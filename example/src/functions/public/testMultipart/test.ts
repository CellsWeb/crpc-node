/**
 * functions/public/testMultipart/test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIT / INTEGRATION TEST FOR testMultipart
 * Run with: pnpm test
 */

import { describe, it, expect } from "vitest";
import { run } from "./run";
import { createUploadedFile } from "@cellsweb/rpc-core";

describe("public.testMultipart", () => {
  it("executes business logic with simulated upload", async () => {
    const mockFile = createUploadedFile({
      path: "/tmp/mock.png",
      filename: "test.png",
      mimeType: "image/png",
      byteLength: 1024,
    });

    const result = await run(
      {
        title: "Test Upload",
        file: mockFile,
      },
      {} as any,
    );

    expect(result.fileName).toBe("test.png");
    expect(result.fileSize).toBe(1024);
  });
});
