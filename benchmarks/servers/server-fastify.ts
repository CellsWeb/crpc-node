import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { CoreRPC, createFastifyPlugin } from "@cellsweb/rpc-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4004);

const app = new CoreRPC({
  functionsDir: path.join(baseDir, "src/functions"),
  middlewaresDir: path.join(baseDir, "src/middlewares"),
  useHttpStatusCodes: true,
  port,
});

const fastify = Fastify({ logger: false });
await fastify.register(createFastifyPlugin(app));

await fastify.listen({ port, host: "0.0.0.0" });
console.log(`🚀 [Fastify] Benchmark Server running at http://0.0.0.0:${port}`);
