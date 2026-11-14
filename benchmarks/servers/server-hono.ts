import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { CoreRPC, createHonoHandler } from "@cellsweb/rpc-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4005);

const app = new CoreRPC({
  functionsDir: path.join(baseDir, "src/functions"),
  middlewaresDir: path.join(baseDir, "src/middlewares"),
  useHttpStatusCodes: true,
  port,
});

const hono = new Hono();
const handler = createHonoHandler(app);
hono.all("/rpc", handler);
hono.all("/rpc/*", handler);

serve({ fetch: hono.fetch, port }, () => {
  console.log(`🚀 [Hono] Benchmark Server running at http://0.0.0.0:${port}`);
});
