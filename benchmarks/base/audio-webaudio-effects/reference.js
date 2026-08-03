import { CONTRACT, IR } from "./workload.js";

function gain(envelope) {
  const threshold = CONTRACT.compressor.threshold;
  const knee = CONTRACT.compressor.knee;
  const low = threshold - knee / 2;
  const high = threshold + knee / 2;
  if (envelope <= low) return 1;
  const target = threshold + (envelope - threshold) * CONTRACT.compressor.ratioReciprocal;
  if (envelope >= high) return target / envelope;
  const t = (envelope - low) / knee;
  return (envelope + t * t * (target - envelope)) / envelope;
}

function channel(input, ir) {
  const output = new Float64Array(input.length + ir.length - 1);
  const history = new Float64Array(ir.length);
  const { b0, b1, b2, a1, a2 } = CONTRACT.biquad;
  let z1 = 0;
  let z2 = 0;
  let envelope = 0;
  let cursor = 0;
  for (let index = 0; index < output.length; index++) {
    let compressed = 0;
    if (index < input.length) {
      const filtered = b0 * input[index] + z1;
      z1 = b1 * input[index] - a1 * filtered + z2;
      z2 = b2 * input[index] - a2 * filtered;
      const magnitude = Math.abs(filtered);
      const coefficient = magnitude > envelope
        ? CONTRACT.compressor.attackCoefficient
        : CONTRACT.compressor.releaseCoefficient;
      envelope = coefficient * envelope + (1 - coefficient) * magnitude;
      compressed = filtered * gain(envelope);
    }
    history[cursor] = compressed;
    let historyIndex = cursor;
    let sum = 0;
    for (let tap = 0; tap < ir.length; tap++) {
      sum += history[historyIndex] * ir[tap];
      historyIndex = historyIndex === 0 ? ir.length - 1 : historyIndex - 1;
    }
    output[index] = sum;
    cursor = (cursor + 1) % ir.length;
  }
  return output;
}

export function processReference(fixture, ir = IR) {
  return { left: channel(fixture.left, ir), right: channel(fixture.right, ir) };
}

export function compareReference(output, reference) {
  let maxAbsolute = 0;
  let maxRelative = 0;
  let violations = 0;
  let nonFinite = 0;
  const absoluteTolerance = 2e-5;
  const relativeTolerance = 2e-4;
  for (const side of ["left", "right"]) {
    if (output[side].length !== reference[side].length) {
      throw new Error("reference length mismatch");
    }
    for (let i = 0; i < output[side].length; i++) {
      const actual = output[side][i];
      const expected = reference[side][i];
      if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
        nonFinite++;
        continue;
      }
      const absolute = Math.abs(actual - expected);
      const relative = absolute / Math.max(Math.abs(expected), 1e-12);
      maxAbsolute = Math.max(maxAbsolute, absolute);
      maxRelative = Math.max(maxRelative, relative);
      if (absolute > absoluteTolerance && relative > relativeTolerance) violations++;
    }
  }
  return { absoluteTolerance, relativeTolerance, maxAbsolute, maxRelative, violations, nonFinite };
}
