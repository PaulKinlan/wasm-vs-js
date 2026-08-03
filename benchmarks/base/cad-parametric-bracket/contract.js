export const WORKLOAD_ID = "cad.parametric-bracket.v1";
export const INPUT_MAGIC = 0x31425243;
export const OUTPUT_MAGIC = 0x314f5242;
export const INPUT_BYTES = 128;
export const OUTPUT_HEADER_BYTES = 256;
export const WIDTH = 80;
export const HEIGHT = 40;
export const DEPTH = 12;
export const FILLET_RADIUS = 5;
export const HOLE_RADIUS = 4;
export const HOLE_CENTERS = [[20, 20], [60, 20]];
export const OUTER_ARC_SEGMENTS = 8;
export const HOLE_SEGMENTS = 32;
export const ANALYTIC_TOPOLOGY = Object.freeze({
  connectedComponents: 1,
  shells: 1,
  throughHoles: 2,
  genus: 2,
  faces: 12,
  edges: 30,
  vertices: 20,
});
export const FEATURE_ORDER = Object.freeze([
  "box(80mm,40mm,12mm)",
  "cylinder(20mm,20mm,r4mm,through)",
  "boolean-cut(left-hole)",
  "cylinder(60mm,20mm,r4mm,through)",
  "boolean-cut(right-hole)",
  "fillet(outer-corner-0,r5mm)",
  "fillet(outer-corner-1,r5mm)",
  "fillet(outer-corner-2,r5mm)",
  "fillet(outer-corner-3,r5mm)",
  "tessellate(polyline-arcs,scan-bands)",
]);
export const VARIANTS = Object.freeze(["js-controlled", "wasm-linear-controlled"]);
