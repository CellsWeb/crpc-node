/**
 * functions/admin/products/list/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SCHEMA & CONTRACT DEFINITION
 *
 * WHAT TO TOUCH:
 *  - metadata: Description, deprecation, tags.
 *  - contentType: "application/json" (default).
 *  - inputSchema: Define fields expected in req.body.data. Include description in Type properties!
 *  - outputSchema: Define structure returned by run(). Include description in Type properties!
 */

import { Type } from "@sinclair/typebox";

export const metadata = {
  description: "TODO: describe list",
  deprecated: false,
  tags: [] as string[],
};

export const contentType = "application/json" as const;

export const headersSchema = Type.Object({}, { additionalProperties: true });

export const inputSchema = Type.Object({
  example: Type.String({ minLength: 1, description: "Example string input parameter" }),
});

export const outputSchema = Type.Object({
  result: Type.String({ description: "Operation status or execution result message" }),
});
