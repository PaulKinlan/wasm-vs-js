export const FLOOD_REPLACEMENT = [34, 139, 230, 191];
export const FLOOD_THRESHOLD = 12;

const RGBA_CHANNELS = 4;
const LAYOUT = {
  source: 0,
  output: 16_384,
  maskOrLuma: 32_768,
  counters: 49_152,
  capacityPixels: 3_072,
};
const COUNTER_NAMES = [
  "operations",
  "readBytes",
  "writeBytes",
  "visitedPixels",
  "changedPixels",
  "neighborTests",
  "stackPushes",
  "stackPops",
  "maxFrontier",
];

function validateRgba(source, width, height) {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw new Error("width and height must be positive safe integers");
  }
  if (width * height > LAYOUT.capacityPixels) throw new Error("fixture exceeds demo capacity");
  if (source.byteLength !== width * height * RGBA_CHANNELS) {
    throw new Error("RGBA byte length mismatch");
  }
}

function emptyCounters() {
  return {
    operations: 0,
    readBytes: 0,
    writeBytes: 0,
    visitedPixels: 0,
    changedPixels: 0,
    neighborTests: 0,
    stackPushes: 0,
    stackPops: 0,
    maxFrontier: 0,
    allocations: 0,
    allocationBytes: 0,
    boundaryCrossings: 1,
  };
}

function bounds(output, source, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * RGBA_CHANNELS;
      if (
        output[offset] !== source[offset] || output[offset + 1] !== source[offset + 1] ||
        output[offset + 2] !== source[offset + 2] || output[offset + 3] !== source[offset + 3]
      ) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function absoluteDifference(left, right) {
  return left >= right ? left - right : right - left;
}

function inFloodRange(source, offset, seed) {
  let maximum = absoluteDifference(source[offset], seed[0]);
  maximum = Math.max(maximum, absoluteDifference(source[offset + 1], seed[1]));
  maximum = Math.max(maximum, absoluteDifference(source[offset + 2], seed[2]));
  maximum = Math.max(maximum, absoluteDifference(source[offset + 3], seed[3]));
  return maximum <= FLOOD_THRESHOLD;
}

export function floodFillJavaScript(fixture, width, height, seedX, seedY) {
  validateRgba(fixture, width, height);
  if (seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) {
    throw new Error("seed is outside the image");
  }
  const pixelCount = width * height;
  const source = new Uint8Array(fixture);
  const output = new Uint8Array(source);
  const visitedMask = new Uint8Array(pixelCount);
  const stack = new Uint32Array(pixelCount);
  const counters = emptyCounters();
  const seedIndex = seedY * width + seedX;
  const seedOffset = seedIndex * RGBA_CHANNELS;
  const seed = source.slice(seedOffset, seedOffset + RGBA_CHANNELS);
  counters.readBytes += RGBA_CHANNELS;
  counters.operations += RGBA_CHANNELS;

  let stackSize = 0;
  const push = (index) => {
    visitedMask[index] = 1;
    stack[stackSize] = index;
    stackSize += 1;
    counters.stackPushes += 1;
    counters.writeBytes += 5;
    counters.maxFrontier = Math.max(counters.maxFrontier, stackSize);
  };
  const tryPush = (index) => {
    counters.neighborTests += 1;
    counters.operations += 1;
    counters.readBytes += 1;
    if (visitedMask[index] === 0) push(index);
  };

  push(seedIndex);
  while (stackSize > 0) {
    stackSize -= 1;
    const index = stack[stackSize];
    counters.stackPops += 1;
    counters.visitedPixels += 1;
    counters.readBytes += 4;
    const offset = index * RGBA_CHANNELS;
    counters.readBytes += RGBA_CHANNELS;
    counters.operations += 8;
    if (!inFloodRange(source, offset, seed)) continue;

    output.set(FLOOD_REPLACEMENT, offset);
    counters.changedPixels += 1;
    counters.writeBytes += RGBA_CHANNELS;
    const x = index % width;
    const y = Math.floor(index / width);
    if (y > 0) tryPush(index - width);
    if (x + 1 < width) tryPush(index + 1);
    if (y + 1 < height) tryPush(index + width);
    if (x > 0) tryPush(index - 1);
  }
  return { output, visitedMask, changedBounds: bounds(output, source, width, height), counters };
}

function clampedCoordinate(value, maximum) {
  return Math.max(0, Math.min(maximum, value));
}

export function lumaGaussianPipelineJavaScript(fixture, width, height) {
  validateRgba(fixture, width, height);
  const pixelCount = width * height;
  const source = new Uint8Array(fixture);
  const output = new Uint8Array(source.byteLength);
  const luma = new Uint8Array(pixelCount);
  const horizontal = new Uint16Array(pixelCount);
  const counters = emptyCounters();
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * RGBA_CHANNELS;
    luma[index] = (77 * source[offset] + 150 * source[offset + 1] + 29 * source[offset + 2] +
      128) >>> 8;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = y * width + clampedCoordinate(x - 1, width - 1);
      const center = y * width + x;
      const right = y * width + clampedCoordinate(x + 1, width - 1);
      horizontal[center] = luma[left] + 2 * luma[center] + luma[right];
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const top = clampedCoordinate(y - 1, height - 1) * width + x;
      const center = y * width + x;
      const bottom = clampedCoordinate(y + 1, height - 1) * width + x;
      const gray = (horizontal[top] + 2 * horizontal[center] + horizontal[bottom] + 8) >>> 4;
      const offset = center * RGBA_CHANNELS;
      output[offset] = gray;
      output[offset + 1] = gray;
      output[offset + 2] = gray;
      output[offset + 3] = source[offset + 3];
    }
  }
  counters.operations = pixelCount * 19;
  counters.readBytes = pixelCount * 13;
  counters.writeBytes = pixelCount * 7;
  counters.visitedPixels = pixelCount;
  return { output, counters };
}

