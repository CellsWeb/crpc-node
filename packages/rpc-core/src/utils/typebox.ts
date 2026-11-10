import { Type, Kind, TypeRegistry, type TSchema, type TUnsafe, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { AppError, ErrorCode } from "../errors";
import { UploadedFile } from "../uploads/types";

export const FileKindSymbol = "FileKind";
export const FilesKindSymbol = "FilesKind";
export const FormNumKindSymbol = "FormNumKind";
export const FormBoolKindSymbol = "FormBoolKind";

// Register custom kinds with TypeBox so Value.Default / Value.Check / Value.Cast
// don't throw "Unknown type" when they encounter File/Files schema fields.
// Our own validateFileField() handles the actual file validation separately.
if (!TypeRegistry.Has(FileKindSymbol)) {
  TypeRegistry.Set(FileKindSymbol, (_schema, value) =>
    value === undefined || value === null || value instanceof UploadedFile,
  );
}
if (!TypeRegistry.Has(FilesKindSymbol)) {
  TypeRegistry.Set(FilesKindSymbol, (_schema, value) =>
    value === undefined || value === null || Array.isArray(value),
  );
}

export interface FileSchemaOptions {
  maxSizeBytes?: number;
  maxCount?: number;
  mimeTypes?: string[];
  description?: string;
}

export type FilesSchemaOptions = FileSchemaOptions;

export function File(options: FileSchemaOptions = {}): TUnsafe<UploadedFile> {
  return Type.Unsafe<UploadedFile>({
    [Kind]: FileKindSymbol,
    type: "object",
    format: "binary",
    description: options.description ?? "Uploaded file",
    maxSizeBytes: options.maxSizeBytes,
    mimeTypes: options.mimeTypes,
  });
}

export function Files(options: FilesSchemaOptions = {}): TUnsafe<UploadedFile[]> {
  return Type.Unsafe<UploadedFile[]>({
    [Kind]: FilesKindSymbol,
    type: "array",
    items: {
      type: "object",
      format: "binary",
    },
    description: options.description ?? "Uploaded files array",
    maxSizeBytes: options.maxSizeBytes,
    maxCount: options.maxCount,
    mimeTypes: options.mimeTypes,
  });
}

// ─── FormNum ──────────────────────────────────────────────────────────────────
// Accepts a numeric string ("22", "-3.5") from FormData OR an actual number.
// TypeBox Transform decodes the string → number during Value.Decode in validateSchema.
// Supports all standard TypeBox number constraints: minimum, maximum,
// exclusiveMinimum, exclusiveMaximum, multipleOf.
// Use this in multipart function inputSchema instead of Type.Number().

export interface FormNumOptions {
  description?: string;
  /** Value must be >= minimum */
  minimum?: number;
  /** Value must be <= maximum */
  maximum?: number;
  /** Value must be > exclusiveMinimum */
  exclusiveMinimum?: number;
  /** Value must be < exclusiveMaximum */
  exclusiveMaximum?: number;
  /** Value must be a multiple of this */
  multipleOf?: number;
}

export function FormNum(options: FormNumOptions = {}) {
  const { description, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf } = options;
  const desc =
    description ??
    'Numeric value. FormData serialises numbers as strings — accepts both "22" (string) and 22 (number).';

  return Type.Union(
    [
      // String path (FormData): validate constraints inside Decode after converting
      Type.Transform(Type.String({ pattern: "^-?\\d+(\\.\\d+)?$" }))
        .Decode((value) => {
          const num = Number(value);
          if (minimum !== undefined && num < minimum)
            throw new RangeError(`Expected number >= ${minimum}, got ${num}`);
          if (maximum !== undefined && num > maximum)
            throw new RangeError(`Expected number <= ${maximum}, got ${num}`);
          if (exclusiveMinimum !== undefined && num <= exclusiveMinimum)
            throw new RangeError(`Expected number > ${exclusiveMinimum}, got ${num}`);
          if (exclusiveMaximum !== undefined && num >= exclusiveMaximum)
            throw new RangeError(`Expected number < ${exclusiveMaximum}, got ${num}`);
          if (multipleOf !== undefined && num % multipleOf !== 0)
            throw new RangeError(`Expected number to be a multiple of ${multipleOf}, got ${num}`);
          return num;
        })
        .Encode((value) => String(value)),
      // Native number path (JSON): TypeBox validates constraints via Value.Check
      Type.Number({ minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf }),
    ],
    { [Kind]: FormNumKindSymbol, description: desc } as any,
  );
}

// ─── FormBool ─────────────────────────────────────────────────────────────────
// Accepts "true"/"false" string from FormData OR an actual boolean.
// TypeBox Transform decodes the string → boolean during Value.Decode in validateSchema.
// Use this in multipart function inputSchema instead of Type.Boolean().

export interface FormBoolOptions {
  description?: string;
}

export function FormBool(options: FormBoolOptions = {}) {
  const desc =
    options.description ??
    'Boolean value. FormData serialises booleans as strings — accepts "true"/"false" (string) and true/false (boolean).';
  return Type.Union(
    [
      Type.Transform(Type.Union([Type.Literal("true"), Type.Literal("false")]))
        .Decode((value) => value === "true")
        .Encode((value) => (value ? "true" : "false")),
      Type.Boolean(),
    ],
    { [Kind]: FormBoolKindSymbol, description: desc } as any,
  );
}

export function isFileSchema(schema: TSchema): boolean {
  if (!schema || typeof schema !== "object") return false;
  const rec = schema as Record<string, unknown>;
  return rec[Kind as unknown as string] === FileKindSymbol || rec.format === "binary";
}

export function isFilesSchema(schema: TSchema): boolean {
  if (!schema || typeof schema !== "object") return false;
  const rec = schema as Record<string, unknown>;
  if (rec[Kind as unknown as string] === FilesKindSymbol) return true;
  if (rec.type === "array" && rec.items && isFileSchema(rec.items as TSchema)) return true;
  return false;
}

export function isFormNumSchema(schema: TSchema): boolean {
  if (!schema || typeof schema !== "object") return false;
  const rec = schema as Record<string, unknown>;
  if (rec[Kind as unknown as string] === FormNumKindSymbol) return true;
  if (Array.isArray(rec.anyOf) && rec.anyOf.length === 2) {
    const hasNum = rec.anyOf.some((v: any) => v.type === "number");
    const hasStrTransform = rec.anyOf.some((v: any) => v.type === "string" && v.pattern?.includes("\\d+"));
    if (hasNum && hasStrTransform) return true;
  }
  return false;
}

export function isFormBoolSchema(schema: TSchema): boolean {
  if (!schema || typeof schema !== "object") return false;
  const rec = schema as Record<string, unknown>;
  if (rec[Kind as unknown as string] === FormBoolKindSymbol) return true;
  if (Array.isArray(rec.anyOf) && rec.anyOf.length === 2) {
    const hasBool = rec.anyOf.some((v: any) => v.type === "boolean");
    const hasBoolStr = rec.anyOf.some((v: any) => Array.isArray(v.anyOf) && v.anyOf.some((x: any) => x.const === "true"));
    if (hasBool && hasBoolStr) return true;
  }
  return false;
}

export function validateFileRules(file: UploadedFile, schema: TSchema, fieldPath: string): void {
  const maxSizeBytes = (schema as Record<string, unknown>).maxSizeBytes as number | undefined;
  const mimeTypes = (schema as Record<string, unknown>).mimeTypes as string[] | undefined;

  if (maxSizeBytes !== undefined && file.byteLength > maxSizeBytes) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `${fieldPath}: File "${file.filename}" exceeds max size of ${maxSizeBytes} bytes (got ${file.byteLength})`,
    );
  }

  if (mimeTypes !== undefined && mimeTypes.length > 0) {
    const fileMimeBase = file.mimeType.split(";")[0].trim().toLowerCase();
    const isAllowed = mimeTypes.some((allowed) => {
      const allowedBase = allowed.split(";")[0].trim().toLowerCase();
      if (allowedBase.endsWith("/*")) {
        const prefix = allowedBase.slice(0, -2);
        return fileMimeBase.startsWith(prefix + "/");
      }
      return fileMimeBase === allowedBase;
    });

    if (!isAllowed) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `${fieldPath}: File "${file.filename}" has invalid MIME type "${file.mimeType}". Allowed: ${mimeTypes.join(", ")}`,
      );
    }
  }
}

