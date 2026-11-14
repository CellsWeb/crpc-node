import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoreRPC } from "@cellsweb/rpc-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4002);

const app = new CoreRPC({
  functionsDir: path.join(baseDir, "src/functions"),
  middlewaresDir: path.join(baseDir, "src/middlewares"),
  useHttpStatusCodes: true,
  port,
});

const handler = await app.createHandler();
const server = http.createServer(handler);

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 [node:http] Benchmark Server running at http://0.0.0.0:${port}`);
});
