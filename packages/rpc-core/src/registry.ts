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
  headersSchema?: TSchema;
  inputSchema?: TSchema;
  outputSchema?: TSchema;
  run: (input: any, context: MiddlewareContext) => Promise<unknown>;
}

export interface FunctionMiddlewaresModule {
  middlewares?: MiddlewareOptionEntry[];
}

export interface RegisteredFunction {
  key: string;
  namespace: string;
  functionName: string;
  filePath: string;
  metadata: FunctionMetadata;
  contentType: ContentTypeContract;
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
}): Promise<Registry> {
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
    ) || Boolean(process.env.VITEST || process.env.TS_NODE_DEV);

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

  const functions = new Map<string, RegisteredFunction>();
  const middlewares = new Map<string, RegisteredMiddleware>();

  // 1. Discover Central Middlewares
  try {
    const mwFiles = await glob(["**/run.{ts,js}"], { cwd: middlewaresDir, absolute: true });

    for (const filePath of mwFiles) {
      const dirName = path.basename(path.dirname(filePath));

      try {
        const mwMod = (await import(filePath)) as MiddlewareModule;

        let constantsMod: Partial<MiddlewareModule> = {};
        const dirPath = path.dirname(filePath);
        const constTs = path.join(dirPath, "constants.ts");
        const constJs = path.join(dirPath, "constants.js");
        const constantsPath = fs.existsSync(constTs) ? constTs : fs.existsSync(constJs) ? constJs : null;
        if (constantsPath) {
          try {
            constantsMod = await import(constantsPath);
          } catch {}
        }

        const name = mwMod.metadata?.name ?? constantsMod.metadata?.name ?? dirName;

        if (typeof mwMod.run !== "function") {
          continue;
        }

        middlewares.set(name, {
          name,
          filePath,
          metadata: mwMod.metadata ?? constantsMod.metadata,
          headersSchema: mwMod.headersSchema ?? constantsMod.headersSchema,
          optionsSchema: mwMod.optionsSchema ?? constantsMod.optionsSchema,
          run: mwMod.run,
        });
      } catch (err) {
        logSystemError(`Failed to load middleware from ${filePath}`, err);
      }
    }
  } catch {}

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
      if (parts.length < 2) continue;
      const functionName = parts[parts.length - 2];
      const namespace = parts.slice(0, -2).join(".");
      const key = `${namespace}.${functionName}`;

      try {
        const fnMod = (await import(filePath)) as FunctionModule;

        let constantsMod: Partial<FunctionModule> = {};
        const dirPath = path.dirname(filePath);
        const constTs = path.join(dirPath, "constants.ts");
        const constJs = path.join(dirPath, "constants.js");
        const constantsPath = fs.existsSync(constTs) ? constTs : fs.existsSync(constJs) ? constJs : null;
        if (constantsPath) {
          try {
            constantsMod = await import(constantsPath);
          } catch {}
        }

        let middlewaresMod: FunctionMiddlewaresModule = {};
        const mwTs = path.join(dirPath, "middlewares.ts");
        const mwJs = path.join(dirPath, "middlewares.js");
        const middlewaresPath = fs.existsSync(mwTs) ? mwTs : fs.existsSync(mwJs) ? mwJs : null;
        if (middlewaresPath) {
          try {
            middlewaresMod = await import(middlewaresPath);
          } catch {}
        }

        if (typeof fnMod.run !== "function") {
          continue;
        }

        functions.set(key, {
          key,
          namespace,
          functionName,
          filePath,
          metadata: fnMod.metadata ?? constantsMod.metadata ?? {},
          contentType: fnMod.contentType ?? constantsMod.contentType ?? "application/json",
          headersSchema: fnMod.headersSchema ?? constantsMod.headersSchema,
          inputSchema: fnMod.inputSchema ?? constantsMod.inputSchema,
          outputSchema: fnMod.outputSchema ?? constantsMod.outputSchema,
          middlewares: middlewaresMod.middlewares ?? [],
          run: fnMod.run,
        });
      } catch (err) {
        logSystemError(`Failed to load function from ${filePath}`, err);
      }
    }
  } catch {}

  return { functions, middlewares };
}
