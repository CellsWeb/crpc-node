import { createId } from "@paralleldrive/cuid2";
import http, {
  type IncomingMessage,
  type RequestListener,
  type Server,
  type ServerResponse,
} from "node:http";
import type { MiddlewareContext } from "./context";
import { renderDocsHtml } from "./docs/renderer";
import { AppError, ErrorCode, isAppError, toAppError } from "./errors";
import { handleApiRequest } from "./interceptor";
import {
  logger,
  logRequestError,
  logRequestSuccess,
  logSystemError,
} from "./logger";
import { buildRegistry, type Registry } from "./registry";
import {
  createTestCaller,
  type ExecuteOptions,
  type ExecuteResult,
  type TestCaller,
} from "./test-caller";
import { getHighResDurationMs, withTimeout } from "./utils/timing";
import { validateSchema } from "./utils/typebox";

export interface CoreRpcOptions {
  functionsDir?: string;
  middlewaresDir?: string;
  port?: number;
  host?: string;
  docs?: boolean;
  rpcEndpoint?: string;
  docsEndpoint?: string;
  strict?: boolean;
}

function normalizeEndpoint(input: string): string {
  let cleaned = input.trim();
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  if (cleaned.length > 1 && cleaned.endsWith("/"))
    cleaned = cleaned.slice(0, -1);
  return cleaned;
}

export class CoreRPC {
  private options: CoreRpcOptions;
  private registryInstance?: Registry;
  private serverInstance?: Server;

  constructor(options: CoreRpcOptions = {}) {
    const rawRpc =
      options.rpcEndpoint ?? process.env.API_RPC_ENDPOINT ?? "/rpc";
    const rawDocs =
      options.docsEndpoint ?? process.env.API_DOCS_ENDPOINT ?? "/docs";

    this.options = {
      functionsDir: options.functionsDir ?? "src/functions",
      middlewaresDir: options.middlewaresDir ?? "src/middlewares",
      port:
        options.port ??
        (process.env.API_PORT ? Number(process.env.API_PORT) : 4000),
      host: options.host ?? process.env.API_HOST ?? "0.0.0.0",
      docs: options.docs ?? true,
      rpcEndpoint: normalizeEndpoint(rawRpc),
      docsEndpoint: normalizeEndpoint(rawDocs),
      strict: options.strict ?? process.env.NODE_ENV === "production",
    };
  }

  public useFunctions(dir: string): this {
    this.options.functionsDir = dir;
    return this;
  }

  public setFunctionDir(dir: string): this {
    return this.useFunctions(dir);
  }

  public useMiddlewares(dir: string): this {
    this.options.middlewaresDir = dir;
    return this;
  }

  public setMiddlewareDir(dir: string): this {
    return this.useMiddlewares(dir);
  }

  public setPort(port: number): this {
    this.options.port = port;
    return this;
  }

  public setHost(host: string): this {
    this.options.host = host;
    return this;
  }

  public setDocs(docs: boolean): this {
    this.options.docs = docs;
    return this;
  }

  public useRpcEndpoint(endpoint: string): this {
    this.options.rpcEndpoint = normalizeEndpoint(endpoint);
    return this;
  }

  public setRpcEndpoint(endpoint: string): this {
    return this.useRpcEndpoint(endpoint);
  }

  public useDocsEndpoint(endpoint: string): this {
    this.options.docsEndpoint = normalizeEndpoint(endpoint);
    return this;
  }

  public setDocsEndpoint(endpoint: string): this {
    return this.useDocsEndpoint(endpoint);
  }

  public async getRegistry(): Promise<Registry> {
    if (!this.registryInstance) {
      this.registryInstance = await buildRegistry({
        functionsDir: this.options.functionsDir,
        middlewaresDir: this.options.middlewaresDir,
        strict: this.options.strict,
      });
    }
    return this.registryInstance;
  }

