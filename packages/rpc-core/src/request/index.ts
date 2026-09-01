import type { IncomingMessage } from "node:http";
import { AppError, ErrorCode } from "../errors";
import { detectRequestKind } from "./content-type";
import { parseJsonRequest } from "./json";
import { parseMultipartRequest } from "./multipart";

export interface ParsedRpcRequest {
  readonly kind: "json" | "multipart";
  readonly namespace: string;
  readonly functionName: string;
  readonly data: Record<string, unknown>;
  readonly tempFilesToCleanup: string[];
}

export async function parseRpcRequest(req: IncomingMessage | any): Promise<ParsedRpcRequest> {
  const headers = req.headers ?? req.raw?.headers ?? {};
  const contentType = headers["content-type"];
  let kind = detectRequestKind(contentType);

  const preParsed =
    req.body ??
    (req as any).rawBody ??
    (req.raw && (req.raw as any).body) ??
    (req.raw && (req.raw as any).rawBody);

  // If content-type header is not explicitly application/json, but a pre-parsed body exists, default to json
  if (kind === "unknown" && preParsed !== undefined && preParsed !== null) {
    kind = "json";
  }

  if (kind === "json") {
    const parsed = await parseJsonRequest(req);
    return {
      kind: "json",
      namespace: parsed.namespace,
      functionName: parsed.functionName,
      data: parsed.data,
      tempFilesToCleanup: [],
    };
  }

  if (kind === "multipart") {
    const parsed = await parseMultipartRequest(req);
    return {
      kind: "multipart",
      namespace: parsed.namespace,
      functionName: parsed.functionName,
      data: parsed.data,
      tempFilesToCleanup: parsed.tempFilesToCleanup,
    };
  }

  throw new AppError(
    ErrorCode.INVALID_CONTENT_TYPE,
    `Unsupported Content-Type "${contentType ?? "none"}". Expected application/json or multipart/form-data.`,
  );
}
