import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Type } from "@sinclair/typebox";
import { CoreRPC } from "./core-rpc";
import { renderDocsHtml } from "./docs/renderer";
import type { FunctionMetadata } from "./registry";
import { scaffoldFunction } from "./scaffold";

describe.each(["SDK", "core CLI", "create CLI"])("%s generates metadata without legacy flags", provider => {
  it.each(["json", "multipart"])("%s function", async contentType => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-metadata-"));
    try {
      const generate = provider === "SDK" ? scaffoldFunction : (await import(new URL(
        provider === "core CLI" ? "../bin/create-function.js" : "../../create-cellsweb-rpc-api/bin/create-function.js", import.meta.url,
      ).href)).scaffoldFunction;
      const output = await generate({ namespace: "public", name: "sample", contentType, targetDir: dir });
      expect(fs.readFileSync(path.join(output, "constants.ts"), "utf8")).not.toContain("isPublic");
    } finally { fs.rmSync(dir, { force: true, recursive: true }); }
  });
});

describe("documentation cleanup and middleware parity", () => {
  const configuredSecret = "CONFIGURED_SECRET_MUST_NOT_APPEAR";
  const schemaSecret = "SCHEMA_SECRET_MUST_NOT_APPEAR";
  const run = vi.fn(async () => ({ ok: true }));
  const middleware = vi.fn(async (_params, context) => context);
  const optionsSchema = Type.Object({
    secret: Type.String({ default: schemaSecret, examples: [schemaSecret], description: "Option description marker" }),
    credentials: Type.Optional(Type.Object({ key: Type.String({ default: schemaSecret, description: "Nested option marker" }) })),
    default: Type.Optional(Type.String({ description: "An option named default" })),
    choices: Type.Optional(Type.Union([Type.Literal(schemaSecret), Type.Literal("another private constant")])),
  });
  const headersSchema = Type.Object({
    authorization: Type.String({ description: "Required bearer marker", default: schemaSecret }),
    "x-trace": Type.Optional(Type.String({ description: "Optional trace marker", examples: [schemaSecret] })),
  });
  let app: CoreRPC, server: http.Server, base: string;
  beforeAll(async () => {
    app = new CoreRPC({ docs: true, docsEndpoint: "/reference/api" });
    const registry = await app.getRegistry();
    registry.middlewares.set("guard", { name: "guard", filePath: "/fixture", metadata: { description: "Middleware description marker" }, optionsSchema, headersSchema, run: middleware });
    registry.middlewares.set("untyped", { name: "untyped", filePath: "/fixture", run: middleware });
    for (const [name, legacy] of [["omitted", undefined], ["legacyTrue", true], ["legacyFalse", false]] as const) {
      const metadata: FunctionMetadata = { description: "Function description marker", ...(legacy === undefined ? {} : { isPublic: legacy }) };
      registry.functions.set(`catalog.${name}`, { key: `catalog.${name}`, namespace: "catalog", functionName: name,
        filePath: "/fixture", contentType: "application/json", metadata,
        inputSchema: Type.Object({ name: Type.String({ description: "Input schema marker" }) }),
        outputSchema: Type.Object({ ok: Type.Boolean() }), middlewares: [
          { name: "guard", options: { secret: configuredSecret, credentials: { key: configuredSecret } } },
          { name: "untyped", options: { untypedSecret: configuredSecret } },
        ], run });
    }
    server = http.createServer(await app.createHandler());
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await app.close(); });

  it.each(["", "/catalog/omitted", "/catalog/legacyTrue", "/catalog/legacyFalse", "/middlewares/guard", "/middlewares/untyped"])("native/Fetch page %s removes badges and all configuration values", async suffix => {
    const uri = "/reference/api" + suffix + "?tab=schema";
    const [native, web] = await Promise.all([fetch(base + uri), app.fetch(new Request(base + uri))]);
    expect(native.status).toBe(200); expect(web.status).toBe(200);
    const html = await native.text(); expect(await web.text()).toBe(html);
    for (const secret of [configuredSecret, schemaSecret, "another private constant", ">PUBLIC</span>", ">PRIVATE</span>"]) expect(html).not.toContain(secret);
    expect(middleware).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
  });
  it("shows recursive types, descriptions and required/optional status on function middleware cards", async () => {
    const html = await (await fetch(base + "/reference/api/catalog/legacyFalse")).text();
    for (const marker of ["Middleware description marker", "Option description marker", "Nested option marker", "An option named default", "Required bearer marker", "Optional trace marker", "required", "optional", "string", 'href="/reference/api/middlewares/guard"']) expect(html).toContain(marker);
    expect(html).toContain('<td class="header-key">authorization</td>');
    expect(html).not.toContain('<td class="header-key">x-trace</td>');
    expect(html).not.toContain("YOUR_X_TRACE");
  });
  it("middleware detail schemas are public projections without mutating runtime metadata", async () => {
    const html = await (await fetch(base + "/reference/api/middlewares/guard")).text();
    expect(html).toContain("Options JSON Schema"); expect(html).toContain("Headers JSON Schema");
    expect(html).toContain("Nested option marker");
    expect(optionsSchema.properties.secret.default).toBe(schemaSecret);
    expect(headersSchema.properties.authorization.default).toBe(schemaSecret);
    const registry = await app.getRegistry();
    expect(registry.functions.get("catalog.legacyTrue")?.metadata.isPublic).toBe(true);
    expect(registry.functions.get("catalog.legacyFalse")?.metadata.isPublic).toBe(false);
  });
  it("never reads per-function middleware option values while rendering", async () => {
    const registry = await app.getRegistry();
    const entry = registry.functions.get("catalog.omitted")!;
    const original = entry.middlewares;
    entry.middlewares = [{ name: "guard", get options() { throw new Error("Configured values inspected"); } }];
    try { expect(() => renderDocsHtml(registry, base, "/reference/api/catalog/omitted", "/rpc", "/reference/api")).not.toThrow(); }
    finally { entry.middlewares = original; }
  });
});
