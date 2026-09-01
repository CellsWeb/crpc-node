import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { CoreRPC, createFastifyPlugin } from "./core-rpc";
import { handleApiRequest } from "./interceptor";
import type { Registry } from "./registry";
import { parseRpcRequest } from "./request";
import { parseJsonRequest } from "./request/json";

function createMockStream(
  chunks: string[] = [],
): Readable & { headers: Record<string, string> } {
  const stream = new Readable({
    read() {
      for (const chunk of chunks) {
        this.push(Buffer.from(chunk));
      }
      this.push(null);
    },
  }) as Readable & { headers: Record<string, string> };

  stream.headers = { "content-type": "application/json" };
  return stream;
}

describe("Framework-Agnostic Request Body Parsing", () => {
  describe("parseJsonRequest with Pre-parsed Bodies (Fastify / Express)", () => {
    it("1. Parses pre-parsed object from req.body directly without draining stream", async () => {
      // Empty stream that would fail if read
      const req = createMockStream([]);
      (req as any).body = {
        namespace: "users",
        functionName: "getProfile",
        data: { userId: "usr_123" },
      };

      const result = await parseJsonRequest(req);
      expect(result.namespace).toBe("users");
      expect(result.functionName).toBe("getProfile");
      expect(result.data).toEqual({ userId: "usr_123" });
    });

    it("2. Parses pre-parsed object from (req.raw as any).body (Fastify bridge pattern)", async () => {
      const emptyStream = createMockStream([]);
      const req = {
        raw: {
          ...emptyStream,
          body: {
            namespace: "orders",
            functionName: "create",
            data: { itemId: 42 },
          },
        },
      };

      const result = await parseJsonRequest(req);
      expect(result.namespace).toBe("orders");
      expect(result.functionName).toBe("create");
      expect(result.data).toEqual({ itemId: 42 });
    });

    it("3. Parses pre-parsed raw JSON string from req.body / req.rawBody", async () => {
      const req = createMockStream([]);
      (req as any).rawBody = JSON.stringify({
        namespace: "auth",
        functionName: "login",
        data: { email: "user@example.com" },
      });

      const result = await parseJsonRequest(req);
      expect(result.namespace).toBe("auth");
      expect(result.functionName).toBe("login");
      expect(result.data).toEqual({ email: "user@example.com" });
    });

    it("4. Parses pre-parsed Buffer from req.body", async () => {
      const req = createMockStream([]);
      (req as any).body = Buffer.from(
        JSON.stringify({
          namespace: "settings",
          functionName: "update",
          data: { theme: "dark" },
        }),
      );

      const result = await parseJsonRequest(req);
      expect(result.namespace).toBe("settings");
      expect(result.functionName).toBe("update");
      expect(result.data).toEqual({ theme: "dark" });
    });

    it("5. Throws AppError when pre-parsed object is missing namespace", async () => {
      const req = createMockStream([]);
      (req as any).body = {
        functionName: "getProfile",
        data: {},
      };

      await expect(parseJsonRequest(req)).rejects.toMatchObject({
        code: "invalid_body",
        message: 'Missing or invalid "namespace" field in JSON body',
      });
    });

    it("6. Throws AppError when pre-parsed object is missing functionName", async () => {
      const req = createMockStream([]);
      (req as any).body = {
        namespace: "users",
        data: {},
      };

      await expect(parseJsonRequest(req)).rejects.toMatchObject({
        code: "invalid_body",
        message: 'Missing or invalid "functionName" field in JSON body',
      });
    });

    it("7. Defaults empty data object when pre-parsed data is omitted or null", async () => {
      const req = createMockStream([]);
      (req as any).body = {
        namespace: "health",
        functionName: "ping",
      };

      const result = await parseJsonRequest(req);
      expect(result.namespace).toBe("health");
      expect(result.functionName).toBe("ping");
      expect(result.data).toEqual({});
    });
  });

  describe("parseJsonRequest Native Node Stream Fallback", () => {
    it("8. Streams and parses valid JSON payload when req.body is undefined", async () => {
      const payload = JSON.stringify({
        namespace: "products",
        functionName: "list",
        data: { limit: 10 },
      });
      const req = createMockStream([payload]);

      const result = await parseJsonRequest(req);
      expect(result.namespace).toBe("products");
      expect(result.functionName).toBe("list");
      expect(result.data).toEqual({ limit: 10 });
    });

    it("9. Throws invalid_body when stream is completely empty and no req.body exists", async () => {
      const req = createMockStream([]);

      await expect(parseJsonRequest(req)).rejects.toMatchObject({
        code: "invalid_body",
        message: "Request body is empty",
      });
    });
  });

  describe("parseRpcRequest Framework Detection", () => {
    it("10. Automatically detects JSON kind when pre-parsed body exists without Content-Type header", async () => {
      const req = {
        headers: {},
        body: {
          namespace: "test",
          functionName: "run",
          data: { a: 1 },
        },
      };

      const result = await parseRpcRequest(req);
      expect(result.kind).toBe("json");
      expect(result.namespace).toBe("test");
      expect(result.functionName).toBe("run");
      expect(result.data).toEqual({ a: 1 });
    });
  });

  describe("Fastify Plugin Adapter & Interceptor Integration", () => {
    it("11. Fastify Plugin registers routes and forwards pre-parsed body cleanly", async () => {
      const app = new CoreRPC({
        functionsDir: "./non-existent",
        middlewaresDir: "./non-existent",
      });
      const plugin = createFastifyPlugin(app);

      const routes: Record<string, (req: any, reply: any) => Promise<void>> =
        {};

      const mockFastify = {
        all(path: string, handler: (req: any, reply: any) => Promise<void>) {
          routes[`ALL ${path}`] = handler;
        },
        get(path: string, handler: (req: any, reply: any) => Promise<void>) {
          routes[`GET ${path}`] = handler;
        },
      };

      await plugin(mockFastify);

      expect(routes["ALL /rpc"]).toBeDefined();
      expect(routes["ALL /rpc/"]).toBeDefined();
      expect(routes["GET /health"]).toBeDefined();
      expect(routes["GET /docs"]).toBeDefined();

      // Test Fastify route handler invocation with mock Fastify req and reply
      let responsePayload = "";
      let hijacked = false;

      const mockFastifyReq = {
        url: "/rpc",
        method: "POST",
        raw: Object.assign(createMockStream([]), {
          url: "/rpc",
          method: "POST",
        }),
        body: {
          namespace: "users",
          functionName: "getById",
          data: { id: "123" },
        },
      };

      const mockFastifyReply = {
        raw: {
          statusCode: 200,
          setHeader: () => {},
          end: (payload: string) => {
            responsePayload = payload;
          },
        },
        hijack() {
          hijacked = true;
        },
      };

      await routes["ALL /rpc"](mockFastifyReq, mockFastifyReply);

      expect(hijacked).toBe(true);
      const parsed = JSON.parse(responsePayload);
      expect(parsed.status).toBe("error");
      expect(parsed.code).toBe("function_not_found"); // Registry didn't have function, but body was parsed cleanly!
      expect(parsed.meta).toBeDefined();
    });

    it("12. handleApiRequest directly handles Fastify req and reply objects", async () => {
      const mockRegistry: Registry = {
        functions: new Map([
          [
            "math.add",
            {
              key: "math.add",
              namespace: "math",
              functionName: "add",
              contentType: "application/json",
              metadata: { name: "Add" },
              middlewares: [],
              run: async (input: any) => ({
                sum: (input?.a ?? 0) + (input?.b ?? 0),
              }),
            },
          ],
        ]),
        middlewares: new Map(),
      };

      let responsePayload = "";
      let statusCode = 0;

      const fastifyReq = {
        headers: { "content-type": "application/json" },
        body: {
          namespace: "math",
          functionName: "add",
          data: { a: 10, b: 25 },
        },
        raw: createMockStream([]),
      };

      const fastifyReply = {
        hijack: () => {},
        raw: {
          statusCode: 200,
          setHeader: () => {},
          end: (payload: string) => {
            responsePayload = payload;
          },
        },
      };

      Object.defineProperty(fastifyReply.raw, "statusCode", {
        set(val: number) {
          statusCode = val;
        },
        get() {
          return statusCode;
        },
      });

      await handleApiRequest(fastifyReq, fastifyReply, mockRegistry);

      expect(statusCode).toBe(200);
      const parsed = JSON.parse(responsePayload);
      expect(parsed.status).toBe("ok");
      expect(parsed.data).toEqual({ sum: 35 });
      expect(parsed.meta.requestId).toBeDefined();
    });
  });
});
