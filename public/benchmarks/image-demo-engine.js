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
