// audio.fir.v1 / audio-fir
// Direct 256-tap convolution over 131,072 mono samples.
// strict-f32-frozen-order: all intermediates use Math.fround.

export const SAMPLES = 131_072;
export const TAPS = 256;
export const SEED = 0xa1b2c3d4;

export function generateSignal(length = SAMPLES, seed = SEED): Float32Array {
  let state = seed >>> 0;
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    data[i] = Math.fround((state / 0x1_0000_0000) * 2 - 1);
  }
  return data;
}

export function generateTaps(taps = TAPS): Float32Array {
  // Windowed-sinc lowpass, fc=0.25 sample-rate, Hann window
  const h = new Float32Array(taps);
  const fc = 0.25;
  const center = Math.fround((taps - 1) / 2);
  for (let i = 0; i < taps; i++) {
    const nn = Math.fround(i - center);
    let sinc: number;
    if (nn === 0) sinc = Math.fround(2 * fc);
    else {
      const arg = Math.fround(Math.fround(2 * Math.PI * fc) * nn);
      sinc = Math.fround(Math.fround(Math.sin(arg)) / Math.fround(Math.PI * nn));
    }
    const w = Math.fround(
      Math.fround(
        0.5 -
          Math.fround(
            0.5 *
              Math.fround(
                Math.cos(Math.fround(Math.fround(2 * Math.PI * i) / Math.fround(taps - 1))),
              ),
          ),
      ),
    );
    h[i] = Math.fround(sinc * w);
  }
  // Normalize DC gain to 1.0
  let sum = 0;
  for (let i = 0; i < taps; i++) sum = Math.fround(sum + h[i]);
  for (let i = 0; i < taps; i++) h[i] = Math.fround(h[i] / sum);
  return h;
}

// Direct convolution: output[i+j] += input[i] * taps[j], increasing tap order.
// The caller owns the output so allocation and reset stay outside the compute phase.
export function firDirectConvolutionInto(
  input: Float32Array,
  taps: Float32Array,
  output: Float32Array,
): void {
  if (output.length !== input.length + taps.length - 1) {
    throw new Error("FIR output length mismatch");
  }
  output.fill(0);
  for (let i = 0; i < input.length; i++) {
    const sample = input[i];
    for (let j = 0; j < taps.length; j++) {
      output[i + j] = Math.fround(output[i + j] + Math.fround(sample * taps[j]));
    }
  }
}

export function firDirectConvolution(input: Float32Array, taps: Float32Array): Float32Array {
  const output = new Float32Array(input.length + taps.length - 1);
  firDirectConvolutionInto(input, taps, output);
  return output;
}
