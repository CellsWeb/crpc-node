/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint — Vanilla Node.js (node:http)
 */

import { CoreRPC } from "@cellsweb/rpc-core";
import http from "node:http";
import { env } from "./env";
import { storage } from "./utils/storage";

export const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: env.API_PORT,
  host: env.API_HOST,
  docs: true,
});

const rpcHandler = await app.createHandler();

export const server = http.createServer(async (req, res) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  // ── Static Files Route (/uploads/*) ──
  if (method === "GET" && url.startsWith("/uploads/")) {
    const filePath = decodeURIComponent(url.replace(/^\/uploads\//, ""));
    const result = await storage.serve(filePath);
    if (!result) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          code: "not_found",
          message: "File not found",
        }),
      );
      return;
    }
    res.writeHead(200, {
      "Content-Type": result.mimeType,
      "Cache-Control": "public, max-age=86400",
    });
    res.end(result.buffer);
    return;
  }

  // ── Core RPC Engine Handler (Handles /rpc, /docs, /health) ──
  await rpcHandler(req, res);
});

// Only start HTTP listener if not running inside test environment (Vitest)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`Server listening at http://${host}:${port}`);
  });
}
