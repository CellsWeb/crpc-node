import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { CoreRPC } from "@cellsweb/rpc-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4007);

const app = new CoreRPC({
  functionsDir: path.join(baseDir, "src/functions"),
  middlewaresDir: path.join(baseDir, "src/middlewares"),
  useHttpStatusCodes: true,
  port,
});

const server = express();
server.use(express.json());
server.all("/rpc", await app.createHandler());

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 [Express] Benchmark Server running at http://0.0.0.0:${port}`);
});
