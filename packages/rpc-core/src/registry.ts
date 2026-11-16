import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { glob } from "tinyglobby";
import type { TSchema } from "@sinclair/typebox";
import type { MiddlewareContext } from "./context";
import { logSystemError } from "./logger";

export interface FunctionMetadata {
  description?: string;
  isPublic?: boolean;
  deprecated?: boolean;
  tags?: string[];
  worker?: boolean;
}

export type ContentTypeContract = "application/json" | "multipart/form-data";

export interface MiddlewareOptionEntry {
  name: string;
  options?: Record<string, unknown>;
}

export function defineMiddlewares<T extends MiddlewareOptionEntry[]>(middlewares: T): T {
  return middlewares;
}

export interface FunctionModule {
  metadata?: FunctionMetadata;
  contentType?: ContentTypeContract;
  worker?: boolean;
  middlewares?: MiddlewareOptionEntry[];
  headersSchema?: TSchema;
  inputSchema?: TSchema;
  outputSchema?: TSchema;
  run?: (input: any, context: MiddlewareContext) => Promise<unknown>;
  default?: any;
}

export interface FunctionMiddlewaresModule {
  middlewares?: MiddlewareOptionEntry[];
  default?: any;
}

export interface RegisteredFunction {
  key: string;
  namespace: string;
  functionName: string;
  filePath: string;
  metadata: FunctionMetadata;
  contentType: ContentTypeContract;
  worker?: boolean;
  headersSchema?: TSchema;
  inputSchema?: TSchema;
  outputSchema?: TSchema;
  middlewares: MiddlewareOptionEntry[];
  run: (input: any, context: MiddlewareContext) => Promise<unknown>;
}

export interface MiddlewareModule {
  metadata?: { name?: string; description?: string };
  headersSchema?: TSchema;
  optionsSchema?: TSchema;
  run: MiddlewareFn<any, any>;
}

export type MiddlewareFn<Options = unknown, ContextExtension = Record<string, unknown>> = (
  params: {
    headers: Record<string, unknown>;
    options: Options;
    function: {
      key: string;
      namespace: string;
      functionName: string;
      metadata: FunctionMetadata;
      contentType: ContentTypeContract;
    };
  },
  context: MiddlewareContext,
) => Promise<MiddlewareContext & ContextExtension>;

export interface RegisteredMiddleware {
  name: string;
  filePath: string;
  metadata?: { name?: string; description?: string };
  headersSchema?: TSchema;
  optionsSchema?: TSchema;
  run: MiddlewareFn<any, any>;
}

export interface Registry {
  functions: Map<string, RegisteredFunction>;
  middlewares: Map<string, RegisteredMiddleware>;
}

