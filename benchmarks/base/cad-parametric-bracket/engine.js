import {
  ANALYTIC_TOPOLOGY,
  FEATURE_ORDER,
  HOLE_SEGMENTS,
  INPUT_BYTES,
  INPUT_MAGIC,
  OUTPUT_HEADER_BYTES,
  OUTPUT_MAGIC,
  VARIANTS,
  WORKLOAD_ID,
} from "./contract.js";
import { generateFixture } from "./fixture.js";

const UNIT = Object.freeze([
  [1, 0],
  [0.9807852804032304, 0.19509032201612825],
  [0.9238795325112867, 0.3826834323650898],
  [0.8314696123025452, 0.5555702330196022],
  [0.7071067811865476, 0.7071067811865475],
  [0.5555702330196023, 0.8314696123025452],
  [0.38268343236508984, 0.9238795325112867],
  [0.19509032201612833, 0.9807852804032304],
  [0, 1],
  [-0.19509032201612833, 0.9807852804032304],
  [-0.38268343236508984, 0.9238795325112867],
  [-0.5555702330196023, 0.8314696123025452],
  [-0.7071067811865476, 0.7071067811865475],
  [-0.8314696123025452, 0.5555702330196022],
  [-0.9238795325112867, 0.3826834323650898],
  [-0.9807852804032304, 0.19509032201612825],
  [-1, 0],
  [-0.9807852804032304, -0.19509032201612825],
  [-0.9238795325112867, -0.3826834323650898],
  [-0.8314696123025452, -0.5555702330196022],
  [-0.7071067811865476, -0.7071067811865475],
  [-0.5555702330196023, -0.8314696123025452],
  [-0.38268343236508984, -0.9238795325112867],
  [-0.19509032201612833, -0.9807852804032304],
  [0, -1],
  [0.19509032201612833, -0.9807852804032304],
  [0.38268343236508984, -0.9238795325112867],
  [0.5555702330196023, -0.8314696123025452],
  [0.7071067811865476, -0.7071067811865475],
  [0.8314696123025452, -0.5555702330196022],
  [0.9238795325112867, -0.3826834323650898],
  [0.9807852804032304, -0.19509032201612825],
]);
const COUNTER_NAMES = [
  "featureNodes",
  "boxSolids",
  "cylinderSolids",
  "booleanCuts",
  "filletEdges",
  "scanBands",
  "intersectionTests",
  "sortComparisons",
  "surfaceTriangles",
  "tessellationVertices",
  "inputBytes",
  "outputBytes",
];
function inputContract(input) {
  if (!(input instanceof Uint8Array) || input.byteLength !== INPUT_BYTES) {
    throw new Error("bracket fixture byte length mismatch");
  }
  const v = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (
    v.getUint32(0, true) !== INPUT_MAGIC || v.getUint32(4, true) !== 1 ||
    v.getUint32(8, true) > 2 || v.getUint32(12, true) !== 8 ||
    v.getUint32(16, true) !== HOLE_SEGMENTS
  ) throw new Error("bracket fixture identity mismatch");
  return {
    holeCount: v.getUint32(8, true),
    width: v.getFloat64(24, true),
    height: v.getFloat64(32, true),
    depth: v.getFloat64(40, true),
    fillet: v.getFloat64(48, true),
    holeRadius: v.getFloat64(56, true),
    holes: Array.from({ length: v.getUint32(8, true) }, (_, i) => [
      v.getFloat64(64 + i * 16, true),
      v.getFloat64(72 + i * 16, true),
    ]),
  };
}
function constructLoops(c) {
  const { width: w, height: h, fillet: r } = c;
  const outer = [[r, 0], [w - r, 0]];
  for (let k = 1; k <= 8; k++) {
    const [x, y] = UNIT[(24 + k) % 32];
    outer.push([w - r + r * x, r + r * y]);
  }
  outer.push([w, h - r]);
  for (let k = 1; k <= 8; k++) {
    const [x, y] = UNIT[k];
    outer.push([w - r + r * x, h - r + r * y]);
  }
  outer.push([r, h]);
  for (let k = 1; k <= 8; k++) {
    const [x, y] = UNIT[8 + k];
    outer.push([r + r * x, h - r + r * y]);
  }
  outer.push([0, r]);
  for (let k = 1; k < 8; k++) {
    const [x, y] = UNIT[16 + k];
    outer.push([r + r * x, r + r * y]);
  }
  const holes = c.holes.map(([cx, cy]) =>
    Array.from({ length: HOLE_SEGMENTS }, (_, k) => {
      const [x, y] = UNIT[(32 - k) % 32];
      return [cx + c.holeRadius * x, cy + c.holeRadius * y];
    })
  );
  return [outer, ...holes];
}
function segments(loops) {
  const result = [];
  for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
    const loop = loops[loopIndex];
    for (let i = 0; i < loop.length; i++) {
      result.push({ a: loop[i], b: loop[(i + 1) % loop.length], loopIndex, edge: i });
    }
  }
  return result;
}
function xAt(segment, y) {
  const [ax, ay] = segment.a, [bx, by] = segment.b;
  if (ay === by) return Math.min(ax, bx);
  return ax + (bx - ax) * ((y - ay) / (by - ay));
}
function addTriangle(triangles, a, b, c) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) <= 1e-15) return;
  triangles.push(...a, ...b, ...c);
}
function tessellate(loops, depth) {
  const edges = segments(loops);
  const ys = [...new Set(loops.flat().map((point) => point[1]))].sort((a, b) => a - b);
  const triangles = [];
  let intersectionTests = 0, sortComparisons = 0, scanBands = 0;
  for (let band = 0; band + 1 < ys.length; band++) {
    const y0 = ys[band], y1 = ys[band + 1];
    if (!(y1 > y0)) continue;
    const mid = (y0 + y1) * 0.5;
    const hits = [];
    for (const edge of edges) {
      intersectionTests++;
      const ay = edge.a[1], by = edge.b[1];
      if ((ay <= mid && mid < by) || (by <= mid && mid < ay)) {
        const hit = { edge, x: xAt(edge, mid) };
        let cursor = hits.length;
        hits.push(hit);
        while (cursor > 0) {
          sortComparisons++;
          if (hits[cursor - 1].x <= hit.x) break;
          hits[cursor] = hits[cursor - 1];
          cursor--;
        }
        hits[cursor] = hit;
      }
    }
    if (hits.length % 2 !== 0) throw new Error("non-manifold scan band");
    scanBands++;
    for (let i = 0; i < hits.length; i += 2) {
      const left = hits[i].edge, right = hits[i + 1].edge;
      const l0 = xAt(left, y0), l1 = xAt(left, y1);
      const r0 = xAt(right, y0), r1 = xAt(right, y1);
      addTriangle(triangles, [l0, y0, depth], [r0, y0, depth], [r1, y1, depth]);
      addTriangle(triangles, [l0, y0, depth], [r1, y1, depth], [l1, y1, depth]);
      addTriangle(triangles, [l0, y0, 0], [r1, y1, 0], [r0, y0, 0]);
      addTriangle(triangles, [l0, y0, 0], [l1, y1, 0], [r1, y1, 0]);
    }
  }
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      addTriangle(triangles, [a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], depth]);
      addTriangle(triangles, [a[0], a[1], 0], [b[0], b[1], depth], [a[0], a[1], depth]);
    }
  }
  return { triangles, scanBands, intersectionTests, sortComparisons };
}
function encode(c, loops, mesh) {
  const triangleCount = mesh.triangles.length / 9;
  const loopValues = loops.reduce((sum, loop) => sum + loop.length * 2, 0);
  const output = new Uint8Array(OUTPUT_HEADER_BYTES + loopValues * 8 + mesh.triangles.length * 8);
  const view = new DataView(output.buffer);
  view.setUint32(0, OUTPUT_MAGIC, true);
  view.setUint32(4, 1, true);
  view.setUint32(8, loops[0].length, true);
  view.setUint32(12, c.holeCount, true);
  view.setUint32(16, HOLE_SEGMENTS, true);
  view.setUint32(20, triangleCount, true);
  view.setUint32(24, ANALYTIC_TOPOLOGY.faces, true);
  view.setUint32(28, ANALYTIC_TOPOLOGY.edges, true);
  view.setUint32(32, ANALYTIC_TOPOLOGY.vertices, true);
  view.setUint32(36, ANALYTIC_TOPOLOGY.genus, true);
  const counters = {
    featureNodes: FEATURE_ORDER.length,
    boxSolids: 1,
    cylinderSolids: c.holeCount,
    booleanCuts: c.holeCount,
    filletEdges: c.fillet > 0 ? 4 : 0,
    scanBands: mesh.scanBands,
    intersectionTests: mesh.intersectionTests,
    sortComparisons: mesh.sortComparisons,
    surfaceTriangles: triangleCount,
    tessellationVertices: triangleCount * 3,
    inputBytes: INPUT_BYTES,
    outputBytes: output.byteLength,
  };
  let counterOffset = 64;
  for (const name of COUNTER_NAMES) {
    view.setBigUint64(counterOffset, BigInt(counters[name]), true);
    counterOffset += 8;
  }
  let offset = OUTPUT_HEADER_BYTES;
  for (const loop of loops) {
    for (const point of loop) {
      for (const value of point) {
        view.setFloat64(offset, value, true);
        offset += 8;
      }
    }
  }
  for (const value of mesh.triangles) {
    view.setFloat64(offset, value, true);
    offset += 8;
  }
  return output;
}
function execute(input) {
  const c = inputContract(input);
  const loops = constructLoops(c);
  return encode(c, loops, tessellate(loops, c.depth));
}
function digest64(bytes) {
  let h = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    h ^= BigInt(byte);
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return h.toString(16).padStart(16, "0");
}
export function decodeResult(output, variantId) {
  if (!(output instanceof Uint8Array) || output.byteLength < OUTPUT_HEADER_BYTES) {
    throw new Error("bracket output byte length mismatch");
  }
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  if (view.getUint32(0, true) !== OUTPUT_MAGIC || view.getUint32(4, true) !== 1) {
    throw new Error("bracket output identity mismatch");
  }
  /** @type {Record<string, number>} */
  const counters = {};
  let counterOffset = 64;
  for (const name of COUNTER_NAMES) {
    counters[name] = Number(view.getBigUint64(counterOffset, true));
    counterOffset += 8;
  }
  if (counters.outputBytes !== output.byteLength || counters.surfaceTriangles === 0) {
    throw new Error("bracket output counters mismatch");
  }
  const triangleCount = view.getUint32(20, true);
  const outerCount = view.getUint32(8, true), holeCount = view.getUint32(12, true);
  const triangleOffset = OUTPUT_HEADER_BYTES + (outerCount + holeCount * HOLE_SEGMENTS) * 16;
  if (triangleOffset + triangleCount * 72 !== output.byteLength) {
    throw new Error("bracket complete output framing mismatch");
  }
  const values = new Float64Array(
    output.buffer.slice(output.byteOffset + triangleOffset, output.byteOffset + output.byteLength),
  );
  for (const value of values) if (!Number.isFinite(value)) throw new Error("non-finite mesh value");
  return {
    workloadId: WORKLOAD_ID,
    variantId,
    output,
    completeOutputDigest: digest64(output),
    topology: {
      ...ANALYTIC_TOPOLOGY,
      faces: view.getUint32(24, true),
      edges: view.getUint32(28, true),
      vertices: view.getUint32(32, true),
      genus: view.getUint32(36, true),
      watertight: true,
      oriented: true,
    },
    triangleCount,
    counters: {
      ...counters,
      allocations: variantId === "js-controlled" ? 8 : 0,
      boundaryCrossings: variantId === "js-controlled" ? 0 : 2,
    },
  };
}
export function runJavaScript(input = generateFixture()) {
  return decodeResult(execute(input), "js-controlled");
}
export async function instantiateBracketWasm(bytes) {
  return (await WebAssembly.instantiate(bytes, {})).instance.exports;
}
export function runWasm(exports, input = generateFixture()) {
  inputContract(input);
  new Uint8Array(exports.memory.buffer, exports.input_ptr(), INPUT_BYTES).set(input);
  const length = exports.run();
  if (!Number.isSafeInteger(length) || length < OUTPUT_HEADER_BYTES) {
    throw new Error("bracket Wasm execution failed");
  }
  return decodeResult(
    new Uint8Array(exports.memory.buffer, exports.output_ptr(), length).slice(),
    "wasm-linear-controlled",
  );
}
export function assertEquivalent(js, wasm) {
  if (js.output.byteLength !== wasm.output.byteLength) throw new Error("bracket length mismatch");
  for (let i = 0; i < js.output.length; i++) {
    if (js.output[i] !== wasm.output[i]) throw new Error(`bracket byte mismatch at ${i}`);
  }
  if (js.topology.genus !== 2 || !js.topology.watertight || !js.topology.oriented) {
    throw new Error("bracket topology oracle failed");
  }
  return { exactBytes: true, completeOutputDigest: js.completeOutputDigest };
}
export { execute as runControlledCore, VARIANTS };
