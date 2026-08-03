import {
  DEPTH,
  FILLET_RADIUS,
  HEIGHT,
  HOLE_CENTERS,
  HOLE_RADIUS,
  HOLE_SEGMENTS,
  INPUT_BYTES,
  INPUT_MAGIC,
  OUTER_ARC_SEGMENTS,
  WIDTH,
} from "./contract.js";

export function generateFixture(overrides = {}) {
  const width = overrides.width ?? WIDTH;
  const height = overrides.height ?? HEIGHT;
  const depth = overrides.depth ?? DEPTH;
  const filletRadius = overrides.filletRadius ?? FILLET_RADIUS;
  const holeRadius = overrides.holeRadius ?? HOLE_RADIUS;
  const holeCenters = overrides.holeCenters ?? HOLE_CENTERS;
  if (
    ![width, height, depth, filletRadius, holeRadius].every(Number.isFinite) ||
    width <= 0 || height <= 0 || depth <= 0 || filletRadius < 0 || holeRadius <= 0 ||
    filletRadius * 2 >= Math.min(width, height) || holeCenters.length > 2 ||
    holeCenters.some((point) =>
      !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)
    )
  ) throw new Error("invalid bracket fixture dimensions");
  for (let i = 0; i < holeCenters.length; i++) {
    for (let j = i + 1; j < holeCenters.length; j++) {
      const dx = holeCenters[i][0] - holeCenters[j][0];
      const dy = holeCenters[i][1] - holeCenters[j][1];
      if (dx * dx + dy * dy <= 4 * holeRadius * holeRadius) {
        throw new Error("overlapping or tangent through-holes are outside the input contract");
      }
    }
  }
  const bytes = new Uint8Array(INPUT_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, INPUT_MAGIC, true);
  view.setUint32(4, 1, true);
  view.setUint32(8, holeCenters.length, true);
  view.setUint32(12, OUTER_ARC_SEGMENTS, true);
  view.setUint32(16, HOLE_SEGMENTS, true);
  view.setFloat64(24, width, true);
  view.setFloat64(32, height, true);
  view.setFloat64(40, depth, true);
  view.setFloat64(48, filletRadius, true);
  view.setFloat64(56, holeRadius, true);
  for (let index = 0; index < 2; index++) {
    const center = holeCenters[index] ?? [0, 0];
    view.setFloat64(64 + index * 16, center[0], true);
    view.setFloat64(72 + index * 16, center[1], true);
  }
  return bytes;
}
