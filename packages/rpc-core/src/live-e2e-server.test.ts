import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import http from "node:http";
import type { Socket } from "node:net";
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CoreRPC } from "./core-rpc";
import { AppError, ErrorCode } from "./errors";
import { Type } from "@sinclair/typebox";
import { rawRpcRequest, createRpcClient } from "../../rpc-client/src";
import type { RegisteredFunction, RegisteredMiddleware } from "./registry";
import { parseJsonRequest } from "./request/json";

describe("Live Network E2E Server & Break-Resistance Test Suite", () => {
  let app: CoreRPC;
  let server: http.Server;
  let port: number;
  let baseUrl: string;
  let delayedAuthInvocations = 0;
  const tmpDir = process.env.UPLOAD_TMP_DIR ?? path.join(os.tmpdir(), "cellsweb-uploads");

  beforeAll(async () => {
    // 1. Create CoreRPC instance with custom endpoints and CORS enabled
    app = new CoreRPC({
      rpcEndpoint: "/api/rpc",
      docsEndpoint: "/api/docs",
      healthEndpoint: "/api/health",
      cors: { origin: "http://localhost:3000", credentials: true },
    });

    // 2. Inject mock functions and middlewares directly into registry for comprehensive live testing
    const registry = await app.getRegistry();

    // Function 1: Standard public greet
    registry.functions.set("public.greet", {
      key: "public.greet",
      namespace: "public",
      functionName: "greet",
      metadata: { description: "Greets a user", isPublic: true },
      contentType: "application/json",
      inputSchema: Type.Object({ name: Type.String({ minLength: 2 }) }),
      outputSchema: Type.Object({ message: Type.String() }),
      middlewares: [],
      filePath: "/mock/public/greet/run.ts",
      run: async (input: { name: string }) => ({ message: `Hello, ${input.name}!` }),
    } as unknown as RegisteredFunction);

    // Function 2: Array payload preservation
    registry.functions.set("catalog.bulkDelete", {
      key: "catalog.bulkDelete",
      namespace: "catalog",
      functionName: "bulkDelete",
      metadata: { description: "Bulk deletes items", isPublic: true },
      contentType: "application/json",
      inputSchema: Type.Array(Type.String()),
      outputSchema: Type.Object({ deletedCount: Type.Number(), ids: Type.Array(Type.String()) }),
      middlewares: [],
      filePath: "/mock/catalog/bulkDelete/run.ts",
      run: async (input: string[]) => ({ deletedCount: input.length, ids: input }),
    } as unknown as RegisteredFunction);

    // Function 3: Protected function with auth middleware
    registry.middlewares.set("authGuard", {
      name: "authGuard",
      metadata: { description: "Enforces auth token" },
      optionsSchema: Type.Object({ role: Type.String() }),
      run: async ({ headers, options }) => {
        const token = headers["authorization"];
        if (!token || token !== "Bearer secret-token") {
          throw new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized token");
        }
        return { user: { role: options.role } };
      },
    } as unknown as RegisteredMiddleware);

    registry.functions.set("admin.getSecrets", {
      key: "admin.getSecrets",
      namespace: "admin",
      functionName: "getSecrets",
      metadata: { description: "Sensitive admin secrets", isPublic: false },
      contentType: "application/json",
      inputSchema: Type.Object({ key: Type.String() }),
      outputSchema: Type.Object({ secret: Type.String() }),
      middlewares: [{ name: "authGuard", options: { role: "admin" } }],
      filePath: "/mock/admin/getSecrets/run.ts",
      run: async () => ({ secret: "classified-42" }),
    } as unknown as RegisteredFunction);

    // Function 4: Worker thread function
    registry.functions.set("compute.heavy", {
      key: "compute.heavy",
      namespace: "compute",
      functionName: "heavy",
      metadata: { description: "Offloads to worker pool", isPublic: true },
      contentType: "application/json",
      worker: true,
      inputSchema: Type.Object({ n: Type.Number() }),
      outputSchema: Type.Object({ result: Type.Number() }),
      middlewares: [],
      filePath: "/mock/compute/heavy/run.ts",
      run: async (input: { n: number }) => {
        let sum = 0;
        for (let i = 0; i < input.n; i++) sum += i;
        return { result: sum };
      },
    } as unknown as RegisteredFunction);

    // Function 5: Protected multipart function
    registry.functions.set("admin.uploadSecret", {
      key: "admin.uploadSecret",
      namespace: "admin",
      functionName: "uploadSecret",
      metadata: { description: "Sensitive file upload", isPublic: false },
      contentType: "multipart/form-data",
      inputSchema: Type.Object({ note: Type.String() }),
      outputSchema: Type.Object({ ok: Type.Boolean() }),
      middlewares: [{ name: "authGuard", options: { role: "admin" } }],
      filePath: "/mock/admin/uploadSecret/run.ts",
      run: async () => ({ ok: true }),
    } as unknown as RegisteredFunction);

    // Function 6 & Middleware: Delayed Auth for Concurrent Multi-File Fallback Upload Testing
    registry.middlewares.set("delayedAuthGuard", {
      name: "delayedAuthGuard",
      metadata: { description: "Enforces auth token with artificial async delay" },
      optionsSchema: Type.Object({ role: Type.String() }),
      run: async ({ headers, options }) => {
        delayedAuthInvocations++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        const token = headers["authorization"];
        if (!token || token !== "Bearer delayed-secret") {
          throw new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized delayed token");
        }
        return { user: { role: options.role } };
      },
    } as unknown as RegisteredMiddleware);

    registry.functions.set("admin.multiUpload", {
      key: "admin.multiUpload",
      namespace: "admin",
      functionName: "multiUpload",
      metadata: { description: "Multi-file upload with delayed auth", isPublic: false },
      contentType: "multipart/form-data",
      inputSchema: Type.Object({ note: Type.String() }),
      outputSchema: Type.Object({ ok: Type.Boolean(), count: Type.Number() }),
      middlewares: [{ name: "delayedAuthGuard", options: { role: "admin" } }],
      filePath: "/mock/admin/multiUpload/run.ts",
      run: async (input: { note: string; [key: string]: any }) => {
        const files = Array.isArray(input.files) ? input.files : input.files ? [input.files] : [];
        return { ok: true, count: files.length };
      },
    } as unknown as RegisteredFunction);

    // Start live HTTP server on ephemeral port (port: 0)
    const handler = await app.createHandler();
    server = http.createServer(handler);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  });

  // ─── 1. Health & Docs Endpoints ─────────────────────────────────────────────
  it("serves custom health endpoint via HTTP GET", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  it("serves interactive docs UI HTML via HTTP GET", async () => {
    const res = await fetch(`${baseUrl}/api/docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
  });

  // ─── 2. CORS Preflight & Headers ─────────────────────────────────────────────
  it("responds to CORS preflight OPTIONS request with 204 and correct headers", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, authorization",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  // ─── 3. Wire Protocol & Successful Execution ─────────────────────────────────
  it("returns a structured payload_too_large response for oversized JSON over live HTTP", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: "public",
        functionName: "greet",
        data: { name: "x".repeat(1.5 * 1024 * 1024) },
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "error", code: "payload_too_large" });
  });

  it("executes valid JSON RPC request via raw HTTP POST", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: "public",
        functionName: "greet",
        data: { name: "Alice" },
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("ok");
    expect(json.data.message).toBe("Hello, Alice!");
    expect(json.meta.requestId).toBeDefined();
    expect(typeof json.meta.durationMs).toBe("number");
  });

  it("preserves URL query strings on the RPC endpoint (/api/rpc?trace=1&foo=bar)", async () => {
    const res = await fetch(`${baseUrl}/api/rpc?trace=1&foo=bar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: "public",
        functionName: "greet",
        data: { name: "Bob" },
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("ok");
    expect(json.data.message).toBe("Hello, Bob!");
  });

  it("handles and preserves native array payloads correctly", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: "catalog",
        functionName: "bulkDelete",
        data: ["prod_1", "prod_2", "prod_3"],
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("ok");
    expect(json.data.deletedCount).toBe(3);
    expect(json.data.ids).toEqual(["prod_1", "prod_2", "prod_3"]);
  });

  // ─── 4. Client SDK Integration over Real Network ─────────────────────────────
  it("works seamlessly with @cellsweb/rpc-client (rawRpcRequest & createRpcClient)", async () => {
    const client = createRpcClient({
      baseUrl,
      rpcEndpoint: "/api/rpc",
    });

    const result = await client.request<{ message: string }>({
      namespace: "public",
      functionName: "greet",
      data: { name: "SDK User" },
    });

    expect(result.message).toBe("Hello, SDK User!");

    const rawResult = await rawRpcRequest<{ deletedCount: number; ids: string[] }>({
      baseUrl,
      rpcEndpoint: "/api/rpc",
      namespace: "catalog",
      functionName: "bulkDelete",
      data: ["item_A", "item_B"],
    });

    expect(rawResult.deletedCount).toBe(2);
    expect(rawResult.ids).toEqual(["item_A", "item_B"]);
  });

  // ─── 5. Security & Boundary Hardening (Attacks & Edge Cases) ────────────────
  it("rejects invalid Content-Type with 200 invalid_content_type", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "plain text attack",
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("invalid_content_type");
  });

  it("rejects malformed / unparseable JSON bodies gracefully", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json ...",
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("invalid_body");
  });

  it("rejects empty body payloads gracefully", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("invalid_body");
  });

  it("rejects requests missing namespace or functionName", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { name: "Alice" } }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("invalid_body");
  });

  it("rejects non-existent functions with function_not_found", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: "hacker",
        functionName: "steal",
        data: {},
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("function_not_found");
  });

  it("enforces strict TypeBox validation constraints (fails minLength)", async () => {
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: "public",
        functionName: "greet",
        data: { name: "x" }, // minLength is 2
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("validation_error");
    expect(json.message).toContain("name");
    expect(json.details).toBeDefined();
  });

  it("enforces fail-closed middleware security (blocks unauthorized access)", async () => {
    // Attempt without token
    const resNoToken = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: "admin",
        functionName: "getSecrets",
        data: { key: "main" },
      }),
    });
    const jsonNoToken = (await resNoToken.json()) as any;
    expect(jsonNoToken.status).toBe("error");

    // Attempt with valid token
    const resAuth = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        namespace: "admin",
        functionName: "getSecrets",
        data: { key: "main" },
      }),
    });
    const jsonAuth = (await resAuth.json()) as any;
    expect(jsonAuth.status).toBe("ok");
    expect(jsonAuth.data.secret).toBe("classified-42");
  });

  it("delivers structured RPC error without ECONNRESET when fallback multipart auth fails", async () => {
    const formData = new FormData();
    formData.append("namespace", "admin");
    formData.append("functionName", "uploadSecret");
    formData.append("note", "secret file");
    formData.append("file", new Blob(["hello world file content"], { type: "text/plain" }), "test.txt");

    // Send WITHOUT Authorization header over real HTTP
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("unauthorized");
    expect(json.message).toContain("Unauthorized token");
  });

  it("deduplicates concurrent onBeforeFileSave hook across multiple files with delayed auth", async () => {
    delayedAuthInvocations = 0;
    const formData = new FormData();
    formData.append("namespace", "admin");
    formData.append("functionName", "multiUpload");
    formData.append("note", "concurrent-batch");
    formData.append("files", new Blob(["file content A"], { type: "text/plain" }), "a.txt");
    formData.append("files", new Blob(["file content B"], { type: "text/plain" }), "b.txt");
    formData.append("files", new Blob(["file content C"], { type: "text/plain" }), "c.txt");

    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      headers: {
        Authorization: "Bearer delayed-secret",
      },
      body: formData,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("ok");
    expect(json.data.ok).toBe(true);
    expect(json.data.count).toBe(3);
    // Crucial: Despite 3 concurrent file streams triggering the pre-auth hook,
    // the auth middleware executed exactly ONCE via the shared authPromise.
    expect(delayedAuthInvocations).toBe(1);
  });

  it("deduplicates concurrent onBeforeFileSave hook and writes zero disk files when delayed auth fails", async () => {
    delayedAuthInvocations = 0;
    const testFileTag = `unauth-dedup-${Date.now()}`;

    const formData = new FormData();
    formData.append("namespace", "admin");
    formData.append("functionName", "multiUpload");
    formData.append("note", "unauthorized-batch");
    formData.append("files", new Blob(["unauthorized payload 1"], { type: "text/plain" }), `${testFileTag}-1.txt`);
    formData.append("files", new Blob(["unauthorized payload 2"], { type: "text/plain" }), `${testFileTag}-2.txt`);
    formData.append("files", new Blob(["unauthorized payload 3"], { type: "text/plain" }), `${testFileTag}-3.txt`);

    // Send WITHOUT Authorization header
    const res = await fetch(`${baseUrl}/api/rpc`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.status).toBe("error");
    expect(json.code).toBe("unauthorized");
    expect(json.message).toContain("Unauthorized delayed token");

    // Assertions required by Enterprise Readiness Report:
    // 1. Auth middleware ran exactly ONCE despite 3 concurrent file streams
    expect(delayedAuthInvocations).toBe(1);
    // 2. Zero pre-auth files were written to disk
    const matchingFiles = fs.existsSync(tmpDir)
      ? fs.readdirSync(tmpDir).filter((f) => f.includes(testFileTag))
      : [];
    expect(matchingFiles.length).toBe(0);
  });

  // ─── 6. High-Throughput & Concurrency Stress Test ───────────────────────────
  it("handles 100 simultaneous concurrent requests without dropping sockets or leaking", async () => {
    const requests = Array.from({ length: 100 }, (_, i) =>
      fetch(`${baseUrl}/api/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namespace: "public",
          functionName: "greet",
          data: { name: `User_${i}` },
        }),
      }).then((r) => r.json()),
    );

    const results = (await Promise.all(requests)) as any[];
    expect(results.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(results[i].status).toBe("ok");
      expect(results[i].data.message).toBe(`Hello, User_${i}!`);
    }
  });
});

describe("JSON body limit recovery over live HTTP", () => {
  const limit = 1_048_576;
  let app: CoreRPC;
  let server: http.Server;
  let url: string;
  let middlewareCalls = 0;
  let handlerCalls = 0;
  const incoming: http.IncomingMessage[] = [];

  function bodyOfSize(size: number) {
    const prefix = '{"namespace":"limits","functionName":"echo","data":"';
    return prefix + "x".repeat(size - prefix.length - 2) + '"}';
  }

  function post(agent: http.Agent, contentLength?: number) {
    let request!: http.ClientRequest;
    const response = new Promise<{ status: number; body: any }>((resolve, reject) => {
      request = http.request(url, {
        method: "POST", agent,
        headers: { "Content-Type": "application/json", ...(contentLength === undefined ? {} : { "Content-Length": contentLength }) },
      }, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { data += chunk; });
        res.on("error", reject);
        res.on("end", () => {
          try { resolve({ status: res.statusCode!, body: JSON.parse(data) }); }
          catch (err) { reject(err); }
        });
      });
      request.on("error", reject);
      request.setTimeout(5000, () => request.destroy(new Error("HTTP request timed out")));
    });
    const socket = new Promise<Socket>((resolve) => request.once("socket", resolve));
    return { request, response, socket };
  }

  const expectReleased = (req: http.IncomingMessage) => {
    // Node itself may retain clearIncoming on 'end' after an early response.
    // Isolated stream tests below additionally assert complete 'end' listener cleanup.
    for (const event of ["data", "readable", "error", "aborted", "close"]) {
      expect(req.listenerCount(event), `${event} listeners`).toBe(0);
    }
  };

  beforeAll(async () => {
    app = new CoreRPC({ rpcEndpoint: "/rpc" });
    const registry = await app.getRegistry();
    registry.middlewares.set("limitGuard", {
      name: "limitGuard", run: async () => { middlewareCalls++; return {}; },
    } as unknown as RegisteredMiddleware);
    registry.functions.set("limits.echo", {
      key: "limits.echo", namespace: "limits", functionName: "echo", metadata: {},
      contentType: "application/json", middlewares: [{ name: "limitGuard" }],
      inputSchema: Type.String(), outputSchema: Type.String(),
      run: async (input: string) => { handlerCalls++; return input; },
    } as unknown as RegisteredFunction);
    const handler = await app.createHandler();
    server = http.createServer((req, res) => { incoming.push(req); void handler(req, res); });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as any).port}/rpc`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  });

  it.each([true, false])("rejects oversized JSON and reuses the connection (Content-Length=%s)", async (withLength) => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    const before = [middlewareCalls, handlerCalls];
    try {
      const body = bodyOfSize(limit + 128 * 1024);
      const large = post(agent, withLength ? Buffer.byteLength(body) : undefined);
      large.request.end(body);
      expect(await large.response).toMatchObject({ status: 200, body: { status: "error", code: "payload_too_large" } });
      expect([middlewareCalls, handlerCalls]).toEqual(before);
      const rejected = incoming.at(-1)!;
      await vi.waitFor(() => expect(rejected.readableEnded).toBe(true));
      expectReleased(rejected);

      const normal = post(agent);
      normal.request.end(JSON.stringify({ namespace: "limits", functionName: "echo", data: "after rejection" }));
      expect(await normal.response).toMatchObject({ status: 200, body: { status: "ok", data: "after rejection" } });
      expect(incoming.at(-1)!.socket).toBe(rejected.socket);
      expect([middlewareCalls, handlerCalls]).toEqual(before.map((n) => n + 1));
      expectReleased(incoming.at(-1)!);
    } finally { agent.destroy(); }
  });

  it("accepts JSON exactly at the limit", async () => {
    const agent = new http.Agent({ keepAlive: true });
    try {
      const body = bodyOfSize(limit);
      const normal = post(agent, limit);
      normal.request.end(body);
      expect(await normal.response).toMatchObject({ status: 200, body: { status: "ok", data: JSON.parse(body).data } });
      expectReleased(incoming.at(-1)!);
    } finally { agent.destroy(); }
  });

  it("waits for a slow normal JSON body to finish before dispatch", async () => {
    const agent = new http.Agent({ keepAlive: true });
    const before = [middlewareCalls, handlerCalls];
    const normal = post(agent);
    const count = incoming.length;
    try {
      normal.request.write('{"namespace":"limits","functionName":"echo","data":');
      await vi.waitFor(() => expect(incoming.length).toBe(count + 1));
      expect([middlewareCalls, handlerCalls]).toEqual(before);
      normal.request.end('"slow normal"}');
      expect(await normal.response).toMatchObject({ status: 200, body: { status: "ok", data: "slow normal" } });
      expectReleased(incoming.at(-1)!);
    } finally { normal.request.destroy(); agent.destroy(); }
  });

  it("closes a sender that exceeds the additional drain byte ceiling", async () => {
    const agent = new http.Agent({ keepAlive: true });
    const excess = post(agent, limit + 1024 * 1024);
    const before = [middlewareCalls, handlerCalls];
    try {
      excess.request.write(bodyOfSize(limit + 1));
      expect(await excess.response).toMatchObject({ status: 200, body: { status: "error", code: "payload_too_large" } });
      const rejected = incoming.at(-1)!;
      excess.request.write(Buffer.alloc(512 * 1024 + 1));
      await vi.waitFor(() => expect(rejected.destroyed).toBe(true));
      expectReleased(rejected);
      expect([middlewareCalls, handlerCalls]).toEqual(before);
    } finally { excess.request.destroy(); agent.destroy(); }
  });

  it("responds before a slow oversized sender finishes, then drains its bounded remainder", async () => {
    const agent = new http.Agent({ keepAlive: true });
    const body = bodyOfSize(limit + 128 * 1024);
    const before = [middlewareCalls, handlerCalls];
    const slow = post(agent, Buffer.byteLength(body));
    try {
      slow.request.write(body.slice(0, limit + 1));
      expect(await slow.response).toMatchObject({ status: 200, body: { status: "error", code: "payload_too_large" } });
      const rejected = incoming.at(-1)!;
      expect(rejected.complete).toBe(false);
      expect(rejected.destroyed).toBe(false);
      slow.request.end(body.slice(limit + 1));
      await vi.waitFor(() => expect(rejected.readableEnded).toBe(true));
      expectReleased(rejected);
      expect([middlewareCalls, handlerCalls]).toEqual(before);
    } finally { slow.request.destroy(); agent.destroy(); }
  });

  it("closes a stalled oversized sender within the drain deadline", async () => {
    const agent = new http.Agent({ keepAlive: true });
    const stalled = post(agent, limit + 128 * 1024);
    const before = [middlewareCalls, handlerCalls];
    try {
      const started = Date.now();
      stalled.request.write(bodyOfSize(limit + 1));
      expect(await stalled.response).toMatchObject({ status: 200, body: { status: "error", code: "payload_too_large" } });
      const rejected = incoming.at(-1)!;
      expect(rejected.complete).toBe(false);
      await vi.waitFor(() => expect(rejected.destroyed).toBe(true), { timeout: 3500 });
      expect(Date.now() - started).toBeLessThan(3500);
      expectReleased(rejected);
      expect([middlewareCalls, handlerCalls]).toEqual(before);
    } finally { stalled.request.destroy(); agent.destroy(); }
  });

  it.each([false, true])("releases listeners when the client aborts (already oversized=%s)", async (oversized) => {
    const agent = new http.Agent({ keepAlive: true });
    const aborted = post(agent, limit + 128 * 1024);
    // Observe rejection immediately so a deliberate client abort cannot be unhandled.
    const outcome = aborted.response.catch(() => undefined);
    const before = [middlewareCalls, handlerCalls];
    const count = incoming.length;
    try {
      aborted.request.write(oversized ? bodyOfSize(limit + 1) : '{"namespace":');
      const clientSocket = await aborted.socket;
      await vi.waitFor(() => expect(incoming.length).toBe(count + 1));
      expect(incoming.at(-1)!.complete).toBe(false);
      if (oversized) expect(await outcome).toMatchObject({ status: 200, body: { code: "payload_too_large" } });
      const rejected = incoming.at(-1)!;
      clientSocket.destroy();
      aborted.request.destroy();
      // A response may have returned the socket to the agent already.
      agent.destroy();
      await vi.waitFor(() => expect(rejected.destroyed).toBe(true));
      expectReleased(rejected);
      expect([middlewareCalls, handlerCalls]).toEqual(before);
      await outcome;
    } finally { aborted.request.destroy(); agent.destroy(); }
  });
});

