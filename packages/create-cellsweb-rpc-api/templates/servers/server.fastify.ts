/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint — Fastify
 */

import { CoreRPC } from "@cellsweb/rpc-core";
import Fastify from "fastify";
import { env } from "./env";
import { storage } from "./utils/storage";

export const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: env.API_PORT,
  host: env.API_HOST,
  docs: true,
});

export const server = Fastify({ logger: false });

// ── Static Files Route (/uploads/*) ──
server.get("/uploads/*", async (req, reply) => {
  const filePath = decodeURIComponent(req.url.replace(/^\/uploads\//, ""));
  const result = await storage.serve(filePath);
  if (!result) {
    reply.code(404).send({
      status: "error",
      code: "not_found",
      message: "File not found",
    });
    return;
  }
  reply.header("Content-Type", result.mimeType);
  reply.header("Cache-Control", "public, max-age=86400");
  reply.send(result.buffer);
});

// ── Register CellsWeb RPC Plugin (Handles /rpc, /docs, and /health) ──
await server.register(app.createFastifyPlugin());

// Only start HTTP listener if not running inside test environment (Vitest)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? "0.0.0.0";
  await server.listen({ port, host });
  console.log(`Fastify server listening at http://${host}:${port}`);
}
