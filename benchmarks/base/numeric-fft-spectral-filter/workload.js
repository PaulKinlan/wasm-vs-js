// Frozen-v1 supplemental controlled implementation for numeric.fft-spectral-filter.v1.
// The catalog remains immutable. This module freezes the concrete fixture and operation order.

export const ENTRY_ID = "numeric.fft-spectral-filter.v1";
export const IMPLEMENTATION_ID = "numeric-fft-spectral-filter-controlled-v1";
export const SAMPLE_COUNT = 1 << 20;
export const SIGNAL_SEED = 0x6d2b79f5;
export const QUANTIZATION_STEP = 1e-5;
export const ORACLE_TOLERANCE = Object.freeze({
  absolute: 0.00025,
  relative: 0.0025,
  energyRelative: 0.0002,
});

function nextXorshift32(state) {
  state ^= state << 13;
  state >>>= 0;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function assertRadix2(n) {
  if (!Number.isInteger(n) || n < 2 || (n & (n - 1)) !== 0) {
    throw new Error("sample count must be a radix-2 integer of at least two");
  }
}

export function generateSignal(n = SAMPLE_COUNT, seed = SIGNAL_SEED) {
  assertRadix2(n);
  let state = seed >>> 0;
  const signal = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    state = nextXorshift32(state);
    const signed = (state & 0xffff) - 0x8000;
    signal[i] = Math.fround(signed / 32768);
  }
  return signal;
}

export function generateWindow(n = SAMPLE_COUNT) {
  assertRadix2(n);
  const window = new Float32Array(n);
  const denominator = n - 1;
  for (let i = 0; i < n; i += 1) {
    window[i] = Math.fround(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denominator));
  }
  return window;
}

export function generateTwiddles(n = SAMPLE_COUNT) {
  assertRadix2(n);
  const twiddles = new Float32Array((n - 1) * 2);
  let cursor = 0;
  for (let len = 2; len <= n; len *= 2) {
    const half = len >>> 1;
    for (let j = 0; j < half; j += 1) {
      const angle = (-2 * Math.PI * j) / len;
      twiddles[cursor++] = Math.fround(Math.cos(angle));
      twiddles[cursor++] = Math.fround(Math.sin(angle));
    }
  }
  return twiddles;
}

export function generateGains(n = SAMPLE_COUNT) {
  assertRadix2(n);
  const gains = new Float32Array(n);
  const fullGainEnd = n >>> 4;
  const halfGainEnd = n >>> 3;
  for (let i = 0; i < n; i += 1) {
    const mirroredBin = Math.min(i, n - i);
    gains[i] = mirroredBin <= fullGainEnd ? 1 : mirroredBin <= halfGainEnd ? 0.5 : 0.25;
  }
  return gains;
}

export function generateFixture(n = SAMPLE_COUNT, seed = SIGNAL_SEED) {
  return {
    signal: generateSignal(n, seed),
    window: generateWindow(n),
    twiddles: generateTwiddles(n),
    gains: generateGains(n),
  };
}

export function fftRadix2F32(data, n, twiddles) {
  assertRadix2(n);
  if (data.length !== n * 2 || twiddles.length !== (n - 1) * 2) {
    throw new Error("FFT field length mismatch");
  }
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >>> 1;
    for (; (j & bit) !== 0; bit >>>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const left = i * 2;
      const right = j * 2;
      let temporary = data[left];
      data[left] = data[right];
      data[right] = temporary;
      temporary = data[left + 1];
      data[left + 1] = data[right + 1];
      data[right + 1] = temporary;
    }
  }
  let twiddleStart = 0;
  for (let len = 2; len <= n; len *= 2) {
    const half = len >>> 1;
    for (let start = 0; start < n; start += len) {
      let twiddle = twiddleStart;
      for (let j = 0; j < half; j += 1) {
        const cosine = twiddles[twiddle++];
        const sine = twiddles[twiddle++];
        const even = (start + j) * 2;
        const odd = (start + j + half) * 2;
        const evenReal = data[even];
        const evenImaginary = data[even + 1];
        const oddReal = data[odd];
        const oddImaginary = data[odd + 1];
        const transformedReal = Math.fround(
          Math.fround(cosine * oddReal) - Math.fround(sine * oddImaginary),
        );
        const transformedImaginary = Math.fround(
          Math.fround(cosine * oddImaginary) + Math.fround(sine * oddReal),
        );
        data[even] = Math.fround(evenReal + transformedReal);
        data[even + 1] = Math.fround(evenImaginary + transformedImaginary);
        data[odd] = Math.fround(evenReal - transformedReal);
        data[odd + 1] = Math.fround(evenImaginary - transformedImaginary);
      }
    }
    twiddleStart += half * 2;
  }
}

