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
    contract.width <= 0 || contract.height <= 0 || contract.depth <= 0 ||
    contract.fillet < 0 || contract.holeRadius <= 0 ||
    contract.fillet * 2 >= Math.min(contract.width, contract.height) ||
    contract.holes.some((point) => !point.every(Number.isFinite))
  ) throw new Error("invalid bracket feature parameters");
  for (let i = 0; i < contract.holes.length; i++) {
    for (let j = i + 1; j < contract.holes.length; j++) {
      const dx = contract.holes[i][0] - contract.holes[j][0];
      const dy = contract.holes[i][1] - contract.holes[j][1];
      if (dx * dx + dy * dy <= 4 * contract.holeRadius * contract.holeRadius) {
        throw new Error("overlapping or tangent through-holes are outside the input contract");
      }
    }
  }
  return contract;
}

function createSolid() {
  return {
    kind: "solid",
    vertices: [],
    edges: [],
    faces: [],
    loops: [],
    coedges: [],
    features: [],
    counters: {
      featureNodes: 0,
      boxSolids: 0,
      cylinderSolids: 0,
      booleanCuts: 0,
      filletEdges: 0,
      booleanIntersectionTests: 0,
    },
  };
}
function addVertex(solid, point) {
  solid.vertices.push({ id: solid.vertices.length, point });
  return solid.vertices.length - 1;
}
function addEdge(solid, curve, vertices) {
  solid.edges.push({ id: solid.edges.length, curve, vertices, coedges: [] });
  return solid.edges.length - 1;
}
function addFace(solid, surface) {
  solid.faces.push({ id: solid.faces.length, surface, loops: [] });
  return solid.faces.length - 1;
}
function addLoop(solid, face, uses) {
  const loop = { id: solid.loops.length, face, coedges: [] };
  solid.loops.push(loop);
  solid.faces[face].loops.push(loop.id);
  for (const use of uses) {
    const coedge = {
      id: solid.coedges.length,
      edge: use.edge,
      face,
      loop: loop.id,
      orientation: use.orientation,
      next: -1,
      previous: -1,
    };
    solid.coedges.push(coedge);
    loop.coedges.push(coedge.id);
    solid.edges[use.edge].coedges.push(coedge.id);
  }
  for (let i = 0; i < loop.coedges.length; i++) {
    const coedge = solid.coedges[loop.coedges[i]];
    coedge.previous = loop.coedges[(i + loop.coedges.length - 1) % loop.coedges.length];
    coedge.next = loop.coedges[(i + 1) % loop.coedges.length];
  }
  return loop.id;
}
function resetIncidence(solid) {
  solid.loops = [];
  solid.coedges = [];
  for (const edge of solid.edges) edge.coedges = [];
  for (const face of solid.faces) face.loops = [];
}
function line() {
  return { kind: "line" };
}
function arc(center, radius, startIndex, steps) {
  return { kind: "circle", center, radius, startIndex, steps };
}
function addFeature(solid, feature) {
  solid.features.push(feature);
  solid.counters.featureNodes++;
}

/** Construct a sharp six-face B-rep box, including loops and two coedges per edge. */
function makeBoxSolid(c) {
  const solid = createSolid();
  const points = [[0, 0], [c.width, 0], [c.width, c.height], [0, c.height]];
  for (const z of [0, c.depth]) for (const [x, y] of points) addVertex(solid, [x, y, z]);
  const bottom = addFace(solid, { kind: "plane", origin: [0, 0, 0], normal: [0, 0, -1] });
  const top = addFace(solid, {
    kind: "plane",
    origin: [0, 0, c.depth],
    normal: [0, 0, 1],
  });
  const sides = points.map((point) =>
    addFace(solid, { kind: "plane", origin: [...point, 0], axis: "z" })
  );
  const bottomEdges = points.map((_, i) => addEdge(solid, line(), [i, (i + 1) % 4]));
  const topEdges = points.map((_, i) => addEdge(solid, line(), [4 + i, 4 + (i + 1) % 4]));
  const vertical = points.map((_, i) => addEdge(solid, line(), [i, 4 + i]));
  addLoop(solid, bottom, bottomEdges.toReversed().map((edge) => ({ edge, orientation: -1 })));
  addLoop(solid, top, topEdges.map((edge) => ({ edge, orientation: 1 })));
  for (let i = 0; i < 4; i++) {
    addLoop(solid, sides[i], [
      { edge: bottomEdges[i], orientation: 1 },
      { edge: vertical[(i + 1) % 4], orientation: 1 },
      { edge: topEdges[i], orientation: -1 },
      { edge: vertical[i], orientation: -1 },
    ]);
  }
  addFeature(solid, { kind: "box", width: c.width, height: c.height, depth: c.depth });
  solid.counters.boxSolids++;
  return solid;
}

