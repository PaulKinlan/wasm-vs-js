// audio-stft Dart WasmGC kernel
// Mirrors benchmarks/audio-stft/workload.ts stftInto:
// Windowing + Radix-2 FFT over overlapping frames into spectrogram buffer.

import 'dart:js_interop';
import 'dart:typed_data';

@JS('Math.fround')
external double fround(double x);

void _fftRadix2(Float32List data, int n, Float32List twiddle) {
  for (int i = 1, j = 0; i < n; i++) {
    int bit = n >> 1;
    for (; (j & bit) != 0; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      int ri = i * 2, rj = j * 2;
      double t = data[ri]; data[ri] = data[rj]; data[rj] = t;
      t = data[ri + 1]; data[ri + 1] = data[rj + 1]; data[rj + 1] = t;
    }
  }
  int twIdx = 0;
  for (int len = 2; len <= n; len <<= 1) {
    int halfLen = len >> 1;
    for (int i = 0; i < n; i += len) {
      int tw = twIdx;
      for (int j = 0; j < halfLen; j++) {
        double wCos = twiddle[tw];
        double wSin = twiddle[tw + 1];
        tw += 2;
        int evenIdx = (i + j) * 2;
        int oddIdx = (i + j + halfLen) * 2;
        double evenRe = data[evenIdx], evenIm = data[evenIdx + 1];
        double oddRe = data[oddIdx], oddIm = data[oddIdx + 1];
        double tRe = fround(fround(wCos * oddRe) - fround(wSin * oddIm));
        double tIm = fround(fround(wCos * oddIm) + fround(wSin * oddRe));
        data[evenIdx] = fround(evenRe + tRe);
        data[evenIdx + 1] = fround(evenIm + tIm);
        data[oddIdx] = fround(evenRe - tRe);
        data[oddIdx + 1] = fround(evenIm - tIm);
      }
    }
    twIdx += halfLen * 2;
  }
}

@JSExport()
class StftKernels {
  @JSExport('stft')
  void stft(
    JSFloat32Array inputJs,
    int inputLen,
    int frameSize,
    int hopSize,
    JSFloat32Array windowJs,
    JSFloat32Array twiddleJs,
    JSFloat32Array scratchJs,
    JSFloat32Array spectrogramJs,
  ) {
    final input = inputJs.toDart;
    final window = windowJs.toDart;
    final twiddle = twiddleJs.toDart;
    final scratch = scratchJs.toDart;
    final spectrogram = spectrogramJs.toDart;
    final numFrames = 1 + (inputLen - frameSize) ~/ hopSize;

    for (int frame = 0; frame < numFrames; frame++) {
      int offset = frame * hopSize;
      for (int i = 0; i < frameSize; i++) {
        scratch[i * 2] = fround(input[offset + i] * window[i]);
        scratch[i * 2 + 1] = 0.0;
      }
      _fftRadix2(scratch, frameSize, twiddle);
      int specOffset = frame * frameSize * 2;
      for (int i = 0; i < frameSize * 2; i++) {
        spectrogram[specOffset + i] = scratch[i];
      }
    }
  }
}

void main() {
  dartKernels = createJSInteropWrapper(StftKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
