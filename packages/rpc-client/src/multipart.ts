/**
 * multipart.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatic Form-Data conversion utility supporting Web (File, Blob) &
 * React Native ({ uri, name, type }) file objects.
 *
 * Supported File Placements:
 * - Direct top-level fields: { file: File, avatar: rnFile }
 * - Direct arrays of files:  { gallery: [file1, file2] }
 *
 * Explicitly Rejected (Throws Client Error to Prevent Silent Data Loss):
 * - Files nested inside plain objects: { product: { image: File } }
 * - Files nested in arrays of objects: [{ image: File }]
 */

export function isBlobOrFile(val: unknown): boolean {
  if (typeof Blob !== "undefined" && val instanceof Blob) return true;
  if (typeof File !== "undefined" && val instanceof File) return true;
  return false;
}

/**
 * Detects a React Native local file object: { uri: "file://...", name, type }
 * Must be a local device URI — not a remote http/https URL.
 */
export function isReactNativeFile(val: unknown): boolean {
  if (!val || typeof val !== "object" || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  if (typeof obj.uri !== "string") return false;
  const uri = obj.uri.trim();
  return (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library://") ||
    uri.startsWith("blob:") ||
    uri.startsWith("data:")
  );
}

export function hasMultipartData(val: unknown): boolean {
  if (!val || typeof val !== "object") return false;
  if (isBlobOrFile(val) || isReactNativeFile(val)) return true;
  if (Array.isArray(val)) {
    return val.some(hasMultipartData);
  }
  return Object.values(val as Record<string, unknown>).some(hasMultipartData);
}

/**
 * Builds the { uri, name, type } object that React Native's native bridge
 * requires for file parts. All three fields MUST be non-empty strings.
 */
export function normalizeRnFile(obj: Record<string, any>): { uri: string; name: string; type: string } {
  const uri = String(obj.uri || "").trim();
  const name = String(obj.name || obj.fileName || obj.filename || "upload.jpg").trim() || "upload.jpg";
  const type = String(obj.type || obj.mimeType || obj.contentType || "image/jpeg").trim() || "image/jpeg";

  return { uri, name, type };
}

function safeAppend(formData: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null) return;

  // 1. Web Blob / File
  if (isBlobOrFile(value)) {
    formData.append(key, value as any);
    return;
  }

  // 2. React Native local file object { uri: "file://...", name, type }
  if (isReactNativeFile(value)) {
    const fileObj = normalizeRnFile(value as Record<string, any>);
    formData.append(key, fileObj as any);
    return;
  }

  // 3. Array
  if (Array.isArray(value)) {
    if (hasMultipartData(value)) {
      for (const item of value) {
        if (
          item &&
          typeof item === "object" &&
          !isBlobOrFile(item) &&
          !isReactNativeFile(item) &&
          hasMultipartData(item)
        ) {
          throw new Error(
            `Unsupported nested file structure in array "${key}". Files must be uploaded directly or as direct arrays of files (e.g. gallery: [file1, file2]), not inside nested objects.`,
          );
        }
        safeAppend(formData, key, item);
      }
    } else {
      formData.append(key, JSON.stringify(value));
    }
    return;
  }

  // 4. Plain object → JSON string
  if (typeof value === "object") {
    if (hasMultipartData(value)) {
      throw new Error(
        `Unsupported nested file structure in field "${key}". Files must be uploaded as top-level fields or direct arrays of files (e.g. { file, title: "..." }), not nested inside plain objects.`,
      );
    }
    formData.append(key, JSON.stringify(value));
    return;
  }

  // 5. Primitive → string
  formData.append(key, String(value));
}

export function buildRpcFormData(
  namespace: string,
  functionName: string,
  data?: Record<string, unknown>,
): FormData {
  const formData = new FormData();

  formData.append("namespace", namespace);
  formData.append("functionName", functionName);

  if (!data || typeof data !== "object") {
    return formData;
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const safeKey =
      key === "namespace"
        ? "_data_namespace"
        : key === "functionName"
        ? "_data_functionName"
        : key;
    safeAppend(formData, safeKey, value);
  }

  return formData;
}
