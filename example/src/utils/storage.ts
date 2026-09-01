import fs from "node:fs";
import path from "node:path";
import { env } from "../env";

let s3ClientInstance: any = null;

async function getS3Client() {
  if (s3ClientInstance) return s3ClientInstance;

  if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
    throw new Error(
      "S3 upload failed: Missing required S3 environment variables (S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY).",
    );
  }

  try {
    // Dynamic import allows optional usage without forcing heavy SDK load if local mode is used
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3ClientInstance = new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
    });
    return s3ClientInstance;
  } catch {
    throw new Error(
      "S3 upload failed: @aws-sdk/client-s3 package is not installed. Run `pnpm add @aws-sdk/client-s3` to enable S3 storage.",
    );
  }
}

export const storage = {
  async upload(buffer: Buffer, originalName: string, subDir = ""): Promise<{ url: string; path: string }> {
    const mode = env.UPLOAD_MODE ?? "local";

    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueFileName = `${baseName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

    if (mode === "s3") {
      const client = await getS3Client();
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const key = subDir ? `${subDir.replace(/^\/|\/$/g, "")}/${uniqueFileName}` : uniqueFileName;

      await client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: buffer,
        }),
      );

      const url = env.S3_ENDPOINT
        ? `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`
        : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;

      return { url, path: key };
    }

    // Local mode
    const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR ?? "public/uploads", subDir);
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, uniqueFileName);

    await fs.promises.writeFile(filePath, buffer);

    const relativeUrlPath = path.join("/uploads", subDir, uniqueFileName).replace(/\\/g, "/");
    const url = `${env.SERVER_URL}${relativeUrlPath}`;

    return { url, path: filePath };
  },

  async delete(filePathOrKey: string): Promise<boolean> {
    const mode = env.UPLOAD_MODE ?? "local";

    if (mode === "s3") {
      try {
        const client = await getS3Client();
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        await client.send(
          new DeleteObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: filePathOrKey,
          }),
        );
        return true;
      } catch {
        return false;
      }
    }

    try {
      await fs.promises.unlink(filePathOrKey);
      return true;
    } catch {
      return false;
    }
  },

  async serve(relativePath: string): Promise<{ stream: fs.ReadStream; mimeType: string } | null> {
    const mode = env.UPLOAD_MODE ?? "local";
    if (mode !== "local") return null;

    const baseUploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR ?? "public/uploads");
    const fullPath = path.resolve(baseUploadDir, relativePath);

    if (!fullPath.startsWith(baseUploadDir)) {
      return null;
    }

    try {
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) return null;

      const ext = path.extname(fullPath).toLowerCase();
      let mimeType = "application/octet-stream";
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".gif") mimeType = "image/gif";
      else if (ext === ".webp") mimeType = "image/webp";
      else if (ext === ".pdf") mimeType = "application/pdf";
      else if (ext === ".json") mimeType = "application/json";

      const stream = fs.createReadStream(fullPath);
      return { stream, mimeType };
    } catch {
      return null;
    }
  },
};
