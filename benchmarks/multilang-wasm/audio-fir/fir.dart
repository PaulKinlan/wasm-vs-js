// audio-fir Dart WasmGC kernel
// Mirrors benchmarks/audio-fir/workload.ts direct convolution:
// output[i+j] += input[i] * taps[j]

import 'dart:js_interop';

@JS('Math.fround')
external double fround(double x);

@JSExport()
class FirKernels {
  @JSExport('fir')
  void fir(
    JSFloat32Array inputJs,
    JSFloat32Array tapsJs,
    JSFloat32Array outputJs,
    int inputLen,
    int tapsLen,
  ) {
    final input = inputJs.toDart;
    final taps = tapsJs.toDart;
    final output = outputJs.toDart;
    final outLen = inputLen + tapsLen - 1;
    for (int k = 0; k < outLen; k++) {
      output[k] = 0.0;
    }
    for (int i = 0; i < inputLen; i++) {
      final sample = input[i];
      for (int j = 0; j < tapsLen; j++) {
        output[i + j] = fround(output[i + j] + fround(sample * taps[j]));
      }
    }
  }
}

void main() {
  dartKernels = createJSInteropWrapper(FirKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
