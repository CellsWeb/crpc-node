#!/usr/bin/env node
/**
 * scripts/create-middleware.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Scaffolds new central middlewares with constants, run, and unit tests.
 *
 * SUPPORTED MODES:
 *  1. Interactive Mode (Default in TTY):
 *     pnpm create:middleware
 *
 *  2. Single CLI Flag Mode (Non-interactive for AI Coders & Devs):
 *     pnpm create:middleware --name tenantResolver --description "Resolves organization tenant"
 *
 *  3. Batch Mode:
 *     pnpm create:middleware --batch '["auth","rateLimit","tenantResolver"]'
 *     pnpm create:middleware --file specs/middlewares.json
 */

import * as p from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";

const MAX_RETRIES = 5;
const ROOT = process.cwd();
const MIDDLEWARES_DIR = path.join(ROOT, "src", "middlewares");

export interface ScaffoldMiddlewareOptions {
  name: string;
  description?: string;
}

const identifierRe = /^[a-zA-Z][a-zA-Z0-9]*$/;

function tplConstants(name: string, desc?: string): string {
  const descriptionStr = desc || `Enforces security policies or request transformations for ${name}`;

  return `/**
 * middlewares/${name}/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MIDDLEWARE CONTRACT & METADATA
 *
 * WHAT TO TOUCH:
 *  - metadata: Human-readable description displayed in /docs.
 *  - headersSchema: Optional headers this middleware requires/reads. Include description in Type properties!
 *  - optionsSchema: Config options passed in function middlewares.ts. Include description & default in Type properties!
 */

import { Type } from "@sinclair/typebox";

export const metadata = {
  name: "${name}",
  description: "${descriptionStr}",
};

export const headersSchema = Type.Object({
  // e.g. "x-${name}-token": Type.String({ description: "Authentication token for ${name}" })
}, { additionalProperties: true });

export const optionsSchema = Type.Object({
  // e.g. enabled: Type.Boolean({ default: true, description: "Enable ${name} middleware processing" })
}, { additionalProperties: false });
`;
}

function tplRun(name: string): string {
  return `/**
 * middlewares/${name}/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MIDDLEWARE IMPLEMENTATION
 *
 * MIDDLEWARE INPUT PARAMETERS:
 *  - params.headers: Incoming HTTP request headers (e.g. authorization, x-tenant-id)
 *  - params.options: Function-level options configured in function's middlewares.ts
 *  - params.function: Target function metadata ({ key, namespace, functionName, contentType })
 *  - context: Immutable request context ({ requestId, ip, requestStartTime, req })
 *
 * WHAT TO TOUCH:
 *  - Implement header checks, token verifications, or rate-limiting guards here.
 *  - Return augmented context object: return { ...context, ${name}: "value" }.
 *  - Throw AppError (e.g. ErrorCode.UNAUTHORIZED) to reject invalid requests.
 */

import type { MiddlewareFn } from "@cellsweb/rpc-core";
import type { Static } from "@sinclair/typebox";
import { optionsSchema } from "./constants";

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
}

function tplTest(name: string): string {
  return `/**
 * middlewares/${name}/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIT TEST FOR ${name} MIDDLEWARE
 * Run with: pnpm test | pnpm test:audit
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
}

/**
 * Programmatic middleware scaffolder.
 */
export async function scaffoldMiddleware(options: ScaffoldMiddlewareOptions): Promise<string> {
  const { name, description } = options;
  const mwDir = path.join(MIDDLEWARES_DIR, name);

  fs.mkdirSync(mwDir, { recursive: true });
  fs.writeFileSync(path.join(mwDir, "constants.ts"), tplConstants(name, description));
  fs.writeFileSync(path.join(mwDir, "run.ts"), tplRun(name));
  fs.writeFileSync(path.join(mwDir, "test.ts"), tplTest(name));

  return mwDir;
}

function parseCliArgs(): {
  isCli: boolean;
  batch?: ScaffoldMiddlewareOptions[];
  single?: ScaffoldMiddlewareOptions;
} {
  const args = process.argv.slice(2);
  if (args.length === 0) return { isCli: false };

  let batchJson: string | undefined;
  let filePath: string | undefined;
  let name: string | undefined;
  let description: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--batch" && args[i + 1]) {
      batchJson = args[++i];
    } else if (arg === "--file" && args[i + 1]) {
      filePath = args[++i];
    } else if ((arg === "--name" || arg === "-n") && args[i + 1]) {
      name = args[++i];
    } else if ((arg === "--description" || arg === "-d") && args[i + 1]) {
      description = args[++i];
    }
  }

  if (filePath) {
    const fileContent = fs.readFileSync(path.resolve(ROOT, filePath), "utf-8");
    const parsed = JSON.parse(fileContent);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const batch = list.map((item) => (typeof item === "string" ? { name: item } : item));
    return { isCli: true, batch };
  }

  if (batchJson) {
    const parsed = JSON.parse(batchJson);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const batch = list.map((item) => (typeof item === "string" ? { name: item } : item));
    return { isCli: true, batch };
  }

  if (name) {
    return {
      isCli: true,
      single: { name, description },
    };
  }

  return { isCli: false };
}

async function main(): Promise<void> {
  const cliArgs = parseCliArgs();

  // ── 1. Batch or CLI Flags Mode (Non-interactive) ──
  if (cliArgs.isCli) {
    if (cliArgs.batch) {
      console.log(`Scaffolding batch of ${cliArgs.batch.length} middlewares...`);
      for (const item of cliArgs.batch) {
        const mwDir = await scaffoldMiddleware(item);
        console.log(`  ✔ Created: ${item.name} -> ${path.relative(ROOT, mwDir)}`);
      }
      console.log("Batch middleware scaffolding complete.");
      return;
    }

    if (cliArgs.single) {
      const mwDir = await scaffoldMiddleware(cliArgs.single);
      console.log(`✔ Created middleware ${cliArgs.single.name} -> ${path.relative(ROOT, mwDir)}`);
      return;
    }
  }

  // ── 2. Interactive Mode (TTY) ──
  console.clear();
  p.intro("  Create Middleware ");

  let middlewareName = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const label = attempt === 0 ? "Middleware name" : `Middleware name (${MAX_RETRIES - attempt} attempt(s) left)`;

    const raw = await p.text({
      message: label,
      placeholder: "auth  |  rateLimit  |  tenantResolver",
      validate: (v) => {
        if (!v?.trim()) return "Required";
        if (!identifierRe.test(v.trim())) return "Letters and numbers only, starting with a letter";
      },
    });
    if (p.isCancel(raw)) { p.cancel("Cancelled."); process.exit(0); }

    const name = (raw as string).trim();
    if (fs.existsSync(path.join(MIDDLEWARES_DIR, name))) {
      const remaining = MAX_RETRIES - attempt - 1;
      if (remaining === 0) {
        p.log.error(`"${name}" already exists. Aborting.`);
        process.exit(1);
      }
      p.log.warn(`Middleware "${name}" already exists. (${remaining} left)`);
      continue;
    }

    middlewareName = name;
    break;
  }

  const mwDir = path.join(MIDDLEWARES_DIR, middlewareName);
  const spin = p.spinner();
  spin.start("Writing files…");

  try {
    await scaffoldMiddleware({ name: middlewareName });
    spin.stop("Done");
  } catch (err) {
    spin.stop("Failed");
    p.log.error((err as Error).message);
    process.exit(1);
  }

  const rel = path.relative(ROOT, mwDir);
  p.note(`📁 ${rel}/\n   constants.ts\n   run.ts\n   test.ts`, "Created");
  p.outro(`"${middlewareName}" ready.`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""))) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
