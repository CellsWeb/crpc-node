/**
 * packages/rpc-core/src/scaffold.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Programmatic scaffolding utilities for CellsWeb RPC functions & middlewares.
 */

import fs from "node:fs";
import path from "node:path";
import { glob } from "tinyglobby";

export interface ScaffoldFunctionOptions {
  namespace: string;
  name: string;
  contentType?: "application/json" | "multipart/form-data" | "json" | "multipart";
  middlewares?: string[];
  description?: string;
  targetDir?: string;
}

export interface ScaffoldMiddlewareOptions {
  name: string;
  description?: string;
  targetDir?: string;
}

export function detectConfiguredDirs(rootDir: string = process.cwd()): {
  functionsDir: string;
  middlewaresDir: string;
} {
  let functionsDir: string | null = null;
  let middlewaresDir: string | null = null;

  // 1. Check environment variables
  if (process.env.RPC_FUNCTIONS_DIR) functionsDir = process.env.RPC_FUNCTIONS_DIR;
  if (process.env.RPC_MIDDLEWARES_DIR) middlewaresDir = process.env.RPC_MIDDLEWARES_DIR;

  // 2. Check package.json#crpc
  if (!functionsDir || !middlewaresDir) {
    const pkgPath = path.join(rootDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (!functionsDir && pkg.crpc?.functionsDir) functionsDir = pkg.crpc.functionsDir;
        if (!middlewaresDir && pkg.crpc?.middlewaresDir) middlewaresDir = pkg.crpc.middlewaresDir;
      } catch {}
    }
  }

  // 3. Scan server entry file (src/server.ts, src/index.ts, src/app.ts, server.ts, etc.)
  if (!functionsDir || !middlewaresDir) {
    const candidates = [
      "src/server.ts",
      "src/index.ts",
      "src/app.ts",
      "src/main.ts",
      "server.ts",
      "index.ts",
      "app.ts",
    ];
    for (const file of candidates) {
      const fullPath = path.join(rootDir, file);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (!functionsDir) {
            const fnMatch = content.match(/functionsDir\s*:\s*["']([^"']+)["']/);
            if (fnMatch) functionsDir = fnMatch[1];
          }
          if (!middlewaresDir) {
            const mwMatch = content.match(/middlewaresDir\s*:\s*["']([^"']+)["']/);
            if (mwMatch) middlewaresDir = mwMatch[1];
          }
          if (functionsDir && middlewaresDir) break;
        } catch {}
      }
    }
  }

  return {
    functionsDir: path.resolve(rootDir, functionsDir || "src/functions"),
    middlewaresDir: path.resolve(rootDir, middlewaresDir || "src/middlewares"),
  };
}

export async function getExistingNamespaces(functionsDir?: string): Promise<string[]> {
  const dir = functionsDir || detectConfiguredDirs().functionsDir;
  if (!fs.existsSync(dir)) return [];

  const runFiles = await glob("**/run.ts", {
    cwd: dir,
    absolute: false,
    ignore: ["**/*.spec.ts", "**/__tests__/**"],
  });

  const namespaces = new Set<string>();
  for (const f of runFiles) {
    const parts = f.split("/");
    if (parts.length < 3) continue;
    const ns = parts.slice(0, parts.length - 2).join(".");
    if (ns) namespaces.add(ns);
  }

  return Array.from(namespaces).sort();
}

