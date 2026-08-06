#include <stdint.h>

// Track B — ml-gemm optimized C variant (INDEPENDENTLY OPTIMIZED).
// Track A baseline (benchmarks/multilang-wasm/ml-gemm/gemm.c, frozen strict-f32
// i/j/k order) is KEPT UNTOUCHED; mirrored verbatim below.
//
// OPTIMIZATION LOG (what / why / measured):
// 1. B-TRANSPOSE for cache locality: B is transposed once per call into a
//    row-major scratch (bT[j*k + t] = b[t*n + j]), so the inner loop reads the
//    B column CONTIGUOUSLY (b_row[t]) instead of strided (b[t*n + j]). The
//    transpose cost is O(k·n), negligible against the O(m·n·k) product.
// 2. Pointer-walked A row + hoisted output pointer.
// 3. CORRECTNESS: the accumulation order is UNCHANGED (strict f32, single
//    accumulator, t ascending — same sequence of f32 adds/muls as the Track A
//    oracle). The optimization only changes MEMORY ACCESS PATTERN, not
//    arithmetic, so the output is BIT-IDENTICAL to Track A (verified in the
//    build script). No tolerance needed.

__attribute__((visibility("default")))
void gemm_baseline(
    const float* a, const float* b, const float* c0, float* out,
    uint32_t m, uint32_t n, uint32_t k) {
  for (uint32_t i = 0; i < m; i++) {
    for (uint32_t j = 0; j < n; j++) {
      float acc = c0[i * n + j];
      for (uint32_t t = 0; t < k; t++) {
        acc += a[i * k + t] * b[t * n + j];
      }
      out[i * n + j] = acc + 0.0f;
    }
  }
}

__attribute__((visibility("default")))
void gemm_opt(
    const float* a, const float* b, const float* c0, float* out,
    uint32_t m, uint32_t n, uint32_t k) {
  // 1. Transpose B once: bT[j*k + t] = b[t*n + j].
  //    (Scratch lives in the caller-provided out region beyond m*n.)
  float* bT = out + (uint32_t)m * n;
  for (uint32_t j = 0; j < n; j++) {
    for (uint32_t t = 0; t < k; t++) {
      bT[j * k + t] = b[t * n + j];
    }
  }

  for (uint32_t i = 0; i < m; i++) {
    const float* a_row = a + i * k;
    float* out_row = out + i * n;
    for (uint32_t j = 0; j < n; j++) {
      const float* b_row = bT + j * k;
      float acc = c0[i * n + j];
      for (uint32_t t = 0; t < k; t++) {
        acc += a_row[t] * b_row[t];
      }
      out_row[j] = acc + 0.0f;
    }
  }
}
