import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { Type, type TSchema } from "@sinclair/typebox";
import { CoreRPC } from "./core-rpc";
import { AppError, ErrorCode } from "./errors";
import { UploadedFile } from "./uploads/types";
import { File, Files, FormBool, FormNum, validateSchema } from "./utils/typebox";

const upload = (mimeType = "text/plain", byteLength = 3) => new UploadedFile({ path: "/fixture", filename: "fixture.txt", mimeType, byteLength });
const rejects = (schema: TSchema, value: unknown) => expect(() => validateSchema(schema, value)).toThrow(AppError);

describe("union validation preserves every branch contract", () => {
  const nullable = Type.Union([Type.String(), Type.Null()]);
  for (const [name, value] of [["nullable_omitted", {}], ["nullable_wrong_shape", []], ["typed_omitted", {}], ["boolean", false], ["number", 1]] as const) {
    it(`rejects ${name}`, () => rejects(nullable, value));
  }
  for (const value of [null, "", "valid"]) it(`accepts nullable ${JSON.stringify(value)}`, () => expect(validateSchema(nullable, value)).toEqual(value));
  it("keeps optional union fields optional and rejects invalid present values", () => {
    const schema = Type.Object({ value: Type.Optional(nullable) });
    expect(validateSchema(schema, {})).toEqual({});
    expect(validateSchema(schema, { value: null })).toEqual({ value: null });
    rejects(schema, { value: [] });
  });
  it("validates unions nested in objects, arrays, tuples and intersections", () => {
    const schemas = [Type.Object({ value: nullable }), Type.Array(nullable), Type.Tuple([nullable]), Type.Intersect([Type.Object({ value: nullable }), Type.Object({ enabled: Type.Boolean() })])];
    const invalid = [{ value: {} }, [[]], [{}], { value: [], enabled: true }];
    schemas.forEach((schema, index) => rejects(schema, invalid[index]));
  });
  it("preserves ordinary defaults and transformed form primitives", () => {
    const schema = Type.Object({ value: Type.Union([Type.String({ default: "fallback" }), Type.Null()]) });
    expect(validateSchema(schema, {})).toEqual({ value: "fallback" });
    expect(validateSchema(FormNum({ minimum: 2 }), "3")).toBe(3);
    expect(validateSchema(FormBool(), "false")).toBe(false);
    rejects(FormNum({ minimum: 2 }), "1");
    rejects(FormNum(), "not-number");
    rejects(FormBool(), "maybe");
  });
  it("retains valid non-file branches instead of always selecting a file", () => {
    const schema = Type.Object({ value: Type.Union([File(), Type.String({ minLength: 2 })]) });
    expect(validateSchema(schema, { value: "reference" })).toEqual({ value: "reference" });
    for (const value of [false, {}, [], null, "x"]) rejects(schema, { value });
  });
  it("enforces file unions at the root and preserves the actual instance", () => {
    const schema = Type.Union([File({ mimeTypes: ["text/plain"], maxSizeBytes: 4 }), Type.Null()]);
    const file = upload();
    expect(validateSchema(schema, file)).toBe(file);
    expect(validateSchema(schema, null)).toBeNull();
    for (const value of [{}, false, upload("image/png"), upload("text/plain", 5)]) rejects(schema, value);
  });
  it("tries all file branches and preserves their constraints", () => {
    const schema = Type.Object({ value: Type.Union([File({ mimeTypes: ["image/png"] }), File({ mimeTypes: ["text/plain"] })]) });
    const file = upload();
    expect(validateSchema<{ value: UploadedFile }>(schema, { value: file }).value).toBe(file);
    rejects(schema, { value: upload("application/json") });
  });
  it("validates arrays of files in unions, including optional and empty arrays", () => {
    const schema = Type.Object({ value: Type.Optional(Type.Union([Files({ maxCount: 2, maxSizeBytes: 4 }), Type.String()])) });
    const file = upload();
    expect(validateSchema(schema, {})).toEqual({});
    expect(validateSchema<{ value: UploadedFile[] }>(schema, { value: [file] }).value[0]).toBe(file);
    expect(validateSchema(schema, { value: [] })).toEqual({ value: [] });
    expect(validateSchema<{ value: UploadedFile[] }>(schema, { value: file }).value).toEqual([file]);
    for (const value of [[{}], [file, file, file], [upload("text/plain", 5)], true]) rejects(schema, { value });
  });
  it("validates nested file unions without erasing non-file branches", () => {
    const schema = Type.Object({ entries: Type.Array(Type.Union([Type.Object({ attachment: File({ maxSizeBytes: 4 }) }), Type.String()])) });
    const file = upload();
    const result = validateSchema<{ entries: [{ attachment: UploadedFile }, string] }>(schema, { entries: [{ attachment: file }, "reference"] });
    expect(result.entries[0].attachment).toBe(file);
    rejects(schema, { entries: [{ attachment: {} }] });
    rejects(schema, { entries: [{ attachment: upload("text/plain", 5) }] });
  });
  it("keeps branch defaults when a union contains physical file instances", () => {
    const schema = Type.Union([
      Type.Object({ attachment: File({ mimeTypes: ["image/png"] }), kind: Type.Literal("image", { default: "image" }) }),
      Type.Object({ attachment: File({ mimeTypes: ["text/plain"] }), kind: Type.Literal("text", { default: "text" }) }),
    ]);
    const file = upload();
    expect(validateSchema(schema, { attachment: file })).toEqual({ attachment: file, kind: "text" });
  });
  it("does not mutate the caller's schema", () => {
    const before = nullable.anyOf.slice();
    validateSchema(nullable, "ok");
    expect(nullable.anyOf).toEqual(before);
    expect(nullable.anyOf).toHaveLength(2);
  });
});

