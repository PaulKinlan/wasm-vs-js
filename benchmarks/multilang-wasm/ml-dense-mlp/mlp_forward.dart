// ml-dense-mlp Dart WasmGC kernel — exact mirror of the C mlp_forward:
// strict f32 linear layers (fround per op, since Dart has no f32 primitive)
// and the frozen f64 GELU-tanh activation. Dart doubles ARE f64, so the GELU
// (frozenExp/frozenTanh, exponent-bit pow2 scaling) is bit-identical natively;
// the fround overhead on the linear layers is real and disclosed.

import 'dart:js_interop';
import 'dart:typed_data';

@JS('Math.fround')
external double fround(double x);

const LN2 = 0.6931471805599453;
const EXP_COEFFS = [
  1.0, 1.0, 0.5, 0.16666666666666666, 0.041666666666666664,
  0.008333333333333333, 0.001388888888888889, 0.0001984126984126984,
  0.0000248015873015873, 0.0000027557319223985893,
  0.0000002755731922398589, 0.000000025052108385441718,
  0.00000000208767569878681,
];

double pow2Exact(int k) {
  // f64 bits = ((k + 1023) << 52): the JS table builds (k+1023)<<20 into the
  // high 32-bit word; k=1024 yields exponent field 2047 = +Infinity.
  final bytes = ByteData(8);
  bytes.setUint32(0, 0, Endian.little);
  bytes.setUint32(4, (k + 1023) << 20, Endian.little);
  return bytes.getFloat64(0, Endian.little);
}

double frozenExp(double x) {
  if (x.isNaN) return x;
  if (x > 709.7827) return double.infinity;
  if (x < -708.39) return 0.0;
  final k = (x / LN2 + 0.5).floor();
  final r = x - k * LN2;
  var p = EXP_COEFFS[12];
  for (int i = 11; i >= 0; i--) {
    p = p * r + EXP_COEFFS[i];
  }
  return p * pow2Exact(k);
}

double frozenTanh(double x) {
  if (x.isNaN) return x;
  if (x >= 9.011) return 1.0;
  if (x <= -9.011) return -1.0;
  return 1.0 - 2.0 / (frozenExp(2.0 * x) + 1.0);
}

double geluFrozenF64(double p) {
  final inner = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
  return 0.5 * p * (1.0 + frozenTanh(inner));
}

@JSExport()
class MlpKernels {
  @JSExport('mlp_forward')
  void mlpForward(
    JSFloat32Array xJs,
    JSFloat32Array wJs,
    JSFloat32Array biasJs,
    JSFloat32Array scratchAJs,
    JSFloat32Array scratchBJs,
    JSFloat32Array yJs,
    int batch,
    int width,
    int hiddenLayers,
  ) {
    final x = xJs.toDart; // zero-copy Float32List views on Wasm
    final w = wJs.toDart;
    final bias = biasJs.toDart;
    final sA = scratchAJs.toDart;
    final sB = scratchBJs.toDart;
    final y = yJs.toDart;
    final layers = hiddenLayers + 1;
    late Float32List input = x;
    for (int layer = 0; layer < layers; layer++) {
      final Float32List out;
      if (layer == layers - 1) {
        out = y;
      } else if (layer % 2 == 0) {
        out = sA;
      } else {
        out = sB;
      }
      // Strict f32 linear layer with per-op fround.
      for (int bi = 0; bi < batch; bi++) {
        for (int o = 0; o < width; o++) {
          var acc = bias[layer * width + o];
          for (int i = 0; i < width; i++) {
            acc = fround(acc + fround(input[bi * width + i] * w[(layer * width * width) + i * width + o]));
          }
          out[bi * width + o] = fround(acc + 0.0);
        }
      }
      if (layer < layers - 1) {
        for (int index = 0; index < out.length; index++) {
          out[index] = fround(geluFrozenF64(out[index])) + 0.0;
        }
      }
      input = out;
    }
  }
}

void main() {
  dartKernels = createJSInteropWrapper(MlpKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
