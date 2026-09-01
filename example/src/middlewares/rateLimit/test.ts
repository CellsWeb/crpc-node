import { describe, it, expect } from "vitest";
import { run } from "./run";

describe("middleware: rateLimit", () => {
  it("consumes rate limit points without error", async () => {
    const ctx = await run(
      {
        headers: {},
        options: { windowSeconds: 60, maxRequests: 100 },
        function: {
          key: "public.hello",
          namespace: "public",
          functionName: "hello",
          metadata: {},
          contentType: "application/json",
        },
      },
      { requestId: "req_1", ip: "127.0.0.1", namespace: "public", functionName: "hello" } as any,
    );

    expect(ctx.requestId).toBe("req_1");
  });
});
