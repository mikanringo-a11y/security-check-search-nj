import { Storage } from "@google-cloud/storage";


export const storage = new Storage ();

const bucketName = process.env.GCP_BUCKET_NAME;
if (!bucketName) {
    throw new Error("GCP_BUCKET_NAME が設定されていません");
}
export const bucket = storage.bucket(bucketName);