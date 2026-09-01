/**
 * middlewares/auditLogger/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MIDDLEWARE CONTRACT & METADATA
 *
 * WHAT TO TOUCH:
 *  - metadata: Human-readable description displayed in /docs.
 *  - headersSchema: Optional headers this middleware requires/reads. Include description in Type properties!
 *  - optionsSchema: Config options passed in function middlewares.ts. Include description & default in Type properties!
 */

import { Type } from "@sinclair/typebox";

export const metadata = {
  name: "auditLogger",
  description: "Audit logs request details",
};

export const headersSchema = Type.Object({
  // e.g. "x-auditLogger-token": Type.String({ description: "Authentication token for auditLogger" })
}, { additionalProperties: true });

export const optionsSchema = Type.Object({
  // e.g. enabled: Type.Boolean({ default: true, description: "Enable auditLogger middleware processing" })
}, { additionalProperties: false });
