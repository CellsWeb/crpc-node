export {
  buildContext,
  buildWebContext,
  extractClientIp,
  extractWebClientIp,
  type InferContext,
  type MiddlewareContext,
} from "./context";
export {
  CoreRPC,
  computeCorsHeaders,
  createFastifyPlugin,
  createHonoHandler,
  createHonoMiddleware,
  createElysiaPlugin,
  serveBun,
  type CoreRpcOptions,
  type CorsOptions,
} from "./core-rpc";
export {
  handleWebRpcRequest,
  type HandleWebRpcRequestOptions,
} from "./interceptor-web";
export {
  parseWebRequest,
  normalizeWebHeaders,
} from "./request/web";
export {
  runPipeline,
  type PipelineResult,
  type PipelineSuccessResult,
  type PipelineErrorResult,
} from "./pipeline";
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
  scaffoldFunction,
  scaffoldMiddleware,
  getExistingNamespaces,
  getAvailableMiddlewares,
  detectConfiguredDirs,
  type ScaffoldFunctionOptions,
  type ScaffoldMiddlewareOptions,
} from "./scaffold";
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
export {
  type TelemetryEvent,
  type TelemetryHook,
} from "./telemetry";
