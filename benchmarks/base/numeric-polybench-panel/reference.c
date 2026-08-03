// Independent C oracle for numeric.polybench-panel.v1 supplemental contract.
// Compiled only to a fixed-memory validation module; it is not a benchmark target.

__attribute__((export_name("reference_gemm")))
void reference_gemm(double *a, double *b, double *c, int ni, int nj, int nk,
                    double alpha, double beta) {
  for (int i = 0; i < ni; ++i) {
    for (int j = 0; j < nj; ++j) c[i * nj + j] *= beta;
    for (int k = 0; k < nk; ++k)
      for (int j = 0; j < nj; ++j)
        c[i * nj + j] += alpha * a[i * nk + k] * b[k * nj + j];
  }
}

__attribute__((export_name("reference_cholesky")))
int reference_cholesky(double *a, int n) {
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

__attribute__((export_name("reference_stencil5")))
void reference_stencil5(double *a, double *out, int n) {
  for (int i = 1; i < n - 1; ++i)
    for (int j = 1; j < n - 1; ++j) {
      int p = i * n + j;
      out[p] = 0.2 * (a[p] + a[p - 1] + a[p + 1] + a[p - n] + a[p + n]);
    }
}

__attribute__((export_name("reference_jacobi2d")))
void reference_jacobi2d(double *a, double *b, int n, int timesteps) {
  for (int t = 0; t < timesteps; ++t) {
    reference_stencil5(a, b, n);
    reference_stencil5(b, a, n);
  }
}
