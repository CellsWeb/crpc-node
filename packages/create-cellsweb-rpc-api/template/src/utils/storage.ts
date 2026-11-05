/**
 * utils/storage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Dual-mode file storage utility — supports "local" disk or "s3" (AWS / R2 / Wasabi / MinIO).
 * Mode is selected via UPLOAD_MODE environment variable.
 */

import path from "node:path";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { env } from "../env";

export type StorageMode = "local" | "s3";

export interface UploadResult {
  url: string;        // Domain-agnostic relative URL (e.g. "uploads/products/filename.jpg")
  fullUrl: string;    // Absolute URL (prefixed with SERVER_URL or S3/R2 public URL)
  path: string;       // Relative storage path or S3 key (for deletion)
  name: string;       // Final sanitized filename
}

/**
 * Normalizes any image URL or path into a relative storage path (e.g. "uploads/products/filename.jpg").
 * Domain-agnostic so database records never contain hardcoded IP/hostnames for local files.
 * External S3/R2/CDN URLs are returned as-is.
 */
export function toRelativeImageUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl || pathOrUrl === "-") return "";
  if (typeof pathOrUrl !== "string") return "";

  const trimmed = pathOrUrl.trim();
  if (!trimmed || trimmed === "-") return "";

  // If local uploads path (even from a previous IP/domain/SERVER_URL), convert to relative path
  if (trimmed.includes("/uploads/")) {
    const relPath = trimmed.split("/uploads/")[1];
    return `uploads/${relPath.replace(/^\/+/, "")}`;
  }

  // If already relative uploads path
  if (trimmed.startsWith("uploads/")) {
    return trimmed;
  }

  // External S3 / R2 / CDN URL — return unchanged
  return trimmed;
}

/**
 * Resolves any relative path or full URL into a valid client-accessible URL.
 * - If input is an external S3/R2/CDN URL, returns it unchanged.
 * - If input is a relative local path or contains an old SERVER_URL /uploads/, rebinds it dynamically to current env.SERVER_URL.
 */
export function resolveImageUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl || pathOrUrl === "-") return "";

  const serverUrl = (env.SERVER_URL || "http://localhost:4000").replace(/\/$/, "");

  // 1. If it points to local uploads path (even from a previous IP/domain), rebind to current SERVER_URL
  if (pathOrUrl.includes("/uploads/")) {
    const relPath = pathOrUrl.split("/uploads/")[1];
    return `${serverUrl}/uploads/${relPath.replace(/^\/+/, "")}`;
  }

  // 2. If it is an internal R2 S3 endpoint (r2.cloudflarestorage.com), resolve to public access
  if (pathOrUrl.includes("r2.cloudflarestorage.com")) {
    const match = pathOrUrl.match(/r2\.cloudflarestorage\.com\/[^/]+\/(.+)$/i);
    const key = match ? match[1] : pathOrUrl.split("/").slice(-2).join("/");

    if (env.S3_PUBLIC_URL) {
      const basePublic = env.S3_PUBLIC_URL.replace(/\/$/, "");
      return `${basePublic}/${key}`;
    }
    // Fallback: proxy through server /uploads/ route
    return `${serverUrl}/uploads/${key}`;
  }

  // 3. External HTTP/HTTPS URL (S3, R2, CDN)
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  // 4. Relative path (e.g. "uploads/products/image.jpg" or "products/image.jpg")
  let clean = pathOrUrl.replace(/^\/+/, "");
  if (!clean.startsWith("uploads/")) {
    clean = `uploads/${clean}`;
  }
  return `${serverUrl}/${clean}`;
}

// ─── Sanitize filename ────────────────────────────────────────────────────────

