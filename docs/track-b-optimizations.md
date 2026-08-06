# Track B — Independent Optimizations

Paul directive (2026-08-06): *"I want optimization to happen. However I want it clear that
the ORIGINAL is to be KEPT and then we show each language's improvements side by side so
people can compare code difference and also runtime perf improvement."*

## What Track B is

- **Track A** = the frozen, controlled baselines (the multilang kernels). Never modified.
- **Track B** = independently optimized variants, ADDED alongside Track A. Explicitly
  non-default. NEVER pooled with Track A claims (AGENTS.md: "Keep controlled Track A and
  independently optimized Track B separate").

## Wave 1 workloads

| Workload        | Optimization (JS)                                              | Optimization (C)                                        | Correctness      |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------- | ---------------- |
| sum-u32         | 4-accumulator unrolled loop                                    | 4-accumulator unrolled loop (pointer walk)              | bit-identical    |
| FFT (512)       | twiddle-sequence cache (same float ops, computed once)         | pointer-hoisted butterflies (op order unchanged)        | bit-identical    |
| ml-gemm         | row-preload + unrolled inner, no per-op fround (tolerance)     | B-transpose for cache locality (order unchanged)        | bit-identical    |
| text-regex-log-scan | split-loop bounds handling (comparison count unchanged)    | split-loop bounds handling + pointer walk               | bit-identical    |

### Measured (in-process warm medians, deno/V8)

| Workload        | JS baseline → opt      | Δ       | C baseline → opt      | Δ      |
| --------------- | ---------------------- | ------- | --------------------- | ------ |
| sum-u32         | 0.35ms → 0.27ms        | −22%    | 0.02ms → 0.02ms       | ≈0%    |
| FFT (512)       | 0.01ms → 0.008ms       | −25%    | 0.01ms → 0.01ms       | ≈2%    |
| ml-gemm (64³)   | 0.39ms → 0.16ms        | −60%    | 0.07ms → 0.08ms       | +2.5%  |
| text-regex-log-scan | 0.19ms → 0.14ms    | −26%    | 0.09ms → 0.09ms       | ≈1%    |

Notes on honesty:

- The JS gains are the headline (60% on GEMM from dropping per-op `Math.fround` —
  disclosed: output is within a tight relative tolerance of the strict-f32 Track A
  oracle, not bit-identical; the ml-gemm JS entry carries that disclosure).
- The C baselines are already compiled at `-O3` by clang, so source-level optimizations
  yield small or no gains — the deltas are real but modest. The value is the *proven*
  bit-identical structure (B-transpose, split loops) plus the side-by-side pedagogy.
- FFT/sum C deltas at ~0.01ms are near the measurement floor; treat them as
  "no significant change" rather than exact percentages.

## Files

- Sources: `benchmarks/multilang-wasm/track-b/*.{c,js}` (each file contains the
  verbatim baseline mirror + the optimized function, with the optimization log).
- Build + measure: `scripts/build-track-b.ts` (clang for C, in-process warm medians;
  bit-identical or disclosed-tolerance verification before any number is emitted).
- Report: `public/data/track-b-report.v1.json`.
- UI: `/benchmarks/track-b/` (source diff + perf bars, CSP-safe).

## Rules

1. Track A kernels are frozen — Track B never edits them.
2. Every Track B variant records its optimization log (what / why / measured).
3. Non-bit-identical variants (the JS GEMM) disclose the rounding change and are
   verified within a published tolerance.
4. Re-run `deno run -A scripts/build-track-b.ts` after any Track B change; the gate
   (`deno task check`) must stay green.