describe("nullable unions over actual HTTP", () => {
  let app: CoreRPC, server: http.Server, base: string;
  let middlewareCalls = 0, handlerCalls = 0;
  beforeAll(async () => {
    app = new CoreRPC({ docs: false });
    const registry = await app.getRegistry();
    registry.middlewares.set("unionGuard", { name: "unionGuard", filePath: "/fixture", run: async ({ headers }, context) => {
      middlewareCalls++;
      if (headers.authorization !== "Bearer allowed") throw new AppError(ErrorCode.UNAUTHORIZED, "Denied");
      return context;
    } });
    for (const functionName of ["nullable", "typedNullable"]) registry.functions.set(`unions.${functionName}`, {
      key: `unions.${functionName}`, namespace: "unions", functionName, filePath: "/fixture", metadata: {}, contentType: "application/json",
      inputSchema: Type.Union([Type.String(), Type.Null()]), middlewares: [{ name: "unionGuard", options: {} }],
      run: async input => { handlerCalls++; return { received: input }; },
    });
    server = http.createServer(await app.createHandler());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await app.close(); });
  for (const [name, functionName, data] of [["nullable_omitted", "nullable", undefined], ["nullable_wrong_shape", "nullable", []], ["typed_omitted", "typedNullable", undefined]] as const) {
    it(`rejects ${name} before the handler with HTTP 200`, async () => {
      const before = handlerCalls;
      const response = await fetch(base + "/rpc", { method: "POST", headers: { "Content-Type": "application/json", authorization: "Bearer allowed" }, body: JSON.stringify({ namespace: "unions", functionName, ...(data !== undefined ? { data } : {}) }) });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: "error", code: "validation_error" });
      expect(handlerCalls).toBe(before);
    });
  }
  it("preserves valid null and leaves authentication first", async () => {
    const request = (authorization: string) => fetch(base + "/rpc", { method: "POST", headers: { "Content-Type": "application/json", authorization }, body: JSON.stringify({ namespace: "unions", functionName: "nullable", data: null }) });
    expect(await (await request("Bearer allowed")).json()).toMatchObject({ status: "ok", data: { received: null } });
    const before = handlerCalls;
    expect(await (await request("denied")).json()).toMatchObject({ status: "error", code: "unauthorized" });
    expect(handlerCalls).toBe(before);
    expect(middlewareCalls).toBe(5);
  });
});
