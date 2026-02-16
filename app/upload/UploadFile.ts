"use server";
import { revalidatePath } from "next/cache";
import { Storage } from "@google-cloud/storage";
import { z } from "zod";

const EnvSchema = z.object({
  GCP_BUCKET_NAME: z.string().min(1, "バケット名が設定されていません"),
});
export async function uploadFile(formData: FormData) {
    const file = formData.get("file") as File;
    if (file && file.size > 0) {
        const data = await file.arrayBuffer();
        const buffer = Buffer.from(data);
        const storage = new Storage();
        const bucket = storage.bucket(process.env.GCP_BUCKET_NAME ?? "");

        const blob = bucket.file(file.name);
        await blob.save(buffer);

        console.log("File uploaded successfully", file.name);
        revalidatePath("/upload");
    }
}