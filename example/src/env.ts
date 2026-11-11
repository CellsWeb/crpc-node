import "dotenv/config";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const EnvSchema = Type.Object({
  NODE_ENV: Type.Optional(Type.Union([
    Type.Literal("development"),
    Type.Literal("test"),
    Type.Literal("production"),
  ], { default: "development" })),

  API_PORT: Type.Optional(Type.Number({ default: 4000 })),
  API_HOST: Type.Optional(Type.String({ default: "0.0.0.0" })),
  API_REQUEST_TIMEOUT_MS: Type.Optional(Type.Number({ default: 30000 })),
  API_LOG_LEVEL: Type.Optional(Type.String({ default: "info" })),
  API_DOCS_ENABLED: Type.Optional(Type.Boolean({ default: false })),

  MAX_JSON_BODY_BYTES: Type.Optional(Type.Number({ default: 1_048_576 })),
  MAX_MULTIPART_BYTES: Type.Optional(Type.Number({ default: 25_000_000 })),
  MAX_UPLOAD_FILE_BYTES: Type.Optional(Type.Number({ default: 10_000_000 })),
  UPLOAD_TMP_DIR: Type.Optional(Type.String()),

  UPLOAD_MODE: Type.Optional(Type.Union([
    Type.Literal("local"),
    Type.Literal("s3"),
  ], { default: "local" })),
  UPLOAD_DIR: Type.Optional(Type.String({ default: "public/uploads" })),
  SERVER_URL: Type.Optional(Type.String({ default: "http://localhost:4000" })),

  S3_BUCKET: Type.Optional(Type.String()),
  S3_REGION: Type.Optional(Type.String()),
  S3_ACCESS_KEY: Type.Optional(Type.String()),
  S3_SECRET_KEY: Type.Optional(Type.String()),
  S3_ENDPOINT: Type.Optional(Type.String()),

  SENTRY_DSN: Type.Optional(Type.String()),
  TELEMETRY_ENABLED: Type.Optional(Type.Boolean({ default: true })),
});

export type Env = Static<typeof EnvSchema>;

function numberFromEnv(value: unknown, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return parsed;
}

function booleanFromEnv(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const str = String(value).trim().toLowerCase();
  if (str === "true" || str === "1") return true;
  if (str === "false" || str === "0") return false;
  return fallback;
}

function parseEnv(): Env {
  const raw: Record<string, unknown> = { ...process.env };
  raw.NODE_ENV ??= "development";
  raw.API_PORT = numberFromEnv(raw.API_PORT, 4000);
  raw.API_HOST ??= "0.0.0.0";
  raw.API_REQUEST_TIMEOUT_MS = numberFromEnv(raw.API_REQUEST_TIMEOUT_MS, 30000);
  raw.MAX_JSON_BODY_BYTES = numberFromEnv(raw.MAX_JSON_BODY_BYTES, 1_048_576);
  raw.MAX_MULTIPART_BYTES = numberFromEnv(raw.MAX_MULTIPART_BYTES, 25_000_000);
  raw.MAX_UPLOAD_FILE_BYTES = numberFromEnv(raw.MAX_UPLOAD_FILE_BYTES, 10_000_000);
  raw.UPLOAD_MODE ??= "local";
  raw.UPLOAD_DIR ??= "public/uploads";
  raw.SERVER_URL ??= "http://localhost:4000";
  raw.API_DOCS_ENABLED = booleanFromEnv(raw.API_DOCS_ENABLED, false);
  raw.TELEMETRY_ENABLED = booleanFromEnv(raw.TELEMETRY_ENABLED, true);

  const withDefaults = (Value as any).Default
    ? (Value as any).Default(EnvSchema, raw)
    : Value.Cast(EnvSchema, raw);

  if (!Value.Check(EnvSchema, withDefaults)) {
    const errors = [...Value.Errors(EnvSchema, withDefaults)];
    const message = errors.map((e) => `${e.path || "/"}: ${e.message}`).join("\n");
    throw new Error(`Environment validation failed:\n${message}`);
  }

  return withDefaults as Env;
}

export const env = parseEnv();

declare global {
  // eslint-disable-next-line no-var
  var env: Env;
}

globalThis.env = env;
