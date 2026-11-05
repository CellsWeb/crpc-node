/**
 * functions/public/testMultipart/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS LOGIC HANDLER
 *
 * WHAT TO TOUCH:
 *  - Place core business operations here.
 *  - Access input fields: input.title, input.file.filename, input.file.toBuffer().
 *  - Access context variables provided by middlewares in _context.
 *
 * WHAT TO EXPECT:
 *  - input is guaranteed to be validated against inputSchema.
 *  - The return object MUST match outputSchema.
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
  // Access uploaded file properties safely
  const filename = input.file.filename;
  const fileSize = input.file.byteLength;

  return {
    fileName: filename,
    fileSize: fileSize,
    extraFiles: input.files?.length ?? 0,
  };
};
