/**
 * middlewares/auditLogger/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MIDDLEWARE IMPLEMENTATION
 *
 * MIDDLEWARE INPUT PARAMETERS:
 *  - params.headers: Incoming HTTP request headers (e.g. authorization, x-tenant-id)
 *  - params.options: Function-level options configured in function's middlewares.ts
 *  - params.function: Target function metadata ({ key, namespace, functionName, contentType })
 *  - context: Immutable request context ({ requestId, ip, requestStartTime, req })
 *
 * WHAT TO TOUCH:
 *  - Implement header checks, token verifications, or rate-limiting guards here.
 *  - Return augmented context object: return { ...context, auditLogger: "value" }.
 *  - Throw AppError (e.g. ErrorCode.UNAUTHORIZED) to reject invalid requests.
 */

import type { MiddlewareFn } from "@cellsweb/rpc-core";
import type { Static } from "@sinclair/typebox";
import type { optionsSchema } from "./constants";

type Options = Static<typeof optionsSchema>;

export const run: MiddlewareFn<Options, { auditLogger: string }> = async (
  { headers, options, function: fn },
  context,
) => {
  void headers;
  void options;
  void fn;

  return {
    ...context,
    auditLogger: "value",
  };
};