/** Construct a complete analytic cylinder B-rep used as the boolean tool. */
function makeCylinderSolid(c, center) {
  const tool = createSolid();
  const bottomVertex = addVertex(tool, [center[0] + c.holeRadius, center[1], 0]);
  const topVertex = addVertex(tool, [center[0] + c.holeRadius, center[1], c.depth]);
  const bottom = addFace(tool, { kind: "plane", z: 0, normal: -1 });
  const top = addFace(tool, { kind: "plane", z: c.depth, normal: 1 });
  const wall = addFace(tool, {
    kind: "cylinder",
    center,
    radius: c.holeRadius,
    axis: "z",
    depth: c.depth,
  });
  const rimBottom = addEdge(tool, arc(center, c.holeRadius, 0, 32), [bottomVertex, bottomVertex]);
  const rimTop = addEdge(tool, arc(center, c.holeRadius, 0, 32), [topVertex, topVertex]);
  const seam = addEdge(tool, { ...line(), seam: true }, [bottomVertex, topVertex]);
  addLoop(tool, bottom, [{ edge: rimBottom, orientation: -1 }]);
  addLoop(tool, top, [{ edge: rimTop, orientation: 1 }]);
  addLoop(tool, wall, [
    { edge: rimBottom, orientation: 1 },
    { edge: seam, orientation: 1 },
    { edge: rimTop, orientation: -1 },
    { edge: seam, orientation: -1 },
  ]);
  addFeature(tool, { kind: "cylinder", center, radius: c.holeRadius });
  tool.counters.cylinderSolids++;
  validateBrepTopology(tool);
  return tool;
}

/** Materially subtract a complete through-cylinder by splicing its wall and rims into the box. */
function booleanCut(solid, tool, c) {
  const cylinderFace = tool.faces.find((face) => face.surface.kind === "cylinder");
  if (!cylinderFace) throw new Error("boolean tool has no cylindrical material boundary");
  const { center, radius } = cylinderFace.surface;
  for (let k = 0; k < HOLE_SEGMENTS; k++) {
    const [ux, uy] = UNIT[k];
    const x = center[0] + radius * ux, y = center[1] + radius * uy;
    solid.counters.booleanIntersectionTests++;
    const qx = x < c.fillet ? c.fillet - x : x > c.width - c.fillet ? x - (c.width - c.fillet) : 0;
    const qy = y < c.fillet
      ? c.fillet - y
      : y > c.height - c.fillet
      ? y - (c.height - c.fillet)
      : 0;
    if (
      x < 0 || x > c.width || y < 0 || y > c.height ||
      qx * qx + qy * qy > c.fillet * c.fillet + 1e-15
    ) throw new Error("cylinder does not produce a contained through-hole");
  }
  const bottomVertex = addVertex(solid, [...tool.vertices[0].point]);
  const topVertex = addVertex(solid, [...tool.vertices[1].point]);
  const wall = addFace(solid, { ...cylinderFace.surface, through: true });
  const rimBottom = addEdge(solid, { ...tool.edges[0].curve }, [bottomVertex, bottomVertex]);
  const rimTop = addEdge(solid, { ...tool.edges[1].curve }, [topVertex, topVertex]);
  const seam = addEdge(solid, { ...tool.edges[2].curve }, [bottomVertex, topVertex]);
  addLoop(solid, 0, [{ edge: rimBottom, orientation: 1 }]);
  addLoop(solid, 1, [{ edge: rimTop, orientation: -1 }]);
  addLoop(solid, wall, [
    { edge: rimBottom, orientation: -1 },
    { edge: seam, orientation: 1 },
    { edge: rimTop, orientation: 1 },
    { edge: seam, orientation: -1 },
  ]);
  addFeature(solid, { kind: "cylinder", center: [...center], radius });
  addFeature(solid, { kind: "boolean-cut", wall });
  solid.counters.cylinderSolids++;
  solid.counters.booleanCuts++;
  validateBrepTopology(solid);
}

