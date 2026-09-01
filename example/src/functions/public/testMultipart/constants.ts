/**
 * functions/public/testMultipart/constants.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SCHEMA & CONTRACT DEFINITION
 *
 * WHAT TO TOUCH:
 *  - metadata: Human-readable description, tags, public status for API docs.
 *  - contentType: Strictly "multipart/form-data" for file uploads.
 *  - inputSchema: Define form fields and file attachments using File() or Files().
 *  - outputSchema: Define what this function returns.
 */

import { Type } from "@sinclair/typebox";
import { File, Files } from "@cellsweb/rpc-core";

export const metadata = {
  description: "TODO: describe testMultipart",
  isPublic: true,
  deprecated: false,
  tags: ["upload"] as string[],
};

export const contentType = "multipart/form-data" as const;

export const inputSchema = Type.Object({
  title: Type.String({ minLength: 1, description: "Title of the upload" }),
  file: File({
    maxSizeBytes: 5_000_000,
    mimeTypes: ["image/png", "image/jpeg", "application/pdf"],
    description: "Primary file attachment",
  }),
  files: Type.Optional(Files({
    maxCount: 5,
    maxSizeBytes: 10_000_000,
    description: "Optional additional files",
  })),
});

export const outputSchema = Type.Object({
  fileName: Type.String({ description: "Original file name" }),
  fileSize: Type.Number({ description: "Size of uploaded file in bytes" }),
  extraFiles: Type.Number({ description: "Count of additional attached files" }),
});
