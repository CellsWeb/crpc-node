/**
 * server.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CellsWeb RPC API Server Entrypoint powered by @cellsweb/rpc-core
 */

import { CoreRPC } from "@cellsweb/rpc-core";
import { env } from "./env";

export const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: env.API_PORT,
  host: env.API_HOST,
  docs: env.NODE_ENV !== "production" || env.API_DOCS_ENABLED === true,
});

// Only start HTTP listener if not running inside test environment (Vitest)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  await app.start();
}