function roundedProfile(c) {
  const r = c.fillet, w = c.width, h = c.height;
  return [
    { point: [r, 0], curve: line() },
    { point: [w - r, 0], curve: arc([w - r, r], r, 24, 8) },
    { point: [w, r], curve: line() },
    { point: [w, h - r], curve: arc([w - r, h - r], r, 0, 8) },
    { point: [w - r, h], curve: line() },
    { point: [r, h], curve: arc([r, h - r], r, 8, 8) },
    { point: [0, h - r], curve: line() },
    { point: [0, r], curve: arc([r, r], r, 16, 8) },
  ];
}

/** Apply four Euler fillet edits while retaining and reattaching all boolean-cut entities. */
function filletVerticalEdges(solid, c) {
  if (c.fillet === 0) return;
  const profile = roundedProfile(c);
  const holeVertices = solid.vertices.length - 8;
  const holeEdges = solid.edges.length - 12;
  const holeFaces = solid.faces.length - 6;
  const bottomVertices = [0], topVertices = [4];
  for (let i = 1; i < 8; i++) {
    if ((i & 1) === 0) {
      bottomVertices.push(i / 2);
      topVertices.push(4 + i / 2);
    } else {
      bottomVertices.push(addVertex(solid, [...profile[i].point, 0]));
      topVertices.push(addVertex(solid, [...profile[i].point, c.depth]));
    }
  }
  for (let i = 0; i < 8; i += 2) {
    solid.vertices[bottomVertices[i]].point = [...profile[i].point, 0];
    solid.vertices[topVertices[i]].point = [...profile[i].point, c.depth];
  }
  const bottomEdges = [], topEdges = [], vertical = [], sides = [];
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    if ((i & 1) === 0) {
      bottomEdges[i] = i / 2;
      topEdges[i] = 4 + i / 2;
      vertical[i] = 8 + i / 2;
      sides[i] = 2 + i / 2;
      Object.assign(solid.edges[bottomEdges[i]], {
        curve: profile[i].curve,
        vertices: [bottomVertices[i], bottomVertices[next]],
      });
      Object.assign(solid.edges[topEdges[i]], {
        curve: profile[i].curve,
        vertices: [topVertices[i], topVertices[next]],
      });
      Object.assign(solid.edges[vertical[i]], {
        curve: line(),
        vertices: [bottomVertices[i], topVertices[i]],
      });
      solid.faces[sides[i]].surface = { kind: "plane", profileEdge: i, axis: "z" };
    } else {
      bottomEdges[i] = addEdge(solid, profile[i].curve, [bottomVertices[i], bottomVertices[next]]);
      topEdges[i] = addEdge(solid, profile[i].curve, [topVertices[i], topVertices[next]]);
      vertical[i] = addEdge(solid, line(), [bottomVertices[i], topVertices[i]]);
      sides[i] = addFace(solid, {
        kind: "cylinder",
        center: profile[i].curve.center,
        radius: c.fillet,
        axis: "z",
        quarter: true,
      });
      addFeature(solid, { kind: "fillet", sourceEdge: (i - 1) / 2, radius: c.fillet });
      solid.counters.filletEdges++;
    }
  }
  if (
    solid.vertices.length !== 16 + holeVertices || solid.edges.length !== 24 + holeEdges ||
    solid.faces.length !== 10 + holeFaces
  ) throw new Error("fillet Euler edit changed an unexpected entity count");
  resetIncidence(solid);
  addLoop(solid, 0, bottomEdges.toReversed().map((edge) => ({ edge, orientation: -1 })));
  addLoop(solid, 1, topEdges.map((edge) => ({ edge, orientation: 1 })));
  for (let i = 0; i < 8; i++) {
    addLoop(solid, sides[i], [
      { edge: bottomEdges[i], orientation: 1 },
      { edge: vertical[(i + 1) % 8], orientation: 1 },
      { edge: topEdges[i], orientation: -1 },
      { edge: vertical[i], orientation: -1 },
    ]);
  }
  for (let hole = 0; hole < holeFaces; hole++) {
    const wall = 6 + hole;
    const edge = 12 + hole * 3;
    addLoop(solid, 0, [{ edge, orientation: 1 }]);
    addLoop(solid, 1, [{ edge: edge + 1, orientation: -1 }]);
    addLoop(solid, wall, [
      { edge, orientation: -1 },
      { edge: edge + 2, orientation: 1 },
      { edge: edge + 1, orientation: 1 },
      { edge: edge + 2, orientation: -1 },
    ]);
  }
  validateBrepTopology(solid);
}

