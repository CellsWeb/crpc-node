export {
  buildContext,
  extractClientIp,
  type InferContext,
  type MiddlewareContext,
} from "./context";
export { CoreRPC, createFastifyPlugin, type CoreRpcOptions } from "./core-rpc";
export { renderDocsHtml } from "./docs/renderer";
export {
  AppError,
  ErrorCode,
  isAppError,
  toAppError,
  type ClientErrorPayload,
} from "./errors";
export { handleApiRequest } from "./interceptor";
export {
  logRequestError,
  logRequestSuccess,
  logSystemError,
  logger,
} from "./logger";
export {
  buildRegistry,
  defineMiddlewares,
  type ContentTypeContract,
  type FunctionMetadata,
  type MiddlewareFn,
  type MiddlewareOptionEntry,
  type RegisteredFunction,
  type RegisteredMiddleware,
  type Registry,
} from "./registry";
export { parseRpcRequest, type ParsedRpcRequest } from "./request";
export {
  createTestCaller,
  type ExecuteOptions,
  type ExecuteResult,
  type TestCaller,
} from "./test-caller";
export {
  UploadedFile,
  createUploadedFile,
  type UploadedFileOptions,
} from "./uploads/types";
export {
  File,
  FileKindSymbol,
  Files,
  FilesKindSymbol,
  FormBool,
  FormBoolKindSymbol,
  FormNum,
  FormNumKindSymbol,
  isFileSchema,
  isFilesSchema,
  isFormBoolSchema,
  isFormNumSchema,
  validateSchema,
  type FileSchemaOptions,
  type FilesSchemaOptions,
  type FormBoolOptions,
  type FormNumOptions,
} from "./utils/typebox";
