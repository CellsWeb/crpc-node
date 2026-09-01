export type RequestKind = "json" | "multipart" | "unknown";

export function detectRequestKind(contentTypeHeader: string | undefined): RequestKind {
  if (!contentTypeHeader) return "unknown";

  const normalized = contentTypeHeader.trim().toLowerCase();

  if (normalized.includes("application/json")) {
    return "json";
  }

  if (normalized.includes("multipart/form-data")) {
    return "multipart";
  }

  return "unknown";
}
