import C from "./constants.v1.js";

export const CONTRACT = Object.freeze({
  workloadId: "ml.keyword-spotting.v1",
  sampleRate: 16000,
  seconds: 60,
  samples: 960000,
  hopSamples: 320,
  hops: 3000,
  windowSamples: 480,
  fftSize: 512,
  features: 10,
  contextFrames: 49,
  hiddenChannels: 8,
  classes: 12,
  spatialRows: 25,
  spatialColumns: 5,
  algorithmFamily: "dscnn-fixed-preprocess-model",
  preprocessing:
    "PCM16LE -> 480-sample Hann Q15 -> radix-2 FFT Q15 -> 10 log bands -> DCT Q15 -> trained lookup normalization",
  model:
    "trained quantized DS-CNN: 10x4 stride-2 Conv2D, four 3x3 depthwise + 1x1 pointwise blocks, global average, 12 logits",
});

const LAYERS = Object.fromEntries(C.layers.map((layer) => [layer.name, layer]));
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
function clampI8(value, relu = false) {
  const low = relu ? 0 : -128;
  return value < low ? low : value > 127 ? 127 : value;
}
function roundDivide(value, divisor) {
  return value >= 0
    ? Math.floor((value + divisor / 2) / divisor)
    : -Math.floor((-value + divisor / 2) / divisor);
}
function requantize(accumulator, multiplierQ24, relu) {
  return clampI8(roundDivide(accumulator * multiplierQ24, 16777216), relu);
}
function validatePcm(pcm) {
  if (!(pcm instanceof Int16Array) || pcm.length !== CONTRACT.samples) {
    throw new RangeError(`expected exactly ${CONTRACT.samples} signed PCM16 samples`);
  }
}
function computeFeature(pcm, hop, re, im, bands, output) {
  const base = hop * CONTRACT.hopSamples;
  for (let index = 0; index < CONTRACT.fftSize; index += 1) {
    const source = base + index;
    re[index] = index < CONTRACT.windowSamples && source < pcm.length
      ? (Math.imul(pcm[source], C.windowQ15[index]) >> 15)
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
  for (let band = 0; band < CONTRACT.features; band += 1) {
    const begin = 1 + Math.floor((band * 256) / CONTRACT.features);
    const end = 1 + Math.floor(((band + 1) * 256) / CONTRACT.features);
    let sum = 1;
    for (let bin = begin; bin < end; bin += 1) sum += Math.abs(re[bin]) + Math.abs(im[bin]);
    bands[band] = ilog2(sum);
  }
  const outputOffset = hop * CONTRACT.features;
  for (let coefficient = 0; coefficient < CONTRACT.features; coefficient += 1) {
    let sum = 0;
    for (let band = 0; band < CONTRACT.features; band += 1) {
      sum += bands[band] * C.dctQ15[coefficient][band];
    }
    const raw = clampI8(sum >> 13);
    output[outputOffset + coefficient] = C.normalizationLookupI8[coefficient][raw + 128];
  }
}
function modelInput(context, hop, row, column) {
  if (row < 0 || row >= CONTRACT.contextFrames || column < 0 || column >= CONTRACT.features) {
    return 0;
  }
  const sourceHop = hop - (CONTRACT.contextFrames - 1 - row);
  return sourceHop < 0
    ? 0
    : context[(sourceHop % CONTRACT.contextFrames) * CONTRACT.features + column];
}
function infer(hop, features, context, layerA, layerB, scores) {
  const featureOffset = hop * CONTRACT.features;
  const contextOffset = (hop % CONTRACT.contextFrames) * CONTRACT.features;
  for (let feature = 0; feature < CONTRACT.features; feature += 1) {
    context[contextOffset + feature] = features[featureOffset + feature];
  }
  const conv = LAYERS.conv0;
  for (let row = 0; row < 25; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      for (let outputChannel = 0; outputChannel < 8; outputChannel += 1) {
        let accumulator = conv.biases[outputChannel];
        const weightBase = outputChannel * 40;
        for (let kernelRow = 0; kernelRow < 10; kernelRow += 1) {
          for (let kernelColumn = 0; kernelColumn < 4; kernelColumn += 1) {
            accumulator += modelInput(
              context,
              hop,
              row * 2 + kernelRow - 4,
              column * 2 + kernelColumn - 1,
            ) * conv.weights[weightBase + kernelRow * 4 + kernelColumn];
          }
        }
        layerA[(row * 5 + column) * 8 + outputChannel] = requantize(
          accumulator,
          conv.multiplierQ24,
          true,
        );
      }
    }
  }
  const input = layerA;
  const output = layerB;
  for (let block = 0; block < 4; block += 1) {
    const depthwise = LAYERS[`dw${block}`];
    for (let row = 0; row < 25; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        for (let channel = 0; channel < 8; channel += 1) {
          let accumulator = depthwise.biases[channel];
          for (let kernelRow = 0; kernelRow < 3; kernelRow += 1) {
            const sourceRow = row + kernelRow - 1;
            for (let kernelColumn = 0; kernelColumn < 3; kernelColumn += 1) {
              const sourceColumn = column + kernelColumn - 1;
              if (sourceRow >= 0 && sourceRow < 25 && sourceColumn >= 0 && sourceColumn < 5) {
                accumulator += input[(sourceRow * 5 + sourceColumn) * 8 + channel] *
                  depthwise.weights[channel * 9 + kernelRow * 3 + kernelColumn];
              }
            }
          }
          output[(row * 5 + column) * 8 + channel] = requantize(
            accumulator,
            depthwise.multiplierQ24,
            false,
          );
        }
      }
    }
    const pointwise = LAYERS[`pw${block}`];
    for (let element = 0; element < 125; element += 1) {
      for (let outputChannel = 0; outputChannel < 8; outputChannel += 1) {
        let accumulator = pointwise.biases[outputChannel];
        for (let inputChannel = 0; inputChannel < 8; inputChannel += 1) {
          accumulator += output[element * 8 + inputChannel] *
            pointwise.weights[outputChannel * 8 + inputChannel];
        }
        input[element * 8 + outputChannel] = requantize(
          accumulator,
          pointwise.multiplierQ24,
          true,
        );
      }
    }
  }
  const dense = LAYERS.dense;
  const scoreOffset = hop * CONTRACT.classes;
  for (let classIndex = 0; classIndex < CONTRACT.classes; classIndex += 1) {
    let accumulator = dense.biases[classIndex];
    for (let channel = 0; channel < 8; channel += 1) {
      let sum = 0;
      for (let element = 0; element < 125; element += 1) sum += input[element * 8 + channel];
      accumulator += roundDivide(sum, 125) * dense.weights[classIndex * 8 + channel];
    }
    scores[scoreOffset + classIndex] = accumulator;
  }
}
export function extractOneSecondTrainingFeatures(pcm) {
  if (!(pcm instanceof Int16Array) || pcm.length !== CONTRACT.sampleRate) {
    throw new RangeError("training clip must contain exactly 16000 PCM16 samples");
  }
  const features = new Int8Array(49 * CONTRACT.features);
  const re = new Int32Array(CONTRACT.fftSize);
  const im = new Int32Array(CONTRACT.fftSize);
  const bands = new Int32Array(CONTRACT.features);
  for (let hop = 0; hop < 49; hop += 1) computeFeature(pcm, hop, re, im, bands, features);
  return features;
}

