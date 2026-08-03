// Frozen-v1 supplemental controlled implementation for audio.webaudio-effects.v1.
// Both targets execute this exact chain: transposed-DF2 biquad, peak-envelope
// soft-knee compressor, then direct convolution. All controlled arithmetic is f32.

export const CONTRACT = Object.freeze({
  entryId: "audio.webaudio-effects.v1",
  implementationId: "audio-webaudio-effects-controlled-v1",
  sampleRate: 48_000,
  seconds: 60,
  frames: 2_880_000,
  channels: 2,
  blockFrames: 128,
  blocks: 22_500,
  irLength: 16,
  tailFrames: 15,
  outputFrames: 2_880_015,
  seed: 0x51f15e5d,
  fpPolicy: "strict-f32-frozen-operation-order",
  biquad: Object.freeze({
    b0: Math.fround(0.206572083826147),
    b1: Math.fround(0.413144167652294),
    b2: Math.fround(0.206572083826147),
    a1: Math.fround(-0.369527377351241),
    a2: Math.fround(0.195815712655833),
  }),
  compressor: Object.freeze({
    threshold: Math.fround(0.25),
    knee: Math.fround(0.1),
    ratioReciprocal: Math.fround(0.25),
    attackCoefficient: Math.fround(0.9),
    releaseCoefficient: Math.fround(0.9995),
    detector: "per-channel-absolute-peak",
    envelope: "one-pole-attack-release",
    kneeRule: "quadratic interpolation between unity and 4:1 linear-domain gain",
  }),
  convolution: "16-tap direct-form circular history, newest sample times tap zero",
  flush: "15 zero compressor outputs flush convolution only",
});

export const IR = new Float32Array([
  0.625,
  -0.1875,
  0.140625,
  0.10546875,
  -0.0791015625,
  0.059326171875,
  -0.04449462890625,
  0.0333709716796875,
  -0.025028228759765625,
  0.01877117156982422,
  -0.014078378677368164,
  0.010558784008026123,
  -0.007919088006019592,
  0.005939316004514694,
  -0.004454487003386021,
  0.0033408652525395155,
]);

const f = Math.fround;

