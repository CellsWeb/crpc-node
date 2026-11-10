/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint — Elysia.js
 */

import { CoreRPC, createElysiaPlugin } from "@cellsweb/rpc-core";
import { Elysia } from "elysia";
import { env } from "./env";
import { storage } from "./utils/storage";

export const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: env.API_PORT,
  host: env.API_HOST,
  docs: true,
});

export const server = new Elysia();

// ── Static Files Route (/uploads/*) ──
server.get("/uploads/*", async ({ path }) => {
  const filePath = decodeURIComponent(path.replace(/^\/uploads\//, ""));
  const result = await storage.serve(filePath);
  if (!result) {
    return new Response(
      JSON.stringify({
        status: "error",
        code: "not_found",
        message: "File not found",
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
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

// ── Register CellsWeb RPC Plugin (Handles /rpc, /docs, /health) ──
server.use(createElysiaPlugin(app));

// Start server if executed directly
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? "0.0.0.0";
  server.listen({ port, hostname: host }, () => {
    console.log(`Elysia server listening at http://${host}:${port}`);
  });
}
