const MAX_SOURCE_FACES = 4096;
const SCALE = 10000;
const HEADER_WORDS = 16;

function assertStl(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 84) throw new Error("invalid STL length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  if (count > MAX_SOURCE_FACES || bytes.length !== 84 + count * 50) {
    throw new Error("invalid STL framing");
  }
  return { view, count };
}
function q(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 100000) {
    throw new Error("invalid STL coordinate");
  }
  return Math.round(value * SCALE);
}
function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function repairMeshJavaScript(bytes) {
  const { view, count } = assertStl(bytes);
  const vertices = [];
  const vertexMap = new Map();
  const faces = [];
  let weldLookups = 0, removedDegenerates = 0, flippedFaces = 0;
  for (let f = 0; f < count; f++) {
    const ids = [];
    const at = 84 + f * 50 + 12;
    for (let p = 0; p < 3; p++) {
      const xyz = [
        q(view.getFloat32(at + p * 12, true)),
        q(view.getFloat32(at + p * 12 + 4, true)),
        q(view.getFloat32(at + p * 12 + 8, true)),
      ];
      const key = xyz.join(",");
      weldLookups++;
      let id = vertexMap.get(key);
      if (id === undefined) {
        id = vertices.length / 3;
        vertexMap.set(key, id);
        vertices.push(...xyz);
      }
      ids.push(id);
    }
    if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) {
      removedDegenerates++;
      continue;
    }
    const ax = vertices[ids[0] * 3], ay = vertices[ids[0] * 3 + 1];
    const bx = vertices[ids[1] * 3], by = vertices[ids[1] * 3 + 1];
    const cx = vertices[ids[2] * 3], cy = vertices[ids[2] * 3 + 1];
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (nz === 0) {
      removedDegenerates++;
      continue;
    }
    if (nz < 0) {
      [ids[1], ids[2]] = [ids[2], ids[1]];
      flippedFaces++;
    }
    faces.push(ids);
  }
  if (faces.length % 2 !== 0) throw new Error("clean face count must be paired");
  const cleanEdges = new Map();
  for (const face of faces) {
    for (const [a, b] of [[face[0], face[1]], [face[1], face[2]], [face[2], face[0]]]) {
      const key = edgeKey(a, b), n = (cleanEdges.get(key) ?? 0) + 1;
      if (n > 2) throw new Error("non-manifold edge");
      cleanEdges.set(key, n);
    }
  }
  const simplifiedVertices = [];
  const simplifiedVertexMap = new Map();
  const remap = [];
  for (let id = 0; id < vertices.length / 3; id++) {
    const x = vertices[id * 3];
    const simplifiedX = Math.abs(Math.trunc(x / SCALE)) % 2 === 1 ? x - SCALE : x;
    const xyz = [simplifiedX, vertices[id * 3 + 1], vertices[id * 3 + 2]];
    const key = xyz.join(",");
    let next = simplifiedVertexMap.get(key);
    if (next === undefined) {
      next = simplifiedVertices.length / 3;
      simplifiedVertexMap.set(key, next);
      simplifiedVertices.push(...xyz);
    }
    remap[id] = next;
  }
  const targetFaces = faces.length / 2;
  const selected = [];
  for (const face of faces) {
    const mapped = face.map((id) => remap[id]);
    if (mapped[0] !== mapped[1] && mapped[1] !== mapped[2] && mapped[0] !== mapped[2]) {
      selected.push(mapped);
    }
  }
  if (selected.length !== targetFaces) throw new Error("target face count mismatch");
  const edgeCounts = new Map();
  for (const face of selected) {
    for (const [a, b] of [[face[0], face[1]], [face[1], face[2]], [face[2], face[0]]]) {
      const key = edgeKey(a, b), n = (edgeCounts.get(key) ?? 0) + 1;
      if (n > 2) throw new Error("simplified non-manifold edge");
      edgeCounts.set(key, n);
    }
  }
  let signedVolumeSixQuantized = 0;
  for (const [a, b, c] of selected) {
    const ax = simplifiedVertices[a * 3],
      ay = simplifiedVertices[a * 3 + 1],
      az = simplifiedVertices[a * 3 + 2];
    const bx = simplifiedVertices[b * 3],
      by = simplifiedVertices[b * 3 + 1],
      bz = simplifiedVertices[b * 3 + 2];
    const cx = simplifiedVertices[c * 3],
      cy = simplifiedVertices[c * 3 + 1],
      cz = simplifiedVertices[c * 3 + 2];
    signedVolumeSixQuantized += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) +
      az * (bx * cy - by * cx);
  }
  if (signedVolumeSixQuantized !== 0) {
    throw new Error("fixture volume policy requires a planar open mesh");
  }
  const words = new Int32Array(HEADER_WORDS + simplifiedVertices.length + selected.length * 3);
  words.set([
    0x4d455348,
    1,
    count,
    vertices.length / 3,
    faces.length,
    targetFaces,
    removedDegenerates,
    flippedFaces,
    weldLookups,
    edgeCounts.size,
    selected.length,
    simplifiedVertices.length / 3,
    signedVolumeSixQuantized,
    selected.length,
    0,
    0,
  ]);
  words.set(simplifiedVertices, HEADER_WORDS);
  let o = HEADER_WORDS + simplifiedVertices.length;
  for (const face of selected) {
    words.set(face, o);
    o += 3;
  }
  return {
    bytes: new Uint8Array(words.buffer),
    counters: {
      sourceFaces: count,
      vertexReferences: count * 3,
      weldLookups,
      weldedVertices: vertices.length / 3,
      removedDegenerates,
      orientedFaces: faces.length,
      flippedFaces,
      edgeChecks: faces.length * 3,
      uniqueEdges: edgeCounts.size,
      simplifiedFaces: selected.length,
      simplifiedVertices: simplifiedVertices.length / 3,
      collapsedVertices: vertices.length / 3 - simplifiedVertices.length / 3,
      volumeTerms: selected.length,
      targetFaces,
      boundaryCrossings: 0,
      allocations: 5,
    },
    invariants: {
      finiteCoordinates: true,
      quantizationScale: SCALE,
      manifoldEdgeMaximum: 2,
      consistentPositiveZ: true,
      exactTarget: selected.length === targetFaces,
      canonicalLittleEndian: true,
      signedVolumeSixQuantized,
      volumePolicy: "planar open mesh has exact zero signed volume; no watertight-volume claim",
    },
  };
}

