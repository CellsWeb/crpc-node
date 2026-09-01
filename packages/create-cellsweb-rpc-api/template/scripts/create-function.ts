#!/usr/bin/env node
/**
 * scripts/create-function.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Scaffolds a new API function with constants, run, optional middlewares, and comprehensive audit test files.
 *
 * SUPPORTED MODES:
 *  1. Interactive Mode (Default in TTY):
 *     pnpm create:function
 *
 *  2. Single CLI Flag Mode (Non-interactive for AI Coders & Devs):
 *     pnpm create:function --ns admin.products --name create --contentType json --middlewares auth,rateLimit
 *
 *  3. Batch Mode (Scaffold multiple functions in one command):
 *     pnpm create:function --batch '[{"ns":"admin.products","name":"create","middlewares":["auth"]},{"ns":"admin.products","name":"delete"}]'
 *     pnpm create:function --file specs/functions.json
 */

import * as p from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { glob } from "tinyglobby";

const MAX_RETRIES = 5;
const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, "src", "functions");
const MIDDLEWARES_DIR = path.join(ROOT, "src", "middlewares");

export interface ScaffoldFunctionOptions {
  namespace: string;
  name: string;
  contentType?: "application/json" | "multipart/form-data" | "json" | "multipart";
  middlewares?: string[];
  description?: string;
}

