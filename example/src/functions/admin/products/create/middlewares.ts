/**
 * functions/admin/products/create/middlewares.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FUNCTION MIDDLEWARE PIPELINE
 *
 * Declarative list of central middlewares executed in order before run().
 */

import { defineMiddlewares } from "@cellsweb/rpc-core";

export const middlewares = defineMiddlewares([
  { name: "auth", options: { roles: ["user", "admin", "vendor", "staff", "dev"] } },
]);
