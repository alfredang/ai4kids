import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getCredential } from "./secrets";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  endpoint: string;
};

export async function getR2Config(): Promise<R2Config | null> {
  const [accountId, accessKeyId, secretAccessKey, bucket, publicUrl, endpoint] = await Promise.all([
    getCredential("r2_account_id"),
    getCredential("r2_access_key_id"),
    getCredential("r2_secret_access_key"),
    getCredential("r2_bucket"),
    getCredential("r2_public_url"),
    getCredential("r2_endpoint"),
  ]);
  if (!accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  return {
    accountId: accountId ?? "",
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ""),
    endpoint: (endpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).replace(/\/+$/, ""),
  };
}

export function r2Client(cfg: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

/** Upload a buffer to R2. Returns the public URL. */
export async function uploadToR2(
  cfg: R2Config,
  key: string,
  body: Buffer,
  contentType?: string,
): Promise<string> {
  const client = r2Client(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${cfg.publicUrl}/${key}`;
}

export async function deleteFromR2(cfg: R2Config, key: string): Promise<void> {
  const client = r2Client(cfg);
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

