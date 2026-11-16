import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { Type } from "@sinclair/typebox";
import { CoreRPC } from "../core-rpc";
import { AppError, ErrorCode } from "../errors";
import type { FunctionMetadata, Registry, RegisteredMiddleware } from "../registry";
import { renderDocsHtml, renderDocsIndex, renderFunctionDoc, renderMiddlewareDoc } from "./renderer";

const cases: { name: string; metadata: FunctionMetadata & { hideFromDocs?: boolean }; hidden: boolean }[] = [
  { name: "omitted", metadata: {}, hidden: false },
  { name: "public", metadata: { isPublic: true }, hidden: false },
  { name: "legacyPrivate", metadata: { isPublic: false }, hidden: false },
  { name: "explicitVisible", metadata: { hideFromDocs: false }, hidden: false },
  { name: "legacyPrivateVisible", metadata: { isPublic: false, hideFromDocs: false }, hidden: false },
  { name: "concealed", metadata: { hideFromDocs: true }, hidden: true },
  { name: "concealedPublic", metadata: { isPublic: true, hideFromDocs: true }, hidden: true },
  { name: "concealedPrivate", metadata: { isPublic: false, hideFromDocs: true }, hidden: true },
];

function fixture() {
  const calls = { middleware: 0, handler: 0 };
  const registry: Registry = { functions: new Map(), middlewares: new Map() };
  registry.middlewares.set("guard", {
    name: "guard", metadata: { description: "Auth middleware" },
    run: async ({ headers }, context) => {
      calls.middleware++;
      if (headers.authorization !== "Bearer valid") throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid token");
      return { ...context, actor: "reader" };
    },
  } as RegisteredMiddleware);
  for (const tc of cases) {
    const namespace = tc.hidden ? "vault.internal" : "catalog";
    const key = `${namespace}.${tc.name}`;
    registry.functions.set(key, {
      key, namespace, functionName: tc.name, filePath: `/mock/${key}/run.ts`, contentType: "application/json",
      metadata: { ...tc.metadata, description: `marker_${tc.name}`, tags: [`tag_${tc.name}`] },
      inputSchema: Type.Object({}, { description: `input_schema_${tc.name}` }),
      outputSchema: Type.Object({ echo: Type.String() }, { description: `output_schema_${tc.name}` }),
      middlewares: [{ name: "guard" }],
      run: async (_, context) => {
        calls.handler++;
        if (context.actor !== "reader") throw new Error("middleware context was lost");
        return { echo: "ok" };
      },
    });
  }
  return { registry, calls };
}

function expectNoHiddenDocumentation(html: string) {
  for (const tc of cases.filter((tc) => tc.hidden)) {
    for (const token of [tc.name, `marker_${tc.name}`, `tag_${tc.name}`, `input_schema_${tc.name}`, `output_schema_${tc.name}`]) {
      expect(html.includes(token), `hidden token ${token}`).toBe(false);
    }
  }
  expect(html).not.toContain("vault.internal");
  expect(html).not.toContain("vault/internal");
}

