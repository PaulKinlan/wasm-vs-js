import {
  type AlgorithmCounters,
  changedBounds,
  copyCounters,
  COUNTER_NAMES,
  type FloodResult,
  LINEAR_MEMORY_LAYOUT,
  type PipelineResult,
  presentationContract,
  RGBA_CHANNELS,
  validateRgba,
  validateSeed,
} from "./contract.ts";

interface ImageEditingExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  flood_fill: (width: number, height: number, seedX: number, seedY: number) => void;
  luma_gaussian_pipeline: (width: number, height: number) => void;
}

export interface ImageEditingWasmInstance {
  instance: WebAssembly.Instance;
  exports: ImageEditingExports;
}

export async function instantiateImageEditingWasm(
  bytes: BufferSource,
): Promise<ImageEditingWasmInstance> {
  const result = await WebAssembly.instantiate(bytes);
  const instance = result instanceof WebAssembly.Instance ? result : result.instance;
  const exports = instance.exports as ImageEditingExports;
  if (
    !(exports.memory instanceof WebAssembly.Memory) || typeof exports.flood_fill !== "function" ||
    typeof exports.luma_gaussian_pipeline !== "function"
  ) throw new Error("image-editing Wasm exports do not match the proposal contract");
  if (
    exports.memory.buffer.byteLength !== LINEAR_MEMORY_LAYOUT.initialPages * 65_536 ||
    LINEAR_MEMORY_LAYOUT.initialPages !== LINEAR_MEMORY_LAYOUT.maximumPages
  ) throw new Error("image-editing Wasm memory is not fixed at one page");
  return { instance, exports };
}

function readAlgorithmCounters(memory: WebAssembly.Memory): AlgorithmCounters {
  const view = new DataView(memory.buffer, LINEAR_MEMORY_LAYOUT.counters, COUNTER_NAMES.length * 4);
  const values = COUNTER_NAMES.map((_, index) => view.getUint32(index * 4, true));
  return {
    operations: values[0],
    readBytes: values[1],
    writeBytes: values[2],
    visitedPixels: values[3],
    changedPixels: values[4],
    neighborTests: values[5],
    stackPushes: values[6],
    stackPops: values[7],
    maxFrontier: values[8],
    allocations: 0,
    allocationBytes: 0,
    boundaryCrossings: 1,
  };
}

function memoryRegions(memory: WebAssembly.Memory, rgbaBytes: number, pixels: number) {
  return {
    source: new Uint8Array(memory.buffer, LINEAR_MEMORY_LAYOUT.source, rgbaBytes),
    output: new Uint8Array(memory.buffer, LINEAR_MEMORY_LAYOUT.output, rgbaBytes),
    mask: new Uint8Array(memory.buffer, LINEAR_MEMORY_LAYOUT.maskOrLuma, pixels),
  };
}

export function floodFillWasm(
  runtime: ImageEditingWasmInstance,
  fixture: Uint8Array,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
): FloodResult {
  validateRgba(fixture, width, height);
  validateSeed(width, height, seedX, seedY);
  const pixels = width * height;
  const regions = memoryRegions(runtime.exports.memory, fixture.byteLength, pixels);
  regions.source.set(fixture);
  regions.output.set(fixture);
  regions.mask.fill(0);
  const beforeBuffer = runtime.exports.memory.buffer;
  runtime.exports.flood_fill(width, height, seedX, seedY);
  if (runtime.exports.memory.buffer !== beforeBuffer) {
    throw new Error("unexpected Wasm memory growth");
  }
  const counters = readAlgorithmCounters(runtime.exports.memory);
  const output = regions.output.slice();
  const visitedMask = regions.mask.slice();
  const allocationBytes = output.byteLength + visitedMask.byteLength;
  const copy = copyCounters(fixture.byteLength, visitedMask.byteLength, true, allocationBytes, 2);
  copy.resetBytes += visitedMask.byteLength;
  copy.copiedBytes += visitedMask.byteLength;
  return {
    output,
    visitedMask,
    counters,
    phases: { copy, algorithm: counters, presentation: presentationContract(output.byteLength) },
    changedBounds: changedBounds(output, fixture, width, height),
  };
}

export function lumaGaussianPipelineWasm(
  runtime: ImageEditingWasmInstance,
  fixture: Uint8Array,
  width: number,
  height: number,
): PipelineResult {
  validateRgba(fixture, width, height);
  const pixels = width * height;
  const regions = memoryRegions(runtime.exports.memory, fixture.byteLength, pixels);
  regions.source.set(fixture);
  const beforeBuffer = runtime.exports.memory.buffer;
  runtime.exports.luma_gaussian_pipeline(width, height);
  if (runtime.exports.memory.buffer !== beforeBuffer) {
    throw new Error("unexpected Wasm memory growth");
  }
  const counters = readAlgorithmCounters(runtime.exports.memory);
  const output = regions.output.slice();
  const copy = copyCounters(fixture.byteLength, 0, false, output.byteLength, 1);
  return {
    output,
    counters,
    phases: { copy, algorithm: counters, presentation: presentationContract(output.byteLength) },
  };
}

export function rgbaPixel(output: Uint8Array, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * RGBA_CHANNELS;
  return [...output.subarray(offset, offset + RGBA_CHANNELS)];
}