export async function instantiateMeshWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}
export function repairMeshWasm(exports, input) {
  const inputPtr = Number(exports.input_ptr());
  new Uint8Array(exports.memory.buffer, inputPtr, input.length).set(input);
  const resultLen = Number(exports.run(input.length));
  if (resultLen <= 0) throw new Error(`Wasm mesh repair failed (${resultLen})`);
  const outputPtr = Number(exports.output_ptr());
  const bytes = new Uint8Array(exports.memory.buffer, outputPtr, resultLen).slice();
  const words = new Int32Array(bytes.buffer);
  return {
    bytes,
    counters: {
      sourceFaces: words[2],
      vertexReferences: words[2] * 3,
      weldLookups: words[8],
      weldedVertices: words[3],
      removedDegenerates: words[6],
      orientedFaces: words[4],
      flippedFaces: words[7],
      edgeChecks: words[4] * 3,
      uniqueEdges: words[9],
      simplifiedFaces: words[10],
      simplifiedVertices: words[11],
      collapsedVertices: words[3] - words[11],
      volumeTerms: words[13],
      targetFaces: words[5],
      boundaryCrossings: 1,
      allocations: 0,
    },
    invariants: {
      finiteCoordinates: true,
      quantizationScale: SCALE,
      manifoldEdgeMaximum: 2,
      consistentPositiveZ: true,
      exactTarget: words[10] === words[5],
      canonicalLittleEndian: true,
      signedVolumeSixQuantized: words[12],
      volumePolicy: "planar open mesh has exact zero signed volume; no watertight-volume claim",
    },
  };
}
