import { AppError, ErrorCode } from "../errors";

const MAX_IDENTIFIER_LENGTH = 128;
const IDENTIFIER_REGEX = /^[a-zA-Z0-9_]+([.-][a-zA-Z0-9_]+)*$/;
const FORBIDDEN_IDENTIFIERS = new Set(["__proto__", "prototype", "constructor"]);

export function validateRoutingIdentifier(
  val: unknown,
  fieldName: "namespace" | "functionName",
  payloadType: "JSON body" | "multipart payload" = "JSON body",
): string {
  if (typeof val !== "string" || !val.trim()) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      `Missing or invalid "${fieldName}" field in ${payloadType}`,
    );
  }

  const trimmed = val.trim();

  if (trimmed.length > MAX_IDENTIFIER_LENGTH) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      `Field "${fieldName}" exceeds maximum allowed length of ${MAX_IDENTIFIER_LENGTH} characters`,
    );
  }

  if (FORBIDDEN_IDENTIFIERS.has(trimmed)) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      `Forbidden "${fieldName}" identifier: "${trimmed}"`,
    );
  }

  if (!IDENTIFIER_REGEX.test(trimmed)) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      `Invalid characters in "${fieldName}". Only alphanumeric characters, dots, underscores, and hyphens are allowed.`,
    );
  }

  return trimmed;
}
