import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "logos");
const cloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
} else {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.warn(
    "[storage] Cloudinary is not configured — falling back to local disk storage at " +
      UPLOAD_DIR +
      ". This is fine for local development but not for serverless/production hosting " +
      "(the filesystem is ephemeral there). Set CLOUDINARY_* env vars before deploying."
  );
}

export interface UploadResult {
  url: string;
  storageId: string;
}

export async function uploadCompanyLogo(
  buffer: Buffer,
  originalName: string
): Promise<UploadResult> {
  if (cloudinaryConfigured) {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "parking-system/company-logos", resource_type: "image" },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result);
        }
      );
      stream.end(buffer);
    });
    return { url: result.secure_url, storageId: result.public_id };
  }

  const safeName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  await fs.promises.writeFile(filePath, buffer);
  return { url: `/uploads/logos/${safeName}`, storageId: safeName };
}

export async function deleteCompanyLogo(storageId: string): Promise<void> {
  if (cloudinaryConfigured) {
    await cloudinary.uploader.destroy(storageId).catch(() => undefined);
    return;
  }
  const filePath = path.join(UPLOAD_DIR, storageId);
  await fs.promises.unlink(filePath).catch(() => undefined);
}

export { UPLOAD_DIR };