function nextXorshift(state) {
  state ^= state << 13;
  state >>>= 0;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

/** Generate the complete CC0 stereo fixture outside the controlled compute phase. */
export function generateFixture(frames = Number(CONTRACT.frames)) {
  if (!Number.isInteger(frames) || frames < 1 || frames > CONTRACT.frames) {
    throw new RangeError("frames outside frozen fixture bounds");
  }
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  left[0] = 1;
  right[0] = f(-0.75);
  // The first second is an impulse/DC/threshold differential segment.
  for (let i = 1; i < Math.min(frames, CONTRACT.sampleRate); i++) {
    const level = i < 12_000 ? 0.1 : i < 24_000 ? 0.25 : i < 36_000 ? 0.3 : -0.2;
    left[i] = f(level);
    right[i] = f(-level * 0.75);
  }
  // Ten-second deterministic logarithm-free sweep. Phase increment rises linearly.
  let phaseL = 0;
  let phaseR = 0;
  const sweepEnd = Math.min(frames, CONTRACT.sampleRate * 11);
  for (let i = CONTRACT.sampleRate; i < sweepEnd; i++) {
    const t = (i - CONTRACT.sampleRate) / (CONTRACT.sampleRate * 10);
    phaseL += 0.0025 + t * 0.19;
    phaseR += 0.0031 + t * 0.17;
    left[i] = f(Math.sin(phaseL) * 0.72);
    right[i] = f(Math.sin(phaseR) * 0.64);
  }
  let state = CONTRACT.seed >>> 0;
  for (let i = CONTRACT.sampleRate * 11; i < frames; i++) {
    state = nextXorshift(state);
    left[i] = f((state / 0x1_0000_0000) * 1.4 - 0.7);
    state = nextXorshift(state);
    right[i] = f((state / 0x1_0000_0000) * 1.4 - 0.7);
  }
  return { left, right };
}

function compressorGain(envelope) {
  const { threshold, knee, ratioReciprocal } = CONTRACT.compressor;
  const half = f(knee * f(0.5));
  const low = f(threshold - half);
  const high = f(threshold + half);
  if (envelope <= low) return f(1);
  const over = f(envelope - threshold);
  const target = f(threshold + f(over * ratioReciprocal));
  const hardGain = f(target / envelope);
  if (envelope >= high) return hardGain;
  const t = f(f(envelope - low) / knee);
  const mix = f(t * t);
  const effective = f(envelope + f(mix * f(target - envelope)));
  return f(effective / envelope);
}

function createChannelState(irLength) {
  return { z1: f(0), z2: f(0), envelope: f(0), history: new Float32Array(irLength), cursor: 0 };
}

function convolveSample(compressed, ir, output, outputIndex, state) {
  state.history[state.cursor] = compressed;
  let sum = f(0);
  let historyIndex = state.cursor;
  for (let tap = 0; tap < ir.length; tap++) {
    sum = f(sum + f(state.history[historyIndex] * ir[tap]));
    historyIndex = historyIndex === 0 ? ir.length - 1 : historyIndex - 1;
  }
  output[outputIndex] = sum;
  state.cursor++;
  if (state.cursor === ir.length) state.cursor = 0;
}

function processBlock(input, offset, frames, ir, output, state) {
  const { b0, b1, b2, a1, a2 } = CONTRACT.biquad;
  const { attackCoefficient, releaseCoefficient } = CONTRACT.compressor;
  for (let blockIndex = 0; blockIndex < frames; blockIndex++) {
    const sample = input[offset + blockIndex];
    const filtered = f(f(b0 * sample) + state.z1);
    state.z1 = f(f(f(b1 * sample) - f(a1 * filtered)) + state.z2);
    state.z2 = f(f(b2 * sample) - f(a2 * filtered));
    const magnitude = f(Math.abs(filtered));
    const coefficient = magnitude > state.envelope ? attackCoefficient : releaseCoefficient;
    state.envelope = f(
      f(coefficient * state.envelope) + f(f(f(1) - coefficient) * magnitude),
    );
    convolveSample(
      f(filtered * compressorGain(state.envelope)),
      ir,
      output,
      offset + blockIndex,
      state,
    );
  }
}

function flushConvolution(inputFrames, ir, output, state) {
  for (let tail = 0; tail < ir.length - 1; tail++) {
    convolveSample(f(0), ir, output, inputFrames + tail, state);
  }
}

function processChannelInBlocks(input, ir, output, observations) {
  const state = createChannelState(ir.length);
  let blocksForChannel = 0;
  for (let offset = 0; offset < input.length; offset += CONTRACT.blockFrames) {
    const frames = Math.min(CONTRACT.blockFrames, input.length - offset);
    if (blocksForChannel > 0) observations.stateCarryBoundaries++;
    processBlock(input, offset, frames, ir, output, state);
    blocksForChannel++;
    observations.blockInvocations++;
  }
  observations.blocksPerChannel.push(blocksForChannel);
  flushConvolution(input.length, ir, output, state);
  observations.tailFlushInvocations++;
  observations.tailFlushFrames += ir.length - 1;
}

export function processJavaScript(fixture, ir = IR) {
  if (!(fixture?.left instanceof Float32Array) || !(fixture?.right instanceof Float32Array)) {
    throw new TypeError("stereo Float32Array fixture required");
  }
  if (fixture.left.length !== fixture.right.length) throw new Error("stereo length mismatch");
  if (!(ir instanceof Float32Array) || ir.length !== CONTRACT.irLength) {
    throw new Error("frozen impulse response required");
  }
  const outputFrames = fixture.left.length + ir.length - 1;
  const left = new Float32Array(outputFrames);
  const right = new Float32Array(outputFrames);
  const observed = {
    blocksPerChannel: [],
    blockInvocations: 0,
    stateCarryBoundaries: 0,
    tailFlushInvocations: 0,
    tailFlushFrames: 0,
    processingBoundaryCrossings: 0,
  };
  processChannelInBlocks(fixture.left, ir, left, observed);
  processChannelInBlocks(fixture.right, ir, right, observed);
  return { left, right, observations: freezeObservations(observed) };
}

export function freezeObservations(observed) {
  return Object.freeze({
    blocksPerChannel: Object.freeze([...observed.blocksPerChannel]),
    blockInvocations: observed.blockInvocations,
    stateCarryBoundaries: observed.stateCarryBoundaries,
    tailFlushInvocations: observed.tailFlushInvocations,
    tailFlushFrames: observed.tailFlushFrames,
    processingBoundaryCrossings: observed.processingBoundaryCrossings,
  });
}

export function counters(frames, target, observations) {
  if (!Number.isInteger(frames) || frames < 1 || !["javascript", "wasm-linear"].includes(target)) {
    throw new TypeError("exact frame count and target required");
  }
  if (!observations || observations.blocksPerChannel?.length !== CONTRACT.channels) {
    throw new TypeError("observed per-channel block execution required");
  }
  const expectedBlocks = Math.ceil(frames / CONTRACT.blockFrames);
  if (
    observations.blocksPerChannel.some((value) => value !== expectedBlocks) ||
    observations.blockInvocations !== expectedBlocks * CONTRACT.channels ||
    observations.stateCarryBoundaries !== (expectedBlocks - 1) * CONTRACT.channels ||
    observations.tailFlushInvocations !== CONTRACT.channels ||
    observations.tailFlushFrames !== (CONTRACT.irLength - 1) * CONTRACT.channels ||
    observations.processingBoundaryCrossings !==
      (target === "wasm-linear" ? observations.blockInvocations + CONTRACT.channels : 0)
  ) {
    throw new Error("observed execution does not satisfy the fixed-block contract");
  }
  const outputFrames = frames + CONTRACT.irLength - 1;
  return Object.freeze({
    channels: 2,
    "input-frames": frames,
    "input-samples": frames * 2,
    "blocks-per-channel": observations.blocksPerChannel[0],
    "block-invocations": observations.blockInvocations,
    "output-frames": outputFrames,
    "output-samples": outputFrames * 2,
    "biquad-samples": frames * 2,
    "compressor-detector-updates": frames * 2,
    "convolution-macs": outputFrames * CONTRACT.irLength * 2,
    "state-carry-boundaries-per-channel": observations.blocksPerChannel[0] - 1,
    "state-carry-boundaries": observations.stateCarryBoundaries,
    "tail-flush-invocations": observations.tailFlushInvocations,
    "tail-flush-frames-per-channel": CONTRACT.irLength - 1,
    "tail-flush-frames": observations.tailFlushFrames,
    "fixture-allocations": 2,
    allocations: target === "javascript" ? 4 : 0,
    "validation-output-copies": target === "wasm-linear" ? 2 : 0,
    "boundary-crossings": observations.processingBoundaryCrossings,
  });
}

export function interleaveBytes(output) {
  const bytes = new Uint8Array(output.left.length * 8);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < output.left.length; i++) {
    view.setFloat32(i * 8, Object.is(output.left[i], -0) ? 0 : output.left[i], true);
    view.setFloat32(i * 8 + 4, Object.is(output.right[i], -0) ? 0 : output.right[i], true);
  }
  return bytes;
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}
