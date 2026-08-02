import {
  changedBounds,
  copyCounters,
  emptyAlgorithmCounters,
  FLOOD_REPLACEMENT,
  FLOOD_THRESHOLD,
  type FloodResult,
  type PipelineResult,
  presentationContract,
  RGBA_CHANNELS,
  validateRgba,
  validateSeed,
} from "./contract.ts";

function absoluteDifference(left: number, right: number): number {
  return left >= right ? left - right : right - left;
}

function inFloodRange(source: Uint8Array, offset: number, seed: readonly number[]): boolean {
  let maximum = absoluteDifference(source[offset], seed[0]);
  maximum = Math.max(maximum, absoluteDifference(source[offset + 1], seed[1]));
  maximum = Math.max(maximum, absoluteDifference(source[offset + 2], seed[2]));
  maximum = Math.max(maximum, absoluteDifference(source[offset + 3], seed[3]));
  return maximum <= FLOOD_THRESHOLD;
}

export function floodFillJavaScript(
  fixture: Uint8Array,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
): FloodResult {
  validateRgba(fixture, width, height);
  validateSeed(width, height, seedX, seedY);
  const pixelCount = width * height;
  const source = new Uint8Array(fixture);
  const output = new Uint8Array(pixelCount * RGBA_CHANNELS);
  output.set(source);
  const visited = new Uint8Array(pixelCount);
  const stack = new Uint32Array(pixelCount);
  const counters = emptyAlgorithmCounters();
  const seedIndex = seedY * width + seedX;
  const seedOffset = seedIndex * RGBA_CHANNELS;
  const seed = [
    source[seedOffset],
    source[seedOffset + 1],
    source[seedOffset + 2],
    source[seedOffset + 3],
  ] as const;
  counters.readBytes += RGBA_CHANNELS;
  counters.operations += RGBA_CHANNELS;

  if (seed.every((channel, index) => channel === FLOOD_REPLACEMENT[index])) {
    const resultOutput = output.slice();
    const resultMask = visited.slice();
    const allocationBytes = source.byteLength + output.byteLength + visited.byteLength +
      stack.byteLength + resultOutput.byteLength + resultMask.byteLength;
    const copy = copyCounters(source.byteLength, visited.byteLength, true, allocationBytes, 6);
    copy.resetBytes += visited.byteLength;
    copy.copiedBytes += visited.byteLength;
    return {
      output: resultOutput,
      visitedMask: resultMask,
      counters,
      phases: { copy, algorithm: counters, presentation: presentationContract(output.byteLength) },
      changedBounds: null,
    };
  }

  let stackSize = 0;
  const push = (index: number): void => {
    visited[index] = 1;
    stack[stackSize] = index;
    stackSize += 1;
    counters.stackPushes += 1;
    counters.writeBytes += 5;
    counters.maxFrontier = Math.max(counters.maxFrontier, stackSize);
  };
  const tryPush = (index: number): void => {
    counters.neighborTests += 1;
    counters.operations += 1;
    counters.readBytes += 1;
    if (visited[index] === 0) push(index);
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

    output[offset] = FLOOD_REPLACEMENT[0];
    output[offset + 1] = FLOOD_REPLACEMENT[1];
    output[offset + 2] = FLOOD_REPLACEMENT[2];
    output[offset + 3] = FLOOD_REPLACEMENT[3];
    counters.changedPixels += 1;
    counters.writeBytes += RGBA_CHANNELS;

    const x = index % width;
    const y = Math.floor(index / width);
    // Fixed N, E, S, W push order. The LIFO stack visits these in reverse order.
    if (y > 0) tryPush(index - width);
    if (x + 1 < width) tryPush(index + 1);
    if (y + 1 < height) tryPush(index + width);
    if (x > 0) tryPush(index - 1);
  }

  const resultOutput = output.slice();
  const resultMask = visited.slice();
  const allocationBytes = source.byteLength + output.byteLength + visited.byteLength +
    stack.byteLength + resultOutput.byteLength + resultMask.byteLength;
  const copy = copyCounters(source.byteLength, visited.byteLength, true, allocationBytes, 6);
  copy.resetBytes += visited.byteLength;
  copy.copiedBytes += visited.byteLength;
  return {
    output: resultOutput,
    visitedMask: resultMask,
    counters,
    phases: { copy, algorithm: counters, presentation: presentationContract(output.byteLength) },
    changedBounds: changedBounds(resultOutput, source, width, height),
  };
}

function clampedCoordinate(value: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, value));
}

export function lumaGaussianPipelineJavaScript(
  fixture: Uint8Array,
  width: number,
  height: number,
): PipelineResult {
  validateRgba(fixture, width, height);
  const pixelCount = width * height;
  const source = new Uint8Array(fixture);
  const output = new Uint8Array(source.byteLength);
  const luma = new Uint8Array(pixelCount);
  const horizontal = new Uint16Array(pixelCount);
  const counters = emptyAlgorithmCounters();

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
  const resultOutput = output.slice();
  const allocationBytes = source.byteLength + output.byteLength + luma.byteLength +
    horizontal.byteLength + resultOutput.byteLength;
  const copy = copyCounters(source.byteLength, 0, false, allocationBytes, 5);
  return {
    output: resultOutput,
    counters,
    phases: { copy, algorithm: counters, presentation: presentationContract(output.byteLength) },
  };
}
