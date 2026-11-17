# Multipart uploads

The client converts top-level File/Blob values or React Native `{uri,name,type}`
assets, and direct file arrays, into multipart when `multipart:true` is selected.
Nested file-in-object inputs are rejected; they are not silently serialized.

<!-- compile: upload-client.ts -->
```typescript
import { createRpcClient } from '@cellsweb/rpc-client';
const rpc = createRpcClient({ baseUrl: 'http://localhost:4000/rpc' });
export async function uploadAvatar(avatar: File) {
  return rpc.request({ namespace: 'user', functionName: 'uploadAvatar',
    multipart: true, data: { avatar } });
}
```

<!-- compile: functions/upload/constants.ts -->
```typescript
import { Type, type Static } from '@sinclair/typebox';
import { File } from '@cellsweb/rpc-core';
export const contentType = 'multipart/form-data';
export const inputSchema = Type.Object({ avatar: File({ maxSizeBytes: 5 * 1024 * 1024 }) });
export const outputSchema = Type.Object({ filename: Type.String(), bytes: Type.Number() });
export type Input = Static<typeof inputSchema>;
```

<!-- compile: functions/upload/run.ts -->
```typescript
import type { Input } from './constants.js';
export async function run(input: Input) {
  return { filename: input.avatar.filename, bytes: input.avatar.byteLength };
}
```

Node UploadedFile has `path`, `filename`, `mimeType`, `declaredMimeType`,
`detectedMimeType`, `byteLength`, `createReadStream()`, `toBuffer()` and `toBlob()`.
It does not expose `filepath`, `mimetype` or `size`. Use the generated storage
helper or application-owned unique destinations for persistence. Do not use a
raw client filename as a trusted destination. Complete persistence during the
handler; framework-owned temporary files are cleaned when processing finishes.

Both routing headers (`X-CRPC-Namespace`/`X-CRPC-Function`) or neither are allowed.
When present they must agree with redundant body routing fields. Headerless
routing remains supported; put routing text fields before files. Authentication
preflight must not create application-owned temporary files for denied requests.

Native Node/Express/Fastify/Ultimate Express use stream intake with Busboy. Fetch
formData in Bun/Hono/Elysia may buffer at runtime. Go fasthttp buffers transport
intake before application multipart processing. Per-request limits and cleanup
are not an aggregate-memory or zero-buffering guarantee.
