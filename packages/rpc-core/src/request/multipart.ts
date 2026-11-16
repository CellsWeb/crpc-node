import type { IncomingMessage } from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import busboy from "busboy";
import { createId } from "@paralleldrive/cuid2";
import mime from "mime-types";
import { AppError, ErrorCode } from "../errors";
import { UploadedFile } from "../uploads/types";
import { validateRoutingIdentifier } from "./routing";

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

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

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

export async function parseMultipartStream(
  req: IncomingMessage | any,
  maxMultipartBytes?: number,
  maxSingleFileBytes?: number,
  onBeforeFileSave?: (fields: Record<string, string | string[]>) => Promise<void>,
): Promise<MultipartStreamResult> {
  const maxTotal =
    maxMultipartBytes ??
    (process.env.MAX_MULTIPART_BYTES ? Number(process.env.MAX_MULTIPART_BYTES) : 25_000_000);
  const maxFile =
    maxSingleFileBytes ??
    (process.env.MAX_UPLOAD_FILE_BYTES ? Number(process.env.MAX_UPLOAD_FILE_BYTES) : 10_000_000);

  const fields: Record<string, string | string[]> = Object.create(null);
  const files: Record<string, UploadedFile | UploadedFile[]> = Object.create(null);
  const tempFilesToCleanup: string[] = [];

  const tmpDir = process.env.UPLOAD_TMP_DIR ?? path.join(os.tmpdir(), "cellsweb-uploads");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  }

  const rawReq = req.raw ?? req;
  const headers = req.headers ?? rawReq.headers ?? {};

  const bb = busboy({
    headers,
    limits: {
      fileSize: maxFile,
      files: 20,
      fields: 100,
      fieldSize: 1024 * 1024, // 1MB per field
      parts: 150,
    },
  });

  return new Promise((resolve, reject) => {
    let totalBytesRead = 0;
    let aborted = false;
    const activeStreams = new Set<fs.WriteStream>();
    const filePromises: Promise<void>[] = [];

    const onReqClose = () => {
      if (!rawReq.complete && !aborted) {
        abortAll(new AppError(ErrorCode.INVALID_BODY, "Client disconnected before multipart upload completed"));
      }
    };
    const onReqError = (err: Error) => {
      abortAll(err);
    };

    if (typeof rawReq.on === "function") {
      rawReq.on("close", onReqClose);
      rawReq.on("error", onReqError);
    }

    const abortAll = (err: Error) => {
      if (aborted) return;
      aborted = true;

      if (typeof rawReq.removeListener === "function") {
        rawReq.removeListener("close", onReqClose);
        rawReq.removeListener("error", onReqError);
      }

      try {
        rawReq.unpipe(bb);

        let drainedBytes = 0;
        const MAX_DRAIN_BYTES = 512 * 1024; // 512KB drain ceiling allows HTTP error response flush

        let drainTimer: NodeJS.Timeout | undefined;

        const cleanupDrainListeners = () => {
          if (drainTimer) {
            clearTimeout(drainTimer);
            drainTimer = undefined;
          }
          if (typeof rawReq.removeListener === "function") {
            rawReq.removeListener("data", onDrainData);
            rawReq.removeListener("end", onDrainDone);
            rawReq.removeListener("close", onDrainDone);
            rawReq.removeListener("error", onDrainDone);
          }
        };

        const onDrainData = (chunk: Buffer) => {
          drainedBytes += chunk ? chunk.length : 0;
          if (drainedBytes > MAX_DRAIN_BYTES) {
            cleanupDrainListeners();
            if (typeof rawReq.destroy === "function") {
              rawReq.destroy();
            }
          }
        };

        const onDrainDone = () => {
          cleanupDrainListeners();
        };

        if (typeof rawReq.on === "function") {
          rawReq.on("data", onDrainData);
          rawReq.on("end", onDrainDone);
          rawReq.on("close", onDrainDone);
          rawReq.on("error", onDrainDone);
        }

        if (typeof rawReq.resume === "function") {
          rawReq.resume();
        }

        // Enforce 2000ms deadline to safely close socket if rejected request remains incomplete
        drainTimer = setTimeout(() => {
          cleanupDrainListeners();
          if (!rawReq.complete && typeof rawReq.destroy === "function") {
            try {
              rawReq.destroy();
            } catch {}
          }
        }, 2000);
        if (drainTimer.unref) drainTimer.unref();
      } catch {}

      for (const ws of activeStreams) {
        try {
          ws.destroy();
        } catch {}
      }
      activeStreams.clear();

      cleanupTempFiles(tempFilesToCleanup);
      reject(err);
    };

    bb.on("filesLimit", () => {
      abortAll(new AppError(ErrorCode.PAYLOAD_TOO_LARGE, "Exceeded maximum allowed files limit (20)"));
    });

    bb.on("fieldsLimit", () => {
      abortAll(new AppError(ErrorCode.PAYLOAD_TOO_LARGE, "Exceeded maximum allowed fields limit (100)"));
    });

    bb.on("partsLimit", () => {
      abortAll(new AppError(ErrorCode.PAYLOAD_TOO_LARGE, "Exceeded maximum allowed parts limit (150)"));
    });

    bb.on("field", (name, val) => {
      if (aborted || FORBIDDEN_KEYS.has(name)) return;

      const fieldBytes = Buffer.byteLength(name) + Buffer.byteLength(val);
      totalBytesRead += fieldBytes;

      if (totalBytesRead > maxTotal) {
        abortAll(
          new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `Total multipart payload size exceeds maximum limit of ${maxTotal} bytes`,
          ),
        );
        return;
      }

      const existing = fields[name];
      if (existing === undefined) {
        fields[name] = val;
      } else if (Array.isArray(existing)) {
        existing.push(val);
      } else {
        fields[name] = [existing, val];
      }
    });

    let preAuthVerified = false;

    bb.on("file", async (fieldname, fileStream, info) => {
      if (aborted || FORBIDDEN_KEYS.has(fieldname)) {
        fileStream.resume();
        return;
      }

      const hasHeaderRouting =
        Boolean(headers["x-crpc-namespace"] ?? headers["X-CRPC-Namespace"]) &&
        Boolean(headers["x-crpc-function"] ?? headers["X-CRPC-Function"]);

      if (!hasHeaderRouting) {
        if (!fields.namespace || !fields.functionName) {
          fileStream.resume();
          abortAll(
            new AppError(
              ErrorCode.INVALID_BODY,
              "Routing fields ('namespace', 'functionName') must appear before file parts in multipart payload",
            ),
          );
          return;
        }

        if (Array.isArray(fields.namespace) || Array.isArray(fields.functionName)) {
          fileStream.resume();
          abortAll(
            new AppError(
              ErrorCode.INVALID_BODY,
              "Duplicate routing fields ('namespace' or 'functionName') in multipart payload",
            ),
          );
          return;
        }

        if (!preAuthVerified && onBeforeFileSave) {
          try {
            fileStream.pause();
            if (typeof rawReq.pause === "function") rawReq.pause();
            await onBeforeFileSave(fields);
            preAuthVerified = true;
            if (typeof rawReq.resume === "function") rawReq.resume();
            fileStream.resume();
          } catch (err) {
            fileStream.resume();
            abortAll(err as Error);
            return;
          }
        }
      }

      const { filename, mimeType } = info;
      const rawFilename = typeof filename === "string" && filename ? filename : "file";
      const cleanFilename = path.basename(rawFilename).replace(/[\x00-\x1f\x7f/\\]/g, "_");
      const declaredMime = mimeType ? mimeType.split(";")[0].trim().toLowerCase() : "application/octet-stream";
      const rawMime =
        mimeType && mimeType !== "application/octet-stream"
          ? mimeType
          : (mime.lookup(cleanFilename) || "application/octet-stream");
      const detectedMime = rawMime.split(";")[0].trim().toLowerCase();

      const uniqueName = `${createId()}-${cleanFilename || "file"}`;
      const savePath = path.join(tmpDir, uniqueName);
      tempFilesToCleanup.push(savePath);

      const writeStream = fs.createWriteStream(savePath, { mode: 0o600 });
      activeStreams.add(writeStream);

      const cleanupStream = () => {
        activeStreams.delete(writeStream);
      };

      writeStream.on("finish", cleanupStream);
      writeStream.on("error", cleanupStream);
      writeStream.on("close", cleanupStream);

      let fileByteLength = 0;

      const filePromise = new Promise<void>((resFile, rejFile) => {
        fileStream.on("data", (chunk: Buffer) => {
          if (aborted) return;
          fileByteLength += chunk.length;
          totalBytesRead += chunk.length;

          if (totalBytesRead > maxTotal) {
            fileStream.unpipe();
            writeStream.destroy();
            const err = new AppError(
              ErrorCode.PAYLOAD_TOO_LARGE,
              `Total multipart payload size exceeds maximum limit of ${maxTotal} bytes`,
            );
            rejFile(err);
            abortAll(err);
          }
        });

        fileStream.on("limit", () => {
          writeStream.destroy();
          const err = new AppError(
            ErrorCode.PAYLOAD_TOO_LARGE,
            `File "${filename}" exceeds single file size limit of ${maxFile} bytes`,
          );
          rejFile(err);
          abortAll(err);
        });

        fileStream.pipe(writeStream);

        writeStream.on("finish", () => {
          if (aborted) return;
          const uploaded = new UploadedFile({
            path: savePath,
            filename,
            mimeType: detectedMime,
            declaredMimeType: declaredMime,
            detectedMimeType: detectedMime,
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

        writeStream.on("error", (err) => {
          rejFile(err);
          abortAll(err);
        });
        fileStream.on("error", (err) => {
          rejFile(err);
          abortAll(err);
        });
      });

      filePromise.catch(() => {});
      filePromises.push(filePromise);
    });

    bb.on("error", (err) => {
      abortAll(new AppError(ErrorCode.INVALID_BODY, `Multipart parsing error: ${(err as Error).message}`));
    });

    bb.on("finish", async () => {
      if (aborted) return;
      try {
        await Promise.all(filePromises);
        if (!aborted) {
          if (typeof rawReq.removeListener === "function") {
            rawReq.removeListener("close", onReqClose);
            rawReq.removeListener("error", onReqError);
          }
          resolve({ fields, files, tempFilesToCleanup });
        }
      } catch (err) {
        abortAll(err as Error);
      }
    });

    rawReq.pipe(bb);
  });
}

export function cleanupTempFiles(paths: string[]): Promise<void> | void {
  if (!paths || paths.length === 0) return;
  const p = Promise.allSettled(
    paths.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath);
      } catch {}
    }),
  );
  void p;
}