export async function instantiateImageEditingWasm(bytes) {
  const result = await WebAssembly.instantiate(bytes);
  const instance = result instanceof WebAssembly.Instance ? result : result.instance;
  const exports = instance.exports;
  if (
    !(exports.memory instanceof WebAssembly.Memory) || typeof exports.flood_fill !== "function" ||
    typeof exports.luma_gaussian_pipeline !== "function" ||
    exports.memory.buffer.byteLength !== 65_536
  ) throw new Error("image-editing Wasm exports do not match the demo contract");
  return exports;
}

function readCounters(memory) {
  const view = new DataView(memory.buffer, LAYOUT.counters, COUNTER_NAMES.length * 4);
  const values = COUNTER_NAMES.map((_, index) => view.getUint32(index * 4, true));
  return Object.fromEntries([
    ...COUNTER_NAMES.map((name, index) => [name, values[index]]),
    ["allocations", 0],
    ["allocationBytes", 0],
    ["boundaryCrossings", 1],
  ]);
}

export function floodFillWasm(exports, fixture, width, height, seedX, seedY) {
  validateRgba(fixture, width, height);
  const pixels = width * height;
  const source = new Uint8Array(exports.memory.buffer, LAYOUT.source, fixture.byteLength);
  const outputRegion = new Uint8Array(exports.memory.buffer, LAYOUT.output, fixture.byteLength);
  const maskRegion = new Uint8Array(exports.memory.buffer, LAYOUT.maskOrLuma, pixels);
  source.set(fixture);
  outputRegion.set(fixture);
  maskRegion.fill(0);
  const before = exports.memory.buffer;
  exports.flood_fill(width, height, seedX, seedY);
  if (exports.memory.buffer !== before) throw new Error("unexpected Wasm memory growth");
  const output = outputRegion.slice();
  return {
    output,
    visitedMask: maskRegion.slice(),
    changedBounds: bounds(output, fixture, width, height),
    counters: readCounters(exports.memory),
  };
}

export function lumaGaussianPipelineWasm(exports, fixture, width, height) {
  validateRgba(fixture, width, height);
  new Uint8Array(exports.memory.buffer, LAYOUT.source, fixture.byteLength).set(fixture);
  const before = exports.memory.buffer;
  exports.luma_gaussian_pipeline(width, height);
  if (exports.memory.buffer !== before) throw new Error("unexpected Wasm memory growth");
  return {
    output: new Uint8Array(exports.memory.buffer, LAYOUT.output, fixture.byteLength).slice(),
    counters: readCounters(exports.memory),
  };
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
