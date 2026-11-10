#!/usr/bin/env node
/**
 * bin/create-middleware.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Built-in CellsWeb RPC middleware generator.
 * Scaffolds new central middlewares with constants, run, and unit tests.
 *
 * SUPPORTED MODES:
 *  1. Interactive Mode (Default in TTY):
 *     crpc create:middleware
 *
 *  2. Single CLI Flag Mode (Non-interactive for AI Coders & Devs):
 *     crpc create:middleware --name tenantResolver --description "Resolves organization tenant"
 *
 *  3. Batch Mode:
 *     crpc create:middleware --batch '["auth","rateLimit","tenantResolver"]'
 *     crpc create:middleware --file specs/middlewares.json
 */

import * as p from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";

const MAX_RETRIES = 5;
const ROOT = process.cwd();

export function detectConfiguredDirs(rootDir = process.cwd()) {
  let functionsDir = null;
  let middlewaresDir = null;

  if (process.env.RPC_FUNCTIONS_DIR) functionsDir = process.env.RPC_FUNCTIONS_DIR;
  if (process.env.RPC_MIDDLEWARES_DIR) middlewaresDir = process.env.RPC_MIDDLEWARES_DIR;

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

const configuredDirs = detectConfiguredDirs(ROOT);
const MIDDLEWARES_DIR = configuredDirs.middlewaresDir;

const identifierRe = /^[a-zA-Z][a-zA-Z0-9]*$/;

function tplConstants(name, desc) {
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

function tplRun(name) {
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
}

function tplTest(name) {
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
export async function scaffoldMiddleware(options) {
  const { name, description } = options;
  const targetDir = options.targetDir || MIDDLEWARES_DIR;
  const mwDir = path.join(targetDir, name);

  fs.mkdirSync(mwDir, { recursive: true });
  fs.writeFileSync(path.join(mwDir, "constants.ts"), tplConstants(name, description));
  fs.writeFileSync(path.join(mwDir, "run.ts"), tplRun(name));
  fs.writeFileSync(path.join(mwDir, "test.ts"), tplTest(name));

  return mwDir;
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) return { isCli: false };

  let batchJson;
  let filePath;
  let name;
  let description;
  let targetDir = MIDDLEWARES_DIR;

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
    } else if ((arg === "--middlewaresDir" || arg === "--dir") && args[i + 1]) {
      targetDir = path.resolve(ROOT, args[++i]);
    }
  }

  if (filePath) {
    const fileContent = fs.readFileSync(path.resolve(ROOT, filePath), "utf-8");
    const parsed = JSON.parse(fileContent);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const batch = list.map((item) => {
      const obj = typeof item === "string" ? { name: item } : item;
      return targetDir ? { targetDir, ...obj } : obj;
    });
    return { isCli: true, batch };
  }

  if (batchJson) {
    const parsed = JSON.parse(batchJson);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const batch = list.map((item) => {
      const obj = typeof item === "string" ? { name: item } : item;
      return targetDir ? { targetDir, ...obj } : obj;
    });
    return { isCli: true, batch };
  }

  if (name) {
    return {
      isCli: true,
      single: { name, description, targetDir },
    };
  }

  return { isCli: false };
}

async function main() {
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

    const name = raw.trim();
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
    p.log.error(err.message);
    process.exit(1);
  }

  const rel = path.relative(ROOT, mwDir);
  p.note(`📁 ${rel}/\n   constants.ts\n   run.ts\n   test.ts`, "Created");
  p.outro(`"${middlewareName}" ready.`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""))) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
