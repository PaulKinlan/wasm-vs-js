// Dart WasmGC kernels for the multi-language Wasm benchmark.
//
// Compiled with `dart compile wasm` (dart2wasm) to a WasmGC module and
// instantiated with the generated JS glue (public/artifacts/multilang-wasm-
// benchmark/fft_dart.mjs). main() wraps the @JSExport class and publishes it
// on globalThis as `dartKernels`; the harness then calls
// `dartKernels.sum_u32(...)` / `dartKernels.fft_butterfly(...)`.
//
// The exported functions accept JS typed arrays zero-copy via dart:js_interop
// (the .toDart wrappers are views over the same Wasm memory), so the workload
// shape matches the linear-memory C/C++/Rust/WAT variants: same input data,
// same butterfly schedule, same u32 reduction semantics.
//
// Note: Dart has no f32 primitive. The FFT variant uses dart:math sin/cos
// (f64), matching the JavaScript baseline's Math.sin/Math.cos; the C/C++/
// AssemblyScript/Rust/WAT variants use an f32 polynomial approximation. The
// report discloses this per-variant.

import 'dart:js_interop';
import 'dart:math' as math;

@JSExport()
class DartKernels {
  @JSExport('sum_u32')
  int sumU32(JSUint32Array values) {
    final v = values.toDart; // zero-copy Uint32List view on Wasm
    int total = 0;
    for (int i = 0; i < v.length; i++) {
      total += v[i];
    }
    return total;
  }

  @JSExport('fft_butterfly')
  void fftButterfly(JSFloat32Array real, JSFloat32Array imag, int len) {
    final r = real.toDart; // zero-copy Float32List views on Wasm
    final im = imag.toDart;
    for (int step = 1; step < len; step <<= 1) {
      final angle = -3.14159265358979323846 / step;
      final wReal = math.cos(angle);
      final wImag = math.sin(angle);
      for (int i = 0; i < len; i += step << 1) {
        double curWReal = 1.0;
        double curWImag = 0.0;
        for (int j = 0; j < step; j++) {
          final u = i + j;
          final v = i + j + step;
          final tr = r[v] * curWReal - im[v] * curWImag;
          final ti = r[v] * curWImag + im[v] * curWReal;
          r[v] = r[u] - tr;
          im[v] = im[u] - ti;
          r[u] = r[u] + tr;
          im[u] = im[u] + ti;
          final nextWReal = curWReal * wReal - curWImag * wImag;
          final nextWImag = curWReal * wImag + curWImag * wReal;
          curWReal = nextWReal;
          curWImag = nextWImag;
        }
      }
    }
  }
}

// Writes globalThis.dartKernels (the documented globalContext interop pattern).
@JS('dartKernels')
external set dartKernels(JSObject value);

void main() {
  dartKernels = createJSInteropWrapper(DartKernels());
}
