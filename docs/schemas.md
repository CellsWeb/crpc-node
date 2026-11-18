# Schemas

Node uses TypeBox for runtime contracts. Input is checked before the handler and output before success.
Unions accept only declared branches; nullable is different from optional.

<!-- compile: schemas.ts -->
```typescript
import { Type, type Static } from '@sinclair/typebox';
import { File, Files, FormBool, FormNum, type UploadedFile } from '@cellsweb/rpc-core';

export const nullableText = Type.Union([Type.String(), Type.Null()]);
export const record = Type.Object({ note: Type.Optional(nullableText) });

export const upload = Type.Object({
  avatar: File({ mimeTypes: ['image/png'], maxSizeBytes: 5 * 1024 * 1024 }),
  attachments: Type.Optional(Files({ maxCount: 3, maxSizeBytes: 1024 * 1024 })),
  age: FormNum({ minimum: 18 }),
  accepted: FormBool(),
});

export type UploadInput = Static<typeof upload>;

export async function handleUpload(input: UploadInput) {
  const avatar: UploadedFile = input.avatar;
  const age: number = input.age;             // primitive number
  const accepted: boolean = input.accepted; // primitive boolean
  return { filename: avatar.filename, age, accepted };
}
```

An omitted object property may be optional. Explicit null must have a null branch
when its contract requires one. Omitted **HTTP data** defaults to `{}`; it is not
automatically converted to null. Nested ordinary JSON arrays/objects are valid.

`File()` and `Files()` check physical UploadedFile instances plus configured
size/MIME/count rules. File unions retain non-file branches and reject unrelated
values; file defaults/transforms do not remove these checks. TypeBox JSON Schema
metadata alone is not content sanitization. Declared/detected MIME is heuristic.

## Multipart Form Helpers: FormNum and FormBool

In multipart form uploads (`multipart/form-data` / browser `FormData`), RFC 7578 transmits
every non-file form field as a textual string. Standard TypeBox schemas like `Type.Number()` and
`Type.Boolean()` strictly reject string values during schema validation.

`FormNum()` and `FormBool()` bridge this gap by providing TypeBox transforms designed for multipart intake:
- They accept string representations from multipart form fields and decode them into JavaScript primitive types (`number` and `boolean`) before passing the sanitized data object to the application handler.
- They also accept native JSON numbers and booleans directly when invoked via standard JSON requests.
- Ordinary JSON schemas do not acquire blanket transport coercion; `FormNum()` and `FormBool()` are explicit opt-in helpers.

### Accepted Values and Handler Types

| Helper | Accepted FormData Strings | Handler-Received Type | Example Valid Inputs | Example Invalid Inputs |
|---|---|---|---|---|
| `FormNum(options?)` | Numeric strings matching `/^-?\d+(\.\d+)?$/` | `number` | `"42"`, `"-7"`, `"3.14"`, `0` | `"abc"`, `""`, `"42px"` |
| `FormBool(options?)` | Exact `"true"` or `"false"` strings | `boolean` | `"true"`, `"false"`, `true`, `false` | `"invalid"`, `"1"`, `"0"`, `"yes"` |

`FormNum()` supports standard TypeBox numeric constraints: `minimum`, `maximum`,
`exclusiveMinimum`, `exclusiveMaximum`, and `multipleOf`.

### Validation Errors and Error Envelope

When input fails validation (such as non-numeric text for `FormNum()`, a value below `minimum`,
or an invalid boolean string), the server rejects the request before the handler executes.
Under the framework's uniform architecture, handled application errors return HTTP 200 OK
by default with an RPC error envelope:

```json
{
  "status": "error",
  "code": "validation_error",
  "message": "Validation failed",
  "details": [
    {
      "path": "/age",
      "message": "Expected number >= 18, got 16"
    }
  ]
}
```

Handled validation errors preserve the uniform HTTP 200 default contract rather than throwing unhandled transport errors. Applications requiring conventional HTTP error statuses can optionally configure `useHttpStatusCodes: true` on `CoreRPC`.

## General Guidelines

File transport supports top-level fields and direct file arrays only; nested files inside objects remain unsupported.

Use TypeBox's normal constraints/defaults for other types. Register any custom
formats your application uses; an arbitrary format name is not a built-in email
verifier. Unknown/extra properties follow the actual schema and may differ from
Go's native strict-object rules. Do not claim every TypeBox keyword is a native
Go schema feature. Avoid large-integer precision assumptions across JavaScript.