export function exactCounters(target) {
  const counters = {
    hops: 3000,
    windows: 3000,
    windowSamples: 1440000,
    fftTransforms: 3000,
    fftButterflies: 3000 * 2304,
    spectralBins: 3000 * 256,
    mfccCoefficients: 3000 * 10,
    conv2dMacs: 3000 * 25 * 5 * 8 * 10 * 4,
    depthwiseMacs: 3000 * 4 * 25 * 5 * 8 * 9,
    pointwiseMacs: 3000 * 4 * 25 * 5 * 8 * 8,
    poolingAdds: 3000 * 25 * 5 * 8,
    outputMacs: 3000 * 8 * 12,
    scoreElements: 3000 * 12,
    featureElements: 3000 * 10,
    inputBytes: 960000 * 2,
    outputBytes: 3000 * 10 + 3000 * 12 * 4,
  };
  if (target === "javascript") counters.javascriptEngineOwnedTypedArrayConstructions = 10;
  if (target === "wasm-linear") counters.wasmExportCalls = 6;
  return counters;
}
export function runJavaScript(pcm) {
  validatePcm(pcm);
  const features = new Int8Array(CONTRACT.hops * CONTRACT.features);
  const scores = new Int32Array(CONTRACT.hops * CONTRACT.classes);
  const re = new Int32Array(CONTRACT.fftSize);
  const im = new Int32Array(CONTRACT.fftSize);
  const bands = new Int32Array(CONTRACT.features);
  const context = new Int8Array(CONTRACT.contextFrames * CONTRACT.features);
  const layerA = new Int8Array(25 * 5 * 8);
  const layerB = new Int8Array(25 * 5 * 8);
  const detectionScratch = new Int32Array(CONTRACT.hops * 3);
  let detectionElements = 0;
  let accepted = 10;
  let candidate = 10;
  let candidateCount = 0;
  for (let hop = 0; hop < CONTRACT.hops; hop += 1) {
    computeFeature(pcm, hop, re, im, bands, features);
    infer(hop, features, context, layerA, layerB, scores);
    const scoreOffset = hop * CONTRACT.classes;
    let best = 0;
    for (let classIndex = 1; classIndex < CONTRACT.classes; classIndex += 1) {
      if (scores[scoreOffset + classIndex] > scores[scoreOffset + best]) best = classIndex;
    }
    if (best === candidate) candidateCount += 1;
    else {
      candidate = best;
      candidateCount = 1;
    }
    if (candidateCount === 5 && candidate !== accepted) {
      accepted = candidate;
      if (accepted !== 10) {
        detectionScratch[detectionElements++] = hop;
        detectionScratch[detectionElements++] = accepted;
        detectionScratch[detectionElements++] = scores[scoreOffset + accepted];
      }
    }
  }
  const detections = detectionScratch.slice(0, detectionElements);
  const counters = exactCounters("javascript");
  counters.detectionElements = detections.length;
  counters.outputBytes += detections.byteLength;
  return { target: "javascript", features, scores, detections, counters };
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
  const features = new Int8Array(
    new Int8Array(exports.memory.buffer, exports.features_ptr(), CONTRACT.hops * CONTRACT.features),
  );
  const scores = new Int32Array(
    new Int32Array(exports.memory.buffer, exports.scores_ptr(), CONTRACT.hops * CONTRACT.classes),
  );
  const detections = new Int32Array(
    new Int32Array(exports.memory.buffer, exports.detections_ptr(), detectionCount * 3),
  );
  const counters = exactCounters("wasm-linear");
  counters.detectionElements = detections.length;
  counters.outputBytes += detections.byteLength;
  return { target: "wasm-linear", features, scores, detections, counters };
}
export function assertEquivalent(js, wasm) {
  for (const key of ["features", "scores", "detections"]) {
    if (js[key].length !== wasm[key].length) throw new Error(`${key} length mismatch`);
    for (let index = 0; index < js[key].length; index += 1) {
      if (js[key][index] !== wasm[key][index]) throw new Error(`${key} mismatch at ${index}`);
    }
  }
  for (const key of Object.keys(js.counters)) {
    if (key === "javascriptEngineOwnedTypedArrayConstructions") continue;
    if (key in wasm.counters && js.counters[key] !== wasm.counters[key]) {
      throw new Error(`counter mismatch: ${key}`);
    }
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
      Math.sin((2 * Math.PI * (220 + (((index / 16000) | 0) % 4) * 110) * index) / 16000) * 12000,
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
