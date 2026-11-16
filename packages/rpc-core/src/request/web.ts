import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import mime from "mime-types";
import { AppError, ErrorCode } from "../errors";
import { UploadedFile } from "../uploads/types";
import { detectRequestKind } from "./content-type";
import type { ParsedRpcRequest } from "./index";
import { cleanupTempFiles } from "./multipart";
import { validateRoutingIdentifier } from "./routing";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_PARTS = 150;
const MAX_FILES = 20;
const MAX_FIELDS = 100;
const MAX_FIELD_SIZE = 1024 * 1024; // 1MB per field

export function normalizeWebHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

function sanitizeParsedJson(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeParsedJson);
  const clean: Record<string, unknown> = Object.create(null);
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    clean[k] = sanitizeParsedJson(v);
  }
  return clean;
}

function ensureValidJsonObject(parsed: unknown): asserts parsed is Record<string, unknown> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      "Expected a top-level JSON object with namespace and functionName",
    );
  }
}

export async function parseWebRequest(
  request: Request,
  options: {
    maxMultipartBytes?: number;
    maxSingleFileBytes?: number;
    maxJsonBytes?: number;
  } = {},
): Promise<ParsedRpcRequest> {
  const contentType = request.headers.get("content-type") ?? "";
  const kind = detectRequestKind(contentType);

  if (kind === "json") {
    let rawText: string;
    try {
      rawText = await request.text();
    } catch (err: unknown) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        `Failed to read JSON request body: ${(err as Error).message}`,
      );
    }

    if (!rawText.trim()) {
      throw new AppError(ErrorCode.INVALID_BODY, "Request body is empty");
    }

    const limit =
      options.maxJsonBytes ??
      (process.env.MAX_JSON_BODY_BYTES
        ? Number(process.env.MAX_JSON_BODY_BYTES)
        : 1_048_576);

    if (Buffer.byteLength(rawText, "utf-8") > limit) {
      throw new AppError(
        ErrorCode.PAYLOAD_TOO_LARGE,
        `JSON request payload exceeds max allowed limit of ${limit} bytes`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new AppError(ErrorCode.INVALID_BODY, "Malformed JSON body");
    }

    ensureValidJsonObject(parsed);

    const namespace = validateRoutingIdentifier(parsed.namespace, "namespace");
    const functionName = validateRoutingIdentifier(parsed.functionName, "functionName");
    const data = parsed.data !== undefined ? parsed.data : {};

    return {
      kind: "json",
      namespace,
      functionName,
      data,
      tempFilesToCleanup: [],
    };
  }

  if (kind === "multipart") {
    const maxTotal =
      options.maxMultipartBytes ??
      (process.env.MAX_MULTIPART_BYTES
        ? Number(process.env.MAX_MULTIPART_BYTES)
        : 25_000_000);
    const maxFile =
      options.maxSingleFileBytes ??
      (process.env.MAX_UPLOAD_FILE_BYTES
        ? Number(process.env.MAX_UPLOAD_FILE_BYTES)
        : 10_000_000);

    const tmpDir = process.env.UPLOAD_TMP_DIR ?? path.join(os.tmpdir(), "cellsweb-uploads");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err: unknown) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        `Failed to parse multipart/form-data: ${(err as Error).message}`,
      );
    }

    const tempFilesToCleanup: string[] = [];
    let namespace: string;
    let functionName: string;

    const nsList = formData.getAll("namespace");
    const fnList = formData.getAll("functionName");
    if (nsList.length > 1 || fnList.length > 1) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        "Duplicate routing fields ('namespace' or 'functionName') in multipart payload",
      );
    }

    try {
      namespace = validateRoutingIdentifier(
        formData.get("namespace"),
        "namespace",
        "multipart payload",
      );
      functionName = validateRoutingIdentifier(
        formData.get("functionName"),
        "functionName",
        "multipart payload",
      );
    } catch (err) {
      throw err;
    }

    const data: Record<string, unknown> = Object.create(null);
    let totalBytes = 0;
    let totalParts = 0;
    let totalFields = 0;
    let totalFiles = 0;

    for (const [key, val] of formData.entries()) {
      totalParts++;
      if (totalParts > MAX_PARTS) {
        cleanupTempFiles(tempFilesToCleanup);
        throw new AppError(
          ErrorCode.PAYLOAD_TOO_LARGE,
          `Multipart request exceeded limit of ${MAX_PARTS} parts`,
        );
      }

      if (key === "namespace" || key === "functionName" || FORBIDDEN_KEYS.has(key)) {
        continue;
      }

      const actualKey =
        key === "_data_namespace"
          ? "namespace"
          : key === "_data_functionName"
          ? "functionName"
          : key;

      if (typeof val === "string") {
        totalFields++;
        if (totalFields > MAX_FIELDS) {
          cleanupTempFiles(tempFilesToCleanup);
          throw new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `Multipart request exceeded limit of ${MAX_FIELDS} fields`,
          );
        }

        const fieldBytes = Buffer.byteLength(val, "utf-8");
        if (fieldBytes > MAX_FIELD_SIZE) {
          cleanupTempFiles(tempFilesToCleanup);
          throw new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `Field "${key}" exceeded maximum field size of ${MAX_FIELD_SIZE} bytes`,
          );
        }

        totalBytes += fieldBytes;
        if (totalBytes > maxTotal) {
          cleanupTempFiles(tempFilesToCleanup);
          throw new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `Total multipart payload size exceeds maximum limit of ${maxTotal} bytes`,
          );
        }

        const trimmed = val.trim();
        let parsedVal: unknown = val;
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            parsedVal = sanitizeParsedJson(JSON.parse(val));
          } catch {}
        }

        const existing = data[actualKey];
        if (existing === undefined) {
          data[actualKey] = parsedVal;
        } else if (Array.isArray(existing)) {
          existing.push(parsedVal);
        } else {
          data[actualKey] = [existing, parsedVal];
        }
      } else if (
        val &&
        typeof val === "object" &&
        typeof (val as any).arrayBuffer === "function"
      ) {
        totalFiles++;
        if (totalFiles > MAX_FILES) {
          cleanupTempFiles(tempFilesToCleanup);
          throw new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `Multipart request exceeded limit of ${MAX_FILES} files`,
          );
        }
        // Web standard File or Blob instance
        const fileObj = val as unknown as {
          name?: string;
          type?: string;
          size: number;
          arrayBuffer: () => Promise<ArrayBuffer>;
        };

        const fileSize = fileObj.size ?? 0;
        totalBytes += fileSize;

        if (fileSize > maxFile) {
          cleanupTempFiles(tempFilesToCleanup);
          throw new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `File "${fileObj.name || "upload"}" exceeds single file size limit of ${maxFile} bytes`,
          );
        }

        if (totalBytes > maxTotal) {
          cleanupTempFiles(tempFilesToCleanup);
          throw new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `Total multipart payload size exceeds maximum limit of ${maxTotal} bytes`,
          );
        }

        const rawFilename = fileObj.name || "file";
        const cleanFilename = path.basename(rawFilename).replace(/[\x00-\x1f\x7f/\\]/g, "_");
        const rawMime =
          fileObj.type && fileObj.type !== "application/octet-stream"
            ? fileObj.type
            : (mime.lookup(cleanFilename) || "application/octet-stream");
        const detectedMime = rawMime.split(";")[0].trim().toLowerCase();

        const uniqueName = `${createId()}-${cleanFilename || "file"}`;
        const savePath = path.join(tmpDir, uniqueName);
        tempFilesToCleanup.push(savePath);

        const arrayBuffer = await fileObj.arrayBuffer();
        await fs.promises.writeFile(savePath, Buffer.from(arrayBuffer), { mode: 0o600 });

        const uploaded = new UploadedFile({
          path: savePath,
          filename: rawFilename,
          mimeType: detectedMime,
          byteLength: fileSize,
        });

        const existing = data[actualKey];
        if (existing === undefined) {
          data[actualKey] = uploaded;
        } else if (Array.isArray(existing)) {
          existing.push(uploaded);
        } else {
          data[actualKey] = [existing, uploaded];
        }
      }
    }

    return {
      kind: "multipart",
      namespace,
      functionName,
      data,
      tempFilesToCleanup,
    };
  }

  throw new AppError(
    ErrorCode.INVALID_CONTENT_TYPE,
    `Unsupported Content-Type "${contentType || "none"}". Expected application/json or multipart/form-data.`,
  );
}
