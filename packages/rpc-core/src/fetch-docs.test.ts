import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Type } from "@sinclair/typebox";
import { CoreRPC } from "./core-rpc";

describe.each(["/docs", "/custom/reference"])("Fetch/native documentation at %s", docsPath => {
  let app: CoreRPC;
  let server: http.Server;
  let base: string;
  const middleware = vi.fn(async () => { throw new Error("Docs must not execute middleware"); });
  const handler = vi.fn(async () => { throw new Error("Docs must not execute handlers"); });

  beforeAll(async () => {
    app = new CoreRPC({ docs: true, docsEndpoint: docsPath, rpcEndpoint: "/api/rpc" });
    const registry = await app.getRegistry();
    registry.middlewares.set("guard", {
      name: "guard", filePath: "/fixture/guard.ts", metadata: { description: "Guard fixture documentation" },
      optionsSchema: Type.Object({ role: Type.String({ description: "middleware_options_marker" }) }),
      headersSchema: Type.Object({ authorization: Type.String({ description: "middleware_headers_marker" }) }),
      run: middleware,
    });
    for (const [namespace, name, isPublic] of [
      ["catalog", "lookup", true], ["catalog", "restricted", false],
      ["catalog", "implicit", undefined], ["admin.catalog", "deepLookup", false],
    ] as const) {
      registry.functions.set(`${namespace}.${name}`, {
        key: `${namespace}.${name}`, namespace, functionName: name, filePath: "/fixture/run.ts",
        metadata: { description: `Function description ${name}`, ...(isPublic === undefined ? {} : { isPublic }) },
        contentType: "application/json", middlewares: [{ name: "guard", options: { role: "reader" } }],
        inputSchema: Type.Object({ query: Type.String({ description: `function_input_marker_${name}` }) }),
        outputSchema: Type.Object({ result: Type.String({ description: `function_output_marker_${name}` }) }),
        run: handler,
      });
    }
    server = http.createServer(await app.createHandler());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server?.closeAllConnections();
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await app?.close();
  });

  async function pages(uri: string) {
    const [native, web] = await Promise.all([
      fetch(base + uri, { signal: AbortSignal.timeout(3000) }),
      app.fetch(new Request(base + uri)),
    ]);
    const [nativeHtml, html] = await Promise.all([native.text(), web.text()]);
    expect(native.status).toBe(200);
    expect(web.status).toBe(200);
    expect(native.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(web.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(middleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect((await app.getRegistry()).functions.size).toBe(4);
    return { nativeHtml, html };
  }

  it.each(["", "/", "?view=directory"])("renders index %s", async suffix => {
    const { nativeHtml, html } = await pages(docsPath + suffix);
    expect(html).toContain("<title>API Documentation</title>");
    expect(html).toContain("Function description restricted");
    expect(html).toContain("Function description implicit");
    expect(html).not.toContain("function_input_marker_");
    expect(html).toBe(nativeHtml);
  });

  it.each(["lookup", "restricted", "implicit"])("renders function %s and its contracts", async name => {
    for (const suffix of ["", "/", "?tab=schema&next=%2Fdocs"]) {
      const { nativeHtml, html } = await pages(`${docsPath}/catalog/${name}${suffix}`);
      for (const body of [nativeHtml, html]) {
        expect(body).toContain(`<title>${name} — API Docs</title>`);
        expect(body).not.toContain("<title>API Documentation</title>");
        expect(body).toContain("Input Data Contract");
        expect(body).toContain("Output Data Contract");
        expect(body).toContain(`function_input_marker_${name}`);
        expect(body).toContain(`function_output_marker_${name}`);
        expect(body).not.toContain(name === "lookup" ? "function_input_marker_restricted" : "function_input_marker_lookup");
        expect(body).not.toMatch(/>(PUBLIC|PRIVATE)<\/span>/);
        expect(body).toContain(`${base}/api/rpc`);
        expect(body).toContain(`href="${docsPath}"`);
      }
      expect(html).toBe(nativeHtml);
    }
  });

  it("resolves deep namespaces", async () => {
    const { nativeHtml, html } = await pages(`${docsPath}/admin/catalog/deepLookup?tab=schema`);
    expect(html).toContain("<title>deepLookup — API Docs</title>");
    expect(html).toContain("function_input_marker_deepLookup");
    expect(html).toContain("function_output_marker_deepLookup");
    expect(html).toBe(nativeHtml);
  });

  it("renders middleware details and its own schemas", async () => {
    for (const suffix of ["", "/", "?tab=schema&next=%2Fdocs"]) {
      const { nativeHtml, html } = await pages(`${docsPath}/middlewares/guard${suffix}`);
      for (const body of [nativeHtml, html]) {
        expect(body).toContain("<title>⚡ guard — Middleware Docs</title>");
        expect(body).toContain("CENTRAL MIDDLEWARE");
        expect(body).toContain("Options JSON Schema");
        expect(body).toContain("Headers JSON Schema");
        expect(body).toContain("middleware_options_marker");
        expect(body).toContain("middleware_headers_marker");
        expect(body).not.toContain("function_input_marker_");
        expect(body).not.toContain("Output Data Contract");
      }
      expect(html).toBe(nativeHtml);
    }
  });

  it.each(["/missing", "/catalog/missing?tab=schema", "/middlewares/missing"])("retains index fallback for unknown route %s", async suffix => {
    const { nativeHtml, html } = await pages(docsPath + suffix);
    expect(html).toContain("<title>API Documentation</title>");
    expect(html).not.toContain("function_input_marker_");
    expect(html).toBe(nativeHtml);
  });

  it("keeps disabled docs inaccessible on both transports", async () => {
    app.setDocs(false);
    try {
      for (const suffix of ["", "/?view=index", "/catalog/restricted", "/catalog/lookup?tab=schema", "/middlewares/guard?tab=schema", "/schema.json", "/metadata", "/missing"]) {
        const responses = await Promise.all([fetch(base + docsPath + suffix), app.fetch(new Request(base + docsPath + suffix))]);
        for (const response of responses) {
          expect(response.status).toBe(404);
          const body = await response.text();
          expect(body).not.toContain("<html");
          expect(body).not.toContain("function_input_marker_");
          expect(body).not.toContain("middleware_options_marker");
        }
      }
      expect(middleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    } finally { app.setDocs(true); }
  });
});
