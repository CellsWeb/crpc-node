/**
 * src/test/setup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL TEST LIFECYCLE
 *
 * Configures the test environment before any integration or unit tests run.
 * Add global test setup, mocks, or database connections here if needed.
 */

import { beforeAll, afterAll, afterEach } from "vitest";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.VITEST = "true";
});

afterEach(async () => {
  // Reset per-test state here if needed
});

afterAll(async () => {
  // Clean up global connections or resources here if needed
});
