/**
 * src/middlewares/auth/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PRE-SCAFFOLDED AUTHENTICATION MIDDLEWARE
 *
 * HOW TO USE & CUSTOMIZE THIS MIDDLEWARE:
 *  1. Replace `verifyToken()` stub below with your JWT (jose/jsonwebtoken), database query, or OAuth logic.
 *  2. Function declarations in `middlewares.ts` can pass options:
 *     `{ name: "auth", options: { roles: ["admin", "user"] } }`
 *  3. In function `run.ts`, access authenticated user via `context.auth.user`.
 *  4. Feel free to edit, rename, or delete this middleware if your project uses custom auth!
 */

import type { Static } from "@sinclair/typebox";
import { AppError, ErrorCode, type MiddlewareFn } from "@cellsweb/rpc-core";
import type { optionsSchema, outputSchema, UserRole } from "./constants";

export type AuthOptions = Static<typeof optionsSchema>;
export type AuthContext = Static<typeof outputSchema>;

interface IUser {
  _id: unknown;
  role: UserRole;
  [key: string]: unknown;
}

// TODO: Replace this stub with your real JWT/database user verification logic!
async function verifyToken(_token: string | undefined): Promise<IUser | null> {
  return null;
}

export const run: MiddlewareFn<AuthOptions, { auth?: AuthContext }> = async (
  { headers, options },
  context,
) => {
  const authHeader =
    (Array.isArray(headers["authorization"]) ? headers["authorization"][0] : headers["authorization"]) ??
    (Array.isArray(headers["token"]) ? headers["token"][0] : headers["token"]);

  const token = (typeof authHeader === "string" ? authHeader : "")?.replace(/^Bearer\s+/i, "") ?? undefined;
  const roles = options.roles;
  const isOptional = options.optional === true || (Array.isArray(roles) && roles.length === 0);

  let user: IUser | null = null;
  try {
    user = await verifyToken(token);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired token");
  }

  if (!user) {
    if (isOptional) {
      return context;
    }
    throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required");
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Insufficient permissions");
  }

  if (user) {
    return {
      ...context,
      auth: {
        userId: String(user._id),
        role: user.role,
        user: user as Record<string, unknown>,
      },
    };
  }

  return context;
};
