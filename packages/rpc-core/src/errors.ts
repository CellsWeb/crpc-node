export enum ErrorCode {
  INVALID_CONTENT_TYPE = "invalid_content_type",
  INVALID_BODY = "invalid_body",
  FUNCTION_NOT_FOUND = "function_not_found",
  VALIDATION_ERROR = "validation_error",
  UNAUTHORIZED = "unauthorized",
  FORBIDDEN = "forbidden",
  RATE_LIMITED = "rate_limited",
  SCHEMA_MISMATCH = "schema_mismatch",
  INTERNAL_ERROR = "internal_error",
  TIMEOUT = "timeout",
  PAYLOAD_TOO_LARGE = "payload_too_large",
}

export interface ClientErrorPayload {
  readonly status: "error";
  readonly code: string;
  readonly message: string;
  readonly meta?: {
    readonly requestId?: string;
    readonly durationMs?: number;
    [key: string]: unknown;
  };
  readonly details?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly internal: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown,
    internal = false,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.internal = internal;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toClientPayload(requestId?: string, durationMs?: number): ClientErrorPayload {
    if (this.internal) {
      return {
        status: "error",
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred on the server.",
        meta: { requestId, durationMs },
      };
    }

    return {
      status: "error",
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
      meta: { requestId, durationMs },
    };
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (err instanceof Error) {
    return new AppError(ErrorCode.INTERNAL_ERROR, err.message, undefined, true);
  }
  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    typeof err === "string" ? err : "Unknown internal error",
    undefined,
    true,
  );
}

export function mapErrorCodeToHttpStatus(code: string): number {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_BODY:
    case ErrorCode.INVALID_CONTENT_TYPE:
    case ErrorCode.SCHEMA_MISMATCH:
      return 400;
    case ErrorCode.UNAUTHORIZED:
      return 401;
    case ErrorCode.FORBIDDEN:
      return 403;
    case ErrorCode.FUNCTION_NOT_FOUND:
      return 404;
    case ErrorCode.PAYLOAD_TOO_LARGE:
      return 413;
    case ErrorCode.RATE_LIMITED:
      return 429;
    case ErrorCode.TIMEOUT:
      return 504;
    case ErrorCode.INTERNAL_ERROR:
    default:
      return 500;
  }
}
