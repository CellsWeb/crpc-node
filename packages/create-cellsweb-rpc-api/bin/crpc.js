#!/usr/bin/env node
/**
 * bin/crpc.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC Universal Framework CLI (crpc)
 *
 * Provides a unified, zero-config CLI for development, building, testing,
 * security auditing, and code scaffolding with flexible runtime detection.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [,, command, ...args] = process.argv;
const rootDir = process.cwd();
const isBun = typeof process.versions.bun !== "undefined";

function getPackageJson() {
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    } catch {}
  }
  return {};
}

function resolveDevEntry(explicitArg) {
  if (explicitArg && !explicitArg.startsWith("-")) {
    return explicitArg;
  }
  const pkg = getPackageJson();
  if (pkg.crpc?.entry && fs.existsSync(path.resolve(rootDir, pkg.crpc.entry))) {
    return pkg.crpc.entry;
  }
  if (pkg.main) {
    const srcEquivalent = pkg.main
      .replace(/^(\.\/)?(dist|\.crpc)\//, "$1src/")
      .replace(/\.js$/, ".ts");
    if (fs.existsSync(path.resolve(rootDir, srcEquivalent))) {
      return srcEquivalent;
    }
  }
  const candidates = [
    "src/server.ts",
    "src/index.ts",
    "src/app.ts",
    "src/main.ts",
    "server.ts",
    "index.ts",
    "app.ts",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.resolve(rootDir, candidate))) {
      return candidate;
    }
  }
  return "src/server.ts";
}

function resolveStartEntry(explicitArg) {
  if (explicitArg && !explicitArg.startsWith("-")) {
    return explicitArg;
  }
  const pkg = getPackageJson();
  if (pkg.crpc?.startEntry && fs.existsSync(path.resolve(rootDir, pkg.crpc.startEntry))) {
    return pkg.crpc.startEntry;
  }
  if (pkg.main) {
    const mainJs = pkg.main.replace(/\.ts$/, ".js");
    if (fs.existsSync(path.resolve(rootDir, mainJs))) {
      return mainJs;
    }
    const distEquivalent = pkg.main
      .replace(/^(\.\/)?src\//, "$1dist/")
      .replace(/\.ts$/, ".js");
    if (fs.existsSync(path.resolve(rootDir, distEquivalent))) {
      return distEquivalent;
    }
    const crpcEquivalent = pkg.main
      .replace(/^(\.\/)?src\//, "$1.crpc/")
      .replace(/\.ts$/, ".js");
    if (fs.existsSync(path.resolve(rootDir, crpcEquivalent))) {
      return crpcEquivalent;
    }
  }
  const candidates = [
    "dist/server.js",
    "dist/index.js",
    "dist/app.js",
    "dist/main.js",
    ".crpc/server.js",
    ".crpc/index.js",
    ".crpc/app.js",
    "server.js",
    "index.js",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.resolve(rootDir, candidate))) {
      return candidate;
    }
  }
  return "dist/server.js";
}

function runChild(cmd, cmdArgs, env = {}) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const executable = isWindows && cmd === "npx" ? "npx.cmd" : cmd;

    const child = spawn(executable, cmdArgs, {
      stdio: "inherit",
      cwd: rootDir,
      env: { ...process.env, ...env },
    });

    child.on("exit", (code) => {
      resolve(code ?? 0);
    });
    child.on("error", (err) => {
      console.error(err.message);
      resolve(1);
    });
  });
}

async function main() {
  switch (command) {
    case "dev": {
      const explicitArg = args.find((a) => !a.startsWith("-"));
      const remainingArgs = explicitArg ? args.filter((a) => a !== explicitArg) : args;
      const entryFile = resolveDevEntry(explicitArg);

      console.log(`⚡ Starting CellsWeb RPC Development Server (${entryFile})${isBun ? " [Bun]" : ""}...`);
      const runner = isBun ? "bun" : "npx";
      const runnerArgs = isBun
        ? ["--watch", entryFile, ...remainingArgs]
        : ["tsx", "watch", "--clear-screen=false", entryFile, ...remainingArgs];

      const code = await runChild(runner, runnerArgs, { NODE_ENV: "development" });
      process.exit(code);
      break;
    }

    case "build": {
      console.log("📦 Building CellsWeb RPC Production Artifacts...");
      const tscCode = await runChild("npx", ["tsc", ...args], {
        NODE_ENV: "production",
      });
      if (tscCode !== 0) {
        process.exit(tscCode);
      }
      const aliasCode = await runChild("npx", ["tsc-alias", "-f"], {
        NODE_ENV: "production",
      });
      process.exit(aliasCode);
      break;
    }

    case "start": {
      const explicitArg = args.find((a) => !a.startsWith("-"));
      const remainingArgs = explicitArg ? args.filter((a) => a !== explicitArg) : args;
      const entryFile = resolveStartEntry(explicitArg);

      console.log(`🚀 Starting CellsWeb RPC Production Server (${entryFile})${isBun ? " [Bun]" : ""}...`);
      const runner = isBun ? "bun" : "node";
      const code = await runChild(runner, [entryFile, ...remainingArgs], {
        NODE_ENV: "production",
      });
      process.exit(code);
      break;
    }

    case "test": {
      console.log("🧪 Running CellsWeb RPC Automated Test Suites...");
      const code = await runChild("npx", ["vitest", "run", ...args]);
      process.exit(code);
      break;
    }

    case "test:watch": {
      console.log("👀 Running CellsWeb RPC Tests in Watch Mode...");
      const code = await runChild("npx", ["vitest", ...args]);
      process.exit(code);
      break;
    }

    case "test:coverage": {
      console.log("📊 Running CellsWeb RPC Tests with Code Coverage...");
      const code = await runChild("npx", ["vitest", "run", "--coverage", ...args]);
      process.exit(code);
      break;
    }

    case "test:audit": {
      console.log("🛡️ Generating Client Security & Verification Audit Report...");
      const auditDir = path.resolve(rootDir, "audit-reports");
      if (!fs.existsSync(auditDir)) {
        fs.mkdirSync(auditDir, { recursive: true });
      }
      const code = await runChild("npx", [
        "vitest",
        "run",
        "--reporter=verbose",
        "--reporter=json",
        "--outputFile.json=./audit-reports/security-audit.json",
        ...args,
      ]);
      process.exit(code);
      break;
    }

    case "create:function": {
      // 1. Check for project-level custom override (backward compatibility)
      const localScript = path.join(rootDir, "scripts", "create-function.ts");
      if (fs.existsSync(localScript)) {
        const runner = isBun ? "bun" : "npx";
        const runnerArgs = isBun ? [localScript, ...args] : ["tsx", localScript, ...args];
        const code = await runChild(runner, runnerArgs);
        process.exit(code);
      } else {
        // 2. Built-in generator
        const builtinScript = path.join(__dirname, "create-function.js");
        const runner = isBun ? "bun" : "node";
        const code = await runChild(runner, [builtinScript, ...args]);
        process.exit(code);
      }
      break;
    }

    case "create:middleware": {
      // 1. Check for project-level custom override (backward compatibility)
      const localScript = path.join(rootDir, "scripts", "create-middleware.ts");
      if (fs.existsSync(localScript)) {
        const runner = isBun ? "bun" : "npx";
        const runnerArgs = isBun ? [localScript, ...args] : ["tsx", localScript, ...args];
        const code = await runChild(runner, runnerArgs);
        process.exit(code);
      } else {
        // 2. Built-in generator
        const builtinScript = path.join(__dirname, "create-middleware.js");
        const runner = isBun ? "bun" : "node";
        const code = await runChild(runner, [builtinScript, ...args]);
        process.exit(code);
      }
      break;
    }

    default: {
      console.log(`
CellsWeb RPC CLI (crpc)

Usage:
  crpc dev [entry]          Start live development server with auto-reload (src/server.ts, etc.)
  crpc build                Compile TypeScript with production ESM resolution (tsc + tsc-alias -f)
  crpc start [entry]        Run compiled production server (dist/server.js, etc.)
  crpc test                 Run Vitest unit and integration test suites
  crpc test:watch           Run Vitest in watch mode
  crpc test:coverage        Run Vitest with code coverage report
  crpc test:audit           Generate client-facing security & verification audit reports
  crpc create:function      Scaffold a new RPC function (interactive or batch)
  crpc create:middleware    Scaffold a new central middleware
      `);
      process.exit(0);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
