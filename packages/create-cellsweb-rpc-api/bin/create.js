#!/usr/bin/env node

/**
 * create-cellsweb-rpc-api
 * ─────────────────────────────────────────────────────────────────────────────
 * CLI scaffolder — copies the CellsWeb RPC API boilerplate into a target dir.
 *
 * Usage:
 *   npm create cellsweb-rpc-api@latest
 *   npx create-cellsweb-rpc-api@latest
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Colours ──────────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
};

const bold = (s) => `${c.bold}${s}${c.reset}`;
const cyan = (s) => `${c.cyan}${s}${c.reset}`;
const green = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const dim = (s) => `${c.dim}${s}${c.reset}`;

// ─── Banner ───────────────────────────────────────────────────────────────────
console.log(`
${cyan("╔═══════════════════════════════════════════════════════╗")}
${cyan("║")}   ${bold("CellsWeb RPC API")} — production-ready boilerplate       ${cyan("║")}
${cyan("║")}   Custom RPC server · TypeBox · pino · Rate limiting     ${cyan("║")}
${cyan("╚═══════════════════════════════════════════════════════╝")}
`);

// ─── Prompt helper ────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question, defaultVal) =>
  new Promise((resolve) => {
    const hint = defaultVal ? dim(` (${defaultVal})`) : "";
    rl.question(`  ${question}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultVal || "");
    });
  });

// ─── Copy helper (recursive) ──────────────────────────────────────────────────
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // ── 1. Inputs ──────────────────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const rawArg = args.find((arg) => !arg.startsWith("-"));
  const isTTY = Boolean(process.stdin.isTTY);

  // Parse --framework or -f flag
  let explicitFramework = null;
  const fwFlagIdx = args.findIndex((arg) => arg === "--framework" || arg === "-f");
  if (fwFlagIdx !== -1 && args[fwFlagIdx + 1]) {
    explicitFramework = args[fwFlagIdx + 1].toLowerCase().trim();
  } else {
    const inlineFw = args.find((arg) => arg.startsWith("--framework="));
    if (inlineFw) {
      explicitFramework = inlineFw.split("=")[1]?.toLowerCase().trim();
    }
  }

  // Parse non-interactive, package name, and package manager flags
  const hasYesFlag =
    args.includes("-y") ||
    args.includes("--yes") ||
    args.includes("--non-interactive");

  const skipInstall =
    args.includes("--skip-install") ||
    args.includes("--no-install");

  let explicitName = null;
  const nameFlagIdx = args.findIndex((arg) => arg === "--name" || arg === "-n");
  if (nameFlagIdx !== -1 && args[nameFlagIdx + 1]) {
    explicitName = args[nameFlagIdx + 1].trim();
  } else {
    const inlineName = args.find((arg) => arg.startsWith("--name="));
    if (inlineName) {
      explicitName = inlineName.split("=")[1]?.trim();
    }
  }

  let explicitPm = null;
  const pmFlagIdx = args.findIndex((arg) => arg === "--pm");
  if (pmFlagIdx !== -1 && args[pmFlagIdx + 1]) {
    explicitPm = args[pmFlagIdx + 1].trim();
  } else {
    const inlinePm = args.find((arg) => arg.startsWith("--pm="));
    if (inlinePm) {
      explicitPm = inlinePm.split("=")[1]?.trim();
    }
  }

  function normalizeFramework(input) {
    if (!input) return "node";
    const str = String(input).toLowerCase().trim();
    if (str === "1" || str === "node" || str === "vanilla" || str === "vanilla node" || str === "vanilla node.js" || str === "node.js") return "node";
    if (str === "2" || str === "express") return "express";
    if (str === "3" || str === "fastify") return "fastify";
    if (str === "4" || str === "ultimate-express" || str === "ultimate" || str === "ue") return "ultimate-express";
    if (str === "5" || str === "hono") return "hono";
    if (str === "6" || str === "elysia" || str === "elysiajs" || str === "elysia.js") return "elysia";
    if (str === "7" || str === "bun" || str === "bun-native" || str === "bun native") return "bun";
    return "node";
  }

  let targetDir;
  let projectName;
  let pm;
  let framework = "node";

  if (rawArg) {
    targetDir = path.resolve(process.cwd(), rawArg);
  } else if (!isTTY || hasYesFlag) {
    targetDir = path.resolve(process.cwd(), "./api");
  } else {
    const answer = await ask("Target directory", "./api");
    targetDir = path.resolve(process.cwd(), answer);
  }

  const defaultName =
    path.basename(targetDir) === "" || path.basename(targetDir) === "/"
      ? "my-rpc-api"
      : path.basename(targetDir);

  const shouldPrompt = isTTY && !hasYesFlag;

  if (!shouldPrompt) {
    projectName = explicitName || defaultName;
    pm = explicitPm || "pnpm";
    framework = normalizeFramework(explicitFramework);
    rl.close();
  } else {
    projectName = explicitName || (await ask("Package name", defaultName));
    const pmAnswer =
      explicitPm || (await ask("Package manager  [npm / pnpm / yarn / bun]", "pnpm"));
    pm = ["npm", "pnpm", "yarn", "bun"].includes(pmAnswer) ? pmAnswer : "pnpm";

    if (explicitFramework) {
      framework = normalizeFramework(explicitFramework);
    } else {
      console.log(`\n  ${bold("Base web framework:")}`);
      console.log(`    ${cyan("1)")} Vanilla Node.js ${dim("(Default — zero extra dependencies, native node:http)")}`);
      console.log(`    ${cyan("2)")} Express ${dim("(Standard — easiest for traditional REST routes & middlewares)")}`);
      console.log(`    ${cyan("3)")} Fastify ${dim("(High performance & rich plugin ecosystem)")}`);
      console.log(`    ${cyan("4)")} Ultimate-Express ${dim("(uWebSockets.js-backed Express drop-in)")}`);
      console.log(`    ${cyan("5)")} Hono ${dim("(Ultra-fast Web Standards & multi-runtime: Bun, Deno, Node)")}`);
      console.log(`    ${cyan("6)")} Elysia.js ${dim("(Bun-native & TypeBox first-class)")}`);
      console.log(`    ${cyan("7)")} Bun Native ${dim("(Zero extra dependencies, native Bun.serve)")}`);
      const fwAnswer = await ask("Choose framework [1/2/3/4/5/6/7]", "1");
      framework = normalizeFramework(fwAnswer);
    }
    rl.close();
  }

  // ── 2. Guard ───────────────────────────────────────────────────────────────
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.log(`\n  ${yellow("⚠")}  ${bold(targetDir)} already exists and is not empty.`);
    console.log(`     Files will be merged — existing files will NOT be overwritten.\n`);
  }

  // ── 3. Copy template ───────────────────────────────────────────────────────
  const templateDir = path.join(__dirname, "..", "template");
  console.log(`\n  ${dim("Scaffolding into")} ${cyan(targetDir)} ...\n`);
  copyDir(templateDir, targetDir);

  // ── 3.5 Swap server.ts template if non-default framework selected ─────────
  const serverTemplatePath = path.join(__dirname, "..", "templates", "servers", `server.${framework}.ts`);
  if (fs.existsSync(serverTemplatePath)) {
    fs.copyFileSync(serverTemplatePath, path.join(targetDir, "src", "server.ts"));
  }

  // ── 4. Write package.json ──────────────────────────────────────────────────
  const pkg = {
    name: projectName,
    version: "0.1.0",
    type: "module",
    private: true,
    scripts: {
      dev: "crpc dev",
      build: "crpc build",
      start: "crpc start",
      typecheck: "tsc --noEmit",
      test: "crpc test",
      "test:watch": "crpc test:watch",
      "test:coverage": "crpc test:coverage",
      "test:audit": "crpc test:audit",
      "create:function": "crpc create:function",
      "create:middleware": "crpc create:middleware",
    },
    engines: {
      node: ">=24.0.0",
    },
    dependencies: {
      "@cellsweb/rpc-core": "^1.0.33",
      "@aws-sdk/client-s3": "^3.700.0",
      "@paralleldrive/cuid2": "^2.2.2",
      "@sentry/node": "^8.40.0",
      "@sinclair/typebox": "^0.34.52",
      "busboy": "^1.6.0",
      "dotenv": "^17.4.2",
      "lru-cache": "^11.1.0",
      "mime-types": "^3.0.2",
      "pino": "^9.7.0",
      "rate-limiter-flexible": "^7.1.0",
      "safe-stable-stringify": "^2.5.0",
      "tinyglobby": "^0.2.12",
    },
    devDependencies: {
      "@types/busboy": "^1.5.4",
      "@types/mime-types": "^3.0.1",
      "@types/node": "^22.15.18",
      "@vitest/coverage-v8": "^3.2.4",
      "@vitest/ui": "^3.2.4",
      "pino-pretty": "^13.0.0",
      "tsc-alias": "^1.8.17",
      "tsx": "^4.22.0",
      "typescript": "^7.0.2",
      "vitest": "^3.2.4",
    },
    pnpm: {
      onlyBuiltDependencies: ["esbuild"],
    },
  };

  // Add framework-specific dependencies
  if (framework === "express") {
    pkg.dependencies["express"] = "^4.21.2";
    pkg.devDependencies["@types/express"] = "^5.0.0";
  } else if (framework === "fastify") {
    pkg.dependencies["fastify"] = "^5.2.1";
  } else if (framework === "ultimate-express") {
    pkg.dependencies["ultimate-express"] = "^2.2.1";
    pkg.devDependencies["@types/express"] = "^5.0.0";
  } else if (framework === "hono") {
    pkg.dependencies["hono"] = "^4.7.0";
    pkg.dependencies["@hono/node-server"] = "^1.13.8";
  } else if (framework === "elysia") {
    pkg.dependencies["elysia"] = "^1.2.0";
  } else if (framework === "bun") {
    // Bun native requires zero extra dependencies!
  }

  fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  // ── 5. Write tsconfig.json ─────────────────────────────────────────────────
  const tsconfig = {
    compilerOptions: {
      outDir: "./dist",
      rootDir: "./src",
      module: "ESNext",
      moduleResolution: "Bundler",
      target: "ES2023",
      lib: ["ES2023", "DOM"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      paths: { "@/*": ["./src/*"] },
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
  fs.writeFileSync(path.join(targetDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2) + "\n");

  // ── 6. Write .gitignore & .npmrc ──────────────────────────────────────────
  const gitignore = ["node_modules", "dist", ".env", "*.log", ".DS_Store"].join("\n") + "\n";
  const giPath = path.join(targetDir, ".gitignore");
  if (!fs.existsSync(giPath)) fs.writeFileSync(giPath, gitignore);

  const npmrc = "onlyBuiltDependencies=esbuild\n";
  const npmrcPath = path.join(targetDir, ".npmrc");
  if (!fs.existsSync(npmrcPath)) fs.writeFileSync(npmrcPath, npmrc);

  // ── 7.5 Copy .env.example -> .env ────────────────────────────────────────
  const envExamplePath = path.join(targetDir, ".env.example");
  const envPath = path.join(targetDir, ".env");
  if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
    fs.copyFileSync(envExamplePath, envPath);
  }

  // ── 8. Install ────────────────────────────────────────────────────────────
  if (!skipInstall) {
    console.log(`  ${dim("Installing dependencies with")} ${bold(pm)} ...\n`);
    try {
      const installCmd =
        pm === "pnpm"
          ? "pnpm install || (pnpm approve-builds esbuild && pnpm install)"
          : `${pm} install`;
      execSync(installCmd, { cwd: targetDir, stdio: "inherit" });
    } catch {
      console.log(`  ${yellow("⚠")}  Install failed — run ${bold(`${pm} install`)} manually.\n`);
    }
  } else {
    console.log(`  ${dim("Skipping dependency installation (--skip-install).")}\n`);
  }

  // ── 9. Done ───────────────────────────────────────────────────────────────
  const fwNameMap = {
    node: "Vanilla Node.js (node:http)",
    express: "Express",
    fastify: "Fastify",
    "ultimate-express": "Ultimate-Express (uWebSockets.js)",
    hono: "Hono (Web Standards & Multi-Runtime)",
    elysia: "Elysia.js (Bun-Native & TypeBox)",
    bun: "Bun Native (native Bun.serve)",
  };

  console.log(`
  ${green("✔")}  ${bold("Done!")} Your RPC API is ready.

  ${dim("Framework:")}     ${cyan(fwNameMap[framework] || framework)}
  ${dim("Target dir:")}    ${cyan(targetDir)}

  ${dim("Next steps:")}
    ${cyan(`cd ${path.relative(process.cwd(), targetDir) || "."}`)}
    ${cyan(`${pm} run dev`)}                  ${dim("→ start dev server with crpc (hot-reload)")}
    ${cyan(`${pm} run create:function`)}       ${dim("→ scaffold a new API function")}
    ${cyan(`${pm} run create:middleware`)}     ${dim("→ scaffold a new middleware")}
    ${cyan(`${pm} run test:audit`)}            ${dim("→ generate multi-tenant security audit report")}

  ${dim("Add your JWT logic in:")}
    ${cyan("src/middlewares/auth/run.ts")}  ${dim("→ verifyToken()")}

  ${dim("API endpoint:")}  POST ${cyan("http://localhost:4000/rpc")}
  ${dim("Docs:")}          GET  ${cyan("http://localhost:4000/docs")}
`);
}

main().catch((err) => {
  console.error(`\n  ${c.red}✖${c.reset}  ${err.message}\n`);
  process.exit(1);
});
