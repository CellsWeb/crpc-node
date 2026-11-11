/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint powered by @cellsweb/rpc-core
 */

import http from "node:http";
import { CoreRPC } from "@cellsweb/rpc-core";
import { env } from "./env";
import { storage } from "./utils/storage";

export const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: env.API_PORT,
  host: env.API_HOST,
  docs: env.NODE_ENV !== "production" || env.API_DOCS_ENABLED === true,
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
      res.writeHead(404, {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
      });
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
      "X-Content-Type-Options": "nosniff",
    });
    res.end(result.buffer);
    return;
  }

  // ── Core RPC Engine Handler (Handles /rpc, /docs, /health) ──
  await rpcHandler(req, res);
});

// Graceful shutdown handler for container environments (K8s, Docker, Cloud Run)
const handleGracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}, initiating graceful shutdown...`);
  if (typeof (server as any).closeIdleConnections === "function") {
    (server as any).closeIdleConnections();
  }
  server.close(async () => {
    try {
      await app.close();
      console.log("Server and background workers shut down cleanly.");
      process.exit(0);
    } catch (err) {
      console.error("Error during graceful shutdown cleanup:", err);
      process.exit(1);
    }
  });

  // Force termination if connections fail to drain within 10s
  setTimeout(() => {
    console.error("Graceful shutdown timed out after 10s. Forcing exit.");
    process.exit(1);
  }, 10000).unref();
};

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  process.once("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => handleGracefulShutdown("SIGINT"));
}

// Only start HTTP listener if not running inside test environment (Vitest)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`Server listening at http://${host}:${port}`);
  });
}