export function normalizeMultipartPayload(
  result: MultipartStreamResult,
): ParsedMultipartRpcPayload {
  const { fields, files, tempFilesToCleanup } = result;

  let namespace: string;
  let functionName: string;
  try {
    namespace = validateRoutingIdentifier(fields.namespace, "namespace", "multipart payload");
    functionName = validateRoutingIdentifier(fields.functionName, "functionName", "multipart payload");
  } catch (err) {
    cleanupTempFiles(tempFilesToCleanup);
    throw err;
  }

  const data: Record<string, unknown> = Object.create(null);

  for (const [key, val] of Object.entries(fields)) {
    if (key === "namespace" || key === "functionName" || FORBIDDEN_KEYS.has(key)) continue;

    const actualKey =
      key === "_data_namespace"
        ? "namespace"
        : key === "_data_functionName"
        ? "functionName"
        : key;

    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          data[actualKey] = sanitizeParsedJson(JSON.parse(val));
          continue;
        } catch {}
      }
      data[actualKey] = val;
    } else if (Array.isArray(val)) {
      data[actualKey] = val.map((item) => {
        if (typeof item === "string") {
          const trimmed = item.trim();
          if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
          ) {
            try {
              return sanitizeParsedJson(JSON.parse(item));
            } catch {}
          }
        }
        return item;
      });
    } else {
      data[actualKey] = val;
    }
  }

  // Merge files into data. If a field already has string values (e.g. existing image URLs
  // in an images array) and a file was also uploaded under the same key, combine them
  // into a single mixed array: [string, string, ..., UploadedFile, ...].
  for (const [key, fileVal] of Object.entries(files)) {
    if (FORBIDDEN_KEYS.has(key)) continue;

    const actualKey =
      key === "_data_namespace"
        ? "namespace"
        : key === "_data_functionName"
        ? "functionName"
        : key;

    const existing = data[actualKey];
    if (existing === undefined) {
      // No string fields for this key — just use the file(s) directly
      data[actualKey] = fileVal;
    } else {
      // String(s) already present — merge into a single array with the file(s)
      const strPart = Array.isArray(existing) ? existing : [existing];
      const filePart = Array.isArray(fileVal) ? fileVal : [fileVal];
      data[actualKey] = [...strPart, ...filePart];
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
  onBeforeFileSave?: (fields: Record<string, string | string[]>) => Promise<void>,
): Promise<ParsedMultipartRpcPayload> {
  const rawResult = await parseMultipartStream(req, maxMultipartBytes, maxSingleFileBytes, onBeforeFileSave);
  return normalizeMultipartPayload(rawResult);
}
