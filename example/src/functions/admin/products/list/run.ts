/**
 * functions/admin/products/list/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS LOGIC HANDLER
 *
 * WHAT TO TOUCH:
 *  - Implement function logic here.
 *  - Access input fields via input.*.
 *  - Access context values (e.g. auth user, ip, headers) via _context.
 *
 * WHAT TO EXPECT:
 *  - Input is pre-validated by TypeBox inputSchema.
 *  - Return value is validated against outputSchema before sending response.
 */

import type { Static } from "@sinclair/typebox";
import type { InferContext } from "@cellsweb/rpc-core";
import type { middlewares } from "./middlewares";
import type { inputSchema, outputSchema } from "./constants";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (
  input: Input,
  _context: InferContext<typeof middlewares>,
): Promise<Output> => {
  return {
    result: input.example,
  };
};
