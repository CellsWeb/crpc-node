import pino from "pino";

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  Boolean(process.env.VITEST);

const level =
  process.env.API_LOG_LEVEL ?? (isTestEnv ? "silent" : "info");

export const logger = pino({
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export function logRequestSuccess(
  requestId: string,
  key: string,
  durationMs: number,
): void {
  logger.info({ requestId, key, durationMs }, "request completed");
}

export function logRequestError(
  requestId: string,
  code: string,
  message: string,
  durationMs: number,
  err?: unknown,
): void {
  logger.info(
    { requestId, code, message, durationMs, err },
    "request error",
  );
}

export function logSystemError(msg: string, err?: unknown): void {
  logger.error({ err }, msg);
}
