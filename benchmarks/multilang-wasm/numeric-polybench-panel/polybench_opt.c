// polybench_opt.c — Track B variant of polybench.c:
// 1. Adds `__restrict` noalias qualifiers to gemm, stencil5, and jacobi2d so the
//    compiler knows output buffers never overlap input buffers.
// 2. Hoists the loop-invariant scalar `alpha * a[i * nk + k]` out of the inner
//    `j` loop in `gemm`.
// 3. When compiled with `-msimd128` (`c-simd`), enables 2-wide `f64x2` vectorization
//    across the independent inner `j` loops of `gemm` and `stencil5` while keeping
//    every cell's floating-point evaluation order identical (`bit-identical`).

#include <stdint.h>

__attribute__((visibility("default")))
void gemm(
    const double* __restrict a,
    const double* __restrict b,
    double* __restrict c,
    int ni, int nj, int nk,
    double alpha, double beta) {
  for (int i = 0; i < ni; ++i) {
    double* row_c = c + i * nj;
    for (int j = 0; j < nj; ++j) row_c[j] *= beta;
    for (int k = 0; k < nk; ++k) {
      const double a_scaled = alpha * a[i * nk + k];
      const double* row_b = b + k * nj;
      for (int j = 0; j < nj; ++j) {
        row_c[j] += a_scaled * row_b[j];
      }
    }
  }
}

__attribute__((visibility("default")))
int cholesky(double* __restrict a, int n) {
  for (int i = 0; i < n; ++i) {
    double* row_i = a + i * n;
    for (int j = 0; j < i; ++j) {
      const double* row_j = a + j * n;
      double sum = row_i[j];
      for (int k = 0; k < j; ++k) sum -= row_i[k] * row_j[k];
      row_i[j] = sum / row_j[j];
    }
    double diag = row_i[i];
    for (int k = 0; k < i; ++k) diag -= row_i[k] * row_i[k];
    if (!(diag > 0.0)) {
      row_i[i] = diag;
      return 0;
    }
    row_i[i] = __builtin_sqrt(diag);
    for (int j = i + 1; j < n; ++j) row_i[j] = 0.0;
  }
  return 1;
}

__attribute__((visibility("default")))
void stencil5(const double* __restrict a, double* __restrict out, int n) {
  for (int i = 1; i < n - 1; ++i) {
    const double* row_curr = a + i * n;
    const double* row_prev = a + (i - 1) * n;
    const double* row_next = a + (i + 1) * n;
    double* row_out = out + i * n;
    for (int j = 1; j < n - 1; ++j) {
      row_out[j] = 0.2 * (row_curr[j] + row_curr[j - 1] + row_curr[j + 1] + row_prev[j] + row_next[j]);
    }
  }
}

__attribute__((visibility("default")))
void jacobi2d(double* __restrict a, double* __restrict b, int n, int timesteps) {
  for (int t = 0; t < timesteps; ++t) {
    stencil5(a, b, n);
    stencil5(b, a, n);
  }
}
