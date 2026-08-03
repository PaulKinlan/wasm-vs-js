import C from "./constants.v1.js";

export const CONTRACT = Object.freeze({
  workloadId: "ml.keyword-spotting.v1",
  sampleRate: 16000,
  seconds: 60,
  samples: 960000,
  hopSamples: 320,
  hops: 3000,
  fftSize: 512,
  features: 13,
  contextFrames: 3,
  hiddenChannels: 8,
  classes: 4,
  algorithmFamily: "dscnn-fixed-preprocess-model",
  preprocessing: "PCM16LE -> Hann Q15 -> radix-2 FFT Q15 -> 13 log bands -> DCT Q15",
  model:
    "owned fixed INT8 depthwise-separable convolution, 3-frame context, 13 depthwise channels, 8 pointwise channels, 4 logits",
});

function bitReverse9(value) {
  let out = 0;
  for (let bit = 0; bit < 9; bit += 1) {
    out = (out << 1) | (value & 1);
    value >>>= 1;
  }
  return out;
}
function ilog2(value) {
  let result = 0;
  while (value > 1) {
    value = Math.floor(value / 2);
    result += 1;
  }
  return result;
}
function clampI8(value) {
  return value < -128 ? -128 : value > 127 ? 127 : value;
}
function validatePcm(pcm) {
  if (!(pcm instanceof Int16Array) || pcm.length !== CONTRACT.samples) {
    throw new RangeError(`expected exactly ${CONTRACT.samples} signed PCM16 samples`);
  }
}

function computeFeature(pcm, hop, re, im, output) {
  const base = hop * CONTRACT.hopSamples;
  for (let index = 0; index < CONTRACT.fftSize; index += 1) {
    re[index] = index < CONTRACT.hopSamples
      ? (Math.imul(pcm[base + index], C.windowQ15[index]) >> 15)
      : 0;
    im[index] = 0;
  }
  for (let index = 0; index < CONTRACT.fftSize; index += 1) {
    const reverse = bitReverse9(index);
    if (reverse > index) {
      const real = re[index];
      re[index] = re[reverse];
      re[reverse] = real;
      const imaginary = im[index];
      im[index] = im[reverse];
      im[reverse] = imaginary;
    }
  }
  for (let length = 2; length <= CONTRACT.fftSize; length *= 2) {
    const half = length / 2;
    const twiddleStep = CONTRACT.fftSize / length;
    for (let start = 0; start < CONTRACT.fftSize; start += length) {
      for (let offset = 0; offset < half; offset += 1) {
        const twiddle = offset * twiddleStep;
        const br = re[start + offset + half];
        const bi = im[start + offset + half];
        const wr = C.twiddleRealQ15[twiddle];
        const wi = C.twiddleImagQ15[twiddle];
        const tr = (Math.imul(br, wr) - Math.imul(bi, wi)) >> 15;
        const ti = (Math.imul(br, wi) + Math.imul(bi, wr)) >> 15;
        const ar = re[start + offset];
        const ai = im[start + offset];
        re[start + offset] = (ar + tr) >> 1;
        im[start + offset] = (ai + ti) >> 1;
        re[start + offset + half] = (ar - tr) >> 1;
        im[start + offset + half] = (ai - ti) >> 1;
      }
    }
  }
  const bands = new Int32Array(CONTRACT.features);
  for (let band = 0; band < CONTRACT.features; band += 1) {
    const begin = 1 + Math.floor((band * 256) / CONTRACT.features);
    const end = 1 + Math.floor(((band + 1) * 256) / CONTRACT.features);
    let sum = 1;
    for (let bin = begin; bin < end; bin += 1) {
      sum += Math.abs(re[bin]) + Math.abs(im[bin]);
    }
    bands[band] = ilog2(sum);
  }
  for (let coefficient = 0; coefficient < CONTRACT.features; coefficient += 1) {
    let sum = 0;
    for (let band = 0; band < CONTRACT.features; band += 1) {
      sum += bands[band] * C.dctQ15[coefficient][band];
    }
    const value = sum >> C.quantization.mfccDctShift;
    output[coefficient] = value < -32768 ? -32768 : value > 32767 ? 32767 : value;
  }
}

function infer(hop, feature, context, depthwise, hidden, scores) {
  const slot = hop % CONTRACT.contextFrames;
  context.set(feature, slot * CONTRACT.features);
  for (let channel = 0; channel < CONTRACT.features; channel += 1) {
    let accumulator = C.depthwiseBiasI32[channel];
    for (let time = 0; time < CONTRACT.contextFrames; time += 1) {
      const sourceHop = hop - (CONTRACT.contextFrames - 1 - time);
      const value = sourceHop < 0
        ? 0
        : context[(sourceHop % CONTRACT.contextFrames) * CONTRACT.features + channel];
      accumulator += value * C.depthwiseWeightsI8[time * CONTRACT.features + channel];
    }
    depthwise[channel] = clampI8(accumulator >> C.quantization.depthwiseShift);
  }
  for (let channel = 0; channel < CONTRACT.hiddenChannels; channel += 1) {
    let accumulator = C.pointwiseBiasI32[channel];
    for (let featureIndex = 0; featureIndex < CONTRACT.features; featureIndex += 1) {
      accumulator += depthwise[featureIndex] *
        C.pointwiseWeightsI8[featureIndex * CONTRACT.hiddenChannels + channel];
    }
    accumulator >>= C.quantization.pointwiseShift;
    hidden[channel] = accumulator < 0 ? 0 : accumulator > 127 ? 127 : accumulator;
  }
  for (let classIndex = 0; classIndex < CONTRACT.classes; classIndex += 1) {
    let accumulator = C.outputBiasI32[classIndex];
    for (let channel = 0; channel < CONTRACT.hiddenChannels; channel += 1) {
      accumulator += hidden[channel] * C.outputWeightsI8[channel * CONTRACT.classes + classIndex];
    }
    scores[classIndex] = accumulator >> C.quantization.outputShift;
  }
}

