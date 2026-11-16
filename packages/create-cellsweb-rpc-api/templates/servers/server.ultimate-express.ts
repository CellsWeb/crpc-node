/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint — Ultimate-Express (uWebSockets.js)
 */

import { CoreRPC } from "@cellsweb/rpc-core";
import express from "ultimate-express";
import { env } from "./env";
import { storage } from "./utils/storage";

export const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: env.API_PORT,
  host: env.API_HOST,
  docs: env.NODE_ENV !== "production" || env.API_DOCS_ENABLED === true,
});

export const server = express();
const rpcHandler = await app.createHandler();

// ── Static Files Route (/uploads/*) ──
server.get("/uploads/*", async (req: any, res: any) => {
  const filePath = decodeURIComponent(req.url.replace(/^\/uploads\//, ""));
  const result = await storage.serve(filePath);
  if (!result) {
    res.status(404).json({
      status: "error",
      code: "not_found",
      message: "File not found",
    });
    return;
  }
  res.setHeader("Content-Type", result.mimeType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(result.buffer);
});

// ⚠️ IMPORTANT: Mount RPC handler BEFORE any global body parsers
server.use(rpcHandler);

// Only start HTTP listener if not running inside test environment (Vitest)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`Ultimate-Express server listening at http://${host}:${port}`);
  });
}
