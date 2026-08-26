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
// Note: Dart has no f32 primitive, so f32 semantics are emulated by rounding
// through a one-element Float32List after every operation. That is a real
// cost, and it is the cost of computing what the other engines compute.
//
// The FFT variant previously used dart:math sin/cos in f64 and rounded only
// where results were stored into the Float32List views. It therefore computed
// a different transform from the C/C++/Rust/AssemblyScript/WAT engines, which
// build twiddle factors from a four-term f32 Taylor series (fft_kernel.c's
// sinf_custom), and produced a different spectrum — while the page claimed
// every variant was bit-identical to the oracle. It now runs the same series
// in the same precision and agrees with them byte for byte.

import 'dart:js_interop';
import 'dart:typed_data';

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

  /// Scratch cell used to round a double to f32, the only way to get f32
  /// rounding in a language with no f32 scalar.
  static final Float32List _round = Float32List(1);

  static double _f32(double value) {
    _round[0] = value;
    return _round[0];
  }

  static final double _pi = _f32(3.14159265358979323846);
  static final double _halfPi = _f32(1.57079632679489661923);
  static final double _twoPi = _f32(2 * _pi);

  /// The four-term f32 Taylor sine the linear-memory kernels use.
  static double _sinf(double x) {
    while (x > _pi) {
      x = _f32(x - _twoPi);
    }
    while (x < -_pi) {
      x = _f32(x + _twoPi);
    }
    final x2 = _f32(x * x);
    final x3 = _f32(x * x2);
    final x5 = _f32(x3 * x2);
    final x7 = _f32(x5 * x2);
    return _f32(
      _f32(_f32(x - _f32(x3 / _f32(6.0))) + _f32(x5 / _f32(120.0))) -
          _f32(x7 / _f32(5040.0)),
    );
  }

  static double _cosf(double x) => _sinf(_f32(x + _halfPi));

  @JSExport('fft_butterfly')
  void fftButterfly(JSFloat32Array real, JSFloat32Array imag, int len) {
    final r = real.toDart; // zero-copy Float32List views on Wasm
    final im = imag.toDart;
    for (int step = 1; step < len; step <<= 1) {
      final angle = _f32(-_pi / _f32(step.toDouble()));
      final wReal = _cosf(angle);
      final wImag = _sinf(angle);
      for (int i = 0; i < len; i += step << 1) {
        double curWReal = _f32(1.0);
        double curWImag = _f32(0.0);
        for (int j = 0; j < step; j++) {
          final u = i + j;
          final v = i + j + step;
          final tr = _f32(_f32(r[v] * curWReal) - _f32(im[v] * curWImag));
          final ti = _f32(_f32(r[v] * curWImag) + _f32(im[v] * curWReal));
          r[v] = _f32(r[u] - tr);
          im[v] = _f32(im[u] - ti);
          r[u] = _f32(r[u] + tr);
          im[u] = _f32(im[u] + ti);
          final nextWReal = _f32(_f32(curWReal * wReal) - _f32(curWImag * wImag));
          final nextWImag = _f32(_f32(curWReal * wImag) + _f32(curWImag * wReal));
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
