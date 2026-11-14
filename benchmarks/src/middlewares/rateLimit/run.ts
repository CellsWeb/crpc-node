import { AppError, ErrorCode } from "@cellsweb/rpc-core";

const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;

export async function run(
  params: { headers: any; options?: { max?: number } },
  ctx: any,
): Promise<void> {
  const max = params.options?.max ?? 100;
  const ip = ctx.clientIp || "127.0.0.1";
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const history = buckets.get(ip) || [];
  const valid = history.filter((t) => t > cutoff);

  if (valid.length >= max) {
    throw new AppError(ErrorCode.RATE_LIMITED, "Rate limit exceeded");
  }

  valid.push(now);
  buckets.set(ip, valid);
}

export default run;