function validateBrepTopology(solid) {
  if (!solid.faces.length) throw new Error("empty B-rep");
  for (const vertex of solid.vertices) {
    if (vertex.point.length !== 3 || !vertex.point.every(Number.isFinite)) {
      throw new Error("invalid B-rep vertex");
    }
  }
  for (const edge of solid.edges) {
    if (
      edge.vertices.length !== 2 || edge.vertices.some((id) => !solid.vertices[id]) ||
      edge.coedges.length !== 2
    ) throw new Error("invalid B-rep edge incidence");
    const uses = edge.coedges.map((id) => solid.coedges[id]);
    if (uses.some((use) => !use) || uses[0].orientation + uses[1].orientation !== 0) {
      throw new Error("invalid B-rep edge orientation");
    }
  }
  for (const face of solid.faces) {
    if (!face.loops.length) throw new Error("B-rep face has no loop");
    for (const loopId of face.loops) {
      const loop = solid.loops[loopId];
      if (!loop || loop.face !== face.id || !loop.coedges.length) {
        throw new Error("invalid B-rep face/loop adjacency");
      }
      for (let i = 0; i < loop.coedges.length; i++) {
        const coedge = solid.coedges[loop.coedges[i]];
        if (
          !coedge || coedge.face !== face.id || coedge.loop !== loop.id ||
          coedge.previous !== loop.coedges[(i + loop.coedges.length - 1) % loop.coedges.length] ||
          coedge.next !== loop.coedges[(i + 1) % loop.coedges.length]
        ) throw new Error("invalid B-rep coedge ring");
      }
    }
  }
  const adjacency = solid.faces.map(() => new Set());
  for (const edge of solid.edges) {
    const [a, b] = edge.coedges.map((id) => solid.coedges[id].face);
    adjacency[a].add(b);
    adjacency[b].add(a);
  }
  let components = 0;
  const visited = new Set();
  for (let start = 0; start < solid.faces.length; start++) {
    if (visited.has(start)) continue;
    components++;
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      for (const next of adjacency[stack.pop()]) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
  }
  const loopCorrection = solid.loops.length - solid.faces.length;
  const eulerCharacteristic = solid.vertices.length - solid.edges.length + solid.faces.length -
    loopCorrection;
  const genus = components - eulerCharacteristic / 2;
  if (!Number.isInteger(genus) || genus < 0) throw new Error("invalid B-rep Euler characteristic");
  return {
    connectedComponents: components,
    shells: components,
    throughHoles: genus,
    genus,
    faces: solid.faces.length,
    edges: solid.edges.length,
    vertices: solid.vertices.length,
    loops: solid.loops.length,
    coedges: solid.coedges.length,
    eulerCharacteristic,
  };
}

export function buildFeatureTree(input = generateFixture()) {
  const contract = inputContract(input);
  const solid = makeBoxSolid(contract);
  for (const center of contract.holes) {
    booleanCut(solid, makeCylinderSolid(contract, center), contract);
  }
  filletVerticalEdges(solid, contract);
  addFeature(solid, { kind: "tessellate" });
  return { contract, solid, counters: solid.counters };
}

