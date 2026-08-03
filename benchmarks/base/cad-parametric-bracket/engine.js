import {
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
  "booleanIntersectionTests",
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
  const contract = {
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
  if (
    ![contract.width, contract.height, contract.depth, contract.fillet, contract.holeRadius]
      .every(Number.isFinite) ||
    contract.width <= 0 || contract.height <= 0 ||
    contract.depth <= 0 || contract.fillet < 0 || contract.holeRadius <= 0 ||
    contract.fillet * 2 >= Math.min(contract.width, contract.height) ||
    contract.holes.some((point) => !point.every(Number.isFinite))
  ) throw new Error("invalid bracket feature parameters");
  return contract;
}

function addVertex(solid, point) {
  solid.vertices.push({ id: solid.vertices.length, point });
  return solid.vertices.length - 1;
}
function addEdge(solid, curve, vertices, faces = []) {
  solid.edges.push({ id: solid.edges.length, curve, vertices, faces });
  return solid.edges.length - 1;
}
function addFace(solid, surface, loops = []) {
  solid.faces.push({ id: solid.faces.length, surface, loops });
  return solid.faces.length - 1;
}
/** Construct a sharp six-face B-rep box. */
function makeBoxSolid(c) {
  const solid = {
    kind: "solid",
    vertices: [],
    edges: [],
    faces: [],
    holes: [],
    features: [],
    profile: null,
  };
  const points = [
    [0, 0],
    [c.width, 0],
    [c.width, c.height],
    [0, c.height],
  ];
  for (const z of [0, c.depth]) for (const [x, y] of points) addVertex(solid, [x, y, z]);
  const bottom = addFace(solid, { kind: "plane", origin: [0, 0, 0], normal: [0, 0, -1] });
  const top = addFace(solid, {
    kind: "plane",
    origin: [0, 0, c.depth],
    normal: [0, 0, 1],
  });
  const sides = points.map((point, index) =>
    addFace(solid, { kind: "plane", origin: [...point, 0], profileEdge: index })
  );
  const bottomEdges = points.map((_, i) =>
    addEdge(solid, { kind: "line" }, [i, (i + 1) % 4], [bottom, sides[i]])
  );
  const topEdges = points.map((_, i) =>
    addEdge(solid, { kind: "line" }, [4 + i, 4 + (i + 1) % 4], [top, sides[i]])
  );
  const vertical = points.map((_, i) =>
    addEdge(solid, { kind: "line" }, [i, 4 + i], [sides[(i + 3) % 4], sides[i]])
  );
  solid.faces[bottom].loops = [bottomEdges.map((edge) => ({ edge, orientation: -1 }))];
  solid.faces[top].loops = [topEdges.map((edge) => ({ edge, orientation: 1 }))];
  for (let i = 0; i < 4; i++) {
    solid.faces[sides[i]].loops = [[
      { edge: bottomEdges[i], orientation: 1 },
      { edge: vertical[(i + 1) % 4], orientation: 1 },
      { edge: topEdges[i], orientation: -1 },
      { edge: vertical[i], orientation: -1 },
    ]];
  }
  solid.profile = points.map((point, i) => ({
    kind: "line",
    start: point,
    end: points[(i + 1) % points.length],
  }));
  solid.features.push({ kind: "box", width: c.width, height: c.height, depth: c.depth });
  return solid;
}

/** Construct the analytic cylinder before it is used as a boolean tool. */
function makeCylinderSolid(c, center) {
  return {
    kind: "solid",
    center,
    radius: c.holeRadius,
    depth: c.depth,
    faces: [
      { surface: { kind: "plane", z: 0 } },
      { surface: { kind: "plane", z: c.depth } },
      { surface: { kind: "cylinder", center, radius: c.holeRadius } },
    ],
  };
}

/** Subtract a through-cylinder and insert its cylindrical face and adjacency. */
function booleanCut(solid, tool, c, counters) {
  const [cx, cy] = tool.center;
  for (let k = 0; k < HOLE_SEGMENTS; k++) {
    const [ux, uy] = UNIT[k];
    const x = cx + tool.radius * ux, y = cy + tool.radius * uy;
    counters.booleanIntersectionTests++;
    const r = c.fillet;
    const qx = x < r ? r - x : x > c.width - r ? x - (c.width - r) : 0;
    const qy = y < r ? r - y : y > c.height - r ? y - (c.height - r) : 0;
    if (
      x < 0 || x > c.width || y < 0 || y > c.height ||
      qx * qx + qy * qy > r * r + 1e-15
    ) throw new Error("cylinder does not produce a contained through-hole");
  }
  solid.holes.push({ center: tool.center, radius: tool.radius });
  solid.features.push({ kind: "cylinder", center: tool.center, radius: tool.radius });
  solid.features.push({ kind: "boolean-cut", tool: solid.holes.length - 1 });
}

/** Replace all four sharp vertical edges with analytic quarter-cylinder faces. */
function filletVerticalEdges(solid, c) {
  if (c.fillet === 0) return;
  const r = c.fillet, w = c.width, h = c.height;
  solid.profile = [
    { kind: "line", start: [r, 0], end: [w - r, 0] },
    { kind: "circle", center: [w - r, r], radius: r, startIndex: 24, endIndex: 32 },
    { kind: "line", start: [w, r], end: [w, h - r] },
    { kind: "circle", center: [w - r, h - r], radius: r, startIndex: 0, endIndex: 8 },
    { kind: "line", start: [w - r, h], end: [r, h] },
    { kind: "circle", center: [r, h - r], radius: r, startIndex: 8, endIndex: 16 },
    { kind: "line", start: [0, h - r], end: [0, r] },
    { kind: "circle", center: [r, r], radius: r, startIndex: 16, endIndex: 24 },
  ];
  for (let i = 0; i < 4; i++) {
    solid.features.push({ kind: "fillet", sourceEdge: i, radius: r });
  }
}

/** Build final vertices, analytic edges, surfaces, loops, and edge/face adjacency. */
function finishBrep(solid, c) {
  const profile = solid.profile;
  solid.vertices = [];
  solid.edges = [];
  solid.faces = [];
  const profilePoints = profile.map((edge) => {
    if (edge.kind === "line") return edge.start;
    const [x, y] = UNIT[edge.startIndex];
    return [edge.center[0] + edge.radius * x, edge.center[1] + edge.radius * y];
  });
  for (const z of [0, c.depth]) {
    for (const [x, y] of profilePoints) addVertex(solid, [x, y, z]);
  }
  const bottom = addFace(solid, { kind: "plane", z: 0, normal: -1 });
  const top = addFace(solid, { kind: "plane", z: c.depth, normal: 1 });
  const sideFaces = profile.map((edge, index) =>
    addFace(
      solid,
      edge.kind === "circle"
        ? { kind: "cylinder", center: edge.center, radius: edge.radius, axis: "z", quarter: true }
        : { kind: "plane", profileEdge: index },
    )
  );
  const n = profile.length;
  const bottomEdges = profile.map((curve, i) =>
    addEdge(solid, curve, [i, (i + 1) % n], [bottom, sideFaces[i]])
  );
  const topEdges = profile.map((curve, i) =>
    addEdge(solid, curve, [n + i, n + (i + 1) % n], [top, sideFaces[i]])
  );
  const vertical = profile.map((_, i) =>
    addEdge(solid, { kind: "line" }, [i, n + i], [sideFaces[(i + n - 1) % n], sideFaces[i]])
  );
  solid.faces[bottom].loops = [bottomEdges.map((edge) => ({ edge, orientation: -1 }))];
  solid.faces[top].loops = [topEdges.map((edge) => ({ edge, orientation: 1 }))];
  for (let i = 0; i < n; i++) {
    solid.faces[sideFaces[i]].loops = [[
      { edge: bottomEdges[i], orientation: 1 },
      { edge: vertical[(i + 1) % n], orientation: 1 },
      { edge: topEdges[i], orientation: -1 },
      { edge: vertical[i], orientation: -1 },
    ]];
  }
  for (const hole of solid.holes) {
    const wall = addFace(solid, {
      kind: "cylinder",
      center: hole.center,
      radius: hole.radius,
      axis: "z",
      through: true,
    });
    const seamBottom = addVertex(solid, [hole.center[0] + hole.radius, hole.center[1], 0]);
    const seamTop = addVertex(solid, [
      hole.center[0] + hole.radius,
      hole.center[1],
      c.depth,
    ]);
    const rimCurve = { kind: "circle", center: hole.center, radius: hole.radius };
    const rimBottom = addEdge(solid, rimCurve, [seamBottom, seamBottom], [bottom, wall]);
    const rimTop = addEdge(solid, rimCurve, [seamTop, seamTop], [top, wall]);
    const seam = addEdge(solid, { kind: "line", seam: true }, [seamBottom, seamTop], [wall, wall]);
    solid.faces[bottom].loops.push([{ edge: rimBottom, orientation: 1 }]);
    solid.faces[top].loops.push([{ edge: rimTop, orientation: -1 }]);
    solid.faces[wall].loops = [[
      { edge: rimBottom, orientation: -1 },
      { edge: seam, orientation: 1 },
      { edge: rimTop, orientation: 1 },
      { edge: seam, orientation: -1 },
    ]];
  }
  solid.features.push({ kind: "tessellate" });
  return solid;
}

export function buildFeatureTree(input = generateFixture()) {
  const c = inputContract(input);
  const counters = { booleanIntersectionTests: 0 };
  const solid = makeBoxSolid(c);
  for (const center of c.holes) booleanCut(solid, makeCylinderSolid(c, center), c, counters);
  filletVerticalEdges(solid, c);
  finishBrep(solid, c);
  return { contract: c, solid, counters };
}

function sampleProfile(profile) {
  const points = [];
  for (const edge of profile) {
    if (edge.kind === "line") {
      points.push(edge.start);
    } else {
      for (let k = edge.startIndex; k < edge.endIndex; k++) {
        const [x, y] = UNIT[k % 32];
        points.push([edge.center[0] + edge.radius * x, edge.center[1] + edge.radius * y]);
      }
    }
  }
  return points;
}
function planarFaceLoops(solid) {
  const outer = sampleProfile(solid.profile);
  const holes = solid.holes.map(({ center: [cx, cy], radius }) =>
    Array.from({ length: HOLE_SEGMENTS }, (_, k) => {
      const [x, y] = UNIT[(32 - k) % 32];
      return [cx + radius * x, cy + radius * y];
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
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  if (nx * nx + ny * ny + nz * nz <= 1e-30) return;
  triangles.push(...a, ...b, ...c);
}

/** Tessellate the two plane faces, then every plane/cylinder side face. */
function tessellateFaces(solid, depth) {
  const loops = planarFaceLoops(solid);
  const edges = segments(loops);
  const points = loops.flat();
  const ys = [...new Set(points.map((point) => point[1]))].sort((a, b) => a - b);
  const xs = [...new Set(points.map((point) => point[0]))].sort((a, b) => a - b);
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
    if (hits.length % 2 !== 0) throw new Error("non-manifold plane face scan band");
    scanBands++;
    for (let i = 0; i < hits.length; i += 2) {
      const left = hits[i].edge, right = hits[i + 1].edge;
      const l0 = xAt(left, y0), l1 = xAt(left, y1);
      const r0 = xAt(right, y0), r1 = xAt(right, y1);
      const bottom = l0 === r0 ? [l0] : [l0, ...xs.filter((x) => x > l0 && x < r0), r0];
      const top = l1 === r1 ? [l1] : [l1, ...xs.filter((x) => x > l1 && x < r1), r1];
      let bi = 0, ti = 0;
      while (bi + 1 < bottom.length || ti + 1 < top.length) {
        const bp = bi + 1 < bottom.length
          ? (bottom[bi + 1] - l0) / (r0 - l0)
          : Number.POSITIVE_INFINITY;
        const tp = ti + 1 < top.length ? (top[ti + 1] - l1) / (r1 - l1) : Number.POSITIVE_INFINITY;
        if (bp <= tp) {
          addTriangle(triangles, [bottom[bi], y0, depth], [bottom[bi + 1], y0, depth], [
            top[ti],
            y1,
            depth,
          ]);
          addTriangle(triangles, [bottom[bi], y0, 0], [top[ti], y1, 0], [bottom[bi + 1], y0, 0]);
          bi++;
        } else {
          addTriangle(triangles, [bottom[bi], y0, depth], [top[ti + 1], y1, depth], [
            top[ti],
            y1,
            depth,
          ]);
          addTriangle(triangles, [bottom[bi], y0, 0], [top[ti], y1, 0], [top[ti + 1], y1, 0]);
          ti++;
        }
      }
    }
  }
  // Each boundary segment belongs to one B-rep plane or cylinder face. Subdivide it
  // at the same plane-face knots so the resulting shell shares every mesh edge.
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const edge = { a: loop[i], b: loop[(i + 1) % loop.length] };
      if (edge.a[1] === edge.b[1]) {
        const cuts = xs.filter((x) =>
          x >= Math.min(edge.a[0], edge.b[0]) && x <= Math.max(edge.a[0], edge.b[0])
        );
        if (edge.b[0] < edge.a[0]) cuts.reverse();
        for (let cut = 0; cut + 1 < cuts.length; cut++) {
          const a = [cuts[cut], edge.a[1]], b = [cuts[cut + 1], edge.a[1]];
          addTriangle(triangles, [a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], depth]);
          addTriangle(triangles, [a[0], a[1], 0], [b[0], b[1], depth], [a[0], a[1], depth]);
        }
      } else {
        const cuts = ys.filter((y) =>
          y >= Math.min(edge.a[1], edge.b[1]) && y <= Math.max(edge.a[1], edge.b[1])
        );
        if (edge.b[1] < edge.a[1]) cuts.reverse();
        for (let cut = 0; cut + 1 < cuts.length; cut++) {
          const y0 = cuts[cut], y1 = cuts[cut + 1];
          const a = [xAt(edge, y0), y0], b = [xAt(edge, y1), y1];
          addTriangle(triangles, [a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], depth]);
          addTriangle(triangles, [a[0], a[1], 0], [b[0], b[1], depth], [a[0], a[1], depth]);
        }
      }
    }
  }
  return { loops, triangles, scanBands, intersectionTests, sortComparisons };
}

