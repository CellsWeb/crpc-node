import { describe, it, expect } from "vitest";
import { run } from "./run";

describe("public.hello", () => {
  it("returns greeting", async () => {
    const result = await run({ name: "Alice" }, {} as any);
    expect(result.greeting).toBe("Hello, Alice!");
  });
});
