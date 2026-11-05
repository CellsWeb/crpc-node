import { AppError, ErrorCode } from "../errors";

export function getHighResDurationMs(startTime: [number, number]): number {
  const [sec, nanosec] = process.hrtime(startTime);
  return Number((sec * 1000 + nanosec / 1_000_000).toFixed(2));
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = "Operation",
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timerId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        new AppError(
          ErrorCode.TIMEOUT,
          `${operationName} timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}
