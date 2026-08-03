import { assertRadix2, ORACLE_TOLERANCE, QUANTIZATION_STEP } from "./workload.js";
import { sha256Hex } from "../../../lib/canonical.ts";

export function runIndependentF64Oracle(
  signal: Float32Array,
  window: Float32Array,
  twiddles: Float32Array,
  gains: Float32Array,
): Float64Array {
  const n = signal.length;
  assertRadix2(n);
  if (window.length !== n || gains.length !== n || twiddles.length !== (n - 1) * 2) {
    throw new Error("reference fixture length mismatch");
  }
  const output = new Float64Array(n * 2);
  for (let i = 0; i < n; i += 1) output[i * 2] = Number(signal[i]) * Number(window[i]);
  fftF64(output, n, twiddles);
  for (let i = 0; i < n; i += 1) {
    output[i * 2] *= Number(gains[i]);
    output[i * 2 + 1] *= -Number(gains[i]);
  }
  fftF64(output, n, twiddles);
  const scale = 1 / n;
  for (let i = 0; i < n; i += 1) {
    output[i * 2] *= scale;
    output[i * 2 + 1] *= -scale;
  }
  return output;
}

function fftF64(data: Float64Array, n: number, twiddles: Float32Array): void {
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >>> 1;
    while ((j & bit) !== 0) {
      j ^= bit;
      bit >>>= 1;
    }
    j ^= bit;
    if (i < j) {
      const left = i * 2;
      const right = j * 2;
      [data[left], data[right]] = [data[right], data[left]];
      [data[left + 1], data[right + 1]] = [data[right + 1], data[left + 1]];
    }
  }
  let twiddleStart = 0;
  for (let len = 2; len <= n; len *= 2) {
    const half = len >>> 1;
    for (let start = 0; start < n; start += len) {
      let twiddle = twiddleStart;
      for (let j = 0; j < half; j += 1) {
        const cosine = Number(twiddles[twiddle++]);
        const sine = Number(twiddles[twiddle++]);
        const even = (start + j) * 2;
        const odd = (start + j + half) * 2;
        const transformedReal = cosine * data[odd] - sine * data[odd + 1];
        const transformedImaginary = cosine * data[odd + 1] + sine * data[odd];
        const evenReal = data[even];
        const evenImaginary = data[even + 1];
        data[even] = evenReal + transformedReal;
        data[even + 1] = evenImaginary + transformedImaginary;
        data[odd] = evenReal - transformedReal;
        data[odd + 1] = evenImaginary - transformedImaginary;
      }
    }
    twiddleStart += half * 2;
  }
}

export function validateAgainstOracle(output: Float32Array, reference: Float64Array) {
  if (output.length !== reference.length) throw new Error("oracle output length mismatch");
  let maxAbsolute = 0;
  let maxRelative = 0;
  let violations = 0;
  let outputEnergy = 0;
  let referenceEnergy = 0;
  for (let i = 0; i < output.length; i += 1) {
    const actual = Number(output[i]);
    const expected = reference[i];
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
      throw new Error(`non-finite output at component ${i}`);
    }
    const absolute = Math.abs(actual - expected);
    const relative = absolute / Math.max(Math.abs(expected), 1e-12);
    maxAbsolute = Math.max(maxAbsolute, absolute);
    maxRelative = Math.max(maxRelative, relative);
    if (absolute > ORACLE_TOLERANCE.absolute && relative > ORACLE_TOLERANCE.relative) {
      violations += 1;
    }
    outputEnergy += actual * actual;
    referenceEnergy += expected * expected;
  }
  const energyRelative = Math.abs(outputEnergy - referenceEnergy) /
    Math.max(referenceEnergy, 1e-30);
  return {
    passed: violations === 0 && energyRelative <= ORACLE_TOLERANCE.energyRelative,
    violations,
    maxAbsolute,
    maxRelative,
    outputEnergy,
    referenceEnergy,
    energyRelative,
    tolerance: ORACLE_TOLERANCE,
  };
}

export function canonicalF32Bytes(values: Float32Array): Uint8Array {
  const normalized = values.slice();
  for (let i = 0; i < normalized.length; i += 1) {
    if (Object.is(normalized[i], -0)) normalized[i] = 0;
  }
  return new Uint8Array(normalized.buffer);
}

export async function completeOutputSha256(values: Float32Array): Promise<string> {
  return await sha256Hex(canonicalF32Bytes(values));
}

export async function quantizedOutputSha256(values: Float32Array): Promise<string> {
  const quantized = new Int32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    if (!Number.isFinite(values[i])) throw new Error(`non-finite output at component ${i}`);
    quantized[i] = Math.round(values[i] / QUANTIZATION_STEP);
  }
  return await sha256Hex(new Uint8Array(quantized.buffer));
}
