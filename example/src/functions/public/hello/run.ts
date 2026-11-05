/**
 * functions/public/hello/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS LOGIC HANDLER
 */

import type { Static } from "@sinclair/typebox";
import type { MiddlewareContext } from "@cellsweb/rpc-core";
import type { inputSchema, outputSchema } from "./constants";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (
  input: Input,
  _context: MiddlewareContext,
): Promise<Output> => {
  return {
    greeting: `Hello, ${input.name}!`,
  };
};
