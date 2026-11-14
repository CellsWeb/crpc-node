import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore
import ultimateExpress from "ultimate-express";
import { CoreRPC } from "@cellsweb/rpc-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4008);

const app = new CoreRPC({
  functionsDir: path.join(baseDir, "src/functions"),
  middlewaresDir: path.join(baseDir, "src/middlewares"),
  useHttpStatusCodes: true,
  port,
});

const server = ultimateExpress();
server.all("/rpc", await app.createHandler());

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 [Ultimate-Express] Benchmark Server running at http://0.0.0.0:${port}`);
});