describe("Docs visibility opt-out", () => {
  it("defaults to visible and preserves legacy isPublic classification", () => {
    const { registry, calls } = fixture();
    const html = renderDocsIndex(registry);
    for (const tc of cases.filter((tc) => !tc.hidden)) expect(html).toContain(`marker_${tc.name}`);
    expect(html.includes("5 functions across 1 namespace"), "visible function/namespace counts").toBe(true);
    expect(html).toContain("PRIVATE");
    expect(html).toContain("PUBLIC");
    expectNoHiddenDocumentation(html);
    expect(registry.functions.size).toBe(8);
    expect(calls).toEqual({ middleware: 0, handler: 0 });
  });

  it.each(["/docs", "/custom/reference/"])("filters every docs surface under %s", (docsEndpoint) => {
    const { registry, calls } = fixture();
    const base = docsEndpoint.replace(/\/$/, "");
    const visible = registry.functions.get("catalog.omitted")!;
    const pages = [
      renderDocsHtml(registry, "http://localhost", `${base}?q=concealed`, "/rpc", docsEndpoint),
      renderDocsHtml(registry, "http://localhost", `${base}/catalog/omitted`, "/rpc", docsEndpoint),
      renderDocsHtml(registry, "http://localhost", `${base}/middlewares/guard`, "/rpc", docsEndpoint),
      renderDocsHtml(registry, "http://localhost", `${base}/missing/function`, "/rpc", docsEndpoint),
      renderFunctionDoc(registry, visible, "http://localhost", "/rpc", docsEndpoint),
      renderMiddlewareDoc(registry, registry.middlewares.get("guard")!, docsEndpoint),
    ];
    for (const html of pages) expectNoHiddenDocumentation(html);
    for (const tc of cases.filter((tc) => tc.hidden)) {
      const hidden = registry.functions.get(`vault.internal.${tc.name}`)!;
      for (const html of [
        renderDocsHtml(registry, "http://localhost", `${base}/vault/internal/${tc.name}/?x=1`, "/rpc", docsEndpoint),
        renderFunctionDoc(registry, hidden, "http://localhost", "/rpc", docsEndpoint),
      ]) {
        expectNoHiddenDocumentation(html);
        expect(html).not.toContain("Input Data Contract");
        expect(html).not.toContain("Output Data Contract");
      }
    }
    expect(registry.functions.size).toBe(8);
    expect(calls).toEqual({ middleware: 0, handler: 0 });
  });

  it("renders an empty directory when all functions are hidden", () => {
    const { registry } = fixture();
    registry.functions = new Map([...registry.functions].filter(([, fn]) => fn.namespace === "vault.internal"));
    const html = renderDocsIndex(registry);
    expectNoHiddenDocumentation(html);
    expect(html).toContain("0 functions across 0 namespaces");
    expect(registry.functions.size).toBe(3);
  });
});

describe("Live docs visibility does not authorize RPC", () => {
  let app: CoreRPC;
  let server: http.Server;
  let base: string;
  let registry: Registry;
  let calls: { middleware: number; handler: number };
  beforeAll(async () => {
    app = new CoreRPC({ docs: true, docsEndpoint: "/docs", rpcEndpoint: "/rpc" });
    registry = await app.getRegistry();
    const configured = fixture();
    registry.functions = configured.registry.functions;
    registry.middlewares = configured.registry.middlewares;
    calls = configured.calls;
    server = http.createServer(await app.createHandler());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  });

  it("omits hidden schemas in live docs without executing middleware", async () => {
    const before = { ...calls };
    for (const url of ["/docs", "/docs/catalog/omitted", "/docs/middlewares/guard", "/docs/vault/internal/concealed"]) {
      const response = await fetch(base + url);
      const html = await response.text();
      expectNoHiddenDocumentation(html);
      // The existing Node docs API returns HTML with HTTP 200; hidden details must not reveal a schema.
      if (url.endsWith("concealed")) expect(html).not.toContain("Input Data Contract");
    }
    expect(calls).toEqual(before);
  });

  it.each(cases)("keeps middleware and execution intact for $name", async (tc) => {
    const namespace = tc.hidden ? "vault.internal" : "catalog";
    const payload = JSON.stringify({ namespace, functionName: tc.name, data: {} });
    const before = { ...calls };
    const denied = await fetch(base + "/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    expect(denied.status).toBe(200);
    expect(await denied.json()).toMatchObject({ status: "error", code: "unauthorized" });
    const allowed = await fetch(base + "/rpc", { method: "POST", headers: { "Content-Type": "application/json", authorization: "Bearer valid" }, body: payload });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ status: "ok", data: { echo: "ok" } });
    expect(calls).toEqual({ middleware: before.middleware + 2, handler: before.handler + 1 });
    expect(registry.functions.has(`${namespace}.${tc.name}`)).toBe(true);
  });

  it("allows a hidden function with no middleware to execute anonymously", async () => {
    const fn = registry.functions.get("vault.internal.concealed")!;
    const original = fn.middlewares;
    const run = fn.run;
    fn.middlewares = [];
    fn.run = async () => ({ echo: "open hidden function" });
    try {
      const response = await fetch(base + "/rpc", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace: "vault.internal", functionName: "concealed", data: {} }) });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: "ok", data: { echo: "open hidden function" } });
    } finally { fn.middlewares = original; fn.run = run; }
  });
});
