/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint — Hono (Web Standards)
 */

import { CoreRPC, createHonoMiddleware } from "@cellsweb/rpc-core";
import { Hono } from "hono";
import { env } from "./env";
import { storage } from "./utils/storage";

export const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: env.API_PORT,
  host: env.API_HOST,
  docs: true,
});

export const server = new Hono();

// ── Static Files Route (/uploads/*) ──
server.get("/uploads/*", async (c) => {
  const filePath = decodeURIComponent(c.req.path.replace(/^\/uploads\//, ""));
  const result = await storage.serve(filePath);
  if (!result) {
    return c.json(
      {
        status: "error",
        code: "not_found",
        message: "File not found",
      },
      404,
    );
  }
  return new Response(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "Cache-Control": "public, max-age=86400",
    },
  });
});

// ── Register CellsWeb RPC Middleware (Handles /rpc, /docs, /health) ──
createHonoMiddleware(app)(server);

// Start server if executed directly (Node.js or Bun)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? "0.0.0.0";

  // Check if running on native Bun
  if (typeof (globalThis as any).Bun !== "undefined") {
    (globalThis as any).Bun.serve({
      port,
      hostname: host,
      fetch: server.fetch,
    });
    console.log(`Hono server listening at http://${host}:${port} (Bun runtime)`);
  } else {
    // Run on Node.js via @hono/node-server
    const { serve } = await import("@hono/node-server");
    serve({ fetch: server.fetch, port, hostname: host }, () => {
      console.log(`Hono server listening at http://${host}:${port} (Node.js runtime)`);
    });
  }
}