export function validateFileField(value: unknown, schema: TSchema, fieldPath: string): void {
  if (isFileSchema(schema)) {
    if (!(value instanceof UploadedFile)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `${fieldPath}: Expected a file attachment`,
      );
    }
    validateFileRules(value, schema, fieldPath);
    return;
  }

  if (isFilesSchema(schema)) {
    if (!Array.isArray(value)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `${fieldPath}: Expected an array of file attachments`,
      );
    }
    const maxCount = (schema as Record<string, unknown>).maxCount as number | undefined;
    if (maxCount !== undefined && value.length > maxCount) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `${fieldPath}: Too many files attached. Maximum allowed is ${maxCount} (got ${value.length})`,
      );
    }
    for (const f of value) {
      if (!(f instanceof UploadedFile)) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `${fieldPath}: Element is not a valid file attachment`,
        );
      }
      validateFileRules(f, schema, fieldPath);
    }
  }
}

function isOptionalSchema(schema: TSchema): boolean {
  return (schema as any)[Symbol.for("TypeBox.Optional")] === "Optional";
}

/**
 * Replace File/Files kind nodes in a schema with Type.Any() (or Type.Optional(Type.Any()))
 * so TypeBox's Value/TypeCompiler module doesn't reject custom symbols. Our validateFileField()
 * handles the actual per-field file validation before we reach TypeBox operations.
 */
