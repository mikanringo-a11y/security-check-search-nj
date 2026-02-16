import { Storage } from "@google-cloud/storage";

const projectId = process.env.GCP_PROJECT_ID;
const clientEmail = process.env.GCP_CLIENT_EMAIL;

const privateKey = process.env.GCP_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing required GCP environment variables");}

export const storage = new Storage ({
    projectId,
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    },
})

const bucketName = process.env.GCP_BUCKET_NAME || 'default-bucket-name';
export const bucket = storage.bucket(bucketName);