import { describe, expect, it } from "vitest";
import { Type } from "@sinclair/typebox";
import { CoreRPC, createHonoHandler, createHonoMiddleware, createElysiaPlugin } from "./core-rpc";
import { AppError, ErrorCode } from "./errors";
import { File } from "./utils/typebox";

describe("Web Standards (Bun, Hono, Elysia, WinterCG) Fetch API", () => {
  function createTestApp() {
    const app = new CoreRPC({
      port: 4000,
      rpcEndpoint: "/rpc",
      docsEndpoint: "/docs",
      healthEndpoint: "/health",
      cors: true,
    });
    return app;
  }

  it("1. executes JSON RPC request via app.fetch(request) with uniform HTTP 200 envelope", async () => {
    const app = createTestApp();
    const registry = await app.getRegistry();

    registry.functions.set("math.add", {
      key: "math.add",
      namespace: "math",
      functionName: "add",
      contentType: "application/json",
      metadata: { description: "Add numbers" },
      inputSchema: Type.Object({ a: Type.Number(), b: Type.Number() }),
      outputSchema: Type.Object({ result: Type.Number() }),
      middlewares: [],
      run: async (input: any) => ({ result: input.a + input.b }),
    });

    const request = new Request("http://localhost:4000/rpc", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        namespace: "math",
        functionName: "add",
        data: { a: 15, b: 27 },
      }),
    });

    const response = await app.fetch(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-request-id")).toBeDefined();

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.data).toEqual({ result: 42 });
    expect(json.meta.requestId).toBeDefined();
    expect(typeof json.meta.durationMs).toBe("number");
  });

  it("2. returns uniform HTTP 200 on schema validation failure", async () => {
    const app = createTestApp();
    const registry = await app.getRegistry();

    registry.functions.set("users.get", {
      key: "users.get",
      namespace: "users",
      functionName: "get",
      contentType: "application/json",
      metadata: {},
      inputSchema: Type.Object({ id: Type.String({ minLength: 3 }) }),
      middlewares: [],
      run: async () => ({}),
    });

    const request = new Request("http://localhost:4000/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        namespace: "users",
        functionName: "get",
        data: { id: "ab" }, // Too short
      }),
    });

    const response = await app.fetch(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("error");
    expect(json.code).toBe("validation_error");
    expect(json.message).toContain("id");
    expect(json.meta).toBeDefined();
  });

  it("3. handles case-insensitive headers in middleware via Web standard Headers", async () => {
    const app = createTestApp();
    const registry = await app.getRegistry();

    registry.middlewares.set("tenantAuth", {
      name: "tenantAuth",
      filePath: "/test/tenantAuth.ts",
      headersSchema: Type.Object({
        "X-Tenant-ID": Type.String(),
      }),
      run: async ({ headers }, ctx) => {
        return { ...ctx, tenantId: headers["X-Tenant-ID"] };
      },
    });

    registry.functions.set("admin.info", {
      key: "admin.info",
      namespace: "admin",
      functionName: "info",
      contentType: "application/json",
      metadata: {},
      middlewares: [{ name: "tenantAuth", options: {} }],
      run: async (_input, ctx) => ({ tenantId: ctx.tenantId }),
    });

    // Send with lowercase header
    const request = new Request("http://localhost:4000/rpc", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-alpha-99",
      },
      body: JSON.stringify({
        namespace: "admin",
        functionName: "info",
        data: {},
      }),
    });

    const response = await app.fetch(request);
    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.data.tenantId).toBe("tenant-alpha-99");
  });

  it("4. handles multipart/form-data with Web standard File uploads", async () => {
    const app = createTestApp();
    const registry = await app.getRegistry();

    registry.functions.set("media.upload", {
      key: "media.upload",
      namespace: "media",
      functionName: "upload",
      contentType: "multipart/form-data",
      metadata: {},
      inputSchema: Type.Object({
        title: Type.String(),
        file: File({ mimeTypes: ["text/plain"] }),
      }),
      middlewares: [],
      run: async (input: any) => {
        const buffer = await input.file.toBuffer();
        return {
          title: input.title,
          filename: input.file.filename,
          size: input.file.byteLength,
          content: buffer.toString("utf-8"),
        };
      },
    });

    const formData = new FormData();
    formData.append("namespace", "media");
    formData.append("functionName", "upload");
    formData.append("title", "My Document");
    formData.append(
      "file",
      new Blob(["Hello Web Standard Uploads!"], { type: "text/plain" }),
      "test-doc.txt",
    );

    const request = new Request("http://localhost:4000/rpc", {
      method: "POST",
      body: formData,
    });

    const response = await app.fetch(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.data.title).toBe("My Document");
    expect(json.data.filename).toBe("test-doc.txt");
    expect(json.data.content).toBe("Hello Web Standard Uploads!");
  });

  it("5. handles CORS preflight OPTIONS request", async () => {
    const app = createTestApp();

    const request = new Request("http://localhost:4000/rpc", {
      method: "OPTIONS",
      headers: {
        origin: "https://my-frontend.com",
        "access-control-request-method": "POST",
      },
    });

    const response = await app.fetch(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://my-frontend.com");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("6. serves GET /health endpoint", async () => {
    const app = createTestApp();

    const request = new Request("http://localhost:4000/health", {
      method: "GET",
    });

    const response = await app.fetch(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.timestamp).toBeDefined();
  });

  it("7. serves GET /docs interactive documentation", async () => {
    const app = createTestApp();

    const request = new Request("http://localhost:4000/docs", {
      method: "GET",
    });

    const response = await app.fetch(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("8. returns HTTP 404 for unknown endpoints", async () => {
    const app = createTestApp();

    const request = new Request("http://localhost:4000/unknown-path", {
      method: "GET",
    });

    const response = await app.fetch(request);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.status).toBe("error");
    expect(json.code).toBe("not_found");
  });

  it("9. integrates seamlessly with Hono pattern via createHonoHandler", async () => {
    const app = createTestApp();
    const registry = await app.getRegistry();

    registry.functions.set("hono.ping", {
      key: "hono.ping",
      namespace: "hono",
      functionName: "ping",
      contentType: "application/json",
      metadata: {},
      middlewares: [],
      run: async () => ({ pong: true, runtime: "hono" }),
    });

    const honoHandler = createHonoHandler(app);

    // Mock Hono context object
    const mockHonoContext = {
      req: {
        raw: new Request("http://localhost:4000/rpc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            namespace: "hono",
            functionName: "ping",
            data: {},
          }),
        }),
      },
    };

    const response = await honoHandler(mockHonoContext);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.data.pong).toBe(true);
    expect(json.data.runtime).toBe("hono");
  });

  it("10. integrates seamlessly with Elysia pattern via createElysiaPlugin", async () => {
    const app = createTestApp();
    const registry = await app.getRegistry();

    registry.functions.set("elysia.ping", {
      key: "elysia.ping",
      namespace: "elysia",
      functionName: "ping",
      contentType: "application/json",
      metadata: {},
      middlewares: [],
      run: async () => ({ pong: true, runtime: "elysia" }),
    });

    const registeredRoutes: Record<string, Function> = {};
    const mockElysia = {
      all: (path: string, handler: Function) => {
        registeredRoutes[`ALL ${path}`] = handler;
      },
      get: (path: string, handler: Function) => {
        registeredRoutes[`GET ${path}`] = handler;
      },
    };

    const plugin = createElysiaPlugin(app);
    plugin(mockElysia);

    expect(registeredRoutes["ALL /rpc"]).toBeDefined();
    expect(registeredRoutes["GET /health"]).toBeDefined();
    expect(registeredRoutes["GET /docs"]).toBeDefined();

    // Execute route handler
    const rpcHandler = registeredRoutes["ALL /rpc"];
    const response = await rpcHandler({
      request: new Request("http://localhost:4000/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          namespace: "elysia",
          functionName: "ping",
          data: {},
        }),
      }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.data.pong).toBe(true);
    expect(json.data.runtime).toBe("elysia");
  });

  it("11. serveBun() handles native Bun.serve or throws clean runtime error on Node.js", async () => {
    const app = createTestApp();
    const isBun = typeof (globalThis as any).Bun !== "undefined";

    if (isBun) {
      const server = await app.serveBun(0);
      expect(server).toBeDefined();
      expect(typeof server.port).toBe("number");
      server.stop();
    } else {
      await expect(app.serveBun()).rejects.toThrow(
        "serveBun() requires the Bun runtime environment",
      );
    }
  });
});
