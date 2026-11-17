# Worker execution

Functions can export `worker = true` to opt into the existing worker path. Keep
handlers transport-neutral and use serializable inputs/results. A worker is not
an authorization bypass: middleware and input/output checks still apply.

<!-- compile: worker.ts -->
```typescript
export const worker = true;
export async function run(input: { values: number[] }) {
  return { total: input.values.reduce((sum, value) => sum + value, 0) };
}
```

Define schemas alongside the handler and build source for the selected runtime.
Do not send live HTTP objects, database connections or temporary upload handles
through a worker boundary. Configure application-owned resources explicitly.
Worker scheduling does not promise parallel speedup for every workload or replace
upload/body bounds. Test worker functions on the deployment runtime; generated
HTTP adapter smoke tests are not a benchmark or every-worker-feature matrix.
