/**
 * functions/public/hello/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SCHEMA & CONTRACT DEFINITION
 */

import { Type } from "@sinclair/typebox";

export const metadata = {
  description: "Sample hello JSON RPC function",
  isPublic: true,
  deprecated: false,
  tags: ["sample"],
};

export const contentType = "application/json" as const;

export const inputSchema = Type.Object({
  name: Type.String({ minLength: 1, description: "Your full name for personalized greeting" }),
});

export const outputSchema = Type.Object({
  greeting: Type.String({ description: "Personalized greeting response message" }),
});