function sampleCoedge(solid, coedgeId) {
  const coedge = solid.coedges[coedgeId];
  const edge = solid.edges[coedge.edge];
  const curve = edge.curve;
  if (curve.kind === "line") {
    const vertex = edge.vertices[coedge.orientation > 0 ? 0 : 1];
    return [solid.vertices[vertex].point.slice(0, 2)];
  }
  const result = [];
  if (coedge.orientation > 0) {
    for (let step = 0; step < curve.steps; step++) {
      const [x, y] = UNIT[(curve.startIndex + step) % 32];
      result.push([curve.center[0] + curve.radius * x, curve.center[1] + curve.radius * y]);
    }
  } else {
    for (let step = curve.steps; step > 0; step--) {
      const [x, y] = UNIT[(curve.startIndex + step) % 32];
      result.push([curve.center[0] + curve.radius * x, curve.center[1] + curve.radius * y]);
    }
  }
  return result;
}
function planarFaceLoops(solid) {
  const top = solid.faces.find((face) =>
    face.surface.kind === "plane" && face.surface.normal?.[2] === 1
  );
  if (!top) throw new Error("B-rep has no upward planar face");
  return top.loops.map((loopId) =>
    solid.loops[loopId].coedges.flatMap((coedgeId) => sampleCoedge(solid, coedgeId))
  );
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

/** Traverse plane/cylinder face loops from the final B-rep and tessellate the closed shell. */
function tessellateFaces(solid, depth) {
  validateBrepTopology(solid);
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

function encode(tree, mesh) {
  const { contract: c, solid } = tree;
  const topology = validateBrepTopology(solid);
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
  view.setUint32(40, topology.coedges, true);
  view.setUint32(44, topology.loops, true);
  view.setInt32(48, topology.eulerCharacteristic, true);
  view.setUint32(52, topology.connectedComponents, true);
  view.setUint32(56, topology.shells, true);
  view.setUint32(60, 0, true);
  const counters = {
    ...solid.counters,
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
/** @param {{allocations: number} | undefined} execution */
function execute(input, execution = undefined) {
  const tree = buildFeatureTree(input);
  const output = encode(tree, tessellateFaces(tree.solid, tree.contract.depth));
  if (execution) execution.allocations++;
  return output;
}

function validateTriangleTopology(values) {
  const edges = new Map();
  const vertices = new Set();
  const triangleAdjacency = Array.from({ length: values.length / 9 }, () => new Set());
  const vertexKey = (offset) =>
    [values[offset], values[offset + 1], values[offset + 2]].map((value) => Math.round(value * 1e9))
      .join(",");
  for (let offset = 0; offset < values.length; offset += 9) {
    const triangle = offset / 9;
    const triangleVertices = [vertexKey(offset), vertexKey(offset + 3), vertexKey(offset + 6)];
    for (const vertex of triangleVertices) vertices.add(vertex);
    for (let edge = 0; edge < 3; edge++) {
      const a = triangleVertices[edge], b = triangleVertices[(edge + 1) % 3];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const item = edges.get(key) ?? { count: 0, orientation: 0, triangles: [] };
      item.count++;
      item.orientation += a < b ? 1 : -1;
      item.triangles.push(triangle);
      edges.set(key, item);
    }
  }
  for (const edge of edges.values()) {
    if (edge.count !== 2 || edge.orientation !== 0) {
      throw new Error("bracket tessellation is not a closed oriented 2-manifold");
    }
    const [a, b] = edge.triangles;
    triangleAdjacency[a].add(b);
    triangleAdjacency[b].add(a);
  }
  let connectedComponents = 0;
  const visited = new Set();
  for (let start = 0; start < triangleAdjacency.length; start++) {
    if (visited.has(start)) continue;
    connectedComponents++;
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      for (const next of triangleAdjacency[stack.pop()]) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
  }
  const eulerCharacteristic = vertices.size - edges.size + triangleAdjacency.length;
  const genus = connectedComponents - eulerCharacteristic / 2;
  if (!Number.isInteger(genus) || genus < 0) {
    throw new Error("invalid tessellation Euler characteristic");
  }
  return {
    watertight: true,
    oriented: true,
    tessellationEdges: edges.size,
    connectedComponents,
    shells: connectedComponents,
    genus,
    eulerCharacteristic,
  };
}
function digest64(bytes) {
  let h = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    h ^= BigInt(byte);
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return h.toString(16).padStart(16, "0");
}

/** Independent combinatorial oracle: it never calls feature construction or B-rep validation. */
function independentOracle(input) {
  if (!(input instanceof Uint8Array) || input.byteLength !== INPUT_BYTES) {
    throw new Error("oracle fixture byte length mismatch");
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const holeCount = view.getUint32(8, true);
  const fillet = view.getFloat64(48, true);
  const profileEdges = fillet > 0 ? 8 : 4;
  const faces = 2 + profileEdges + holeCount;
  const edges = 3 * profileEdges + 3 * holeCount;
  const vertices = 2 * profileEdges + 2 * holeCount;
  const loops = profileEdges + 2 + 3 * holeCount;
  const coedges = edges * 2;
  const eulerCharacteristic = vertices - edges + faces - (loops - faces);
  const genus = 1 - eulerCharacteristic / 2;
  return {
    contract: { holeCount, fillet },
    topology: {
      connectedComponents: 1,
      shells: 1,
      throughHoles: holeCount,
      genus,
      faces,
      edges,
      vertices,
      loops,
      coedges,
      eulerCharacteristic,
    },
    counters: {
      featureNodes: 2 + holeCount * 2 + (fillet > 0 ? 4 : 0),
      boxSolids: 1,
      cylinderSolids: holeCount,
      booleanCuts: holeCount,
      filletEdges: fillet > 0 ? 4 : 0,
      booleanIntersectionTests: holeCount * HOLE_SEGMENTS,
      inputBytes: INPUT_BYTES,
    },
  };
}
/**
 * @param {Uint8Array} output
 * @param {string} variantId
 * @param {Uint8Array} input
 * @param {{allocations: number, boundaryCrossings: number} | undefined} execution
 */
export function decodeResult(output, variantId, input = generateFixture(), execution = undefined) {
  if (!VARIANTS.includes(variantId)) throw new Error("unknown bracket variant");
  if (!(output instanceof Uint8Array) || output.byteLength < OUTPUT_HEADER_BYTES) {
    throw new Error("bracket output byte length mismatch");
  }
  inputContract(input);
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
    coedges: view.getUint32(40, true),
    loops: view.getUint32(44, true),
    eulerCharacteristic: view.getInt32(48, true),
    connectedComponents: view.getUint32(52, true),
    shells: view.getUint32(56, true),
  };
  for (const name of Object.keys(headerTopology)) {
    if (headerTopology[name] !== oracle.topology[name]) {
      throw new Error(`bracket topology header mismatch: ${name}`);
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
  for (const name of ["connectedComponents", "shells", "genus", "eulerCharacteristic"]) {
    if (meshTopology[name] !== oracle.topology[name]) {
      throw new Error(`independent mesh Euler oracle mismatch: ${name}`);
    }
  }
  if (
    !execution || !Number.isSafeInteger(execution.allocations) ||
    !Number.isSafeInteger(execution.boundaryCrossings)
  ) {
    throw new Error("missing operative execution counters");
  }
  return {
    workloadId: WORKLOAD_ID,
    variantId,
    output,
    completeOutputDigest: digest64(output),
    topology: {
      connectedComponents: meshTopology.connectedComponents,
      shells: meshTopology.shells,
      throughHoles: oracle.topology.throughHoles,
      genus: meshTopology.genus,
      faces: headerTopology.faces,
      edges: headerTopology.edges,
      vertices: headerTopology.vertices,
      loops: headerTopology.loops,
      coedges: headerTopology.coedges,
      eulerCharacteristic: meshTopology.eulerCharacteristic,
      watertight: meshTopology.watertight,
      oriented: meshTopology.oriented,
      tessellationEdges: meshTopology.tessellationEdges,
    },
    triangleCount,
    counters: { ...counters, ...execution },
  };
}
export function runJavaScript(input = generateFixture()) {
  const execution = { allocations: 0, boundaryCrossings: 0 };
  const output = execute(input, execution);
  return decodeResult(output, "js-controlled", input, execution);
}
export async function instantiateBracketWasm(bytes) {
  return (await WebAssembly.instantiate(bytes, {})).instance.exports;
}
export function runWasm(exports, input = generateFixture()) {
  inputContract(input);
  let boundaryCrossings = 0;
  new Uint8Array(exports.memory.buffer, exports.input_ptr(), INPUT_BYTES).set(input);
  boundaryCrossings++;
  const length = exports.run();
  boundaryCrossings++;
  if (!Number.isSafeInteger(length) || length < OUTPUT_HEADER_BYTES) {
    throw new Error("bracket Wasm execution failed");
  }
  let allocations = 0;
  const output = new Uint8Array(exports.memory.buffer, exports.output_ptr(), length).slice();
  allocations++;
  return decodeResult(output, "wasm-linear-controlled", input, {
    allocations,
    boundaryCrossings,
  });
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
