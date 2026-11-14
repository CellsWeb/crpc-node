import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoreRPC, serveBun } from "@cellsweb/rpc-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4003);

const app = new CoreRPC({
  functionsDir: path.join(baseDir, "src/functions"),
  middlewaresDir: path.join(baseDir, "src/middlewares"),
  useHttpStatusCodes: true,
  port,
});

serveBun(app, port);
console.log(`🚀 [bun.serve] Benchmark Server running at http://0.0.0.0:${port}`);
