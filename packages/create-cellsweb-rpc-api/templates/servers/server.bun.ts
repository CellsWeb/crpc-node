/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint — Bun Native
 */

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

export const fetchHandler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // ── Static Files Route (/uploads/*) ──
  if (url.pathname.startsWith("/uploads/")) {
    const filePath = decodeURIComponent(url.pathname.replace(/^\/uploads\//, ""));
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
  }

  // ── Dispatch to CellsWeb RPC (Handles /rpc, /docs, /health, OPTIONS) ──
  return await app.fetch(req);
};

// Bun default export supports `bun run src/server.ts`
export default {
  port: env.API_PORT ?? 4000,
  hostname: env.API_HOST ?? "0.0.0.0",
  fetch: fetchHandler,
};

// Start server if executed directly in Bun runtime
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? "0.0.0.0";
  if (typeof (globalThis as any).Bun !== "undefined") {
    (globalThis as any).Bun.serve({
      port,
      hostname: host,
      fetch: fetchHandler,
    });
    console.log(`Bun native server listening at http://${host}:${port}`);
  } else {
    // Fallback if started on Node.js
    console.log(`Starting via app.start() fallback on Node.js...`);
    await app.start();
  }
}
