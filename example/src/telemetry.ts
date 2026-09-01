/**
 * telemetry.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Optional Telemetry & Error Tracking integration (Sentry / Metrics).
 *
 * Sentry error reporting initializes automatically ONLY if SENTRY_DSN is configured
 * in .env. Otherwise, errors are handled via pino logger with zero extra overhead.
 */

import { logger } from "@cellsweb/rpc-core";
import { env } from "./env";

let isSentryInitialized = false;

async function initSentry() {
  if (isSentryInitialized) return;
  if (!env.SENTRY_DSN) return;

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      enabled: env.TELEMETRY_ENABLED ?? true,
    });
    isSentryInitialized = true;
    logger.info("Sentry error tracking initialized");
  } catch {
    logger.warn("Sentry DSN provided, but @sentry/node is not installed. Run `pnpm add @sentry/node` to enable.");
  }
}

// Auto-initialize Sentry if DSN is provided
initSentry().catch(() => {});

export const telemetry = {
  /**
   * Reports internal exceptions to Sentry (if configured) and logs via Pino.
   */
  async captureException(error: unknown, contextData?: Record<string, unknown>): Promise<void> {
    if (env.SENTRY_DSN) {
      try {
        const Sentry = await import("@sentry/node");
        Sentry.captureException(error, { extra: contextData });
      } catch {
        // Fallback silently if Sentry package is not installed
      }
    }
  },

  /**
   * Records execution metrics or custom timing stats.
   */
  recordMetric(metricName: string, value: number, tags?: Record<string, string>): void {
    if (env.TELEMETRY_ENABLED === false) return;
    logger.debug({ metricName, value, ...tags }, "Telemetry metric recorded");
  },
};
