// gemm_tiled.cpp — Track B variant of gemm.cpp: 32x32 i/j panel cache blocking.
//
// Blocks i and j into 32x32 panels while leaving the inner k reduction intact.
// Equivalence: bit-identical (strict f32 ascending t accumulation per cell).

static constexpr unsigned int TILE = 32u;

extern "C" {
__attribute__((visibility("default")))
void gemm(
    const float* __restrict a,
    const float* __restrict b,
    const float* __restrict c0,
    float* __restrict out,
    unsigned int m,
    unsigned int n,
    unsigned int k) {
  for (unsigned int ii = 0; ii < m; ii += TILE) {
    const unsigned int i_max = (ii + TILE < m) ? (ii + TILE) : m;
    for (unsigned int jj = 0; jj < n; jj += TILE) {
      const unsigned int j_max = (jj + TILE < n) ? (jj + TILE) : n;
      for (unsigned int i = ii; i < i_max; i++) {
        const float* row_a = a + i * k;
        for (unsigned int j = jj; j < j_max; j++) {
          float acc = c0[i * n + j];
          for (unsigned int t = 0; t < k; t++) {
            acc += row_a[t] * b[t * n + j];
          }
          out[i * n + j] = acc + 0.0f;
        }
      }
    }
  }
}
}