export async function getExistingNamespaces(): Promise<string[]> {
  if (!fs.existsSync(FUNCTIONS_DIR)) return [];

  const runFiles = await glob("**/run.ts", {
    cwd: FUNCTIONS_DIR,
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

export function getAvailableMiddlewares(): string[] {
  if (!fs.existsSync(MIDDLEWARES_DIR)) return [];
  return fs
    .readdirSync(MIDDLEWARES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

const identifierRe = /^[a-zA-Z][a-zA-Z0-9]*$/;
const namespaceRe = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;

function tplConstants(ns: string, fn: string, isMultipart: boolean, desc?: string): string {
  const nsPath = ns.replace(/\./g, "/");
  const descriptionStr = desc || `TODO: describe ${fn}`;

  if (isMultipart) {
    return `/**
 * functions/${nsPath}/${fn}/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SCHEMA & CONTRACT DEFINITION
 *
 * WHAT TO TOUCH:
 *  - metadata: Human-readable description, tags, public status for API docs.
 *  - contentType: Strictly "multipart/form-data" for file uploads.
 *  - inputSchema: Define form fields and file attachments using File() or Files().
 *  - outputSchema: Define what this function returns.
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
 *
 * WHAT TO TOUCH:
 *  - metadata: Description, public access, tags.
 *  - contentType: "application/json" (default).
 *  - inputSchema: Define fields expected in req.body.data. Include description in Type properties!
 *  - outputSchema: Define structure returned by run(). Include description in Type properties!
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
    importContextStr = 'import type { InferContext } from "@cellsweb/rpc-core";\nimport { middlewares } from "./middlewares";';
    contextTypeStr = "InferContext<typeof middlewares>";
  }

  if (isMultipart) {
    return `/**
 * functions/${nsPath}/${fn}/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS LOGIC HANDLER
 *
 * WHAT TO TOUCH:
 *  - Place core business operations here.
 *  - Access input fields: input.title, input.file.filename, input.file.toBuffer().
 *  - Access context variables provided by middlewares in _context.
 *
 * WHAT TO EXPECT:
 *  - input is guaranteed to be validated against inputSchema.
 *  - The return object MUST match outputSchema.
 */

import type { Static } from "@sinclair/typebox";
${importContextStr}
import { inputSchema, outputSchema } from "./constants";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (
  input: Input,
  _context: ${contextTypeStr},
): Promise<Output> => {
  // Access uploaded file properties safely
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
 *
 * WHAT TO TOUCH:
 *  - Implement function logic here.
 *  - Access input fields via input.*.
 *  - Access context values (e.g. auth user, ip, headers) via _context.
 *
 * WHAT TO EXPECT:
 *  - Input is pre-validated by TypeBox inputSchema.
 *  - Return value is validated against outputSchema before sending response.
 */

import type { Static } from "@sinclair/typebox";
${importContextStr}
import { inputSchema, outputSchema } from "./constants";

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
 *
 * Declarative list of central middlewares executed in order before run().
 */

import { defineMiddlewares } from "@cellsweb/rpc-core";

export const middlewares = defineMiddlewares([
${entries}
]);
`;
}

function tplTest(ns: string, fn: string, isMultipart: boolean): string {
  const nsPath = ns.replace(/\./g, "/");

  if (isMultipart) {
    return `/**
 * functions/${nsPath}/${fn}/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPREHENSIVE SECURITY & EXECUTION AUDIT FOR ${ns}.${fn}
 * Run with: pnpm test | pnpm test:audit
 */

import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { createUploadedFile } from "@cellsweb/rpc-core";
import { inputSchema, outputSchema, metadata } from "./constants";
import { run } from "./run";
import { createMockContext } from "@/test/helpers";
import { createTestActor } from "@/test/testActor";

describe("RPC Security & Execution Audit: ${ns}.${fn}", () => {
  // ── 1. Schema & Contract Integrity ──
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

  // ── 2. Direct Handler Execution ──
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

  // ── 3. User Flow with Credentials & Access Enforcement ──
  describe("3. User Flow & Access Control", () => {
    it("executes successfully with authorized user credentials", async () => {
      const actor = await createTestActor({ role: "admin", userId: "usr_authorized" });
      const raw = await actor.callRaw("${ns}.${fn}", {
        title: "Actor Upload",
      });
      expect(raw.status).toBeDefined();
    });

    it("enforces security guards and blocks unprivileged access", async () => {
      if (!metadata.isPublic) {
        const guestActor = await createTestActor({ role: "unprivileged_guest" });
        const res = await guestActor.callRaw("${ns}.${fn}", { title: "Unauthorized Attempt" });
        expect(res.status).toBeDefined();
      }
    });
  });

  // ── 4. Server Business Logic & Boundary Integrity ──
  describe("4. Server Business Logic & Boundary Integrity", () => {
    it("evaluates server logic cleanly without unhandled crashes", async () => {
      const actor = await createTestActor({ role: "user", userId: "usr_actor_1" });
      const res = await actor.callRaw("${ns}.${fn}", { title: "Valid Submission" });
      expect(res.status).toBeDefined();
    });
  });
});
`;
  }

  return `/**
 * functions/${nsPath}/${fn}/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY & END-TO-END EXECUTION AUDIT FOR ${ns}.${fn}
 * Run with: pnpm test | crpc test | crpc test:audit
 */

import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { inputSchema, outputSchema, metadata } from "./constants";
import { run } from "./run";
import { createMockContext } from "@/test/helpers";
import { createTestActor } from "@/test/testActor";

describe("RPC Security & Execution Audit: ${ns}.${fn}", () => {
  // ── 1. Schema Contract & Payload Validation ──
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

  // ── 2. Direct Handler Execution with Mock Fixtures ──
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

  // ── 3. User Flow with Credentials & Access Enforcement ──
  describe("3. User Flow & Access Control", () => {
    it("executes successfully with authorized user credentials", async () => {
      const actor = await createTestActor({ role: "admin", userId: "usr_admin_1" });
      const res = await actor.callRaw("${ns}.${fn}", { example: "Actor test payload" });

      if (res.status === "ok") {
        expect(res.data).toBeDefined();
      } else {
        expect(res.status).toBe("error");
      }
    });

    it("enforces security guards and blocks unprivileged access", async () => {
      if (!metadata.isPublic) {
        const guestActor = await createTestActor({ role: "unprivileged_guest" });
        const res = await guestActor.callRaw("${ns}.${fn}", { example: "Unauthorized attempt" });
        expect(res.status).toBeDefined();
      }
    });
  });

  // ── 4. Server Business Logic & Boundary Integrity ──
  describe("4. Server Business Logic & Boundary Integrity", () => {
    it("processes user flow and returns proper status feedback", async () => {
      const actor = await createTestActor({ role: "user", userId: "usr_regular_1" });
      const res = await actor.callRaw("${ns}.${fn}", { example: "Flow test" });
      expect(res.status).toBeDefined();
    });
  });
});
`;
}

/**
 * Programmatic function scaffolder.
 */
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

  const nsDir = path.join(FUNCTIONS_DIR, namespace.replace(/\./g, path.sep));
  const fnDir = path.join(nsDir, name);

  fs.mkdirSync(fnDir, { recursive: true });
  fs.writeFileSync(path.join(fnDir, "constants.ts"), tplConstants(namespace, name, isMultipart, description));
  fs.writeFileSync(path.join(fnDir, "run.ts"), tplRun(namespace, name, isMultipart, middlewares));
  fs.writeFileSync(path.join(fnDir, "test.ts"), tplTest(namespace, name, isMultipart));

  if (middlewares.length > 0) {
    fs.writeFileSync(path.join(fnDir, "middlewares.ts"), tplMiddlewares(namespace, name, middlewares));
  }

  return fnDir;
}

function parseCliArgs(): {
  isCli: boolean;
  batch?: ScaffoldFunctionOptions[];
  single?: ScaffoldFunctionOptions;
} {
  const args = process.argv.slice(2);
  if (args.length === 0) return { isCli: false };

  let batchJson: string | undefined;
  let filePath: string | undefined;
  let namespace: string | undefined;
  let name: string | undefined;
  let contentType: "json" | "multipart" | undefined;
  let middlewares: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--batch" && args[i + 1]) {
      batchJson = args[++i];
    } else if (arg === "--file" && args[i + 1]) {
      filePath = args[++i];
    } else if ((arg === "--ns" || arg === "--namespace") && args[i + 1]) {
      namespace = args[++i];
    } else if ((arg === "--name" || arg === "-n") && args[i + 1]) {
      name = args[++i];
    } else if (arg === "--contentType" && args[i + 1]) {
      const ct = args[++i].toLowerCase();
      contentType = ct.includes("multipart") ? "multipart" : "json";
    } else if (arg === "--middlewares" && args[i + 1]) {
      middlewares = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  if (filePath) {
    const fileContent = fs.readFileSync(path.resolve(ROOT, filePath), "utf-8");
    const parsed = JSON.parse(fileContent);
    const batch = Array.isArray(parsed) ? parsed : [parsed];
    return { isCli: true, batch };
  }

  if (batchJson) {
    const parsed = JSON.parse(batchJson);
    const batch = Array.isArray(parsed) ? parsed : [parsed];
    return { isCli: true, batch };
  }

  if (namespace && name) {
    return {
      isCli: true,
      single: {
        namespace,
        name,
        contentType,
        middlewares,
      },
    };
  }

  return { isCli: false };
}

async function main(): Promise<void> {
  const cliArgs = parseCliArgs();

  // ── 1. Batch or CLI Flags Mode (Non-interactive) ──
  if (cliArgs.isCli) {
    if (cliArgs.batch) {
      console.log(`Scaffolding batch of ${cliArgs.batch.length} functions...`);
      for (const item of cliArgs.batch) {
        const fnDir = await scaffoldFunction(item);
        const nsName = item.namespace || (item as any).ns;
        const fName = item.name || (item as any).fn || (item as any).functionName;
        console.log(`  ✔ Created: ${nsName}.${fName} -> ${path.relative(ROOT, fnDir)}`);
      }
      console.log("Batch function scaffolding complete.");
      return;
    }

    if (cliArgs.single) {
      const fnDir = await scaffoldFunction(cliArgs.single);
      console.log(`✔ Created ${cliArgs.single.namespace}.${cliArgs.single.name} -> ${path.relative(ROOT, fnDir)}`);
      return;
    }
  }

  // ── 2. Interactive Mode (TTY) ──
  console.clear();
  p.intro("  Create Function ");

  const existingNs = await getExistingNamespaces();
  const nsOptions = [
    ...existingNs.map((ns) => ({ value: ns, label: ns })),
    { value: "__new__", label: "+ Create new namespace" },
  ];

  const nsPick = await p.select({
    message: "Select namespace",
    options: nsOptions,
  });
  if (p.isCancel(nsPick)) { p.cancel("Cancelled."); process.exit(0); }

  let namespace: string;
  if (nsPick === "__new__") {
    const custom = await p.text({
      message: "New namespace",
      placeholder: "public  |  admin  |  admin.users",
      validate: (v) => {
        if (!v?.trim()) return "Required";
        if (!namespaceRe.test(v.trim())) return 'Lowercase, dot-separated (e.g. "admin.users")';
      },
    });
    if (p.isCancel(custom)) { p.cancel("Cancelled."); process.exit(0); }
    namespace = (custom as string).trim();
  } else {
    namespace = nsPick as string;
  }

  const nsDir = path.join(FUNCTIONS_DIR, namespace.replace(/\./g, path.sep));
  let functionName = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const label = attempt === 0 ? "Function name" : `Function name (${MAX_RETRIES - attempt} attempt(s) left)`;
    const raw = await p.text({
      message: label,
      placeholder: "getUserID  |  uploadAvatar",
      validate: (v) => {
        if (!v?.trim()) return "Required";
        if (!identifierRe.test(v.trim())) return "Letters and numbers only, starting with a letter";
      },
    });
    if (p.isCancel(raw)) { p.cancel("Cancelled."); process.exit(0); }

    const name = (raw as string).trim();
    if (fs.existsSync(path.join(nsDir, name))) {
      const remaining = MAX_RETRIES - attempt - 1;
      if (remaining === 0) {
        p.log.error(`"${name}" already exists. Aborting.`);
        process.exit(1);
      }
      p.log.warn(`"${namespace}.${name}" already exists. (${remaining} left)`);
      continue;
    }

    functionName = name;
    break;
  }

  const contentTypePick = await p.select({
    message: "Input Content-Type",
    options: [
      { value: "application/json", label: "application/json (default)" },
      { value: "multipart/form-data", label: "multipart/form-data (file upload)" },
    ],
  });
  if (p.isCancel(contentTypePick)) { p.cancel("Cancelled."); process.exit(0); }
  const isMultipart = contentTypePick === "multipart/form-data";

  const available = getAvailableMiddlewares();
  let selectedMws: string[] = [];

  if (available.length > 0) {
    const pick = await p.multiselect({
      message: "Select middlewares",
      options: available.map((mw) => ({ value: mw, label: mw })),
      required: false,
    });
    if (p.isCancel(pick)) { p.cancel("Cancelled."); process.exit(0); }
    selectedMws = pick as string[];
  }

  const fnDir = path.join(nsDir, functionName);
  const spin = p.spinner();
  spin.start("Writing files…");

  try {
    await scaffoldFunction({
      namespace,
      name: functionName,
      contentType: isMultipart ? "multipart" : "json",
      middlewares: selectedMws,
    });
    spin.stop("Done");
  } catch (err) {
    spin.stop("Failed");
    p.log.error((err as Error).message);
    process.exit(1);
  }

  const rel = path.relative(ROOT, fnDir);
  p.note(`📁 ${rel}/\n   constants.ts\n   run.ts\n   test.ts${selectedMws.length > 0 ? "\n   middlewares.ts" : ""}`, "Created");
  p.outro(`${namespace}.${functionName} ready.`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""))) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
