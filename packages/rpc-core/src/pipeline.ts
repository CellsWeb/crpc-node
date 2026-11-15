import type { IncomingMessage } from "node:http";
import type { TSchema } from "@sinclair/typebox";
import { AppError, ErrorCode, isAppError, toAppError } from "./errors";
import { logRequestError, logRequestSuccess, logSystemError } from "./logger";
import type { MiddlewareContext } from "./context";
import type { Registry, RegisteredFunction } from "./registry";
import { getHighResDurationMs, withTimeout } from "./utils/timing";
import { validateSchema } from "./utils/typebox";
import { getGlobalWorkerPool } from "./workers/worker-pool";

export interface PipelineOptions {
  key: string;
  data: unknown;
  headers?: Record<string, unknown>;
  context: MiddlewareContext;
  registry: Registry;
  timeoutMs?: number;
  skipMiddlewares?: boolean;
}

export interface PipelineSuccessResult<T = unknown> {
  status: "ok";
  data: T;
  durationMs: number;
  requestId: string;
  meta: {
    requestId: string;
    durationMs: number;
  };
}

export interface PipelineErrorResult {
  status: "error";
  code: string;
  message: string;
  details?: unknown;
  meta: {
    requestId: string;
    durationMs: number;
  };
}

export type PipelineResult<T = unknown> = PipelineSuccessResult<T> | PipelineErrorResult;

function prepareHeadersForSchema(
  schema: TSchema | undefined,
  headers: Record<string, unknown>,
): Record<string, unknown> {
  if (
    !schema ||
    typeof schema !== "object" ||
    (schema as any).type !== "object" ||
    !(schema as any).properties
  ) {
    return headers;
  }

  const result: Record<string, unknown> = { ...headers };
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(headers)) {
    lowerMap.set(k.toLowerCase(), v);
  }

  for (const propKey of Object.keys((schema as any).properties)) {
    if (result[propKey] === undefined) {
      const match = lowerMap.get(propKey.toLowerCase());
      if (match !== undefined) {
        result[propKey] = match;
      }
    }
  }

  return result;
}

