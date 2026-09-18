#include <stdint.h>

// gemm_tiled.c — Track B variant of gemm.c: 32x32 i/j panel cache blocking.
//
// Blocks i and j into 32x32 panels while leaving the inner k reduction intact.
// Within one panel the working set is 32 rows of A (16 KiB at k=128) and 32
// columns of B (16 KiB), compared with 64 KiB for the full B matrix untiled.
//
// Equivalence: bit-identical (docs/track-b-optimizations.md).
// Only the outer (i, j) traversal order changes; each element's k reduction runs
// in ascending t = 0..k-1 with strict f32 rounding (-ffp-contract=off).

#define TILE 32u

__attribute__((visibility("default")))
void gemm(
    const float* __restrict a,
    const float* __restrict b,
    const float* __restrict c0,
    float* __restrict out,
    uint32_t m,
    uint32_t n,
    uint32_t k) {
  for (uint32_t ii = 0; ii < m; ii += TILE) {
    const uint32_t i_max = (ii + TILE < m) ? (ii + TILE) : m;
    for (uint32_t jj = 0; jj < n; jj += TILE) {
      const uint32_t j_max = (jj + TILE < n) ? (jj + TILE) : n;
      for (uint32_t i = ii; i < i_max; i++) {
        const float* row_a = a + i * k;
        for (uint32_t j = jj; j < j_max; j++) {
          float acc = c0[i * n + j];
          for (uint32_t t = 0; t < k; t++) {
            acc += row_a[t] * b[t * n + j];
          }
          out[i * n + j] = acc + 0.0f;
        }
      }
    }
  }
}
