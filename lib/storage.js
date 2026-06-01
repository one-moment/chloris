import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function getStorageConfig() {
  return {
    provider: process.env.STORAGE_PROVIDER ?? "inline",
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION ?? "ap-northeast-2",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES)
  };
}

function requireS3Config(config) {
  if (config.provider !== "s3") return;
  if (!config.bucket) throw new Error("S3_BUCKET is required when STORAGE_PROVIDER=s3.");
}

function sanitizeName(name) {
  return String(name ?? "file").replace(/[^a-zA-Z0-9가-힣._-]/g, "_").slice(0, 120);
}

export function publicUrlForKey(key) {
  const config = getStorageConfig();
  if (!config.publicBaseUrl) return null;
  return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
}

export async function createUploadTarget({ fileName, fileType, fileSize, userId }) {
  const config = getStorageConfig();
  if (config.provider !== "s3") {
    return {
      provider: "inline",
      maxUploadBytes: config.maxUploadBytes
    };
  }

  requireS3Config(config);
  if (!fileSize || Number(fileSize) > config.maxUploadBytes) {
    throw new Error(`File must be ${config.maxUploadBytes} bytes or smaller.`);
  }

  const key = `uploads/${userId}/${Date.now()}-${sanitizeName(fileName)}`;
  const client = new S3Client({ region: config.region });
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: fileType || "application/octet-stream"
    }),
    { expiresIn: 300 }
  );

  return {
    provider: "s3",
    key,
    uploadUrl,
    publicUrl: publicUrlForKey(key),
    maxUploadBytes: config.maxUploadBytes
  };
}
