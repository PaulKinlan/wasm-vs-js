// numeric-polybench-panel Dart WasmGC kernel
// Mirrors benchmarks/base/numeric-polybench-panel/workload.js & WAT/reference.c:
// 4 kernels: gemm, cholesky, stencil5, jacobi2d operating on double precision (f64).

import 'dart:js_interop';
import 'dart:math' as math;

@JSExport()
class PolybenchKernels {
  @JSExport('gemm')
  void gemm(
    JSFloat64Array aJs,
    JSFloat64Array bJs,
    JSFloat64Array cJs,
    int ni,
    int nj,
    int nk,
    double alpha,
    double beta,
  ) {
    final a = aJs.toDart;
    final b = bJs.toDart;
    final c = cJs.toDart;
    for (int i = 0; i < ni; ++i) {
      for (int j = 0; j < nj; ++j) c[i * nj + j] *= beta;
      for (int k = 0; k < nk; ++k) {
        final aik = a[i * nk + k];
        for (int j = 0; j < nj; ++j) {
          c[i * nj + j] += alpha * aik * b[k * nj + j];
        }
      }
    }
  }

  @JSExport('cholesky')
  int cholesky(JSFloat64Array aJs, int n) {
    final a = aJs.toDart;
    for (int i = 0; i < n; ++i) {
      for (int j = 0; j < i; ++j) {
        for (int k = 0; k < j; ++k) {
          a[i * n + j] -= a[i * n + k] * a[j * n + k];
        }
        a[i * n + j] /= a[j * n + j];
      }
      for (int k = 0; k < i; ++k) {
        a[i * n + i] -= a[i * n + k] * a[i * n + k];
      }
      final aii = a[i * n + i];
      if (!(aii > 0.0)) return 0;
      a[i * n + i] = math.sqrt(aii);
      for (int j = i + 1; j < n; ++j) {
        a[i * n + j] = 0.0;
      }
    }
    return 1;
  }

  @JSExport('stencil5')
  void stencil5(JSFloat64Array aJs, JSFloat64Array outJs, int n) {
    final a = aJs.toDart;
    final out = outJs.toDart;
    for (int i = 1; i < n - 1; ++i) {
      for (int j = 1; j < n - 1; ++j) {
        int p = i * n + j;
        out[p] = 0.2 * (a[p] + a[p - 1] + a[p + 1] + a[p - n] + a[p + n]);
      }
    }
  }

  @JSExport('jacobi2d')
  void jacobi2d(JSFloat64Array aJs, JSFloat64Array bJs, int n, int timesteps) {
    final a = aJs.toDart;
    final b = bJs.toDart;
    for (int t = 0; t < timesteps; ++t) {
      for (int i = 1; i < n - 1; ++i) {
        for (int j = 1; j < n - 1; ++j) {
          int p = i * n + j;
          b[p] = 0.2 * (a[p] + a[p - 1] + a[p + 1] + a[p - n] + a[p + n]);
        }
      }
      for (int i = 1; i < n - 1; ++i) {
        for (int j = 1; j < n - 1; ++j) {
          int p = i * n + j;
          a[p] = 0.2 * (b[p] + b[p - 1] + b[p + 1] + b[p - n] + b[p + n]);
        }
      }
    }
  }
}

void main() {
  dartKernels = createJSInteropWrapper(PolybenchKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