function sanitizeFilename(original: string): string {
  const ext = path.extname(original);
  const base = path.basename(original, ext).replace(/[^a-z0-9._-]/gi, "_");
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${base}_${timestamp}_${rand}${ext}`;
}

// ─── Local storage ────────────────────────────────────────────────────────────

function getUploadRoot(): string {
  const configured = env.UPLOAD_DIR || "public/uploads";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

function cleanStoragePath(inputPath: string): string {
  let p = inputPath;
  try {
    p = decodeURIComponent(p);
  } catch {}

  const serverUrl = (env.SERVER_URL || "http://localhost:4000").replace(/\/$/, "");

  if (p.startsWith(serverUrl)) {
    p = p.substring(serverUrl.length);
  } else {
    p = p.replace(/^https?:\/\/[^/]+/i, "");
  }

  p = p.split("?")[0].split("#")[0];
  p = p.replace(/\\/g, "/");

  while (/^\/?(uploads?\/|\/)/i.test(p)) {
    p = p.replace(/^\/?(uploads?\/|\/)/i, "");
  }

  return p;
}

async function localUpload(
  buffer: Buffer,
  originalName: string,
  dir: string = "",
): Promise<UploadResult> {
  const uploadRoot = getUploadRoot();
  const safeName = sanitizeFilename(originalName);
  const relDir = dir.replace(/^\/+/, "");
  const savePath = path.join(uploadRoot, relDir, safeName);
  const dirPath = path.dirname(savePath);

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(savePath, buffer);

  const relativePath = relDir ? `${relDir}/${safeName}` : safeName;
  const normalizedRelPath = relativePath.replace(/\\/g, "/");
  const relUrl = `uploads/${normalizedRelPath}`;

  return {
    url: relUrl,
    fullUrl: resolveImageUrl(relUrl),
    path: normalizedRelPath,
    name: safeName,
  };
}

async function localDelete(relativePath: string): Promise<boolean> {
  try {
    const uploadRoot = getUploadRoot();
    const clean = cleanStoragePath(relativePath);
    const fullPath = path.join(uploadRoot, clean);
    const resolved = path.resolve(fullPath);
    const root = path.resolve(uploadRoot) + path.sep;

    // Security: prevent directory traversal
    if (!resolved.startsWith(root) && resolved !== path.resolve(uploadRoot)) {
      return false;
    }

    if (existsSync(fullPath)) {
      await fs.unlink(fullPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function localServe(relativePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const { default: mime } = await import("mime-types");
    const uploadRoot = getUploadRoot();
    const clean = cleanStoragePath(relativePath);

    const fullPath = path.join(uploadRoot, clean);

    const resolved = path.resolve(fullPath);
    const root = path.resolve(uploadRoot) + path.sep;
    if (!resolved.startsWith(root) && resolved !== path.resolve(uploadRoot)) return null;
    if (!existsSync(fullPath)) return null;

    const buffer = await fs.readFile(fullPath);
    const mimeType = mime.lookup(fullPath) || "application/octet-stream";
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

// ─── S3 Storage Integration (@aws-sdk/client-s3) ─────────────────────────────

let s3ClientInstance: any = null;

async function getS3Client() {
  if (s3ClientInstance) return { s3: s3ClientInstance, bucket: env.S3_BUCKET! };

  if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
    throw new Error(
      "S3 upload failed: Missing required S3 environment variables (S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY).",
    );
  }

  try {
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3ClientInstance = new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
    });
    return { s3: s3ClientInstance, bucket: env.S3_BUCKET };
  } catch {
    throw new Error(
      "S3 upload failed: @aws-sdk/client-s3 package is not installed. Run `pnpm add @aws-sdk/client-s3` to enable S3 storage.",
    );
  }
}

async function s3Upload(
  buffer: Buffer,
  originalName: string,
  dir: string = "",
): Promise<UploadResult> {
  const { default: mime } = await import("mime-types");
  const { s3, bucket } = await getS3Client();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");

  const safeName = sanitizeFilename(originalName);
  const relDir = dir.replace(/^\/+/, "");
  const key = relDir ? `${relDir}/${safeName}` : safeName;
  const contentType = mime.lookup(originalName) || "application/octet-stream";

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  let publicUrl = "";
  if (env.S3_PUBLIC_URL) {
    const basePublic = env.S3_PUBLIC_URL.replace(/\/$/, "");
    publicUrl = `${basePublic}/${key}`;
  } else if (env.S3_ENDPOINT) {
    if (env.S3_ENDPOINT.includes("r2.cloudflarestorage.com")) {
      const serverUrl = (env.SERVER_URL || "http://localhost:4000").replace(/\/$/, "");
      publicUrl = `${serverUrl}/uploads/${key}`;
    } else {
      const baseEndpoint = env.S3_ENDPOINT.replace(/\/$/, "");
      publicUrl = `${baseEndpoint}/${bucket}/${key}`;
    }
  } else {
    const region = env.S3_REGION || "us-east-1";
    publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  return {
    url: publicUrl,
    fullUrl: publicUrl,
    path: key,
    name: safeName,
  };
}

async function s3Delete(relativePath: string): Promise<boolean> {
  try {
    const { s3, bucket } = await getS3Client();
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const cleanKey = cleanStoragePath(relativePath);

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: cleanKey,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

async function s3Serve(relativePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const { default: mime } = await import("mime-types");
    const { s3, bucket } = await getS3Client();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const cleanKey = cleanStoragePath(relativePath);

    const res = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: cleanKey,
      }),
    );

    if (!res.Body) return null;
    const byteArray = await res.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);
    const mimeType = res.ContentType || mime.lookup(cleanKey) || "application/octet-stream";
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

// ─── Dynamic .gitignore Initialization for Local Mode ─────────────────────────

const mode: StorageMode = (env.UPLOAD_MODE || "local") as StorageMode;

async function ensureStorageGitignore(): Promise<void> {
  if (mode !== "local") return;

  try {
    const uploadRoot = getUploadRoot();
    await fs.mkdir(uploadRoot, { recursive: true });

    const gitignorePath = path.join(uploadRoot, ".gitignore");
    if (!existsSync(gitignorePath)) {
      const gitignoreContent = `# Ignore all uploaded media files in this directory\n*\n!.gitignore\n`;
      await fs.writeFile(gitignorePath, gitignoreContent, "utf8");
    }
  } catch {}
}

ensureStorageGitignore().catch(() => {});

export const storage = {
  mode,

  upload: (buffer: Buffer, originalName: string, dir: string = "") =>
    mode === "s3" ? s3Upload(buffer, originalName, dir) : localUpload(buffer, originalName, dir),

  delete: (relativePath: string) =>
    mode === "s3" ? s3Delete(relativePath) : localDelete(relativePath),

  serve: (relativePath: string) =>
    mode === "s3" ? s3Serve(relativePath) : localServe(relativePath),
};
