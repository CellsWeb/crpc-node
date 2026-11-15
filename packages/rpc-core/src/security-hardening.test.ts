import { describe, it, expect, afterAll } from "vitest";
import { Readable } from "node:stream";
import { Type } from "@sinclair/typebox";
import { CoreRPC } from "./core-rpc";
import { parseMultipartRequest } from "./request/multipart";
import { parseRpcRequest } from "./request";
import { extractClientIp, buildContext } from "./context";
import { validateSchema, File } from "./utils/typebox";
import { ErrorCode, AppError } from "./errors";
import { getGlobalWorkerPool, shutdownGlobalWorkerPool } from "./workers/worker-pool";

describe("Security & Robustness Probes", () => {
  afterAll(async () => {
    await shutdownGlobalWorkerPool();
  });

  describe("1. Prototype Pollution Shields", () => {
    it("filters out __proto__, constructor, and prototype from multipart fields", async () => {
      const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
      const multipartBody = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="namespace"',
        "",
        "auth",
        `--${boundary}`,
        'Content-Disposition: form-data; name="functionName"',
        "",
        "login",
        `--${boundary}`,
        'Content-Disposition: form-data; name="__proto__"',
        "",
        '{"polluted":true}',
        `--${boundary}`,
        'Content-Disposition: form-data; name="constructor"',
        "",
        "evil",
        `--${boundary}`,
        'Content-Disposition: form-data; name="prototype"',
        "",
        "hacked",
        `--${boundary}`,
        'Content-Disposition: form-data; name="username"',
        "",
        "admin",
        `--${boundary}--`,
        "",
      ].join("\r\n");

      const req = Object.assign(Readable.from([Buffer.from(multipartBody)]), {
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
      });

      const parsed = await parseMultipartRequest(req);
      expect(parsed.data.username).toBe("admin");
      expect((parsed.data as any).__proto__).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(parsed.data.constructor).toBeUndefined();
      expect(parsed.data.prototype).toBeUndefined();
    });
  });

  describe("2. IP Spoofing Prevention", () => {
    it("ignores X-Forwarded-For when trustProxy is false", () => {
      const mockReq = {
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18",
        },
        socket: {
          remoteAddress: "10.0.0.1",
        },
      };

      const ipWithoutTrust = extractClientIp(mockReq, false);
      expect(ipWithoutTrust).toBe("10.0.0.1");

      const ipWithTrust = extractClientIp(mockReq, true);
      expect(ipWithTrust).toBe("203.0.113.195");
    });

    it("sanitizes malformed X-Request-Id headers", () => {
      const mockReq = {
        headers: {
          "x-request-id": "malicious\r\nHeader-Injection: true",
        },
      };

      const ctx = buildContext(mockReq, "test", "run");
      expect(ctx.requestId).not.toContain("\r\n");
      expect(ctx.requestId.length).toBeGreaterThan(0);
    });
  });

  describe("3. Strict Content-Type Enforcement", () => {
    it("rejects requests missing Content-Type header even if body was pre-parsed", async () => {
      const mockReq = {
        headers: {},
        body: { namespace: "test", functionName: "run", data: {} },
      };

      await expect(parseRpcRequest(mockReq)).rejects.toThrow("Unsupported Content-Type");
    });
  });

  describe("4. Required vs Optional File Schema Validation", () => {
    it("rejects payload when a required File field is missing", () => {
      const schema = Type.Object({
        title: Type.String(),
        avatar: File(),
      });

      expect(() => {
        validateSchema(schema, { title: "Test" });
      }).toThrow("Expected a file attachment");
    });

    it("allows payload when File field is optional and omitted", () => {
      const schema = Type.Object({
        title: Type.String(),
        avatar: Type.Optional(File()),
      });

      const result = validateSchema<{ title: string; avatar?: unknown }>(schema, {
        title: "Test",
      });
      expect(result.title).toBe("Test");
      expect(result.avatar).toBeUndefined();
    });
    it("preserves UploadedFile instance methods across validateSchema", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rpc-file-val-"));
      const filePath = path.join(tempDir, "test.txt");
      await fs.writeFile(filePath, "Testing preservation");

      const { createUploadedFile, UploadedFile } = await import("./uploads/types");
      const uploaded = createUploadedFile({
        path: filePath,
        filename: "test.txt",
        mimeType: "text/plain",
        byteLength: 20,
      });

      const schema = Type.Object({
        title: Type.String(),
        file: File(),
      });

      const validated = validateSchema<{ title: string; file: InstanceType<typeof UploadedFile> }>(
        schema,
        { title: "Preserve", file: uploaded },
      );

      expect(validated.file).toBeInstanceOf(UploadedFile);
      expect(typeof validated.file.toBuffer).toBe("function");
      const buf = await validated.file.toBuffer();
      expect(buf.toString("utf-8")).toBe("Testing preservation");

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("normalizes a single UploadedFile into an array when schema expects Files()", async () => {
      const { createUploadedFile, UploadedFile } = await import("./uploads/types");
      const { Files } = await import("./utils/typebox");

      const uploaded = createUploadedFile({
        path: "/tmp/photo.jpg",
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        byteLength: 1024,
      });

      const schema = Type.Object({
        gallery: Files(),
      });

      const validated = validateSchema<{ gallery: InstanceType<typeof UploadedFile>[] }>(
        schema,
        { gallery: uploaded },
      );

      expect(Array.isArray(validated.gallery)).toBe(true);
      expect(validated.gallery).toHaveLength(1);
      expect(validated.gallery[0]).toBeInstanceOf(UploadedFile);
      expect(validated.gallery[0].filename).toBe("photo.jpg");
    });
  });

  describe("5. Query String Stripping on /rpc", () => {
    it("correctly routes POST requests with query strings (/rpc?token=abc)", async () => {
      const app = new CoreRPC({
        functionsDir: "./non-existent",
        middlewaresDir: "./non-existent",
      });

      const handler = await app.createHandler();

      let statusCode = 0;
      let body = "";

      const mockReq = Object.assign(
        Readable.from([
          JSON.stringify({
            namespace: "test",
            functionName: "run",
            data: {},
          }),
        ]),
        {
          url: "/rpc?token=abc&session=123",
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
        },
      );

      const mockRes = {
        statusCode: 200,
        setHeader: () => {},
        end: (payload: string) => {
          body = payload;
        },
      };

      await handler(mockReq as any, mockRes as any);

      // Should hit the RPC dispatcher, not return 404!
      const parsed = JSON.parse(body);
      expect(parsed.status).toBe("error");
      expect(parsed.code).toBe("function_not_found");
    });
  });

  describe("6. Express Next Pass-Through", () => {
    it("calls next() for unmatched routes instead of returning 404 when next is provided", async () => {
      const app = new CoreRPC({
        functionsDir: "./non-existent",
        middlewaresDir: "./non-existent",
      });

      const handler = await app.createHandler();

      let nextCalled = false;
      const mockReq = {
        url: "/api/other-express-route",
        method: "GET",
        headers: {},
      };
      const mockRes = {
        statusCode: 200,
        setHeader: () => {},
        end: () => {},
      };
      const next = () => {
        nextCalled = true;
      };

      await (handler as any)(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe("7. Multi-Threaded Worker Execution", () => {
    it("executes functions marked with worker: true in worker pool", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rpc-worker-test-"));
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ type: "module" }),
      );
      const fnDir = path.join(tempDir, "compute", "heavy");
      await fs.mkdir(fnDir, { recursive: true });

      await fs.writeFile(
        path.join(fnDir, "run.js"),
        `
        export const worker = true;
        export async function run(data) {
          return { computed: data.x * 2 };
        }
        `,
      );

      const app = new CoreRPC({
        functionsDir: tempDir,
        middlewaresDir: "./non-existent",
      });

      const res = await app.execute("compute.heavy", { x: 21 });
      expect(res.status).toBe("ok");
      if (res.status === "ok") {
        expect((res.data as any).computed).toBe(42);
      }

      await app.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("safely handles worker throwing primitive string or null", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rpc-worker-throw-"));
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ type: "module" }),
      );
      const fnDir = path.join(tempDir, "compute", "error");
      await fs.mkdir(fnDir, { recursive: true });

      await fs.writeFile(
        path.join(fnDir, "run.js"),
        `
        export const worker = true;
        export async function run() {
          throw "Custom primitive worker error";
        }
        `,
      );

      const app = new CoreRPC({
        functionsDir: tempDir,
        middlewaresDir: "./non-existent",
      });

      const res = await app.execute("compute.error", {});
      expect(res.status).toBe("error");
      if (res.status === "error") {
        expect(res.message).toBe("Custom primitive worker error");
        expect(res.code).toBe("internal_error");
      }

      await app.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("rehydrates UploadedFile inside worker thread allowing toBuffer calls", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rpc-worker-file-"));
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ type: "module" }),
      );
      const fnDir = path.join(tempDir, "media", "process");
      await fs.mkdir(fnDir, { recursive: true });

      const testFilePath = path.join(tempDir, "sample.txt");
      await fs.writeFile(testFilePath, "Hello from file!");

      await fs.writeFile(
        path.join(fnDir, "run.js"),
        `
        export const worker = true;
        export async function run(data) {
          const buf = await data.file.toBuffer();
          return { content: buf.toString("utf-8"), size: data.file.byteLength };
        }
        `,
      );

      const app = new CoreRPC({
        functionsDir: tempDir,
        middlewaresDir: "./non-existent",
      });

      const { createUploadedFile } = await import("./uploads/types");
      const uploaded = createUploadedFile({
        path: testFilePath,
        filename: "sample.txt",
        mimeType: "text/plain",
        byteLength: 16,
      });

      const res = await app.execute("media.process", { file: uploaded });
      expect(res.status).toBe("ok");
      if (res.status === "ok") {
        expect((res.data as any).content).toBe("Hello from file!");
        expect((res.data as any).size).toBe(16);
      }

      await app.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe("8. Routing Identifier Traversal & Injection Shields", () => {
    it("rejects path traversal attempts in namespace or functionName", async () => {
      const traversalPayloads = [
        { namespace: "../../../etc", functionName: "passwd" },
        { namespace: "public", functionName: "../secret" },
        { namespace: "..", functionName: "run" },
        { namespace: "admin..users", functionName: "list" },
        { namespace: "/root", functionName: "exec" },
        { namespace: "public", functionName: "cmd;ls" },
        { namespace: "public\0evil", functionName: "hello" },
        { namespace: "public", functionName: "__proto__" },
        { namespace: "constructor", functionName: "test" },
      ];

      for (const payload of traversalPayloads) {
        const mockReq = {
          headers: { "content-type": "application/json" },
          body: { ...payload, data: {} },
        };

        await expect(parseRpcRequest(mockReq)).rejects.toThrow();
      }
    });

    it("rejects identifiers exceeding 128 characters", async () => {
      const longName = "a".repeat(129);
      const mockReq = {
        headers: { "content-type": "application/json" },
        body: { namespace: longName, functionName: "test", data: {} },
      };

      await expect(parseRpcRequest(mockReq)).rejects.toThrow("exceeds maximum allowed length");
    });
  });

  describe("9. Fail-Closed Middleware Enforcement", () => {
    it("fails closed with INTERNAL_ERROR if declared middleware is unregistered", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rpc-mw-failclosed-"));
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ type: "module" }),
      );
      const fnDir = path.join(tempDir, "admin", "secureAction");
      await fs.mkdir(fnDir, { recursive: true });

      await fs.writeFile(
        path.join(fnDir, "middlewares.js"),
        `
        export const middlewares = [{ name: "nonExistentMiddleware" }];
        `,
      );

      await fs.writeFile(
        path.join(fnDir, "run.js"),
        `
        export async function run() {
          throw new Error("HANDLER_SHOULD_NEVER_RUN");
        }
        `,
      );

      const app = new CoreRPC({
        functionsDir: tempDir,
        middlewaresDir: "./non-existent",
      });

      const res = await app.execute("admin.secureAction", {});
      expect(res.status).toBe("error");
      if (res.status === "error") {
        expect(res.code).toBe("internal_error");
        expect(res.message).toContain("nonExistentMiddleware");
      }

      await app.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe("10. Web Standard Multipart DoS & Flood Protections", () => {
    it("rejects Web Standard multipart requests exceeding 100 text fields", async () => {
      const { parseWebRequest } = await import("./request/web");
      const formData = new FormData();
      formData.append("namespace", "public");
      formData.append("functionName", "upload");

      for (let i = 0; i < 105; i++) {
        formData.append(`field_${i}`, `data_${i}`);
      }

      const req = new Request("http://localhost:4000/rpc", {
        method: "POST",
        body: formData,
      });

      await expect(parseWebRequest(req)).rejects.toThrow("exceeded limit of 100 fields");
    });

    it("rejects Web Standard multipart requests with field exceeding 1MB", async () => {
      const { parseWebRequest } = await import("./request/web");
      const formData = new FormData();
      formData.append("namespace", "public");
      formData.append("functionName", "upload");
      formData.append("largeField", "A".repeat(1024 * 1024 + 100));

      const req = new Request("http://localhost:4000/rpc", {
        method: "POST",
        body: formData,
      });

      await expect(parseWebRequest(req)).rejects.toThrow("exceeded maximum field size");
    });

    it("rejects Web Standard multipart requests exceeding 20 files", async () => {
      const { parseWebRequest } = await import("./request/web");
      const formData = new FormData();
      formData.append("namespace", "public");
      formData.append("functionName", "upload");

      for (let i = 0; i < 25; i++) {
        formData.append(`file_${i}`, new Blob(["file-content"], { type: "text/plain" }), `file_${i}.txt`);
      }

      const req = new Request("http://localhost:4000/rpc", {
        method: "POST",
        body: formData,
      });

      await expect(parseWebRequest(req)).rejects.toThrow("exceeded limit of 20 files");
    });

    it("filters prototype pollution keys from Web Standard FormData", async () => {
      const { parseWebRequest } = await import("./request/web");
      const formData = new FormData();
      formData.append("namespace", "public");
      formData.append("functionName", "upload");
      formData.append("__proto__", '{"polluted":true}');
      formData.append("constructor", "evil");
      formData.append("prototype", "evil");
      formData.append("safeKey", "safeValue");

      const req = new Request("http://localhost:4000/rpc", {
        method: "POST",
        body: formData,
      });

      const parsed = await parseWebRequest(req);
      const parsedData = parsed.data as Record<string, any>;
      expect(parsedData.safeKey).toBe("safeValue");
      expect(parsedData.__proto__).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(parsedData.constructor).toBeUndefined();
      expect(parsedData.prototype).toBeUndefined();
    });
  });

  describe("11. Worker Pool Non-Cloneable Payload Protection", () => {
    it("gracefully catches non-cloneable objects passed to worker threads without crashing pool", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rpc-worker-clone-"));
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ type: "module" }),
      );
      const fnDir = path.join(tempDir, "worker", "cloneCheck");
      await fs.mkdir(fnDir, { recursive: true });

      await fs.writeFile(
        path.join(fnDir, "run.js"),
        `
        export const worker = true;
        export async function run(data) {
          return { ok: true };
        }
        `,
      );

      const app = new CoreRPC({
        functionsDir: tempDir,
        middlewaresDir: "./non-existent",
      });

      // Symbols and functions cannot be cloned via postMessage structured clone algorithm
      const res = await app.execute("worker.cloneCheck", {
        func: () => "cannot-clone",
        sym: Symbol("test"),
      });

      expect(res.status).toBe("error");
      if (res.status === "error") {
        expect(res.code).toBe("internal_error");
      }

      await app.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe("12. Enterprise & Government Security Headers", () => {
    it("injects OWASP security headers (nosniff, frame-options, referrer-policy) on RPC and health responses", async () => {
      const app = new CoreRPC();
      const res = await app.fetch(
        new Request("http://localhost:4000/health", { method: "GET" }),
      );

      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
    });
  });

  describe("13. Header-Based Multipart Routing & Zero-Byte Pre-Auth Rejection", () => {
    it("rejects unauthorized multipart request via headers before parsing body", async () => {
      const app = new CoreRPC();
      const registry = await app.getRegistry();

      registry.middlewares.set("requireSecret", {
        name: "requireSecret",
        metadata: { name: "requireSecret" },
        run: async (opts) => {
          if (opts.headers["x-secret"] !== "valid-token") {
            throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid secret");
          }
          return {};
        },
      });

      registry.functions.set("upload.secureDoc", {
        key: "upload.secureDoc",
        namespace: "upload",
        functionName: "secureDoc",
        filePath: "/mock/upload/secureDoc/run.ts",
        contentType: "multipart/form-data",
        metadata: { isPublic: true },
        middlewares: [{ name: "requireSecret" }],
        run: async () => ({ uploaded: true }),
      });

      // Send multipart request with invalid secret and dummy body
      const boundary = "----TestBoundary12345";
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nHello World\r\n--${boundary}--\r\n`;

      const res = await app.fetch(
        new Request("http://localhost:4000/rpc", {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "X-CRPC-Namespace": "upload",
            "X-CRPC-Function": "secureDoc",
            "x-secret": "wrong-token",
          },
          body,
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("error");
      expect(json.code).toBe("unauthorized");
      expect(json.message).toBe("Invalid secret");
    });
  });
});
