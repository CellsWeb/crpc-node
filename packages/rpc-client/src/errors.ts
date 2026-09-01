export class RpcError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly meta?: Record<string, unknown>;

  constructor(options: {
    message: string;
    code?: string;
    status?: number;
    meta?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = "RpcError";
    this.code = options.code ?? "internal_error";
    this.status = options.status ?? 200;
    this.meta = options.meta;

    // Restore prototype chain in ES5/ES6 subclassing
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
