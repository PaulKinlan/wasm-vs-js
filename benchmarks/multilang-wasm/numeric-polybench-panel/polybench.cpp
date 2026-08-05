// numeric-polybench-panel multilang kernel (C++)
// Mirrors benchmarks/base/numeric-polybench-panel/workload.js & WAT/reference.c:
// 4 kernels: gemm, cholesky, stencil5, jacobi2d operating on double precision (f64).

#include <stdint.h>

extern "C" {

__attribute__((visibility("default")))
void gemm(
    double* a, double* b, double* c,
    int ni, int nj, int nk,
    double alpha, double beta) {
  for (int i = 0; i < ni; ++i) {
    for (int j = 0; j < nj; ++j) c[i * nj + j] *= beta;
    for (int k = 0; k < nk; ++k) {
      for (int j = 0; j < nj; ++j) {
        c[i * nj + j] += alpha * a[i * nk + k] * b[k * nj + j];
      }
    }
  }
}

__attribute__((visibility("default")))
int cholesky(double* a, int n) {
  for (int i = 0; i < n; ++i) {
    for (int j = 0; j < i; ++j) {
      for (int k = 0; k < j; ++k) a[i * n + j] -= a[i * n + k] * a[j * n + k];
      a[i * n + j] /= a[j * n + j];
    }
    for (int k = 0; k < i; ++k) a[i * n + i] -= a[i * n + k] * a[i * n + k];
    if (!(a[i * n + i] > 0.0)) return 0;
    a[i * n + i] = __builtin_sqrt(a[i * n + i]);
    for (int j = i + 1; j < n; ++j) a[i * n + j] = 0.0;
  }
  return 1;
}

__attribute__((visibility("default")))
void stencil5(const double* a, double* out, int n) {
  for (int i = 1; i < n - 1; ++i) {
    for (int j = 1; j < n - 1; ++j) {
      int p = i * n + j;
      out[p] = 0.2 * (a[p] + a[p - 1] + a[p + 1] + a[p - n] + a[p + n]);
    }
  }
}

__attribute__((visibility("default")))
void jacobi2d(double* a, double* b, int n, int timesteps) {
  for (int t = 0; t < timesteps; ++t) {
    stencil5(a, b, n);
    stencil5(b, a, n);
  }
}

} // extern "C"
