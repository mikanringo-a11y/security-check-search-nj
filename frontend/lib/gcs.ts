import { Storage } from "@google-cloud/storage";
const base64Credentials = process.env.GCP_CREDENTIALS_BASE64;
if (!base64Credentials) {
    throw new Error("GCP_CREDENTIALS_BASE64 が設定されていません");
}
const decodedString = Buffer.from(base64Credentials, 'base64').toString('utf-8');
const credentials = JSON.parse(decodedString);
const projectId = credentials.project_id;
const clientEmail = credentials.client_email;
const privateKey = credentials.private_key;

if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing required GCP environment variables");}

export const storage = new Storage ({
    projectId,
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    },
})

const bucketName = process.env.GCP_BUCKET_NAME;
if (!bucketName) {
    throw new Error("GCP_BUCKET_NAME が設定されていません");
}
export const bucket = storage.bucket(bucketName);