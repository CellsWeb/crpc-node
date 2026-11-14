import { AppError, ErrorCode } from "@cellsweb/rpc-core";

export async function run(
  params: { headers: Record<string, string>; options: any },
  ctx: any,
): Promise<void> {
  const token = params.headers?.authorization;
  if (token !== "Bearer secret_token_123") {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or missing Bearer token");
  }
  ctx.auth = { userId: "usr_bench_node_99" };
}

export default run;