describe("JSON rejection drain resource cleanup", () => {
  const events = ["data", "readable", "end", "error", "aborted", "close"];
  const streams: PassThrough[] = [];
  afterEach(() => {
    for (const stream of streams.splice(0)) stream.destroy();
    vi.useRealTimers();
  });

  async function rejectedStream() {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const stream = new PassThrough();
    streams.push(stream);
    const result = parseJsonRequest(stream, 16);
    stream.write(Buffer.alloc(32));
    await expect(result).rejects.toMatchObject({ code: "payload_too_large" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(stream.destroyed).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    return stream;
  }

  const expectClean = (stream: Readable) => {
    expect(vi.getTimerCount()).toBe(0);
    for (const event of events) expect(stream.listenerCount(event), event).toBe(0);
  };

  it.each(["end", "close", "error", "aborted"])("cleans the drain timer and listeners on %s", async (event) => {
    const stream = await rejectedStream();
    if (event === "end") {
      await new Promise<void>((resolve) => { stream.once("end", resolve); stream.end("tail"); });
    } else if (event === "aborted") {
      stream.emit("aborted");
    } else {
      await new Promise<void>((resolve) => {
        stream.once("close", resolve);
        stream.destroy(event === "error" ? new Error("peer reset") : undefined);
      });
    }
    expectClean(stream);
    await vi.advanceTimersByTimeAsync(2500);
    expectClean(stream);
  });

  it("bounds discarded bytes and releases resources when the drain ceiling is exceeded", async () => {
    const stream = await rejectedStream();
    stream.write(Buffer.alloc(512 * 1024));
    expect(stream.destroyed).toBe(false);
    stream.write(Buffer.alloc(1));
    expect(stream.destroyed).toBe(true);
    expectClean(stream);
  });

  it("destroys an incomplete stream at the deadline and clears the timer", async () => {
    const stream = await rejectedStream();
    await vi.advanceTimersByTimeAsync(1999);
    expect(stream.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(stream.destroyed).toBe(true);
    expectClean(stream);
  });

  it("cleans up a socket disconnect after an early response detaches the request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const socket = new EventEmitter();
    const stream = Object.assign(new PassThrough(), { socket });
    streams.push(stream);
    const result = parseJsonRequest(stream, 16);
    stream.write(Buffer.alloc(32));
    await expect(result).rejects.toMatchObject({ code: "payload_too_large" });
    expect(socket.listenerCount("close")).toBe(1);
    socket.emit("close");
    expect(stream.destroyed).toBe(true);
    expect(socket.listenerCount("close")).toBe(0);
    expectClean(stream);
  });
});
