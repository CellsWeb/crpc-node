export interface TelemetryEvent {
  requestId: string;
  namespace?: string;
  functionName?: string;
  durationMs: number;
  status: "ok" | "error";
  code?: string;
  message?: string;
  clientIp?: string;
  userAgent?: string;
  error?: unknown;
}

export type TelemetryHook = (event: TelemetryEvent) => void | Promise<void>;
