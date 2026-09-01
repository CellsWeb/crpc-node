/**
 * middlewares/auditLogger/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIT TEST FOR auditLogger MIDDLEWARE
 * Run with: pnpm test | pnpm test:audit
 */

import { describe, it, expect } from "vitest";
import { run } from "./run";

describe("middleware: auditLogger", () => {
  it("augments context successfully", async () => {
    const initialContext = { requestId: "test-id", ip: "127.0.0.1" } as any;
    const result = await run(
      {
        headers: {},
        options: {},
        function: {
          key: "test.fn",
          namespace: "test",
          functionName: "fn",
          metadata: {} as any,
          contentType: "application/json",
        },
      },
      initialContext,
    );

    expect(result.auditLogger).toBe("value");
  });
});
