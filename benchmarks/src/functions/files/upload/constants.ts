import { Type } from "@sinclair/typebox";
import { File, Files } from "@cellsweb/rpc-core";

export const metadata = {
  description: "Handles binary file uploads and metadata persistence",
  deprecated: false,
  tags: ["files", "benchmark"] as string[],
};

export const contentType = "multipart/form-data" as const;

export const inputSchema = Type.Object({
  note: Type.Optional(Type.String({ description: "Upload notes" })),
  file: File({
    maxSizeBytes: 50_000_000,
    mimeTypes: ["image/png", "application/pdf", "image/jpeg"],
    description: "Primary uploaded file",
  }),
  files: Type.Optional(Files({
    maxCount: 10,
    maxSizeBytes: 50_000_000,
    description: "Additional files",
  })),
});

export const outputSchema = Type.Object({
  id: Type.String(),
  fileName: Type.String(),
  fileSize: Type.Number(),
  mimeType: Type.String(),
  extraCount: Type.Number(),
  savedPath: Type.String(),
  dbSaved: Type.Boolean(),
});
