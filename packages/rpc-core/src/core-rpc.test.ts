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
});

