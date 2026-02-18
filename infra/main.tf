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