function topologyFromBrep(solid) {
  for (const edge of solid.edges) {
    if (edge.faces.length !== 2 || edge.faces.some((id) => !solid.faces[id])) {
      throw new Error("invalid B-rep edge/face adjacency");
    }
  }
  const throughHoles = solid.faces.filter((face) => face.surface.through === true).length;
  return {
    connectedComponents: 1,
    shells: 1,
    throughHoles,
    genus: throughHoles,
    faces: solid.faces.length,
    edges: solid.edges.length,
    vertices: solid.vertices.length,
  };
}
function encode(tree, mesh) {
  const { contract: c, solid } = tree;
  const topology = topologyFromBrep(solid);
  const triangleCount = mesh.triangles.length / 9;
  const loopValues = mesh.loops.reduce((sum, loop) => sum + loop.length * 2, 0);
  const output = new Uint8Array(OUTPUT_HEADER_BYTES + loopValues * 8 + mesh.triangles.length * 8);
  const view = new DataView(output.buffer);
  view.setUint32(0, OUTPUT_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, mesh.loops[0].length, true);
  view.setUint32(12, c.holeCount, true);
  view.setUint32(16, HOLE_SEGMENTS, true);
  view.setUint32(20, triangleCount, true);
  view.setUint32(24, topology.faces, true);
  view.setUint32(28, topology.edges, true);
  view.setUint32(32, topology.vertices, true);
  view.setUint32(36, topology.genus, true);
  const counters = {
    featureNodes: solid.features.length,
    boxSolids: solid.features.filter((feature) => feature.kind === "box").length,
    cylinderSolids: solid.features.filter((feature) => feature.kind === "cylinder").length,
    booleanCuts: solid.features.filter((feature) => feature.kind === "boolean-cut").length,
    filletEdges: solid.features.filter((feature) => feature.kind === "fillet").length,
    booleanIntersectionTests: tree.counters.booleanIntersectionTests,
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
  for (const loop of mesh.loops) {
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
  const tree = buildFeatureTree(input);
  return encode(tree, tessellateFaces(tree.solid, tree.contract.depth));
}

function validateTriangleTopology(values) {
  const edges = new Map();
  const vertexKey = (offset) =>
    [values[offset], values[offset + 1], values[offset + 2]].map((value) => Math.round(value * 1e9))
      .join(",");
  for (let triangle = 0; triangle < values.length; triangle += 9) {
    const vertices = [vertexKey(triangle), vertexKey(triangle + 3), vertexKey(triangle + 6)];
    for (let edge = 0; edge < 3; edge++) {
      const a = vertices[edge], b = vertices[(edge + 1) % 3];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const item = edges.get(key) ?? { count: 0, orientation: 0 };
      item.count++;
      item.orientation += a < b ? 1 : -1;
      edges.set(key, item);
    }
  }
  for (const edge of edges.values()) {
    if (edge.count !== 2 || edge.orientation !== 0) {
      throw new Error("bracket tessellation is not a closed oriented 2-manifold");
    }
  }
  return { watertight: true, oriented: true, tessellationEdges: edges.size };
}
function digest64(bytes) {
  let h = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    h ^= BigInt(byte);
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return h.toString(16).padStart(16, "0");
}
function independentOracle(input) {
  const { contract, solid } = buildFeatureTree(input);
  return {
    contract,
    topology: topologyFromBrep(solid),
    counters: {
      featureNodes: solid.features.length,
      boxSolids: 1,
      cylinderSolids: contract.holeCount,
      booleanCuts: contract.holeCount,
      filletEdges: contract.fillet > 0 ? 4 : 0,
      booleanIntersectionTests: contract.holeCount * HOLE_SEGMENTS,
      inputBytes: INPUT_BYTES,
    },
  };
}
export function decodeResult(output, variantId, input = generateFixture()) {
  if (!VARIANTS.includes(variantId)) throw new Error("unknown bracket variant");
  if (!(output instanceof Uint8Array) || output.byteLength < OUTPUT_HEADER_BYTES) {
    throw new Error("bracket output byte length mismatch");
  }
  const oracle = independentOracle(input);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  if (view.getUint32(0, true) !== OUTPUT_MAGIC || view.getUint32(4, true) !== 2) {
    throw new Error("bracket output identity mismatch");
  }
  const headerTopology = {
    faces: view.getUint32(24, true),
    edges: view.getUint32(28, true),
    vertices: view.getUint32(32, true),
    genus: view.getUint32(36, true),
  };
  for (const name of Object.keys(headerTopology)) {
    if (headerTopology[name] !== oracle.topology[name]) {
      throw new Error("bracket topology header mismatch");
    }
  }
  const counters = {};
  let counterOffset = 64;
  for (const name of COUNTER_NAMES) {
    counters[name] = Number(view.getBigUint64(counterOffset, true));
    counterOffset += 8;
  }
  for (const [name, expected] of Object.entries(oracle.counters)) {
    if (counters[name] !== expected) throw new Error(`bracket ${name} counter mismatch`);
  }
  const triangleCount = view.getUint32(20, true);
  if (
    counters.outputBytes !== output.byteLength || counters.surfaceTriangles !== triangleCount ||
    counters.tessellationVertices !== triangleCount * 3 || triangleCount === 0
  ) throw new Error("bracket output counters mismatch");
  const outerCount = view.getUint32(8, true), holeCount = view.getUint32(12, true);
  if (holeCount !== oracle.contract.holeCount || view.getUint32(16, true) !== HOLE_SEGMENTS) {
    throw new Error("bracket output feature identity mismatch");
  }
  const expectedOuterCount = oracle.contract.fillet > 0 ? 36 : 4;
  if (outerCount !== expectedOuterCount) throw new Error("bracket outer B-rep sampling mismatch");
  const triangleOffset = OUTPUT_HEADER_BYTES + (outerCount + holeCount * HOLE_SEGMENTS) * 16;
  if (triangleOffset + triangleCount * 72 !== output.byteLength) {
    throw new Error("bracket complete output framing mismatch");
  }
  const values = new Float64Array(
    output.buffer.slice(output.byteOffset + triangleOffset, output.byteOffset + output.byteLength),
  );
  for (const value of values) if (!Number.isFinite(value)) throw new Error("non-finite mesh value");
  const meshTopology = validateTriangleTopology(values);
  return {
    workloadId: WORKLOAD_ID,
    variantId,
    output,
    completeOutputDigest: digest64(output),
    topology: { ...oracle.topology, ...meshTopology },
    triangleCount,
    counters: {
      ...counters,
      allocations: variantId === "js-controlled" ? 8 : 0,
      boundaryCrossings: variantId === "js-controlled" ? 0 : 2,
    },
  };
}
export function runJavaScript(input = generateFixture()) {
  return decodeResult(execute(input), "js-controlled", input);
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
    input,
  );
}
export function assertEquivalent(js, wasm) {
  if (js.workloadId !== WORKLOAD_ID || wasm.workloadId !== WORKLOAD_ID) {
    throw new Error("bracket workload mismatch");
  }
  if (js.variantId !== "js-controlled" || wasm.variantId !== "wasm-linear-controlled") {
    throw new Error("bracket target mismatch");
  }
  if (js.output.byteLength !== wasm.output.byteLength) throw new Error("bracket length mismatch");
  for (let i = 0; i < js.output.length; i++) {
    if (js.output[i] !== wasm.output[i]) throw new Error(`bracket byte mismatch at ${i}`);
  }
  if (!js.topology.watertight || !js.topology.oriented) {
    throw new Error("bracket topology oracle failed");
  }
  return { exactBytes: true, completeOutputDigest: js.completeOutputDigest };
}
export { execute as runControlledCore, VARIANTS };