export async function buildRegistry(options: {
  functionsDir?: string;
  middlewaresDir?: string;
  strict?: boolean;
} = {}): Promise<Registry> {
  const isProd = process.env.NODE_ENV === "production";
  const strict = options.strict ?? isProd;
  const rootDir = process.cwd();
  let functionsDir = path.resolve(rootDir, options.functionsDir ?? "src/functions");
  let middlewaresDir = path.resolve(rootDir, options.middlewaresDir ?? "src/middlewares");

  // 🧠 SMART RUNTIME RESOLUTION:
  // Detect if running under native Node.js without a TS execution engine (tsx / ts-node / vitest)
  const isRunningTs =
    process.argv.some(
      (arg) =>
        arg.includes("tsx") ||
        arg.includes("ts-node") ||
        arg.includes("vitest") ||
        arg.endsWith(".ts"),
    ) ||
    process.execArgv.some(
      (arg) =>
        arg.includes("tsx") ||
        arg.includes("ts-node") ||
        arg.includes("strip-types") ||
        arg.includes(".ts"),
    ) ||
    Boolean(process.env.VITEST || process.env.TS_NODE_DEV);

  if (!isRunningTs) {
    // Check if functionsDir points to src/ but compiled dist/ or .crpc/ exists
    const candidateDirs = [
      functionsDir.replace(/[\\/]src([\\/]|$)/, "/dist$1"),
      functionsDir.replace(/[\\/]src([\\/]|$)/, "/.crpc$1"),
      path.resolve(rootDir, "dist/functions"),
      path.resolve(rootDir, ".crpc/functions"),
    ];

    for (const candidate of candidateDirs) {
      if (fs.existsSync(candidate)) {
        functionsDir = candidate;
        break;
      }
    }

    const candidateMwDirs = [
      middlewaresDir.replace(/[\\/]src([\\/]|$)/, "/dist$1"),
      middlewaresDir.replace(/[\\/]src([\\/]|$)/, "/.crpc$1"),
      path.resolve(rootDir, "dist/middlewares"),
      path.resolve(rootDir, ".crpc/middlewares"),
    ];

    for (const candidate of candidateMwDirs) {
      if (fs.existsSync(candidate)) {
        middlewaresDir = candidate;
        break;
      }
    }
  }

  const toImportUrl = (p: string) => {
    return pathToFileURL(p).href;
  };

  const functions = new Map<string, RegisteredFunction>();
  const middlewares = new Map<string, RegisteredMiddleware>();

  // 1. Discover Central Middlewares
  try {
    const mwFiles = await glob(["**/run.{ts,js}"], { cwd: middlewaresDir, absolute: true });

    for (const filePath of mwFiles) {
      const dirName = path.basename(path.dirname(filePath));

      try {
        const mwMod = (await import(toImportUrl(filePath))) as MiddlewareModule;

        let constantsMod: Partial<MiddlewareModule> = {};
        const dirPath = path.dirname(filePath);
        const constTs = path.join(dirPath, "constants.ts");
        const constJs = path.join(dirPath, "constants.js");
        const constMjs = path.join(dirPath, "constants.mjs");
        const constantsPath = fs.existsSync(constTs)
          ? constTs
          : fs.existsSync(constJs)
          ? constJs
          : fs.existsSync(constMjs)
          ? constMjs
          : null;
        if (constantsPath) {
          try {
            constantsMod = await import(toImportUrl(constantsPath));
          } catch (cErr) {
            logSystemError(`Failed to load middleware constants from ${constantsPath}`, cErr);
            if (strict) throw cErr;
          }
        }

        const name = mwMod.metadata?.name ?? constantsMod.metadata?.name ?? dirName;

        const mwRun = mwMod.run ?? (mwMod as any).default;
        if (typeof mwRun !== "function") {
          continue;
        }

        middlewares.set(name, {
          name,
          filePath,
          metadata: mwMod.metadata ?? constantsMod.metadata,
          headersSchema: mwMod.headersSchema ?? constantsMod.headersSchema,
          optionsSchema: mwMod.optionsSchema ?? constantsMod.optionsSchema,
          run: mwRun,
        });
      } catch (err) {
        logSystemError(`Failed to load middleware from ${filePath}`, err);
        if (strict) throw err;
      }
    }
  } catch (err) {
    if (strict) throw err;
  }

  // 2. Discover RPC Functions
  try {
    const fnFiles = await glob(["**/run.{ts,js}"], {
      cwd: functionsDir,
      absolute: true,
      ignore: ["**/*.spec.{ts,js}", "**/__tests__/**"],
    });

    for (const filePath of fnFiles) {
      const rel = path.relative(functionsDir, filePath);
      const parts = rel.split(path.sep);
      if (parts.length < 3) {
        logSystemError(
          `Skipping function at ${filePath}: Functions must be placed inside a namespace folder, e.g. functions/{namespace}/{functionName}/run.ts`,
        );
        continue;
      }
      const functionName = parts[parts.length - 2];
      const namespace = parts.slice(0, -2).join(".");
      const key = `${namespace}.${functionName}`;

      try {
        const fnMod = (await import(toImportUrl(filePath))) as FunctionModule;

        let constantsMod: Partial<FunctionModule> = {};
        const dirPath = path.dirname(filePath);
        const constTs = path.join(dirPath, "constants.ts");
        const constJs = path.join(dirPath, "constants.js");
        const constMjs = path.join(dirPath, "constants.mjs");
        const constantsPath = fs.existsSync(constTs)
          ? constTs
          : fs.existsSync(constJs)
          ? constJs
          : fs.existsSync(constMjs)
          ? constMjs
          : null;
        if (constantsPath) {
          try {
            constantsMod = await import(toImportUrl(constantsPath));
          } catch (cErr) {
            logSystemError(`Failed to load constants from ${constantsPath}`, cErr);
            if (strict) throw cErr;
          }
        }

        let middlewaresMod: FunctionMiddlewaresModule = {};
        const mwTs = path.join(dirPath, "middlewares.ts");
        const mwJs = path.join(dirPath, "middlewares.js");
        const mwMjs = path.join(dirPath, "middlewares.mjs");
        const middlewaresPath = fs.existsSync(mwTs)
          ? mwTs
          : fs.existsSync(mwJs)
          ? mwJs
          : fs.existsSync(mwMjs)
          ? mwMjs
          : null;
        if (middlewaresPath) {
          try {
            middlewaresMod = await import(toImportUrl(middlewaresPath));
          } catch (mErr) {
            logSystemError(`Failed to load middlewares from ${middlewaresPath}`, mErr);
            if (strict) throw mErr;
          }
        }

        const runFn =
          fnMod.run ??
          (typeof fnMod.default === "function"
            ? fnMod.default
            : (fnMod.default as any)?.run);

        if (typeof runFn !== "function") {
          continue;
        }

        const isWorker = Boolean(fnMod.worker ?? constantsMod.worker ?? false);

        functions.set(key, {
          key,
          namespace,
          functionName,
          filePath,
          worker: isWorker,
          metadata: fnMod.metadata ?? constantsMod.metadata ?? {},
          contentType: fnMod.contentType ?? constantsMod.contentType ?? "application/json",
          headersSchema: fnMod.headersSchema ?? constantsMod.headersSchema,
          inputSchema: fnMod.inputSchema ?? constantsMod.inputSchema,
          outputSchema: fnMod.outputSchema ?? constantsMod.outputSchema,
          middlewares: (() => {
            const raw =
              middlewaresMod.middlewares ??
              (middlewaresMod.default as any)?.middlewares ??
              middlewaresMod.default ??
              fnMod.middlewares ??
              constantsMod.middlewares;
            return Array.isArray(raw) ? raw : [];
          })(),
          run: runFn,
        });
      } catch (err) {
        logSystemError(`Failed to load function from ${filePath}`, err);
        if (strict) throw err;
      }
    }
  } catch (err) {
    if (strict) throw err;
  }

  return { functions, middlewares };
}
