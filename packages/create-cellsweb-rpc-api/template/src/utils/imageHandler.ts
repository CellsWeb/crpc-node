/**
 * utils/imageHandler.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generic, domain-agnostic file & image processing utility.
 * Works seamlessly with @cellsweb/rpc-core UploadedFile streams, custom buffers, or string URLs.
 * Storage mode agnostic — works for both "local" disk and "s3" modes.
 * Returns relative paths ("uploads/...") for local storage so database entries remain domain-agnostic.
 */
import { UploadedFile } from "@cellsweb/rpc-core";
import { storage, toRelativeImageUrl } from "./storage";

/**
 * Process a single image/file field (UploadedFile instance, buffer object, or URL string).
 * If a new UploadedFile is passed, uploads it to storage and deletes old file if replacing.
 * Normalizes output into a domain-agnostic relative path for local storage.
 */
export async function processImageField(
  imageInput: unknown,
  dir: string = "general",
  existingUrl?: string,
): Promise<string | undefined> {
  if (!imageInput) return existingUrl ? toRelativeImageUrl(existingUrl) : undefined;

  // 1. UploadedFile instance or custom object with toBuffer()
  if (
    imageInput instanceof UploadedFile ||
    (typeof imageInput === "object" && imageInput !== null && "toBuffer" in imageInput)
  ) {
    const file = imageInput as UploadedFile;
    const buffer = await file.toBuffer();
    const filename = file.filename || "upload.jpg";
    const uploaded = await storage.upload(buffer, filename, dir);

    // Delete existing old file if replacing
    if (existingUrl && typeof existingUrl === "string") {
      try {
        await storage.delete(existingUrl);
      } catch {
        // Ignore delete errors if old file doesn't exist
      }
    }
    return toRelativeImageUrl(uploaded.url);
  }

  // 2. Existing URL string
  if (typeof imageInput === "string") {
    return toRelativeImageUrl(imageInput);
  }

  return existingUrl ? toRelativeImageUrl(existingUrl) : undefined;
}

/**
 * Process multiple image/file fields for catalogs, galleries, or attachments.
 * Handles removing deleted file URLs from storage and uploading new file objects.
 * Normalizes output into domain-agnostic relative paths for local storage.
 */
export async function processMultipleImageFields(
  imagesInput: unknown[],
  dir: string = "gallery",
  removeList: string[] = [],
): Promise<string[]> {
  // 1. Delete files specified in removeList from storage
  for (const url of removeList) {
    if (url && typeof url === "string") {
      try {
        await storage.delete(url);
      } catch {
        // Ignore delete errors
      }
    }
  }

  const finalUrls: string[] = [];
  if (!Array.isArray(imagesInput)) return finalUrls;

  for (const item of imagesInput) {
    if (typeof item === "string") {
      // Keep existing URL if it wasn't marked for removal
      if (!removeList.includes(item)) {
        finalUrls.push(toRelativeImageUrl(item));
      }
    } else if (
      item instanceof UploadedFile ||
      (typeof item === "object" && item !== null && "toBuffer" in item)
    ) {
      const file = item as UploadedFile;
      const buffer = await file.toBuffer();
      const filename = file.filename || "upload.jpg";
      const uploaded = await storage.upload(buffer, filename, dir);
      finalUrls.push(toRelativeImageUrl(uploaded.url));
    }
  }

  return finalUrls;
}
