terraform {
    required_version = ">= 1.0"
    backend "gcs" {
    bucket = "welcome-study-sakamoto-tfstate"
    prefix = "terraform/state"
  }
  required_providers {
    google = {
        source = "hashicorp/google"
        version = "~> 5.0"
    }
  }
}
provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_pubsub_topic" "csv_uploads" {
    name = "csv-uploads"
}
resource "google_pubsub_subscription" "ingestion_subscription" {
    name = "ingestion-subscription"
    topic = google_pubsub_topic.csv_uploads.name
  
    ack_deadline_seconds = 20
}
data "google_storage_bucket" "bucket" {
    name = var.bucket_name
}
data "google_storage_project_service_account" "gcs_account"{

}
resource "google_pubsub_topic_iam_member" "gcs_pubsub_publisher" {
    topic = google_pubsub_topic.csv_uploads.name
    role = "roles/pubsub.publisher"
    member = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
  
}
resource "google_storage_notification" "csv_upload_notification" {
    bucket = data.google_storage_bucket.bucket.name
    topic = google_pubsub_topic.csv_uploads.id
    payload_format = "JSON_API_V1"
    event_types = ["OBJECT_FINALIZE"]
    depends_on = [ google_pubsub_topic_iam_member.gcs_pubsub_publisher ]
  
}
# ==========================================
# Artifact Registry (Dockerイメージの保存庫)
# ==========================================
resource "google_artifact_registry_repository" "app_repo" {
  location      = var.region
  repository_id = "security-check-repo"
  description   = "Docker repository for Security Check App (Frontend & Backend)"
  format        = "DOCKER"
}

# ==========================================
# Cloud SQL (PostgreSQL 16)
# ==========================================
# 1. DBパスワードの自動生成（安全のためコードに直書きしない）
resource "random_password" "db_password" {
  length  = 16
  special = true
}

# 2. Cloud SQL インスタンス本体
resource "google_sql_database_instance" "main" {
  name             = "security-check-db-instance"
  database_version = "POSTGRES_16" # ローカルのDockerと同じバージョンに統一
  region           = var.region

  settings {
    # 開発・テスト用のため一番安価で軽量なマシンスペックを指定（本番は適宜上げる）
    tier = "db-f1-micro" 

    ip_configuration {
      ipv4_enabled = true
      # ※将来的にセキュリティをガチガチにする場合は、ipv4_enabled=falseにして
      # プライベートIP（VPC内通信のみ）に絞りますが、まずは疎通確認しやすくしています。
    }
  }

  # 注意: 開発中は terraform destroy で消せるように false にしています。
  # 本番稼働時は誤削除防止のため必ず true に変更してください。
  deletion_protection = false 
}

# 3. データベースの作成
resource "google_sql_database" "database" {
  name     = "security_check" # ローカルと同じDB名
  instance = google_sql_database_instance.main.name
}

# 4. データベースユーザーの作成
resource "google_sql_user" "db_user" {
  name     = "postgres"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# ==========================================
# Outputs (構築後にコンソールに表示したい情報)
# ==========================================
output "artifact_registry_url" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app_repo.name}"
  description = "DockerイメージをPushする際のベースURL"
}

output "cloud_sql_connection_name" {
  value       = google_sql_database_instance.main.connection_name
  description = "Cloud SQL Auth Proxy等で接続する際に使うコネクション名"
}

resource "google_container_cluster" "primary" {
    name     = "security-check-gke-cluster"
    location = var.region
    
    # シングルノードの小規模クラスター（開発用）
    remove_default_node_pool = true
    initial_node_count = 1
    
    deletion_protection = false
    workload_identity_config {
      workload_pool = "${var.project_id}.svc.id.goog"
    }

}
resource "google_container_node_pool" "primary_nodes" {
    name = "security-check-node-pool-v2"
    location = var.region
    cluster = google_container_cluster.primary.name
    node_count = 1
    node_config {
        preemptible = true
        machine_type = "e2-medium"
        oauth_scopes = [
            "https://www.googleapis.com/auth/cloud-platform"
        ]
        workload_metadata_config {
          mode = "GKE_METADATA"
        }
    }
}
# ==========================================
# Workload Identity: フロントエンド用の権限設定
# ==========================================
# 1. フロントエンド用GCPサービスアカウント(GSA)の作成
resource "google_service_account" "frontend_sa" {
  account_id   = "frontend-sa"
  display_name = "Frontend Service Account for GCS Upload"
}

# 2. GCSバケットへの書き込み・読み込み権限を付与
resource "google_storage_bucket_iam_member" "frontend_gcs_admin" {
  bucket = data.google_storage_bucket.bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.frontend_sa.email}"
}

# 3. KSA(Kubernetes Service Account) と GSA の紐付け
# defaultネームスペースの「frontend-ksa」というKSAからのアクセスを許可
resource "google_service_account_iam_member" "workload_identity_binding" {
  service_account_id = google_service_account.frontend_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[default/frontend-ksa]"
}
output "cloud_sql_password" {
  value     = random_password.db_password.result
  sensitive = true
}
# バックエンド用GSAの作成
resource "google_service_account" "backend_sa" {
  account_id   = "backend-sa"
  display_name = "Backend Service Account for Cloud SQL"
}

# Cloud SQL接続権限を付与
resource "google_project_iam_member" "backend_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# KSA (Kubernetes SA) と GSA (Google SA) の紐付け
resource "google_service_account_iam_member" "backend_wi_binding" {
  service_account_id = google_service_account.backend_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[default/backend-ksa]"
}
resource "google_storage_bucket_iam_member" "frontend_storage_creator" {
  bucket = "welcome-study-sakamoto-tfstate" # 実際のバケット名
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.frontend_sa.email}"
}
resource "google_storage_bucket_iam_member" "frontend_storage_viewer" {
  bucket = "welcome-study-sakamoto-tfstate"
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.frontend_sa.email}"
}