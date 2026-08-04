// ml-gemm Dart WasmGC kernel — mirrors benchmarks/v2/ml-gemm/workload.js:
// C = C0 + A * B, strict f32 left-to-right accumulation in frozen i/j/k order.
//
// Dart has no f32 primitive, so every multiply and every add is rounded with
// Math.fround (f64 -> f32) exactly like the JS oracle:
//   acc = fround(acc + fround(a * b))
// This is bit-identical to hardware f32 arithmetic (f32xf32 products are exact
// in f64; fround(acc + exactProduct) == f32.add). The fround overhead is real
// and disclosed per-variant. Outputs are written as fround(acc + 0) to
// normalize -0 to +0, matching the oracle's "acc + 0".

import 'dart:js_interop';

@JS('Math.fround')
external double fround(double x);

@JSExport()
class GemmKernels {
  @JSExport('gemm')
  void gemm(
    JSFloat32Array aJs,
    JSFloat32Array bJs,
    JSFloat32Array c0Js,
    JSFloat32Array outJs,
    int m,
    int n,
    int k,
  ) {
    final a = aJs.toDart; // zero-copy Float32List views on Wasm
    final b = bJs.toDart;
    final c0 = c0Js.toDart;
    final out = outJs.toDart;
    for (int i = 0; i < m; i++) {
      for (int j = 0; j < n; j++) {
        double acc = c0[i * n + j];
        for (int t = 0; t < k; t++) {
          acc = fround(acc + fround(a[i * k + t] * b[t * n + j]));
        }
        out[i * n + j] = fround(acc + 0.0);
      }
    }
  }
}

void main() {
  dartKernels = createJSInteropWrapper(GemmKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
