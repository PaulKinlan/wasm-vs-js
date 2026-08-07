// Track B — ml-gemm optimized JavaScript variant (INDEPENDENTLY OPTIMIZED).
// Track A baseline = the strict-f32 left-to-right jsGemm in
// public/multilang-runner.js (KEPT UNTOUCHED); mirrored verbatim below.
//
// OPTIMIZATION LOG:
// 1. ROW-PRELOAD + NO-FROUND BLOCKED INNER LOOP: the baseline calls
//    Math.fround after every multiply+add (strict-f32 discipline, bit-identical
//    to the Wasm). The optimized variant drops per-op Math.fround (JS floats
//    are f64; the arithmetic is done in f64 and only the final sum is written
//    to a Float32Array). ROUNDING DISCLOSURE: output is NOT bit-identical to
//    the Track A oracle — correctness verified within a disclosed relative
//    tolerance (max |Δ| ≤ 1e-5 · max|out|) in the build script.
// 2. Typed-array row preload (aRow slice) removes repeated index arithmetic in
//    the inner loop.
// This is an INDEPENDENTLY OPTIMIZED Track B variant, NEVER pooled with Track A.

export function gemmBaseline(a, b, c0, out, m, n, k) {
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let acc = c0[i * n + j];
      for (let t = 0; t < k; t++) {
        acc = Math.fround(acc + Math.fround(a[i * k + t] * b[t * n + j]));
      }
      out[i * n + j] = Math.fround(acc + 0);
    }
  }
}

export function gemmOpt(a, b, c0, out, m, n, k) {
  for (let i = 0; i < m; i++) {
    const aRow = a.subarray(i * k, (i + 1) * k);
    for (let j = 0; j < n; j++) {
      let acc = c0[i * n + j];
      let t = 0;
      // 4-way unrolled inner loop, no per-op fround.
      for (; t + 4 <= k; t += 4) {
        acc += aRow[t] * b[t * n + j] + aRow[t + 1] * b[(t + 1) * n + j] +
          aRow[t + 2] * b[(t + 2) * n + j] + aRow[t + 3] * b[(t + 3) * n + j];
      }
      for (; t < k; t++) acc += aRow[t] * b[t * n + j];
      out[i * n + j] = acc;
    }
  }
}
