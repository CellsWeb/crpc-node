import type { IncomingMessage } from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import busboy from "busboy";
import { createId } from "@paralleldrive/cuid2";
import mime from "mime-types";
import { AppError, ErrorCode } from "../errors";
import { UploadedFile } from "../uploads/types";

export interface MultipartStreamResult {
  readonly fields: Record<string, string | string[]>;
  readonly files: Record<string, UploadedFile | UploadedFile[]>;
  readonly tempFilesToCleanup: string[];
}

export interface ParsedMultipartRpcPayload {
  readonly namespace: string;
  readonly functionName: string;
  readonly data: Record<string, unknown>;
  readonly tempFilesToCleanup: string[];
}

export async function parseMultipartStream(
  req: IncomingMessage | any,
  maxMultipartBytes?: number,
  maxSingleFileBytes?: number,
): Promise<MultipartStreamResult> {
  const maxTotal = maxMultipartBytes ?? (process.env.MAX_MULTIPART_BYTES ? Number(process.env.MAX_MULTIPART_BYTES) : 25_000_000);
  const maxFile = maxSingleFileBytes ?? (process.env.MAX_UPLOAD_FILE_BYTES ? Number(process.env.MAX_UPLOAD_FILE_BYTES) : 10_000_000);

  const fields: Record<string, string | string[]> = {};
  const files: Record<string, UploadedFile | UploadedFile[]> = {};
  const tempFilesToCleanup: string[] = [];

  const tmpDir = process.env.UPLOAD_TMP_DIR ?? path.join(os.tmpdir(), "cellsweb-uploads");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const rawReq = req.raw ?? req;
  const headers = req.headers ?? rawReq.headers ?? {};

  const bb = busboy({
    headers,
    limits: {
      fileSize: maxFile,
    },
  });

  return new Promise((resolve, reject) => {
    let totalBytesRead = 0;
    const filePromises: Promise<void>[] = [];

    bb.on("field", (name, val) => {
      const existing = fields[name];
      if (existing === undefined) {
        fields[name] = val;
      } else if (Array.isArray(existing)) {
        existing.push(val);
      } else {
        fields[name] = [existing, val];
      }
    });

    bb.on("file", (fieldname, fileStream, info) => {
      const { filename, mimeType } = info;
      const detectedMime = mimeType && mimeType !== "application/octet-stream"
        ? mimeType
        : (mime.lookup(filename) || "application/octet-stream");

      const uniqueName = `${createId()}-${path.basename(filename)}`;
      const savePath = path.join(tmpDir, uniqueName);
      tempFilesToCleanup.push(savePath);

      const writeStream = fs.createWriteStream(savePath);
      let fileByteLength = 0;

      const filePromise = new Promise<void>((resFile, rejFile) => {
        fileStream.on("data", (chunk: Buffer) => {
          fileByteLength += chunk.length;
          totalBytesRead += chunk.length;

          if (totalBytesRead > maxTotal) {
            fileStream.unpipe();
            writeStream.destroy();
            rejFile(
              new AppError(
                ErrorCode.PAYLOAD_TOO_LARGE,
                `Total multipart payload size exceeds maximum limit of ${maxTotal} bytes`,
              ),
            );
          }
        });

        fileStream.on("limit", () => {
          writeStream.destroy();
          rejFile(
            new AppError(
              ErrorCode.PAYLOAD_TOO_LARGE,
              `File "${filename}" exceeds single file size limit of ${maxFile} bytes`,
            ),
          );
        });

        fileStream.pipe(writeStream);

        writeStream.on("finish", () => {
          const uploaded = new UploadedFile({
            path: savePath,
            filename,
            mimeType: detectedMime,
            byteLength: fileByteLength,
          });

          const existing = files[fieldname];
          if (!existing) {
            files[fieldname] = uploaded;
          } else if (Array.isArray(existing)) {
            existing.push(uploaded);
          } else {
            files[fieldname] = [existing, uploaded];
          }
          resFile();
        });

        writeStream.on("error", (err) => rejFile(err));
        fileStream.on("error", (err) => rejFile(err));
      });

      filePromises.push(filePromise);
    });

    bb.on("error", (err) => {
      cleanupTempFiles(tempFilesToCleanup);
      reject(new AppError(ErrorCode.INVALID_BODY, `Multipart parsing error: ${(err as Error).message}`));
    });

    bb.on("finish", async () => {
      try {
        await Promise.all(filePromises);
        resolve({ fields, files, tempFilesToCleanup });
      } catch (err) {
        cleanupTempFiles(tempFilesToCleanup);
        reject(err);
      }
    });

    rawReq.pipe(bb);
  });
}

export function cleanupTempFiles(paths: string[]): void {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch {}
  }
}

export function normalizeMultipartPayload(
  result: MultipartStreamResult,
): ParsedMultipartRpcPayload {
  const { fields, files, tempFilesToCleanup } = result;

  const namespace = fields.namespace;
  const functionName = fields.functionName;

  if (typeof namespace !== "string" || !namespace.trim()) {
    cleanupTempFiles(tempFilesToCleanup);
    throw new AppError(
      ErrorCode.INVALID_BODY,
      'Missing or invalid "namespace" form field in multipart payload',
    );
  }

  if (typeof functionName !== "string" || !functionName.trim()) {
    cleanupTempFiles(tempFilesToCleanup);
    throw new AppError(
      ErrorCode.INVALID_BODY,
      'Missing or invalid "functionName" form field in multipart payload',
    );
  }

  const data: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(fields)) {
    if (key === "namespace" || key === "functionName") continue;

    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          data[key] = JSON.parse(val);
          continue;
        } catch {}
      }
      data[key] = val;
    } else if (Array.isArray(val)) {
      data[key] = val.map((item) => {
        if (typeof item === "string") {
          const trimmed = item.trim();
          if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
          ) {
            try {
              return JSON.parse(item);
            } catch {}
          }
        }
        return item;
      });
    } else {
      data[key] = val;
    }
  }

  // Merge files into data. If a field already has string values (e.g. existing image URLs
  // in an images array) and a file was also uploaded under the same key, combine them
  // into a single mixed array: [string, string, ..., UploadedFile, ...].
  for (const [key, fileVal] of Object.entries(files)) {
    const existing = data[key];
    if (existing === undefined) {
      // No string fields for this key — just use the file(s) directly
      data[key] = fileVal;
    } else {
      // String(s) already present — merge into a single array with the file(s)
      const strPart = Array.isArray(existing) ? existing : [existing];
      const filePart = Array.isArray(fileVal) ? fileVal : [fileVal];
      data[key] = [...strPart, ...filePart];
    }
  }

  return {
    namespace: namespace.trim(),
    functionName: functionName.trim(),
    data,
    tempFilesToCleanup,
  };
}

export async function parseMultipartRequest(
  req: IncomingMessage | any,
  maxMultipartBytes?: number,
  maxSingleFileBytes?: number,
): Promise<ParsedMultipartRpcPayload> {
  const rawResult = await parseMultipartStream(req, maxMultipartBytes, maxSingleFileBytes);
  return normalizeMultipartPayload(rawResult);
}
