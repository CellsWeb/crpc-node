# Schemas

Node uses TypeBox. Input is checked before the handler and output before success.
Unions accept only declared branches; nullable is different from optional.

<!-- compile: schemas.ts -->
```typescript
import { Type } from '@sinclair/typebox';
import { File, Files, FormBool, FormNum } from '@cellsweb/rpc-core';
export const nullableText = Type.Union([Type.String(), Type.Null()]);
export const record = Type.Object({ note: Type.Optional(nullableText) });
export const upload = Type.Object({
  avatar: File({ mimeTypes: ['image/png'], maxSizeBytes: 5 * 1024 * 1024 }),
  attachments: Type.Optional(Files({ maxCount: 3, maxSizeBytes: 1024 * 1024 })),
  age: FormNum({ minimum: 18 }),
  accepted: FormBool(),
});
```

An omitted object property may be optional. Explicit null must have a null branch
when its contract requires one. Omitted **HTTP data** defaults to `{}`; it is not
automatically converted to null. Nested ordinary JSON arrays/objects are valid.

`File()` and `Files()` check physical UploadedFile instances plus configured
size/MIME/count rules. File unions retain non-file branches and reject unrelated
values; file defaults/transforms do not remove these checks. TypeBox JSON Schema
metadata alone is not content sanitization. Declared/detected MIME is heuristic.

FormNum/FormBool are explicit multipart form helpers; ordinary JSON schemas do
not acquire blanket transport coercion. File transport supports top-level fields
and direct file arrays only; nested files inside objects remain unsupported.

Use TypeBox's normal constraints/defaults for other types. Register any custom
formats your application uses; an arbitrary format name is not a built-in email
verifier. Unknown/extra properties follow the actual schema and may differ from
Go's native strict-object rules. Do not claim every TypeBox keyword is a native
Go schema feature. Avoid large-integer precision assumptions across JavaScript.
