terraform {
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