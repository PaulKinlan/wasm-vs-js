// ml-numeric-kernels Dart WasmGC kernel — mirrors
// benchmarks/base/ml-numeric-kernels/workload.js exactly: GEMM f32/i8,
// Conv f32/i8, Softmax f32/i8 on the frozen shapes (GEMM 8x7x9, CONV
// 8x8x3->4 k3/s1/p1, SOFTMAX 8x16).
//
// Dart has no f32 primitive, so every f32 multiply/add/division is rounded
// with Math.fround (f64 -> f32) exactly like the JS oracle — bit-identical to
// hardware f32 arithmetic. i8/i32/u8 operations are exact on Dart ints. The
// fround overhead is real and disclosed per-variant.

import 'dart:js_interop';

@JS('Math.fround')
external double fround(double x);

@JSExport()
class NumericKernels {
  @JSExport('gemmF32')
  void gemmF32(JSFloat32Array aJs, JSFloat32Array bJs, JSFloat32Array outJs) {
    final a = aJs.toDart;
    final b = bJs.toDart;
    final out = outJs.toDart;
    for (int i = 0; i < 8; i++) {
      for (int j = 0; j < 7; j++) {
        double acc = 0.0;
        for (int k = 0; k < 9; k++) {
          acc = fround(acc + fround(a[i * 9 + k] * b[k * 7 + j]));
        }
        out[i * 7 + j] = fround(acc + 0.0);
      }
    }
  }

  @JSExport('gemmI8')
  void gemmI8(JSInt8Array aJs, JSInt8Array bJs, JSInt32Array outJs) {
    final a = aJs.toDart;
    final b = bJs.toDart;
    final out = outJs.toDart;
    for (int i = 0; i < 8; i++) {
      for (int j = 0; j < 7; j++) {
        int acc = 0;
        for (int k = 0; k < 9; k++) {
          acc += a[i * 9 + k] * b[k * 7 + j];
        }
        out[i * 7 + j] = acc;
      }
    }
  }

  @JSExport('convF32')
  void convF32(JSFloat32Array inputJs, JSFloat32Array weightsJs, JSFloat32Array outJs) {
    final input = inputJs.toDart;
    final weights = weightsJs.toDart;
    final out = outJs.toDart;
    for (int y = 0; y < 8; y++) {
      for (int x = 0; x < 8; x++) {
        for (int o = 0; o < 4; o++) {
          double acc = 0.0;
          for (int ky = 0; ky < 3; ky++) {
            for (int kx = 0; kx < 3; kx++) {
              int iy = y + ky - 1, ix = x + kx - 1;
              if (iy < 0 || ix < 0 || iy >= 8 || ix >= 8) continue;
              for (int c = 0; c < 3; c++) {
                acc = fround(acc +
                    fround(input[(iy * 8 + ix) * 3 + c] * weights[((ky * 3 + kx) * 3 + c) * 4 + o]));
              }
            }
          }
          out[(y * 8 + x) * 4 + o] = fround(acc + 0.0);
        }
      }
    }
  }

  @JSExport('convI8')
  void convI8(JSInt8Array inputJs, JSInt8Array weightsJs, JSInt32Array outJs) {
    final input = inputJs.toDart;
    final weights = weightsJs.toDart;
    final out = outJs.toDart;
    for (int y = 0; y < 8; y++) {
      for (int x = 0; x < 8; x++) {
        for (int o = 0; o < 4; o++) {
          int acc = 0;
          for (int ky = 0; ky < 3; ky++) {
            for (int kx = 0; kx < 3; kx++) {
              int iy = y + ky - 1, ix = x + kx - 1;
              if (iy < 0 || ix < 0 || iy >= 8 || ix >= 8) continue;
              for (int c = 0; c < 3; c++) {
                acc += input[(iy * 8 + ix) * 3 + c] * weights[((ky * 3 + kx) * 3 + c) * 4 + o];
              }
            }
          }
          out[(y * 8 + x) * 4 + o] = acc;
        }
      }
    }
  }

  double expApproxF32(double value) {
    final x = fround(value < -8.0 ? -8.0 : (value > 0.0 ? 0.0 : value));
    double y = fround(1.0 + fround(x / 256.0));
    for (int i = 0; i < 8; i++) {
      y = fround(y * y);
    }
    return y;
  }

  @JSExport('softmaxF32')
  void softmaxF32(JSFloat32Array inputJs, JSFloat32Array outJs) {
    final input = inputJs.toDart;
    final out = outJs.toDart;
    for (int r = 0; r < 8; r++) {
      final base = r * 16;
      double max = input[base];
      for (int c = 1; c < 16; c++) {
        if (input[base + c] > max) max = input[base + c];
      }
      double sum = 0.0;
      for (int c = 0; c < 16; c++) {
        final e = expApproxF32(fround(input[base + c] - max));
        out[base + c] = e;
        sum = fround(sum + e);
      }
      for (int c = 0; c < 16; c++) {
        out[base + c] = fround(fround(out[base + c] / sum) + 0.0);
      }
    }
  }

  @JSExport('softmaxI8')
  void softmaxI8(JSInt8Array inputJs, JSUint8Array outJs) {
    final input = inputJs.toDart;
    final out = outJs.toDart;
    const lut = [256, 94, 35, 13, 5, 2, 1, 0, 0];
    for (int r = 0; r < 8; r++) {
      final base = r * 16;
      int max = input[base], maxIndex = 0;
      for (int c = 1; c < 16; c++) {
        if (input[base + c] > max) {
          max = input[base + c];
          maxIndex = c;
        }
      }
      int sum = 0;
      for (int c = 0; c < 16; c++) {
        int d = max - input[base + c];
        if (d > 8) d = 8;
        sum += lut[d];
      }
      int quantized = 0;
      for (int c = 0; c < 16; c++) {
        int d = max - input[base + c];
        if (d > 8) d = 8;
        final q = (lut[d] * 255 + sum ~/ 2) ~/ sum;
        out[base + c] = q;
        quantized += q;
      }
      out[base + maxIndex] = out[base + maxIndex] + 255 - quantized;
    }
  }
}

void main() {
  dartKernels = createJSInteropWrapper(NumericKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