export function getAvailableMiddlewares(middlewaresDir?: string): string[] {
  const dir = middlewaresDir || detectConfiguredDirs().middlewaresDir;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

function tplConstants(ns: string, fn: string, isMultipart: boolean, desc?: string): string {
  const nsPath = ns.replace(/\./g, "/");
  const descriptionStr = desc || `TODO: describe ${fn}`;

  if (isMultipart) {
    return `/**
 * functions/${nsPath}/${fn}/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SCHEMA & CONTRACT DEFINITION
 */

import { Type } from "@sinclair/typebox";
import { File, Files } from "@cellsweb/rpc-core";

export const metadata = {
  description: "${descriptionStr}",
  isPublic: ${ns.startsWith("public")},
  deprecated: false,
  tags: ["upload"] as string[],
};

export const contentType = "multipart/form-data" as const;

export const headersSchema = Type.Object({}, { additionalProperties: true });

export const inputSchema = Type.Object({
  title: Type.String({ minLength: 1, description: "Title of the upload" }),
  file: File({
    maxSizeBytes: 5_000_000,
    mimeTypes: ["image/png", "image/jpeg", "application/pdf"],
    description: "Primary file attachment",
  }),
  files: Type.Optional(Files({
    maxCount: 5,
    maxSizeBytes: 10_000_000,
    description: "Optional additional files",
  })),
});

export const outputSchema = Type.Object({
  fileName: Type.String({ description: "Original file name" }),
  fileSize: Type.Number({ description: "Size of uploaded file in bytes" }),
  extraFiles: Type.Number({ description: "Count of additional attached files" }),
});
`;
  }

  return `/**
 * functions/${nsPath}/${fn}/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SCHEMA & CONTRACT DEFINITION
 */

import { Type } from "@sinclair/typebox";

export const metadata = {
  description: "${descriptionStr}",
  isPublic: ${ns.startsWith("public")},
  deprecated: false,
  tags: [] as string[],
};

export const contentType = "application/json" as const;

export const headersSchema = Type.Object({}, { additionalProperties: true });

export const inputSchema = Type.Object({
  example: Type.String({ minLength: 1, description: "Example string input parameter" }),
});

export const outputSchema = Type.Object({
  result: Type.String({ description: "Operation status or execution result message" }),
});
`;
}

function tplRun(ns: string, fn: string, isMultipart: boolean, mws: string[]): string {
  const nsPath = ns.replace(/\./g, "/");
  let contextTypeStr = "MiddlewareContext";
  let importContextStr = 'import type { MiddlewareContext } from "@cellsweb/rpc-core";';

  if (mws.length > 0) {
    importContextStr = 'import type { InferContext } from "@cellsweb/rpc-core";\nimport type { middlewares } from "./middlewares";';
    contextTypeStr = "InferContext<typeof middlewares>";
  }

  if (isMultipart) {
    return `/**
 * functions/${nsPath}/${fn}/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS LOGIC HANDLER
 */

import type { Static } from "@sinclair/typebox";
${importContextStr}
import type { inputSchema, outputSchema } from "./constants";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (
  input: Input,
  _context: ${contextTypeStr},
): Promise<Output> => {
  const filename = input.file.filename;
  const fileSize = input.file.byteLength;

  return {
    fileName: filename,
    fileSize: fileSize,
    extraFiles: input.files?.length ?? 0,
  };
};
`;
  }

  return `/**
 * functions/${nsPath}/${fn}/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS LOGIC HANDLER
 */

import type { Static } from "@sinclair/typebox";
${importContextStr}
import type { inputSchema, outputSchema } from "./constants";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (
  input: Input,
  _context: ${contextTypeStr},
): Promise<Output> => {
  return {
    result: input.example,
  };
};
`;
}

function tplMiddlewares(ns: string, fn: string, mws: string[]): string {
  const nsPath = ns.replace(/\./g, "/");
  const entries = mws
    .map((mw) => {
      if (mw === "rateLimit") {
        return `  { name: "rateLimit", options: { windowSeconds: 60, maxRequests: 100 } },`;
      }
      if (mw === "auth") {
        return `  { name: "auth", options: { roles: ["user", "admin", "vendor", "staff", "dev"] } },`;
      }
      return `  { name: "${mw}", options: {} },`;
    })
    .join("\n");

  return `/**
 * functions/${nsPath}/${fn}/middlewares.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FUNCTION MIDDLEWARE PIPELINE
 */

import { defineMiddlewares } from "@cellsweb/rpc-core";

export const middlewares = defineMiddlewares([
${entries}
]);
`;
}

function tplTest(ns: string, fn: string, isMultipart: boolean, mws: string[] = []): string {
  const nsPath = ns.replace(/\./g, "/");
  const hasAuth = mws.includes("auth");

  if (isMultipart) {
    return `/**
 * functions/${nsPath}/${fn}/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPREHENSIVE SECURITY & EXECUTION AUDIT FOR ${ns}.${fn}
 */

import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { createUploadedFile } from "@cellsweb/rpc-core";
import { inputSchema, outputSchema, metadata } from "./constants";
import { run } from "./run";
import { createMockContext } from "@/test/helpers";
import { createTestActor } from "@/test/testActor";

describe("RPC Security & Execution Audit: ${ns}.${fn}", () => {
  describe("1. Schema & Contract Integrity", () => {
    it("conforms to valid TypeBox metadata contract", () => {
      expect(metadata).toBeDefined();
      expect(typeof metadata.description).toBe("string");
    });

    it("verifies inputSchema rejects invalid file shapes", () => {
      const invalid = { title: "" };
      const isValid = Value.Check(inputSchema, invalid);
      expect(isValid).toBe(false);
    });
  });

  describe("2. Handler Execution (run.ts)", () => {
    it("executes business logic with mock file attachment", async () => {
      const mockFile = createUploadedFile({
        path: "/tmp/mock.png",
        filename: "test.png",
        mimeType: "image/png",
        byteLength: 1024,
      });

      const context = createMockContext({
        auth: { userId: "test_uploader", role: "user" },
      });

      const result = await run(
        {
          title: "Test Upload",
          file: mockFile,
        },
        context as any,
      );

      expect(result.fileName).toBe("test.png");
      expect(result.fileSize).toBe(1024);

      const isOutputValid = Value.Check(outputSchema, result);
      expect(isOutputValid).toBe(true);
    });
  });

  describe("3. User Flow & Access Control", () => {
    it("executes successfully with authorized user credentials", async () => {
      const actor = await createTestActor({ role: "admin", userId: "usr_authorized" });
      const mockFile = createUploadedFile({
        path: "/tmp/mock.png",
        filename: "test.png",
        mimeType: "image/png",
        byteLength: 1024,
      });
      const raw = await actor.callRaw("${ns}.${fn}", {
        title: "Actor Upload",
        file: mockFile,
      });
      expect(raw.status).toBe("ok");
    });

    it("enforces security guards and blocks unprivileged access", async () => {
      if (${hasAuth}) {
        const guestActor = await createTestActor({ role: "unprivileged_guest" });
        const res = await guestActor.callRaw("${ns}.${fn}", { title: "Unauthorized Attempt" });
        expect(res.status).toBe("error");
      }
    });
  });

  describe("4. Server Business Logic & Boundary Integrity", () => {
    it("evaluates server logic cleanly without unhandled crashes", async () => {
      const actor = await createTestActor({ role: "admin", userId: "usr_actor_1" });
      const mockFile = createUploadedFile({
        path: "/tmp/mock.png",
        filename: "test.png",
        mimeType: "image/png",
        byteLength: 1024,
      });
      const res = await actor.callRaw("${ns}.${fn}", { title: "Valid Submission", file: mockFile });
      expect(res.status).toBe("ok");
    });
  });
});
`;
  }

  return `/**
 * functions/${nsPath}/${fn}/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY & END-TO-END EXECUTION AUDIT FOR ${ns}.${fn}
 */

import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { inputSchema, outputSchema, metadata } from "./constants";
import { run } from "./run";
import { createMockContext } from "@/test/helpers";
import { createTestActor } from "@/test/testActor";

describe("RPC Security & Execution Audit: ${ns}.${fn}", () => {
  describe("1. Schema Contract & Payload Validation", () => {
    it("exports valid metadata configuration", () => {
      expect(metadata).toBeDefined();
      expect(typeof metadata.description).toBe("string");
    });

    it("validates payload against TypeBox inputSchema", () => {
      const valid = { example: "Valid input payload" };
      const isValid = Value.Check(inputSchema, valid);
      expect(isValid).toBe(true);
    });
  });

  describe("2. Direct Handler Execution (run.ts)", () => {
    it("executes business logic with mock context credentials", async () => {
      const context = createMockContext({
        auth: { userId: "test_user_id", role: "admin" },
      });

      const result = await run({ example: "Hello World" }, context as any);
      expect(result).toBeDefined();
      expect(result.result).toBe("Hello World");

      const isOutputValid = Value.Check(outputSchema, result);
      expect(isOutputValid).toBe(true);
    });
  });

  describe("3. User Flow & Access Control", () => {
    it("executes successfully with authorized user credentials", async () => {
      const actor = await createTestActor({ role: "admin", userId: "usr_admin_1" });
      const res = await actor.callRaw("${ns}.${fn}", { example: "Actor test payload" });
      expect(res.status).toBe("ok");
      if (res.status === "ok") {
        expect(res.data).toEqual({ result: "Actor test payload" });
      }
    });

    it("enforces security guards and blocks unprivileged access", async () => {
      if (${hasAuth}) {
        const guestActor = await createTestActor({ role: "unprivileged_guest" });
        const res = await guestActor.callRaw("${ns}.${fn}", { example: "Unauthorized attempt" });
        expect(res.status).toBe("error");
      }
    });
  });

  describe("4. Server Business Logic & Boundary Integrity", () => {
    it("processes user flow and returns proper status feedback", async () => {
      const actor = await createTestActor({ role: "admin", userId: "usr_regular_1" });
      const res = await actor.callRaw("${ns}.${fn}", { example: "Flow test" });
      expect(res.status).toBe("ok");
    });
  });
});
`;
}

export async function scaffoldFunction(
  options: ScaffoldFunctionOptions | Record<string, any>,
): Promise<string> {
  const namespace = options.namespace || (options as any).ns;
  const name = options.name || (options as any).fn || (options as any).functionName;
  if (!namespace || !name) {
    throw new Error(`Both namespace and name are required. Received: ${JSON.stringify(options)}`);
  }

  const middlewares = options.middlewares || [];
  const description = options.description;
  const contentType = options.contentType || (options as any).type;
  const isMultipart =
    contentType === "multipart/form-data" || contentType === "multipart";

  const defaultDirs = detectConfiguredDirs();
  const root = options.targetDir || defaultDirs.functionsDir;
  const nsDir = path.join(root, namespace.replace(/\./g, path.sep));
  const fnDir = path.join(nsDir, name);

  fs.mkdirSync(fnDir, { recursive: true });
  fs.writeFileSync(path.join(fnDir, "constants.ts"), tplConstants(namespace, name, isMultipart, description));
  fs.writeFileSync(path.join(fnDir, "run.ts"), tplRun(namespace, name, isMultipart, middlewares));
  fs.writeFileSync(path.join(fnDir, "test.ts"), tplTest(namespace, name, isMultipart, middlewares));

  if (middlewares.length > 0) {
    fs.writeFileSync(path.join(fnDir, "middlewares.ts"), tplMiddlewares(namespace, name, middlewares));
  }

  return fnDir;
}

export async function scaffoldMiddleware(
  options: ScaffoldMiddlewareOptions,
): Promise<string> {
  const { name, description } = options;
  const defaultDirs = detectConfiguredDirs();
  const root = options.targetDir || defaultDirs.middlewaresDir;
  const mwDir = path.join(root, name);

  const descStr = description || `Enforces security policies or request transformations for ${name}`;
  const tplConst = `/**
 * middlewares/${name}/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MIDDLEWARE CONTRACT & METADATA
 */

import { Type } from "@sinclair/typebox";

export const metadata = {
  name: "${name}",
  description: "${descStr}",
};

export const headersSchema = Type.Object({}, { additionalProperties: true });

export const optionsSchema = Type.Object({}, { additionalProperties: false });
`;

  const tplMRun = `/**
 * middlewares/${name}/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MIDDLEWARE IMPLEMENTATION
 */

import type { MiddlewareFn } from "@cellsweb/rpc-core";
import type { Static } from "@sinclair/typebox";
import type { optionsSchema } from "./constants";

type Options = Static<typeof optionsSchema>;

export const run: MiddlewareFn<Options, { ${name}: string }> = async (
  { headers, options, function: fn },
  context,
) => {
  void headers;
  void options;
  void fn;

  return {
    ...context,
    ${name}: "value",
  };
};
`;

  const tplMTest = `/**
 * middlewares/${name}/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIT TEST FOR ${name} MIDDLEWARE
 */

import { describe, it, expect } from "vitest";
import { run } from "./run";

describe("middleware: ${name}", () => {
  it("augments context successfully", async () => {
    const initialContext = { requestId: "test-id", ip: "127.0.0.1" } as any;
    const result = await run(
      {
        headers: {},
        options: {},
        function: {
          key: "test.fn",
          namespace: "test",
          functionName: "fn",
          metadata: {} as any,
          contentType: "application/json",
        },
      },
      initialContext,
    );

    expect(result.${name}).toBe("value");
  });
});
`;

  fs.mkdirSync(mwDir, { recursive: true });
  fs.writeFileSync(path.join(mwDir, "constants.ts"), tplConst);
  fs.writeFileSync(path.join(mwDir, "run.ts"), tplMRun);
  fs.writeFileSync(path.join(mwDir, "test.ts"), tplMTest);

  return mwDir;
}
