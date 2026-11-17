import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CoreRPC } from "@cellsweb/rpc-core";

describe("CellsWeb RPC API Boilerplate Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let tempDir: string;
  let functionsDir: string;
  let middlewaresDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-test-"));
    functionsDir = path.join(tempDir, "functions");
    middlewaresDir = path.join(tempDir, "middlewares");

    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }));
    try {
      fs.symlinkSync(
        path.resolve(process.cwd(), "node_modules"),
        path.join(tempDir, "node_modules"),
        "dir"
      );
    } catch {}

    // ── Create Central Middlewares ──
    const reqHeaderDir = path.join(middlewaresDir, "requireHeader");
    fs.mkdirSync(reqHeaderDir, { recursive: true });
    fs.writeFileSync(
      path.join(reqHeaderDir, "constants.ts"),
      `import { Type } from "@sinclair/typebox";
       export const headersSchema = Type.Object({ "x-test-header": Type.String() });
       export const optionsSchema = Type.Object({ tag: Type.String() });`,
    );
    fs.writeFileSync(
      path.join(reqHeaderDir, "run.ts"),
      `export const run = async ({ headers, options }, context) => {
         if (!headers["x-test-header"]) throw new Error("Header missing");
         return { ...context, testTag: options.tag };
       };`,
    );

    // ── Create Functions ──
    // 1. public.echoJson
    const echoDir = path.join(functionsDir, "public", "echoJson");
    fs.mkdirSync(echoDir, { recursive: true });
    fs.writeFileSync(
      path.join(echoDir, "constants.ts"),
      `import { Type } from "@sinclair/typebox";
       export const metadata = { description: "echo" };
       export const contentType = "application/json";
       export const inputSchema = Type.Object({ message: Type.String({ minLength: 2 }) });
       export const outputSchema = Type.Object({ reply: Type.String() });`,
    );
    fs.writeFileSync(
      path.join(echoDir, "run.ts"),
      `export const run = async (input, context) => ({ reply: input.message + "_" + (context.testTag || "none") });`,
    );
    fs.writeFileSync(
      path.join(echoDir, "middlewares.ts"),
      `import { defineMiddlewares } from "@cellsweb/rpc-core";
       export const middlewares = defineMiddlewares([
         { name: "requireHeader", options: { tag: "echo-tag" } }
       ]);`,
    );

    const app = new CoreRPC({
      functionsDir,
      middlewaresDir,
      docs: true,
    });

    const handler = await app.createHandler();
    server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("1. Responds to health check at /health", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
  });

  it("2. JSON RPC function succeeds with headers & schema", async () => {
    const res = await fetch(`${baseUrl}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-header": "valid",
      },
      body: JSON.stringify({
        namespace: "public",
        functionName: "echoJson",
        data: { message: "hello" },
      }),
    });
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.data.reply).toBe("hello_echo-tag");
  });

  it("3. Rejects invalid input schema", async () => {
    const res = await fetch(`${baseUrl}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-header": "valid",
      },
      body: JSON.stringify({
        namespace: "public",
        functionName: "echoJson",
        data: { message: "a" },
      }),
    });
    const json = await res.json();
    expect(json.status).toBe("error");
    expect(json.code).toBe("validation_error");
  });
});