function sanitizeSchemaForTypebox(schema: TSchema): TSchema {
  if (isFileSchema(schema) || isFilesSchema(schema)) {
    return isOptionalSchema(schema) ? Type.Optional(Type.Any()) : Type.Any();
  }
  if (Array.isArray((schema as any).anyOf)) {
    const variants: TSchema[] = (schema as any).anyOf;
    const nonFile = variants.filter((v) => !isFileSchema(v) && !isFilesSchema(v));
    const target =
      nonFile.length > 0
        ? Type.Union([...nonFile.map(sanitizeSchemaForTypebox), Type.Any()])
        : Type.Any();
    return isOptionalSchema(schema) ? Type.Optional(target) : target;
  }
  if (Array.isArray((schema as any).allOf)) {
    return {
      ...schema,
      allOf: (schema as any).allOf.map(sanitizeSchemaForTypebox),
    } as TSchema;
  }
  if (schema.type === "array" && (schema as any).items) {
    return {
      ...schema,
      items: sanitizeSchemaForTypebox((schema as any).items),
    } as TSchema;
  }
  if (schema.type === "object" && (schema as any).properties) {
    const sanitizedProps: Record<string, TSchema> = {};
    for (const [key, prop] of Object.entries((schema as any).properties as Record<string, TSchema>)) {
      sanitizedProps[key] = sanitizeSchemaForTypebox(prop);
    }
    return { ...schema, properties: sanitizedProps } as TSchema;
  }
  return schema;
}

interface CompiledEntry {
  safeSchema: TSchema;
  check: {
    Check: (value: unknown) => boolean;
    Errors: (value: unknown) => Iterable<{ path: string; message: string; value: unknown }>;
    Decode: (value: unknown) => unknown;
  };
}

const compiledSchemaCache = new WeakMap<TSchema, CompiledEntry>();

