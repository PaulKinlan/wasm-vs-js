#include <stdint.h>

// gemm_ikj.c — Track B variant of gemm.c: loop interchange i/j/k -> i/k/j.
//
// Baseline (gemm.c, engine key `c`) walks B down a column in the innermost
// loop (stride n*4 = 512 B at n=128), touching a distinct 64-byte cache line
// on every step.
//
// Interchanging the two inner loops streams B[t][0..n] contiguously along a row
// while holding A[i][t] in a scalar register. Use `restrict` so the compiler
// knows `out` does not alias `a`, `b`, or `c0`.
//
// Equivalence: bit-identical (docs/track-b-optimizations.md).
// For every fixed (i, j), terms are accumulated into out[i*n + j] in ascending
// t = 0..k-1 with strict f32 rounding after each multiply and add (-ffp-contract=off),
// followed by "+ 0.0f" signed-zero normalization.

__attribute__((visibility("default")))
void gemm(
    const float* __restrict a,
    const float* __restrict b,
    const float* __restrict c0,
    float* __restrict out,
    uint32_t m,
    uint32_t n,
    uint32_t k) {
  for (uint32_t i = 0; i < m; i++) {
    float* row_out = out + i * n;
    const float* row_c0 = c0 + i * n;
    for (uint32_t j = 0; j < n; j++) {
      row_out[j] = row_c0[j];
    }
    for (uint32_t t = 0; t < k; t++) {
      const float aik = a[i * k + t];
      const float* row_b = b + t * n;
      for (uint32_t j = 0; j < n; j++) {
        row_out[j] += aik * row_b[j];
      }
    }
    for (uint32_t j = 0; j < n; j++) {
      row_out[j] = row_out[j] + 0.0f;
    }
  }
}
