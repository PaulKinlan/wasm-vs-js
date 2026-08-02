import { sha256Hex } from "../../lib/canonical.ts";

export const PIXEL_STRIDE = 4;
export const FLOOD_FIXTURE = {
  id: "generated-map-64x48",
  width: 64,
  height: 48,
  seed: 0x34c2a91d,
} as const;
export const PIPELINE_FIXTURE = {
  id: "generated-photo-40x30",
  width: 40,
  height: 30,
  seed: 0x8f31d4c7,
} as const;

function assertDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw new Error("fixture dimensions must be positive safe integers");
  }
}

function pixelOffset(width: number, x: number, y: number): number {
  return (y * width + x) * PIXEL_STRIDE;
}

function setPixel(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  const offset = pixelOffset(width, x, y);
  rgba[offset] = red;
  rgba[offset + 1] = green;
  rgba[offset + 2] = blue;
  rgba[offset + 3] = alpha;
}

function nextXorshift32(state: number): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function generateFloodFixture(
  width = FLOOD_FIXTURE.width,
  height = FLOOD_FIXTURE.height,
  seed = FLOOD_FIXTURE.seed,
): Uint8Array {
  assertDimensions(width, height);
  const rgba = new Uint8Array(width * height * PIXEL_STRIDE);
  let state = seed >>> 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      state = nextXorshift32(state);
      const variation = state % 9;
      setPixel(
        rgba,
        width,
        x,
        y,
        72 + variation,
        110 + ((variation * 3) % 9),
        144 + ((variation * 5) % 9),
        220 + (variation % 5),
      );
    }
  }

  // Integer-only barriers create concavities, a one-pixel channel, and nested regions.
  for (let x = 5; x < width - 5; x += 1) {
    if (x !== Math.floor(width / 2)) setPixel(rgba, width, x, 8, 205, 54, 62, 255);
  }
  for (let y = 8; y < height - 6; y += 1) {
    setPixel(rgba, width, 5, y, 205, 54, 62, 255);
    if (y !== Math.floor(height / 2)) {
      setPixel(rgba, width, width - 6, y, 205, 54, 62, 255);
    }
  }
  for (let x = 5; x < width - 5; x += 1) {
    setPixel(rgba, width, x, height - 7, 205, 54, 62, 255);
  }
  const innerLeft = Math.floor(width / 3);
  const innerRight = width - innerLeft - 1;
  const innerTop = Math.floor(height / 3);
  const innerBottom = height - innerTop - 1;
  for (let x = innerLeft; x <= innerRight; x += 1) {
    if (x !== innerLeft + 2) setPixel(rgba, width, x, innerTop, 18, 24, 31, 255);
    setPixel(rgba, width, x, innerBottom, 18, 24, 31, 255);
  }
  for (let y = innerTop; y <= innerBottom; y += 1) {
    setPixel(rgba, width, innerLeft, y, 18, 24, 31, 255);
    setPixel(rgba, width, innerRight, y, 18, 24, 31, 255);
  }
  for (let y = 2; y < Math.min(height - 2, 12); y += 1) {
    for (let x = width - 14; x < width - 2; x += 1) {
      if ((x + y) % 3 === 0) setPixel(rgba, width, x, y, 0, 0, 0, 0);
    }
  }
  return rgba;
}

export function generatePipelineFixture(
  width = PIPELINE_FIXTURE.width,
  height = PIPELINE_FIXTURE.height,
  seed = PIPELINE_FIXTURE.seed,
): Uint8Array {
  assertDimensions(width, height);
  const rgba = new Uint8Array(width * height * PIXEL_STRIDE);
  let state = seed >>> 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      state = nextXorshift32(state);
      const noise = state & 31;
      const red = (x * 5 + y * 3 + noise) & 255;
      const green = (x * 2 + y * 7 + ((noise * 3) & 63)) & 255;
      const blue = (x * 9 + y + ((noise * 5) & 127)) & 255;
      setPixel(rgba, width, x, y, red, green, blue, 255);
    }
  }
  return rgba;
}

export interface GeneratedFixtureRecord {
  id: string;
  file: string;
  width: number;
  height: number;
  stride: number;
  bytes: number;
  seed: string;
  sha256: string;
  purpose: string;
}

export async function fixtureRecord(
  fixture: typeof FLOOD_FIXTURE | typeof PIPELINE_FIXTURE,
  file: string,
  bytes: Uint8Array,
  purpose: string,
): Promise<GeneratedFixtureRecord> {
  return {
    id: fixture.id,
    file,
    width: fixture.width,
    height: fixture.height,
    stride: fixture.width * PIXEL_STRIDE,
    bytes: bytes.byteLength,
    seed: `0x${fixture.seed.toString(16).padStart(8, "0")}`,
    sha256: await sha256Hex(bytes),
    purpose,
  };
}