export async function executeMiddlewareChain(
  fnEntry: RegisteredFunction,
  registry: Registry,
  context: MiddlewareContext,
  headers: Record<string, unknown>,
  key: string,
  startTime?: [number, number],
): Promise<MiddlewareContext> {
  const reqStartTime = startTime ?? process.hrtime();
  const requestId = context.requestId;
  let currentContext: MiddlewareContext = context;

  for (const mwConfig of fnEntry.middlewares) {
    const mwEntry = registry.middlewares.get(mwConfig.name);
    if (!mwEntry) {
      logSystemError(
        `Security Boundary Violation: Middleware "${mwConfig.name}" declared on ${key} but not found in registry.`,
      );
      const durationMs = getHighResDurationMs(reqStartTime);
      const err = new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Required middleware "${mwConfig.name}" is not registered on this server`,
      );
      logRequestError(requestId, err.code, err.message, durationMs);
      throw err;
    }

    const preparedMwHeaders = prepareHeadersForSchema(mwEntry.headersSchema, headers);
    if (mwEntry.headersSchema) {
      validateSchema(
        mwEntry.headersSchema,
        preparedMwHeaders,
        `Middleware headers for "${mwConfig.name}"`,
      );
    }

    const mwOptions = mwConfig.options ?? {};
    const validatedOptions = mwEntry.optionsSchema
      ? validateSchema(
          mwEntry.optionsSchema,
          mwOptions,
          `Middleware options for "${mwConfig.name}"`,
        )
      : mwOptions;

    const mwResult = await mwEntry.run(
      {
        headers: preparedMwHeaders as Record<string, unknown>,
        options: validatedOptions,
        function: {
          key,
          namespace: fnEntry.namespace,
          functionName: fnEntry.functionName,
          metadata: fnEntry.metadata,
          contentType: fnEntry.contentType,
        },
      },
      currentContext,
    );

    if (mwResult && typeof mwResult === "object") {
      currentContext = mwResult as MiddlewareContext;
    }
  }

  return currentContext;
}

export async function runPipeline<T = unknown>(
  options: PipelineOptions,
): Promise<PipelineSuccessResult<T>> {
  const startTime = process.hrtime();
  const { key, registry, context } = options;
  const requestId = context.requestId;
  const headers = options.headers ?? {};

  const fnEntry = registry.functions.get(key);
  if (!fnEntry) {
    const durationMs = getHighResDurationMs(startTime);
    const err = new AppError(
      ErrorCode.FUNCTION_NOT_FOUND,
      `Function "${key}" not found in registry`,
    );
    logRequestError(requestId, err.code, err.message, durationMs);
    throw err;
  }

  let currentContext: MiddlewareContext = context;

  // 1. Execute middleware chain (unless already executed during header-based streaming phase)
  if (!options.skipMiddlewares) {
    currentContext = await executeMiddlewareChain(fnEntry, registry, context, headers, key, startTime);
  }

  // 2. Validate function headers
  const preparedFnHeaders = prepareHeadersForSchema(fnEntry.headersSchema, headers);
  if (fnEntry.headersSchema) {
    validateSchema(fnEntry.headersSchema, preparedFnHeaders, `Headers for "${key}"`);
  }

  // 3. Validate function input
  const validatedInput = fnEntry.inputSchema
    ? validateSchema(fnEntry.inputSchema, options.data, `Input for "${key}"`)
    : options.data;

  // 4. Check abort signal before starting function execution
  if (currentContext.signal?.aborted) {
    const durationMs = getHighResDurationMs(startTime);
    const err = new AppError(ErrorCode.INTERNAL_ERROR, "Request was aborted");
    logRequestError(requestId, err.code, err.message, durationMs);
    throw err;
  }

  // 5. Execute function (Worker thread or main thread with timeout)
  const timeoutMs =
    options.timeoutMs ??
    (process.env.API_REQUEST_TIMEOUT_MS
      ? Number(process.env.API_REQUEST_TIMEOUT_MS)
      : 30000);

  let rawResult: unknown;

  if (fnEntry.worker) {
    // Multi-threaded worker execution:
    // Strip non-clonable properties from context before sending to worker thread
    const serializableContext: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(currentContext)) {
      if (k === "req" || typeof v === "function" || v instanceof AbortSignal) continue;
      serializableContext[k] = v;
    }

    const workerPromise = getGlobalWorkerPool().run(
      fnEntry.filePath,
      validatedInput,
      serializableContext,
    );
    rawResult = await withTimeout(workerPromise, timeoutMs, `Function ${key}`);
  } else {
    rawResult = await withTimeout(
      fnEntry.run(validatedInput, currentContext),
      timeoutMs,
      `Function ${key}`,
    );
  }

  // 6. Validate function output
  let validatedOutput = rawResult;
  if (fnEntry.outputSchema) {
    try {
      validatedOutput = validateSchema(
        fnEntry.outputSchema,
        rawResult,
        `Output for "${key}"`,
      );
    } catch (schemaErr) {
      logSystemError(
        `Output schema mismatch — bug in run.ts for function ${key}`,
        schemaErr,
      );
      const durationMs = getHighResDurationMs(startTime);
      const err = new AppError(
        ErrorCode.SCHEMA_MISMATCH,
        "Response schema mismatch — check function run.ts output.",
        isAppError(schemaErr) ? schemaErr.details : undefined,
        false,
      );
      logRequestError(requestId, err.code, err.message, durationMs);
      throw err;
    }
  }

  const durationMs = getHighResDurationMs(startTime);
  logRequestSuccess(requestId, key, durationMs);

  return {
    status: "ok",
    data: validatedOutput as T,
    durationMs,
    requestId,
    meta: {
      requestId,
      durationMs,
    },
  };
}
