/**
 * src/middlewares/rateLimit/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PRE-SCAFFOLDED RATE LIMITING MIDDLEWARE
 *
 * HOW TO USE & CUSTOMIZE THIS MIDDLEWARE:
 *  1. Uses RateLimiterMemory (in-memory) by default.
 *  2. For multi-instance cluster production setups, swap `RateLimiterMemory` with `RateLimiterRedis`.
 *  3. Function declarations in `middlewares.ts` specify limits:
 *     `{ name: "rateLimit", options: { windowSeconds: 60, maxRequests: 100 } }`
 *  4. Feel free to edit, customize, or delete this middleware as needed!
 */

import type { Static } from "@sinclair/typebox";
import { AppError, ErrorCode, type MiddlewareFn } from "@cellsweb/rpc-core";
import { LRUCache } from "lru-cache";
import { RateLimiterAbstract, RateLimiterMemory } from "rate-limiter-flexible";
import { optionsSchema } from "./constants";

type Options = Static<typeof optionsSchema>;

const limiterCache = new LRUCache<string, RateLimiterAbstract>({
  max: 256,
});

function getOrCreateLimiter(
  windowSeconds: number,
  maxRequests: number,
): RateLimiterAbstract {
  const key = `${windowSeconds}:${maxRequests}`;
  let limiter = limiterCache.get(key);

  if (!limiter) {
    limiter = new RateLimiterMemory({
      duration: windowSeconds,
      points: maxRequests,
    });
    limiterCache.set(key, limiter);
  }

  return limiter;
}

export const run: MiddlewareFn<Options> = async ({ options, function: fn }, context) => {
  const { windowSeconds, maxRequests } = options;
  const { ip, namespace, functionName } = context;

  const limiter = getOrCreateLimiter(windowSeconds, maxRequests);
  const rateLimitKey = `${ip}:${namespace}:${functionName}`;

  try {
    await limiter.consume(rateLimitKey, 1);
  } catch {
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      `Rate limit exceeded for ${namespace}.${functionName}. Maximum ${maxRequests} requests per ${windowSeconds}s.`,
    );
  }

  return context;
};
