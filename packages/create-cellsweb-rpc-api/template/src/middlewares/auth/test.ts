import { describe, it, expect } from "vitest";
import { run } from "./run";

describe("middleware: auth", () => {
  it("allows unauthenticated requests when no roles are required", async () => {
    const ctx = await run(
      {
        headers: {},
        options: { roles: [] },
        function: {
          key: "public.hello",
          namespace: "public",
          functionName: "hello",
          metadata: {},
          contentType: "application/json",
        },
      },
      { requestId: "req_1", ip: "127.0.0.1" } as any,
    );

    expect(ctx.requestId).toBe("req_1");
  });
});