function getOrCompileSchema(schema: TSchema): CompiledEntry {
  let cached = compiledSchemaCache.get(schema);
  if (cached) return cached;

  const safeSchema = sanitizeSchemaForTypebox(schema);
  let check: CompiledEntry["check"];

  try {
    const compiled = TypeCompiler.Compile(safeSchema);
    check = {
      Check: (v) => compiled.Check(v),
      Errors: (v) => compiled.Errors(v),
      Decode: (v) => compiled.Decode(v),
    };
  } catch {
    check = {
      Check: (v) => Value.Check(safeSchema, v),
      Errors: (v) => Value.Errors(safeSchema, v),
      Decode: (v) => Value.Decode(safeSchema, v),
    };
  }

  cached = { safeSchema, check };
  try {
    compiledSchemaCache.set(schema, cached);
  } catch {}
  return cached;
}

export function validateSchema<T>(
  schema: TSchema,
  data: unknown,
  contextName = "Payload",
): T {
  // Preserve original UploadedFile instances so TypeBox's Value.Default/Value.Clone doesn't strip their prototype methods
  const fileInstances = new Map<string, UploadedFile | UploadedFile[]>();
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v instanceof UploadedFile) {
        fileInstances.set(k, v);
      } else if (Array.isArray(v) && v.length > 0 && v[0] instanceof UploadedFile) {
        fileInstances.set(k, v as UploadedFile[]);
      }
    }
  }

  const objData = typeof data === "object" && data !== null && !Array.isArray(data)
    ? { ...(data as Record<string, unknown>) }
    : null;

  // 1. Validate File/Files fields using our own rules
  if (schema.type === "object" && (schema as any).properties && objData !== null) {
    const props = (schema as any).properties as Record<string, TSchema>;
    const requiredSet = new Set(
      Array.isArray((schema as any).required) ? (schema as any).required : [],
    );

    for (const [key, propSchema] of Object.entries(props)) {
      const isReq = requiredSet.has(key);
      const val = objData[key];

      if (isFileSchema(propSchema) || isFilesSchema(propSchema)) {
        if (val === undefined || val === null) {
          if (isReq) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              `${key}: Expected a file attachment`,
              [{ path: `/${key}`, message: "Expected a file attachment", value: val }],
            );
          }
        } else {
          let targetVal: unknown = val;
          if (isFilesSchema(propSchema) && val instanceof UploadedFile) {
            const arr = [val];
            targetVal = arr;
            objData[key] = arr;
            fileInstances.set(key, arr);
          }
          validateFileField(targetVal, propSchema, key);
        }
      } else if (Array.isArray((propSchema as any).anyOf)) {
        const variants: TSchema[] = (propSchema as any).anyOf;
        const fileVariant = variants.find((v) => isFileSchema(v) || isFilesSchema(v));
        if (fileVariant && val instanceof UploadedFile) {
          let targetVal: unknown = val;
          if (isFilesSchema(fileVariant)) {
            const arr = [val];
            targetVal = arr;
            objData[key] = arr;
            fileInstances.set(key, arr);
          }
          validateFileField(targetVal, fileVariant, key);
        }
      }
    }
  }

  const { safeSchema, check } = getOrCompileSchema(schema);
  const targetData = objData !== null ? objData : data;
  const withDefaults = Value.Default(safeSchema, targetData);

  if (!check.Check(withDefaults)) {
    const errors = [...check.Errors(withDefaults)];
    const details = errors.map((e) => ({
      path: e.path,
      message: e.message,
      value: e.value,
    }));

    const firstMsg = details[0]
      ? `${details[0].path ? details[0].path.slice(1) + ": " : ""}${details[0].message}`
      : "Schema validation failed";

    throw new AppError(ErrorCode.VALIDATION_ERROR, firstMsg, details);
  }

  try {
    const decoded = check.Decode(withDefaults) as T;
    if (fileInstances.size > 0 && decoded && typeof decoded === "object") {
      for (const [k, fileVal] of fileInstances.entries()) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        (decoded as Record<string, unknown>)[k] = fileVal;
      }
    }
    return decoded;
  } catch (err: unknown) {
    const inner =
      err instanceof Error
        ? ((err as unknown as Record<string, unknown>).error ?? err)
        : err;
    if (inner instanceof RangeError) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, inner.message);
    }
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      (err as Error).message ?? "Schema decode error",
    );
  }
}
