import { Readable } from "node:stream";
import { describe, it, expect } from "vitest";
import { CoreRPC } from "./core-rpc";
import { Files } from "./utils/typebox";

describe("CoreRPC Engine & Endpoints", () => {
  it("1. Initializes via Direct Constructor with custom rpc & docs endpoints", () => {
    const app = new CoreRPC({
      functionsDir: "./src/functions",
      middlewaresDir: "./src/middlewares",
      port: 4000,
      rpcEndpoint: "/custom-rpc",
      docsEndpoint: "/custom-docs",
      docs: true,
    });
    expect(app).toBeInstanceOf(CoreRPC);
  });

  it("2. Supports Instance Setters for endpoints", () => {
    const app = new CoreRPC()
      .useFunctions("./src/functions")
      .useMiddlewares("./src/middlewares")
      .setRpcEndpoint("/v1/rpc")
      .setDocsEndpoint("/v1/docs")
      .setPort(5000);

    expect(app).toBeInstanceOf(CoreRPC);
  });

  it("3. Supports Static Builder (CoreRPC.configure)", () => {
    const app = CoreRPC.configure({ docs: true })
      .setFunctionDir("./src/functions")
      .setMiddlewareDir("./src/middlewares")
      .setRpcEndpoint("/rpc")
      .setDocsEndpoint("/docs")
      .setPort(6000);

    expect(app).toBeInstanceOf(CoreRPC);
  });

  it("4. Creates raw HTTP RequestListener via createHandler()", async () => {
    const app = new CoreRPC({ rpcEndpoint: "/rpc", docsEndpoint: "/docs" });
    const handler = await app.createHandler();
    expect(typeof handler).toBe("function");
  });

  it("5. Files schema accepts maxCount option", () => {
    const schema = Files({ maxCount: 5, maxSizeBytes: 10_000_000, description: "Test files" });
    expect(schema.maxCount).toBe(5);
  });

  it("6. Returns 404 for unconfigured endpoints when rpcEndpoint is /rpc", async () => {
    const app = new CoreRPC({ rpcEndpoint: "/rpc" });
    const handler = await app.createHandler();

    let responsePayload = "";
    let statusCode = 0;

    const req = {
      url: "/api",
      method: "POST",
      headers: {},
      socket: {},
    } as any;

    const res = {
      statusCode: 200,
      setHeader: () => {},
      end: (data: string) => {
        responsePayload = data;
      },
    } as any;

    Object.defineProperty(res, "statusCode", {
      set(code: number) {
        statusCode = code;
      },
      get() {
        return statusCode;
      },
    });

    await handler(req, res);

    expect(statusCode).toBe(404);
    const parsed = JSON.parse(responsePayload);
    expect(parsed.status).toBe("error");
    expect(parsed.code).toBe("not_found");
  });

  it("7. app.execute returns error when function is not in registry", async () => {
    const app = new CoreRPC({ functionsDir: "./non-existent", middlewaresDir: "./non-existent" });
    const result = await app.execute("test.unknown", {});

    expect(result.status).toBe("error");
    expect(result.code).toBe("function_not_found");
    expect(result.meta.requestId).toBeDefined();
    expect(typeof result.meta.durationMs).toBe("number");
  });

  it("8. createTestCaller wraps app.execute with call and callRaw", async () => {
    const app = new CoreRPC({ functionsDir: "./non-existent", middlewaresDir: "./non-existent" });
    const caller = app.createTestCaller({
      contextOverrides: { auth: { userId: "test_user", role: "admin" } },
    });

    const rawResult = await caller.callRaw("test.unknown", { some: "data" });
    expect(rawResult.status).toBe("error");
    expect(rawResult.code).toBe("function_not_found");

    await expect(caller.call("test.unknown", {})).rejects.toThrow();
  });

  it("9. invalidates cached registry after changing function or middleware directories", async () => {
    const app = new CoreRPC({
      functionsDir: "./non-existent-1",
      middlewaresDir: "./non-existent-1",
    });

    const initialRegistry = await app.getRegistry();
    app.useFunctions("./non-existent-2");
    app.useMiddlewares("./non-existent-3");

    const refreshedRegistry = await app.getRegistry();

    expect(refreshedRegistry).not.toBe(initialRegistry);
  });

  it("10. supports custom healthEndpoint, rpcEndpoint and docsEndpoint", async () => {
    const app = new CoreRPC({
      functionsDir: "./non-existent",
      middlewaresDir: "./non-existent",
      healthEndpoint: "/custom-health",
      rpcEndpoint: "/custom-rpc",
      docsEndpoint: "/custom-docs",
    });
    const handler = await app.createHandler();
    let resData = "";
    const req = { method: "GET", url: "/custom-health" } as any;
    const res = {
      statusCode: 200,
      setHeader: () => {},
      end: (d: string) => { resData = d; },
    } as any;
    await handler(req, res);
    expect(JSON.parse(resData).status).toBe("ok");
  });

  it("11. handles CORS preflight OPTIONS requests gracefully", async () => {
    const app = new CoreRPC({
      functionsDir: "./non-existent",
      middlewaresDir: "./non-existent",
      cors: { origin: "http://localhost:3000", credentials: true },
    });
    const handler = await app.createHandler();
    const headersSet: Record<string, string> = {};
    const req = {
      method: "OPTIONS",
      url: "/rpc",
      headers: { origin: "http://localhost:3000" },
    } as any;
    const res = {
      statusCode: 0,
      setHeader: (k: string, v: string) => { headersSet[k] = v; },
      end: () => {},
    } as any;
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(headersSet["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
    expect(headersSet["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headersSet["Access-Control-Allow-Methods"]).toContain("POST");
  });

  it("12. passes defaulted middleware options and handles case-insensitive headers", async () => {
    const { Type } = await import("@sinclair/typebox");
    const app = new CoreRPC();
    const registry = await app.getRegistry();

    let capturedOptions: any = null;
    let capturedHeaders: any = null;

    // Register a middleware that specifies default options and mixed-case required header
    registry.middlewares.set("testDefaults", {
      name: "testDefaults",
      filePath: "/test/run.ts",
      optionsSchema: Type.Object({
        timeoutSeconds: Type.Optional(Type.Number({ default: 45 })),
        retries: Type.Optional(Type.Number({ default: 3 })),
      }),
      headersSchema: Type.Object({
        "X-Tenant-ID": Type.String(),
      }),
      run: async ({ options, headers }, ctx) => {
        capturedOptions = options;
        capturedHeaders = headers;
        return ctx;
      },
    });

    registry.functions.set("test.headerCase", {
      key: "test.headerCase",
      namespace: "test",
      functionName: "headerCase",
      filePath: "/test/fn.ts",
      contentType: "application/json",
      metadata: {},
      middlewares: [{ name: "testDefaults", options: {} }],
      headersSchema: Type.Object({
        "Authorization": Type.String(),
      }),
      run: async (input) => ({ echo: input }),
    });

    // Provide lowercased headers (like Node.js HTTP parser produces)
    const result = await app.execute("test.headerCase", { foo: "bar" }, {
      headers: {
        "x-tenant-id": "tenant-42",
        "authorization": "Bearer token123",
      },
    });

    expect(result.status).toBe("ok");
    // Verify schema defaults were populated!
    expect(capturedOptions).toEqual({ timeoutSeconds: 45, retries: 3 });
    // Verify mixed-case header was mapped
    expect(capturedHeaders["X-Tenant-ID"]).toBe("tenant-42");
  });

  it("13. renders docs index and function docs correctly with custom docsEndpoint", async () => {
    const app = new CoreRPC({
      docsEndpoint: "/my-custom-docs",
      rpcEndpoint: "/my-custom-rpc",
      docs: true,
    });
    const registry = await app.getRegistry();
    registry.functions.set("catalog.list", {
      key: "catalog.list",
      namespace: "catalog",
      functionName: "list",
      filePath: "/catalog/list/run.ts",
      contentType: "application/json",
      metadata: { description: "List catalog items" },
      middlewares: [],
      run: async () => [],
    });

    const handler = await app.createHandler();
    let resHtml = "";
    const req = {
      method: "GET",
      url: "/my-custom-docs/catalog/list",
      headers: { host: "localhost:4000" },
    } as any;
    const res = {
      statusCode: 200,
      setHeader: () => {},
      end: (h: string) => { resHtml = h; },
    } as any;

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(resHtml).toContain("catalog");
    expect(resHtml).toContain("list");
    expect(resHtml).toContain("/my-custom-rpc");
    expect(resHtml).toContain("/my-custom-docs");
  });

  it("14. honors useHttpStatusCodes option across HTTP and Web fetch", async () => {
    const app = new CoreRPC({
      useHttpStatusCodes: true,
    });
    const handler = await app.createHandler();

    // 1. Missing function via HTTP handler
    const stream = Readable.from([
      JSON.stringify({ namespace: "ghost", functionName: "missing", data: {} }),
    ]) as any;
    stream.method = "POST";
    stream.url = "/rpc";
    stream.headers = { "content-type": "application/json" };

    const res = {
      statusCode: 200,
      setHeader: () => {},
      end: () => {},
    } as any;
    await handler(stream, res);
    expect(res.statusCode).toBe(404);

    // 2. Missing function via Web fetch
    const webRes = await app.fetch(
      new Request("http://localhost:4000/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ namespace: "ghost", functionName: "missing", data: {} }),
      }),
    );
    expect(webRes.status).toBe(404);
    const body = await webRes.json();
    expect(body.status).toBe("error");
    expect(body.code).toBe("function_not_found");
  });
});

