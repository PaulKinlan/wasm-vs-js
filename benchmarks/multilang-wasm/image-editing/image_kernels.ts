// image-editing multilang kernels (AssemblyScript) — exact mirror of the
// pinned proposal WAT (benchmarks/image-editing/image-editing.wat) and
// image_kernels.c. Fixed one-page layout (bytes): source = 0, output = 16384,
// visited/luma = 32768, stack/horizontal = 36864, nine u32 counters = 49152.
// Integer-only; raw linear-memory loads/stores like sum_u32.ts/fft_kernel.ts.

const SRC: usize = 0;
const OUT: usize = 16384;
const MASK_LUMA: usize = 32768;
const STACK_HORIZ: usize = 36864;
const COUNTERS: usize = 49152;
const FLOOD_THRESHOLD: u32 = 12;

let gOperations: u32 = 0;
let gReadBytes: u32 = 0;
let gWriteBytes: u32 = 0;
let gVisitedPixels: u32 = 0;
let gChangedPixels: u32 = 0;
let gNeighborTests: u32 = 0;
let gStackPushes: u32 = 0;
let gStackPops: u32 = 0;
let gMaxFrontier: u32 = 0;
let gStackSize: u32 = 0;

function resetCounters(): void {
  gStackSize = 0;
  gOperations = 0;
  gReadBytes = 0;
  gWriteBytes = 0;
  gVisitedPixels = 0;
  gChangedPixels = 0;
  gNeighborTests = 0;
  gStackPushes = 0;
  gStackPops = 0;
  gMaxFrontier = 0;
}

function writeCounters(): void {
  store<u32>(COUNTERS, gOperations);
  store<u32>(COUNTERS + 4, gReadBytes);
  store<u32>(COUNTERS + 8, gWriteBytes);
  store<u32>(COUNTERS + 12, gVisitedPixels);
  store<u32>(COUNTERS + 16, gChangedPixels);
  store<u32>(COUNTERS + 20, gNeighborTests);
  store<u32>(COUNTERS + 24, gStackPushes);
  store<u32>(COUNTERS + 28, gStackPops);
  store<u32>(COUNTERS + 32, gMaxFrontier);
}

function absdiff(left: u32, right: u32): u32 {
  return left >= right ? left - right : right - left;
}

function push(index: u32): void {
  store<u8>(MASK_LUMA + index, 1);
  store<u32>(STACK_HORIZ + gStackSize * 4, index);
  gStackSize += 1;
  gStackPushes += 1;
  gWriteBytes += 5;
  if (gStackSize > gMaxFrontier) gMaxFrontier = gStackSize;
}

function tryPush(index: u32): void {
  gNeighborTests += 1;
  gOperations += 1;
  gReadBytes += 1;
  if (load<u8>(MASK_LUMA + index) == 0) push(index);
}

export function flood_fill(width: u32, height: u32, seedX: u32, seedY: u32): void {
  resetCounters();
  const seedIndex = seedY * width + seedX;
  const seedOffset = seedIndex * 4;
  const seedR = load<u8>(SRC + seedOffset) as u32;
  const seedG = load<u8>(SRC + seedOffset + 1) as u32;
  const seedB = load<u8>(SRC + seedOffset + 2) as u32;
  const seedA = load<u8>(SRC + seedOffset + 3) as u32;
  gReadBytes = 4;
  gOperations = 4;

  if (seedR == 34 && seedG == 139 && seedB == 230 && seedA == 191) {
    writeCounters();
    return;
  }

  push(seedIndex);
  while (gStackSize != 0) {
    gStackSize -= 1;
    const index = load<u32>(STACK_HORIZ + gStackSize * 4);
    gStackPops += 1;
    gVisitedPixels += 1;
    gReadBytes += 8;
    const offset = index * 4;

    let maximum = absdiff(load<u8>(SRC + offset) as u32, seedR);
    let difference = absdiff(load<u8>(SRC + offset + 1) as u32, seedG);
    if (difference > maximum) maximum = difference;
    difference = absdiff(load<u8>(SRC + offset + 2) as u32, seedB);
    if (difference > maximum) maximum = difference;
    difference = absdiff(load<u8>(SRC + offset + 3) as u32, seedA);
    if (difference > maximum) maximum = difference;
    gOperations += 8;

    if (maximum <= FLOOD_THRESHOLD) {
      store<u8>(OUT + offset, 34);
      store<u8>(OUT + offset + 1, 139);
      store<u8>(OUT + offset + 2, 230);
      store<u8>(OUT + offset + 3, 191);
      gChangedPixels += 1;
      gWriteBytes += 4;

      const x = index % width;
      const y = index / width;
      if (y > 0) tryPush(index - width);
      if (x + 1 < width) tryPush(index + 1);
      if (y + 1 < height) tryPush(index + width);
      if (x > 0) tryPush(index - 1);
    }
  }
  writeCounters();
}

export function luma_gaussian_pipeline(width: u32, height: u32): void {
  resetCounters();
  const pixels = width * height;

  // Integer luma: (77R + 150G + 29B + 128) >> 8.
  for (let index: u32 = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const value = (77 * (load<u8>(SRC + offset) as u32) +
      150 * (load<u8>(SRC + offset + 1) as u32) +
      29 * (load<u8>(SRC + offset + 2) as u32) + 128) >> 8;
    store<u8>(MASK_LUMA + index, value as u8);
  }

  for (let index: u32 = 0; index < pixels; index += 1) {
    const x = index % width;
    const left = x == 0 ? index : index - 1;
    const right = x + 1 >= width ? index : index + 1;
    const value = (load<u8>(MASK_LUMA + left) as u16) +
      2 * (load<u8>(MASK_LUMA + index) as u16) +
      (load<u8>(MASK_LUMA + right) as u16);
    store<u16>(STACK_HORIZ + index * 2, value);
  }

  for (let index: u32 = 0; index < pixels; index += 1) {
    const y = index / width;
    const top = y == 0 ? index : index - width;
    const bottom = y + 1 >= height ? index : index + width;
    const value = ((load<u16>(STACK_HORIZ + top * 2) as u32) +
      2 * (load<u16>(STACK_HORIZ + index * 2) as u32) +
      (load<u16>(STACK_HORIZ + bottom * 2) as u32) + 8) >> 4;
    const offset = index * 4;
    store<u8>(OUT + offset, value as u8);
    store<u8>(OUT + offset + 1, value as u8);
    store<u8>(OUT + offset + 2, value as u8);
    store<u8>(OUT + offset + 3, load<u8>(SRC + offset + 3));
  }

  gOperations = pixels * 19;
  gReadBytes = pixels * 13;
  gWriteBytes = pixels * 7;
  gVisitedPixels = pixels;
  writeCounters();
}
