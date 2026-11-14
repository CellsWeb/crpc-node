import path from "node:path";
import { fileURLToPath } from "node:url";
import { Elysia } from "elysia";
import { CoreRPC, createElysiaPlugin } from "@cellsweb/rpc-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4006);

const app = new CoreRPC({
  functionsDir: path.join(baseDir, "src/functions"),
  middlewaresDir: path.join(baseDir, "src/middlewares"),
  useHttpStatusCodes: true,
  port,
});

const elysia = new Elysia();
elysia.use(createElysiaPlugin(app));

elysia.listen(port, () => {
  console.log(`🚀 [Elysia] Benchmark Server running at http://0.0.0.0:${port}`);
});
