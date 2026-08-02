export const RGBA_CHANNELS = 4;
export const FLOOD_THRESHOLD = 12;
export const FLOOD_REPLACEMENT = [34, 139, 230, 191] as const;
export const FLOOD_CONNECTIVITY = 4;

export const LINEAR_MEMORY_LAYOUT = {
  initialPages: 1,
  maximumPages: 1,
  source: 0,
  output: 16_384,
  maskOrLuma: 32_768,
  stackOrHorizontal: 36_864,
  counters: 49_152,
  capacityPixels: 3_072,
  capacityRgbaBytes: 12_288,
} as const;

export const COUNTER_NAMES = [
  "operations",
  "readBytes",
  "writeBytes",
  "visitedPixels",
  "changedPixels",
  "neighborTests",
  "stackPushes",
  "stackPops",
  "maxFrontier",
] as const;

export interface AlgorithmCounters {
  operations: number;
  readBytes: number;
  writeBytes: number;
  visitedPixels: number;
  changedPixels: number;
  neighborTests: number;
  stackPushes: number;
  stackPops: number;
  maxFrontier: number;
  allocations: number;
  allocationBytes: number;
  boundaryCrossings: number;
}

export interface CopyCounters {
  ingressBytes: number;
  resetBytes: number;
  egressBytes: number;
  maskEgressBytes: number;
  copiedBytes: number;
  allocations: number;
  allocationBytes: number;
  boundaryCrossings: number;
}

export interface PresentationContract {
  status: "not-run-proposal-contract";
  uploadBytes: number;
  uploadCalls: 1;
  proxyCallbacks: 2;
  allocations: 0;
  allocationBytes: 0;
  boundaryCrossings: 0;
  reason: string;
}

export interface PhaseContract {
  copy: CopyCounters;
  algorithm: AlgorithmCounters;
  presentation: PresentationContract;
}

export interface FloodResult {
  output: Uint8Array;
  visitedMask: Uint8Array;
  counters: AlgorithmCounters;
  phases: PhaseContract;
  changedBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

export interface PipelineResult {
  output: Uint8Array;
  counters: AlgorithmCounters;
  phases: PhaseContract;
}

export function validateRgba(source: Uint8Array, width: number, height: number): void {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw new Error("width and height must be positive safe integers");
  }
  const pixels = width * height;
  if (pixels > LINEAR_MEMORY_LAYOUT.capacityPixels) throw new Error("fixture exceeds v1 capacity");
  if (source.byteLength !== pixels * RGBA_CHANNELS) throw new Error("RGBA byte length mismatch");
}

export function validateSeed(width: number, height: number, seedX: number, seedY: number): void {
  if (
    !Number.isSafeInteger(seedX) || !Number.isSafeInteger(seedY) || seedX < 0 || seedY < 0 ||
    seedX >= width || seedY >= height
  ) throw new Error("seed is outside the image");
}

export function emptyAlgorithmCounters(): AlgorithmCounters {
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

export function copyCounters(
  rgbaBytes: number,
  maskBytes: number,
  resetOutput: boolean,
  allocationBytes: number,
  allocations: number,
): CopyCounters {
  const resetBytes = resetOutput ? rgbaBytes : 0;
  return {
    ingressBytes: rgbaBytes,
    resetBytes,
    egressBytes: rgbaBytes,
    maskEgressBytes: maskBytes,
    copiedBytes: rgbaBytes + resetBytes + rgbaBytes + maskBytes,
    allocations,
    allocationBytes,
    boundaryCrossings: 2,
  };
}

export function presentationContract(outputBytes: number): PresentationContract {
  return {
    status: "not-run-proposal-contract",
    uploadBytes: outputBytes,
    uploadCalls: 1,
    proxyCallbacks: 2,
    allocations: 0,
    allocationBytes: 0,
    boundaryCrossings: 0,
    reason:
      "Canvas upload and the requestAnimationFrame-plus-task presentation proxy are declared but not executed or timed in this proposal shard.",
  };
}

export function changedBounds(
  output: Uint8Array,
  source: Uint8Array,
  width: number,
  height: number,
): FloodResult["changedBounds"] {
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