  public async createHandler(): Promise<RequestListener> {
    const registry = await this.getRegistry();

    return async (
      req: IncomingMessage | any,
      res: ServerResponse | any,
    ): Promise<void> => {
      const rawReq = req.raw ?? req;
      const rawRes = res.raw ?? res;
      const url = rawReq.url ?? req.url ?? "/";
      const method = rawReq.method ?? req.method ?? "GET";

      const rpcPath = this.options.rpcEndpoint ?? "/rpc";
      const docsPath = this.options.docsEndpoint ?? "/docs";

      if (method === "POST" && (url === rpcPath || url === `${rpcPath}/`)) {
        if (req.body !== undefined && rawReq.body === undefined) {
          rawReq.body = req.body;
        }
        await handleApiRequest(req, res, registry);
        return;
      }

      if (method === "GET" && (url === "/health" || url === "/health/")) {
        rawRes.statusCode = 200;
        if (typeof rawRes.setHeader === "function") {
          rawRes.setHeader("Content-Type", "application/json");
        }
        rawRes.end(
          JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        );
        return;
      }

      if (
        this.options.docs &&
        method === "GET" &&
        (url === docsPath ||
          url === `${docsPath}/` ||
          url.startsWith(`${docsPath}/`))
      ) {
        const host =
          req.headers?.host ??
          rawReq.headers?.host ??
          `localhost:${this.options.port ?? 4000}`;
        const socket = req.socket ?? rawReq.socket;
        const protocol = socket?.encrypted ? "https" : "http";
        const serverUrl = `${protocol}://${host}`;
        const html = renderDocsHtml(registry, serverUrl, url, rpcPath);

        rawRes.statusCode = 200;
        if (typeof rawRes.setHeader === "function") {
          rawRes.setHeader("Content-Type", "text/html; charset=utf-8");
        }
        rawRes.end(html);
        return;
      }

      rawRes.statusCode = 404;
      if (typeof rawRes.setHeader === "function") {
        rawRes.setHeader("Content-Type", "application/json");
      }
      rawRes.end(
        JSON.stringify({
          status: "error",
          code: "not_found",
          message: `Cannot ${method} ${url}`,
        }),
      );
    };
  }

