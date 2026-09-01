import { Type, Kind, TypeRegistry, type TSchema, type TUnsafe, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
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
    const isAllowed = mimeTypes.some((allowed) => {
      if (allowed.endsWith("/*")) {
        const prefix = allowed.slice(0, -2);
        return file.mimeType.startsWith(prefix + "/");
      }
      return file.mimeType === allowed;
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

/**
 * Replace File/Files kind nodes in a schema with Type.Optional(Type.Any()) so TypeBox's
 * Value module doesn't try to deeply traverse them. Our validateFileField() handles
 * the actual per-field file validation before we reach the TypeBox Value operations.
 */
function sanitizeSchemaForTypebox(schema: TSchema): TSchema {
  if (isFileSchema(schema) || isFilesSchema(schema)) {
    return Type.Optional(Type.Any());
  }
  if (Array.isArray((schema as any).anyOf)) {
    const variants: TSchema[] = (schema as any).anyOf;
    if (variants.some((v) => isFileSchema(v) || isFilesSchema(v))) {
      return Type.Optional(Type.Any());
    }
    return schema;
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

export function validateSchema<T>(
  schema: TSchema,
  data: unknown,
  contextName = "Payload",
): T {
  // 1. Validate File/Files fields using our own rules (before TypeBox touches them)
  if (schema.type === "object" && (schema as any).properties) {
    const props = (schema as any).properties as Record<string, TSchema>;
    const objData = (typeof data === "object" && data !== null) ? (data as Record<string, unknown>) : {};

    for (const [key, propSchema] of Object.entries(props)) {
      if (isFileSchema(propSchema) || isFilesSchema(propSchema)) {
        const val = objData[key];
        if (val !== undefined) validateFileField(val, propSchema, key);
      } else if (Array.isArray((propSchema as any).anyOf)) {
        // Handle Type.Union([Type.String(), File(...)]) — find the File variant
        const fileVariant = ((propSchema as any).anyOf as TSchema[]).find(
          (v) => isFileSchema(v) || isFilesSchema(v),
        );
        if (fileVariant) {
          const val = objData[key];
          // Only validate as file if it actually IS an UploadedFile (not a string URL)
          if (val !== undefined && val instanceof UploadedFile) {
            validateFileField(val, fileVariant, key);
          }
        }
      }
    }
  }

  // 2. Replace File/Files schema nodes with Type.Any() before TypeBox Value operations
  //    so Value.Default / Value.Check / Value.Cast don't throw "Unknown type".
  const safeSchema = sanitizeSchemaForTypebox(schema);

  const withDefaults = Value.Default(safeSchema, data);

  if (!Value.Check(safeSchema, withDefaults)) {
    const errors = [...Value.Errors(safeSchema, withDefaults)];
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

  // Value.Decode runs TypeBox Transform decoders (e.g. FormNum, FormBool).
  // Since Value.Check already passed above, Decode should succeed for normal schemas.
  // If a FormNum/FormBool constraint check fails inside Decode, it throws a RangeError
  // (wrapped by TypeBox in TransformDecodeError). Surface it as a validation AppError.
  try {
    return Value.Decode(safeSchema, withDefaults) as T;
  } catch (err: unknown) {
    // TypeBox wraps decode function errors in TransformDecodeError — extract the inner cause.
    const inner = err instanceof Error ? ((err as unknown as Record<string, unknown>).error ?? err) : err;
    if (inner instanceof RangeError) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, inner.message);
    }
    // No transform found or non-constraint decode failure — fall back to Cast.
    return Value.Cast(safeSchema, withDefaults) as T;
  }
}
