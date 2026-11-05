import http, { type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { RequestListener } from "node:http";
import { createId } from "@paralleldrive/cuid2";
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
import { getHighResDurationMs } from "./utils/timing";
import { runPipeline } from "./pipeline";
import { shutdownGlobalWorkerPool } from "./workers/worker-pool";

export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface CoreRpcOptions {
  functionsDir?: string;
  middlewaresDir?: string;
  port?: number;
  host?: string;
  docs?: boolean;
  rpcEndpoint?: string;
  docsEndpoint?: string;
  healthEndpoint?: string;
  strict?: boolean;
  trustProxy?: boolean;
  cors?: boolean | CorsOptions;
}

function applyCors(
  req: IncomingMessage | any,
  res: ServerResponse | any,
  corsConfig?: boolean | CorsOptions,
): void {
  if (!corsConfig) return;

  const rawReq = req.raw ?? req;
  const rawRes = res.raw ?? res;
  if (typeof rawRes.setHeader !== "function") return;

  const originHeader = (rawReq.headers?.origin as string) ?? "";
  const config: CorsOptions = typeof corsConfig === "object" ? corsConfig : {};

  let allowedOrigin: string | undefined;

  if (typeof config.origin === "function") {
    if (config.origin(originHeader)) {
      allowedOrigin = originHeader;
    }
  } else if (Array.isArray(config.origin)) {
    if (config.origin.includes(originHeader)) {
      allowedOrigin = originHeader;
    }
  } else if (typeof config.origin === "string") {
    allowedOrigin = config.origin;
  } else if (corsConfig === true || config.origin === true) {
    allowedOrigin = originHeader || "*";
  }

  if (allowedOrigin) {
    rawRes.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    if (config.credentials || (corsConfig === true && originHeader)) {
      rawRes.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  const exposedHeaders = config.exposedHeaders ?? ["X-Request-Id"];
  rawRes.setHeader("Access-Control-Expose-Headers", exposedHeaders.join(", "));
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
    const rawHealth =
      options.healthEndpoint ?? process.env.API_HEALTH_ENDPOINT ?? "/health";

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
      healthEndpoint: normalizeEndpoint(rawHealth),
      strict: options.strict ?? process.env.NODE_ENV === "production",
      trustProxy: options.trustProxy ?? false,
      cors: options.cors ?? true,
    };
  }

  private invalidateRegistry(): void {
    this.registryInstance = undefined;
  }

  public useFunctions(dir: string): this {
    this.options.functionsDir = dir;
    this.invalidateRegistry();
    return this;
  }

  public setFunctionDir(dir: string): this {
    return this.useFunctions(dir);
  }

  public useMiddlewares(dir: string): this {
    this.options.middlewaresDir = dir;
    this.invalidateRegistry();
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

  public setTrustProxy(trust: boolean): this {
    this.options.trustProxy = trust;
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
      next?: (err?: any) => void,
    ): Promise<void> => {
      const rawReq = req.raw ?? req;
      const rawRes = res.raw ?? res;
      const rawUrl = rawReq.url ?? req.url ?? "/";
      const pathname = rawUrl.split("?")[0];
      const method = rawReq.method ?? req.method ?? "GET";

      const rpcPath = this.options.rpcEndpoint ?? "/rpc";
      const docsPath = this.options.docsEndpoint ?? "/docs";
      const healthPath = this.options.healthEndpoint ?? "/health";

      applyCors(req, res, this.options.cors);

      if (method === "OPTIONS") {
        rawRes.statusCode = 204;
        if (typeof rawRes.setHeader === "function") {
          const methods =
            typeof this.options.cors === "object" && this.options.cors.methods
              ? this.options.cors.methods.join(", ")
              : "POST, GET, OPTIONS";
          const allowedHeaders =
            typeof this.options.cors === "object" && this.options.cors.allowedHeaders
              ? this.options.cors.allowedHeaders.join(", ")
              : "Content-Type, Authorization, X-Request-Id, *";
          const maxAge =
            typeof this.options.cors === "object" && this.options.cors.maxAge !== undefined
              ? String(this.options.cors.maxAge)
              : "86400";

          rawRes.setHeader("Access-Control-Allow-Methods", methods);
          rawRes.setHeader("Access-Control-Allow-Headers", allowedHeaders);
          rawRes.setHeader("Access-Control-Max-Age", maxAge);
        }
        rawRes.end();
        return;
      }

      if (method === "POST" && (pathname === rpcPath || pathname === `${rpcPath}/`)) {
        if (req.body !== undefined && rawReq.body === undefined) {
          rawReq.body = req.body;
        }
        await handleApiRequest(req, res, registry, {
          trustProxy: this.options.trustProxy,
        });
        return;
      }

      if (method === "GET" && (pathname === healthPath || pathname === `${healthPath}/`)) {
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
        (pathname === docsPath ||
          pathname === `${docsPath}/` ||
          pathname.startsWith(`${docsPath}/`))
      ) {
        const host =
          req.headers?.host ??
          rawReq.headers?.host ??
          `localhost:${this.options.port ?? 4000}`;
        const socket = req.socket ?? rawReq.socket;
        const protocol = socket?.encrypted ? "https" : "http";
        const serverUrl = `${protocol}://${host}`;
        const html = renderDocsHtml(registry, serverUrl, rawUrl, rpcPath, docsPath);

        rawRes.statusCode = 200;
        if (typeof rawRes.setHeader === "function") {
          rawRes.setHeader("Content-Type", "text/html; charset=utf-8");
        }
        rawRes.end(html);
        return;
      }

      if (typeof next === "function") {
        return next();
      }

      rawRes.statusCode = 404;
      if (typeof rawRes.setHeader === "function") {
        rawRes.setHeader("Content-Type", "application/json");
      }
      rawRes.end(
        JSON.stringify({
          status: "error",
          code: "not_found",
          message: `Cannot ${method} ${rawUrl}`,
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

      const headers = (options.headers ?? {}) as Record<string, unknown>;

      const context: MiddlewareContext = {
        requestId,
        ip: (options.contextOverrides?.ip as string) ?? "127.0.0.1",
        namespace: fnEntry.namespace,
        functionName: fnEntry.functionName,
        requestStartTime: Date.now(),
        req: {} as IncomingMessage,
        ...(options.contextOverrides ?? {}),
      };

      const result = await runPipeline<T>({
        key,
        data,
        headers,
        context,
        registry,
        timeoutMs: options.timeoutMs,
      });

      return {
        status: "ok",
        data: result.data,
        meta: {
          requestId,
          durationMs: result.durationMs,
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
    pluginOptions: {
      rpcEndpoint?: string;
      docsEndpoint?: string;
      healthEndpoint?: string;
    } = {},
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
      const healthPath = normalizeEndpoint(
        pluginOptions.healthEndpoint ?? this.options.healthEndpoint ?? "/health",
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

      fastify.get(healthPath, async (req: any, reply: any) => {
        reply.hijack();
        await handler(req.raw, reply.raw);
      });
      fastify.get(`${healthPath}/`, async (req: any, reply: any) => {
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
    pluginOptions: {
      rpcEndpoint?: string;
      docsEndpoint?: string;
      healthEndpoint?: string;
    } = {},
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

    return new Promise((resolve, reject) => {
      this.serverInstance!.once("error", reject);
      this.serverInstance!.listen(port, host, () => {
        this.serverInstance!.removeListener("error", reject);
        logger.info(`Server listening at http://${host}:${port}`);
        resolve(this.serverInstance!);
      });
    });
  }

  public async listen(overridePort?: number): Promise<Server> {
    return this.start(overridePort);
  }

  public async close(): Promise<void> {
    await shutdownGlobalWorkerPool();
    if (this.serverInstance) {
      if (typeof (this.serverInstance as any).closeIdleConnections === "function") {
        (this.serverInstance as any).closeIdleConnections();
      }
      await new Promise<void>((resolve, reject) => {
        this.serverInstance!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.serverInstance = undefined;
    }
  }

  public static configure(options?: CoreRpcOptions): CoreRPC {
    return new CoreRPC(options);
  }
}

export function createFastifyPlugin(
  app: CoreRPC,
  options?: {
    rpcEndpoint?: string;
    docsEndpoint?: string;
    healthEndpoint?: string;
  },
) {
  return app.createFastifyPlugin(options);
}