  public async execute<T = unknown>(
    key: string,
    data?: unknown,
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult<T>> {
    const startTime = process.hrtime();
    const requestId =
      (options.contextOverrides?.requestId as string) ?? createId();

    try {
      const registry = await this.getRegistry();
      const fnEntry = registry.functions.get(key);

      if (!fnEntry) {
        throw new AppError(
          ErrorCode.FUNCTION_NOT_FOUND,
          `Function "${key}" not found in registry`,
        );
      }

      const headers = options.headers ?? {};

      let currentContext: MiddlewareContext = {
        requestId,
        ip: (options.contextOverrides?.ip as string) ?? "127.0.0.1",
        namespace: fnEntry.namespace,
        functionName: fnEntry.functionName,
        requestStartTime: Date.now(),
        req: {} as IncomingMessage,
        ...(options.contextOverrides ?? {}),
      };

      for (const mwConfig of fnEntry.middlewares) {
        const mwEntry = registry.middlewares.get(mwConfig.name);
        if (!mwEntry) {
          logSystemError(
            `Middleware "${mwConfig.name}" declared on ${key} but not found in registry.`,
          );
          continue;
        }

        if (mwEntry.headersSchema) {
          validateSchema(
            mwEntry.headersSchema,
            headers,
            `Middleware headers for "${mwConfig.name}"`,
          );
        }

        const mwOptions = mwConfig.options ?? {};
        if (mwEntry.optionsSchema) {
          validateSchema(
            mwEntry.optionsSchema,
            mwOptions,
            `Middleware options for "${mwConfig.name}"`,
          );
        }

        const mwResult = await mwEntry.run(
          {
            headers: headers as Record<string, unknown>,
            options: mwOptions,
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

      if (fnEntry.headersSchema) {
        validateSchema(fnEntry.headersSchema, headers, `Headers for "${key}"`);
      }

      const validatedInput = fnEntry.inputSchema
        ? validateSchema(fnEntry.inputSchema, data, `Input for "${key}"`)
        : data;

      const timeoutMs =
        options.timeoutMs ??
        (process.env.API_REQUEST_TIMEOUT_MS
          ? Number(process.env.API_REQUEST_TIMEOUT_MS)
          : 30000);

      const rawResult = await withTimeout(
        fnEntry.run(validatedInput, currentContext),
        timeoutMs,
        `Function ${key}`,
      );

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
          throw new AppError(
            ErrorCode.SCHEMA_MISMATCH,
            "Response schema mismatch — check function run.ts output.",
            isAppError(schemaErr) ? schemaErr.details : undefined,
            false,
          );
        }
      }

      const durationMs = getHighResDurationMs(startTime);
      logRequestSuccess(requestId, key, durationMs);

      return {
        status: "ok",
        data: validatedOutput as T,
        meta: {
          requestId,
          durationMs,
        },
      };
    } catch (err) {
      const durationMs = getHighResDurationMs(startTime);
      const appErr = toAppError(err);
      logRequestError(
        requestId,
        appErr.code,
        appErr.message,
        durationMs,
        appErr.internal ? err : undefined,
      );

      return {
        status: "error",
        code: appErr.code,
        message: appErr.message,
        details: appErr.details,
        meta: {
          requestId,
          durationMs,
        },
      };
    }
  }

  public getRpcEndpoint(): string {
    return this.options.rpcEndpoint ?? "/rpc";
  }

  public getDocsEndpoint(): string {
    return this.options.docsEndpoint ?? "/docs";
  }

  public createFastifyPlugin(
    pluginOptions: { rpcEndpoint?: string; docsEndpoint?: string } = {},
  ) {
    return async (
      fastify: any,
      _opts: Record<string, unknown> = {},
    ): Promise<void> => {
      const handler = await this.createHandler();
      const rpcPath = normalizeEndpoint(
        pluginOptions.rpcEndpoint ?? this.options.rpcEndpoint ?? "/rpc",
      );
      const docsPath = normalizeEndpoint(
        pluginOptions.docsEndpoint ?? this.options.docsEndpoint ?? "/docs",
      );

      const routeHandler = async (req: any, reply: any) => {
        if (req.raw && req.body !== undefined) {
          req.raw.body = req.body;
        }
        reply.hijack();
        await handler(req.raw, reply.raw);
      };

      fastify.all(rpcPath, routeHandler);
      fastify.all(`${rpcPath}/`, routeHandler);

      fastify.get("/health", async (req: any, reply: any) => {
        reply.hijack();
        await handler(req.raw, reply.raw);
      });
      fastify.get("/health/", async (req: any, reply: any) => {
        reply.hijack();
        await handler(req.raw, reply.raw);
      });

      if (this.options.docs) {
        fastify.get(docsPath, async (req: any, reply: any) => {
          reply.hijack();
          await handler(req.raw, reply.raw);
        });
        fastify.get(`${docsPath}/*`, async (req: any, reply: any) => {
          reply.hijack();
          await handler(req.raw, reply.raw);
        });
      }
    };
  }

  public fastifyPlugin(
    pluginOptions: { rpcEndpoint?: string; docsEndpoint?: string } = {},
  ) {
    return this.createFastifyPlugin(pluginOptions);
  }

  public createTestCaller(defaultOptions: ExecuteOptions = {}): TestCaller {
    return createTestCaller(this, defaultOptions);
  }

  public async start(overridePort?: number): Promise<Server> {
    const port = overridePort ?? this.options.port ?? 4000;
    const host = this.options.host ?? "0.0.0.0";

    const handler = await this.createHandler();
    this.serverInstance = http.createServer(handler);

    return new Promise((resolve) => {
      this.serverInstance!.listen(port, host, () => {
        logger.info(`Server listening at http://${host}:${port}`);
        resolve(this.serverInstance!);
      });
    });
  }

  public async listen(overridePort?: number): Promise<Server> {
    return this.start(overridePort);
  }

  public static configure(options?: CoreRpcOptions): CoreRPC {
    return new CoreRPC(options);
  }
}

export function createFastifyPlugin(
  app: CoreRPC,
  options?: { rpcEndpoint?: string; docsEndpoint?: string },
) {
  return app.createFastifyPlugin(options);
}
