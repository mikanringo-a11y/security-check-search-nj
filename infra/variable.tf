variable "project_id" {
  description = "The ID of the project in which to provision resources."
  type        = string
  default = "welcome-study-sakamoto"
}
variable "region" {
  description = "The region in which to provision resources."
  type        = string
  default = "asia-northeast1"

}
variable "bucket_name" {
    description = "The name of the GCS bucket to create."
    type        = string
    default = "welcome-study-sakamoto-bucket" 
}