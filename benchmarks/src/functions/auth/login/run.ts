import { AppError, ErrorCode } from "@cellsweb/rpc-core";

export const run = async (
  input: { email: string; password: string },
  _context?: any,
): Promise<{ token: string; userId: string; expiresAt: number }> => {
  if (input.email !== "perf@example.com" || input.password !== "SecretPassword123!") {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid credentials");
  }

  return {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.benchmark_node_token",
    userId: "usr_bench_node_99",
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  };
};

export default run;