export function exactCounters(target) {
  return {
    hops: 3000,
    windows: 3000,
    windowSamples: 960000,
    fftTransforms: 3000,
    fftButterflies: 3000 * 2304,
    spectralBins: 3000 * 256,
    mfccCoefficients: 3000 * 13,
    depthwiseMacs: 3000 * 3 * 13,
    pointwiseMacs: 3000 * 13 * 8,
    outputMacs: 3000 * 8 * 4,
    scoreElements: 3000 * 4,
    featureElements: 3000 * 13,
    inputBytes: 960000 * 2,
    outputBytes: 3000 * 13 * 2 + 3000 * 4 * 4,
    allocations: target === "javascript" ? 10 : 0,
    boundaryCrossings: target === "javascript" ? 0 : 2,
  };
}

export function runJavaScript(pcm) {
  validatePcm(pcm);
  const features = new Int16Array(CONTRACT.hops * CONTRACT.features);
  const scores = new Int32Array(CONTRACT.hops * CONTRACT.classes);
  const detections = [];
  const re = new Int32Array(CONTRACT.fftSize);
  const im = new Int32Array(CONTRACT.fftSize);
  const context = new Int16Array(CONTRACT.contextFrames * CONTRACT.features);
  const depthwise = new Int16Array(CONTRACT.features);
  const hidden = new Int16Array(CONTRACT.hiddenChannels);
  let previous = -1;
  for (let hop = 0; hop < CONTRACT.hops; hop += 1) {
    const feature = features.subarray(hop * CONTRACT.features, (hop + 1) * CONTRACT.features);
    const hopScores = scores.subarray(hop * CONTRACT.classes, (hop + 1) * CONTRACT.classes);
    computeFeature(pcm, hop, re, im, feature);
    infer(hop, feature, context, depthwise, hidden, hopScores);
    let best = 0;
    for (let classIndex = 1; classIndex < CONTRACT.classes; classIndex += 1) {
      if (hopScores[classIndex] > hopScores[best]) best = classIndex;
    }
    if (best !== 0 && best !== previous) detections.push(hop, best, hopScores[best]);
    previous = best;
  }
  return {
    target: "javascript",
    features,
    scores,
    detections: new Int32Array(detections),
    counters: exactCounters("javascript"),
  };
}

export async function instantiateWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const exports = instance.exports;
  for (
    const name of [
      "memory",
      "pcm_ptr",
      "features_ptr",
      "scores_ptr",
      "detections_ptr",
      "detection_count",
      "run",
    ]
  ) {
    if (!(name in exports)) throw new Error(`Wasm export missing: ${name}`);
  }
  return exports;
}

export function runWasm(exports, pcm) {
  validatePcm(pcm);
  const inputPtr = exports.pcm_ptr();
  new Int16Array(exports.memory.buffer, inputPtr, pcm.length).set(pcm);
  const detectionCount = exports.run();
  if (detectionCount !== exports.detection_count()) {
    throw new Error("Wasm detection count mismatch");
  }
  const features = new Int16Array(
    new Int16Array(
      exports.memory.buffer,
      exports.features_ptr(),
      CONTRACT.hops * CONTRACT.features,
    ),
  );
  const scores = new Int32Array(
    new Int32Array(exports.memory.buffer, exports.scores_ptr(), CONTRACT.hops * CONTRACT.classes),
  );
  const detections = new Int32Array(
    new Int32Array(exports.memory.buffer, exports.detections_ptr(), detectionCount * 3),
  );
  return {
    target: "wasm-linear",
    features,
    scores,
    detections,
    counters: exactCounters("wasm-linear"),
  };
}

export function assertEquivalent(js, wasm) {
  for (const key of ["features", "scores", "detections"]) {
    if (js[key].length !== wasm[key].length) throw new Error(`${key} length mismatch`);
    for (let index = 0; index < js[key].length; index += 1) {
      if (js[key][index] !== wasm[key][index]) {
        throw new Error(`${key} mismatch at ${index}: ${js[key][index]} != ${wasm[key][index]}`);
      }
    }
  }
  const sharedKeys = Object.keys(js.counters).filter((key) =>
    !["allocations", "boundaryCrossings"].includes(key)
  );
  for (const key of sharedKeys) {
    if (js.counters[key] !== wasm.counters[key]) throw new Error(`counter mismatch: ${key}`);
  }
  return true;
}

export function syntheticValidationPcm() {
  const pcm = new Int16Array(CONTRACT.samples);
  let state = 0x53435632;
  for (let index = 0; index < pcm.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const carrier = Math.round(
      Math.sin((2 * Math.PI * (220 + ((index / 16000) | 0) % 4 * 110) * index) / 16000) * 12000,
    );
    pcm[index] = Math.max(-32768, Math.min(32767, carrier + ((state >>> 20) - 2048)));
  }
  return pcm;
}

export async function sha256Hex(view) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
