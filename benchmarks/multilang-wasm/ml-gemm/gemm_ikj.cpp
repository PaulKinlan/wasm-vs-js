// gemm_ikj.cpp — Track B variant of gemm.cpp: loop interchange i/j/k -> i/k/j.
//
// Streams B[t][0..n] contiguously along rows instead of walking columns of B.
// Equivalence: bit-identical (strict f32 ascending t accumulation per cell).

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
  for (unsigned int i = 0; i < m; i++) {
    float* row_out = out + i * n;
    const float* row_c0 = c0 + i * n;
    for (unsigned int j = 0; j < n; j++) {
      row_out[j] = row_c0[j];
    }
    for (unsigned int t = 0; t < k; t++) {
      const float aik = a[i * k + t];
      const float* row_b = b + t * n;
      for (unsigned int j = 0; j < n; j++) {
        row_out[j] += aik * row_b[j];
      }
    }
    for (unsigned int j = 0; j < n; j++) {
      row_out[j] = row_out[j] + 0.0f;
    }
  }
}
}