export function runPipelineJs(signal, window, twiddles, gains) {
  const n = signal.length;
  assertFixtureLengths(n, signal, window, twiddles, gains);
  const output = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) output[i * 2] = Math.fround(signal[i] * window[i]);
  fftRadix2F32(output, n, twiddles);
  for (let i = 0; i < n; i += 1) {
    const gain = gains[i];
    output[i * 2] = Math.fround(output[i * 2] * gain);
    output[i * 2 + 1] = Math.fround(output[i * 2 + 1] * gain);
    output[i * 2 + 1] = Math.fround(-output[i * 2 + 1]);
  }
  fftRadix2F32(output, n, twiddles);
  const scale = Math.fround(1 / n);
  for (let i = 0; i < n; i += 1) {
    output[i * 2] = Math.fround(output[i * 2] * scale);
    output[i * 2 + 1] = Math.fround(Math.fround(-output[i * 2 + 1]) * scale);
  }
  return output;
}

export async function runPipelineWasm(wasmBytes, signal, window, twiddles, gains) {
  const n = signal.length;
  assertFixtureLengths(n, signal, window, twiddles, gains);
  const instance = await WebAssembly.instantiate(wasmBytes, {});
  const { memory, spectral_pipeline: pipeline } = instance.instance.exports;
  if (!(memory instanceof WebAssembly.Memory) || typeof pipeline !== "function") {
    throw new Error("numeric FFT Wasm exports are incomplete");
  }
  const dataBytes = n * 2 * 4;
  const windowBytes = n * 4;
  const twiddleBytes = (n - 1) * 2 * 4;
  const gainBytes = n * 4;
  const dataPointer = 0;
  const windowPointer = dataPointer + dataBytes;
  const twiddlePointer = windowPointer + windowBytes;
  const gainPointer = twiddlePointer + twiddleBytes;
  if (gainPointer + gainBytes > memory.buffer.byteLength) throw new Error("Wasm memory too small");
  new Float32Array(memory.buffer, dataPointer, n * 2).fill(0);
  const data = new Float32Array(memory.buffer, dataPointer, n * 2);
  for (let i = 0; i < n; i += 1) data[i * 2] = signal[i];
  new Float32Array(memory.buffer, windowPointer, n).set(window);
  new Float32Array(memory.buffer, twiddlePointer, (n - 1) * 2).set(twiddles);
  new Float32Array(memory.buffer, gainPointer, n).set(gains);
  pipeline(dataPointer, windowPointer, twiddlePointer, gainPointer, n);
  return new Float32Array(data).slice();
}

function assertFixtureLengths(n, signal, window, twiddles, gains) {
  assertRadix2(n);
  if (
    signal.length !== n || window.length !== n || gains.length !== n ||
    twiddles.length !== (n - 1) * 2
  ) throw new Error("numeric FFT fixture field length mismatch");
}

export function expectedCounters(n = SAMPLE_COUNT, target = "js-controlled") {
  assertRadix2(n);
  const stages = Math.log2(n);
  const butterflies = n * stages;
  return Object.freeze({
    pipelines: 1,
    samples: n,
    "forward-ffts": 1,
    "inverse-ffts": 1,
    butterflies,
    "twiddle-pair-loads": butterflies,
    "window-multiplies": n,
    "filter-scalar-multiplies": n * 2,
    "inverse-scale-multiplies": n * 2,
    "input-bytes": n * 4,
    "output-bytes": n * 2 * 4,
    allocations: target === "js-controlled" ? 1 : 0,
    "boundary-crossings": target === "wasm-linear-controlled" ? 2 : 0,
  });
}

export function checkpointValues(output) {
  const n = output.length >>> 1;
  const indices = [0, 1, n >>> 3, n >>> 2, n >>> 1, n - 2, n - 1];
  return indices.map((index) => ({
    index,
    real: output[index * 2],
    imaginary: output[index * 2 + 1],
  }));
}
