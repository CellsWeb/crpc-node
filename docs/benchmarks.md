# Benchmarks

Benchmark workloads and historical results are maintained in the repository's
`benchmarks/README.md` and `benchmarks/RESULTS.md`. Record commit, runtime,
hardware, concurrency, payload, limits and warmup when comparing results.

Those numbers are workload observations, not current guarantees of latency,
throughput, memory, security or adapter superiority. This release's
gates are correctness, real HTTP uploads/cleanup, clean installations and
schema/auth behavior. No new performance benchmark was executed for the release
stabilization work. Go transport buffering and Fetch formData buffering must be
accounted for in memory comparisons; see [architecture](architecture.md).
