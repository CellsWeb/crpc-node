import type { Static } from "@sinclair/typebox";
import type { inputSchema, outputSchema } from "./constants";
import { saveUpload } from "../../../store";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (input: Input, _ctx: any): Promise<Output> => {
  const file = input.file;
  const buffer = await file.toBuffer();

  const uploadResult = await saveUpload({
    fileName: file.filename,
    fileSize: file.byteLength,
    mimeType: file.mimeType,
    buffer,
  });

  const extraFiles = Array.isArray(input.files) ? input.files : [];
  for (const extra of extraFiles) {
    const extraBuf = await extra.toBuffer();
    await saveUpload({
      fileName: extra.filename,
      fileSize: extra.byteLength,
      mimeType: extra.mimeType,
      buffer: extraBuf,
    });
  }

  return {
    id: uploadResult.id,
    fileName: file.filename,
    fileSize: file.byteLength,
    mimeType: file.mimeType,
    extraCount: extraFiles.length,
    savedPath: uploadResult.savedPath,
    dbSaved: uploadResult.dbSaved,
  };
};

export default run;
