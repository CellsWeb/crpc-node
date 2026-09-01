/**
 * src/test/helpers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST CONTEXT & FIXTURE HELPERS
 *
 * GUIDE FOR DEVELOPERS & AI CODERS:
 *  - Use `createMockContext()` to build simulated request contexts for unit testing `run.ts` handlers.
 *  - This helper is generic and domain-agnostic. You can customize fields (e.g. `auth`, `tenantId`, `user`, `role`, `session`)
 *    to match your project's specific domain model and middleware context outputs.
 *
 * USAGE IN UNIT TESTS:
 *  ```ts
 *  import { createMockContext } from "@/test/helpers";
 *  import { run } from "./run";
 *
 *  const context = createMockContext({
 *    auth: { userId: "user_123", role: "admin", tenantId: "tenant_alpha" }
 *  });
 *  const result = await run({ name: "Sample Item" }, context as any);
 *  ```
 */

import type { MiddlewareContext } from "@cellsweb/rpc-core";

export interface MockContextOptions {
  requestId?: string;
  ip?: string;
  namespace?: string;
  functionName?: string;
  requestStartTime?: number;
  auth?: {
    userId?: string;
    role?: string;
    tenantId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Creates a generic mock MiddlewareContext for testing RPC functions.
 * All properties are overridable to match your application's middleware outputs.
 */
export function createMockContext(
  options: MockContextOptions = {},
): MiddlewareContext & Record<string, unknown> {
  const now = Date.now();
  const requestId = options.requestId || `test_req_${now}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    requestId,
    ip: options.ip || "127.0.0.1",
    namespace: options.namespace || "test",
    functionName: options.functionName || "function",
    requestStartTime: options.requestStartTime || now,
    req: {} as any,
    auth: {
      userId: options.auth?.userId || "test_user_id",
      role: options.auth?.role || "user",
      tenantId: options.auth?.tenantId || "default_tenant",
      ...(options.auth || {}),
    },
    ...options,
  };
}
