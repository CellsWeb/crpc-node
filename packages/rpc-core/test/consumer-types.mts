import { Type, type Static } from '@sinclair/typebox';
import { File, Files, FormNum, FormBool, type FunctionMetadata } from '@cellsweb/rpc-core';
import api from '@cellsweb/rpc-core';
export const defaultFactory: typeof File = api.File;
export const schema = Type.Object({ file: File(), files: Type.Optional(Files()), count: FormNum(), enabled: FormBool() });
export type Input = Static<typeof schema>;
export async function consume(input: Input) { return { bytes: await input.file.toBuffer(), count: input.count, enabled: input.enabled }; }
export const legacy: FunctionMetadata = { isPublic: false };
