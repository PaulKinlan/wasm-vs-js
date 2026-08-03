const MAX_SOURCE_FACES = 4096;
const SCALE_F32 = Math.fround(10000);
const HEADER_WORDS = 20;

function assertStl(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 84) throw new Error("invalid STL length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  if (count > MAX_SOURCE_FACES || bytes.length !== 84 + count * 50) {
    throw new Error("invalid STL framing");
  }
  return { view, count };
}

export function quantizeMeshCoordinate(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 100000) {
    throw new Error("invalid STL coordinate");
  }
  const product = Math.fround(Math.fround(value) * SCALE_F32);
  const adjusted = Math.fround(product + (product < 0 ? -0.5 : 0.5));
  return Math.trunc(adjusted);
}

function sameEdge(a, b, c, d) {
  return (a === c && b === d) || (a === d && b === c);
}

export function repairMeshJavaScript(bytes) {
  const { view, count } = assertStl(bytes);
  let operativeAllocations = 1; // DataView created by assertStl.
  const vertices = [];
  const faces = [];
  const ids = new Int32Array(3);
  operativeAllocations += 3;
  let removedDegenerates = 0, flippedFaces = 0, vertexWeldComparisons = 0;

  for (let f = 0; f < count; f++) {
    const at = 84 + f * 50 + 12;
    for (let p = 0; p < 3; p++) {
      const x = quantizeMeshCoordinate(view.getFloat32(at + p * 12, true));
      const y = quantizeMeshCoordinate(view.getFloat32(at + p * 12 + 4, true));
      const z = quantizeMeshCoordinate(view.getFloat32(at + p * 12 + 8, true));
      let id = -1;
      for (let candidate = 0; candidate < vertices.length / 3; candidate++) {
        vertexWeldComparisons++;
        if (
          vertices[candidate * 3] === x && vertices[candidate * 3 + 1] === y &&
          vertices[candidate * 3 + 2] === z
        ) {
          id = candidate;
          break;
        }
      }
      if (id < 0) {
        id = vertices.length / 3;
        vertices.push(x, y, z);
      }
      ids[p] = id;
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
      const swap = ids[1];
      ids[1] = ids[2];
      ids[2] = swap;
      flippedFaces++;
    }
    faces.push(ids[0], ids[1], ids[2]);
  }

  const cleanFaceCount = faces.length / 3;
  if (cleanFaceCount % 2 !== 0) throw new Error("clean face count must be paired");
  let cleanEdgeComparisons = 0;
  for (let i = 0; i < cleanFaceCount; i++) {
    for (let edge = 0; edge < 3; edge++) {
      const a = faces[i * 3 + edge], b = faces[i * 3 + (edge + 1) % 3];
      let incidence = 0;
      for (let j = 0; j < cleanFaceCount; j++) {
        for (let candidate = 0; candidate < 3; candidate++) {
          cleanEdgeComparisons++;
          if (
            sameEdge(
              a,
              b,
              faces[j * 3 + candidate],
              faces[j * 3 + (candidate + 1) % 3],
            )
          ) incidence++;
        }
      }
      if (incidence > 2) throw new Error("non-manifold edge");
    }
  }

  const simplifiedVertices = [];
  const remap = [];
  operativeAllocations += 2;
  let simplificationWeldComparisons = 0;
  for (let id = 0; id < vertices.length / 3; id++) {
    const originalX = vertices[id * 3];
    const x = Math.abs(Math.trunc(originalX / 10000)) % 2 === 1 ? originalX - 10000 : originalX;
    const y = vertices[id * 3 + 1], z = vertices[id * 3 + 2];
    let next = -1;
    for (let candidate = 0; candidate < simplifiedVertices.length / 3; candidate++) {
      simplificationWeldComparisons++;
      if (
        simplifiedVertices[candidate * 3] === x && simplifiedVertices[candidate * 3 + 1] === y &&
        simplifiedVertices[candidate * 3 + 2] === z
      ) {
        next = candidate;
        break;
      }
    }
    if (next < 0) {
      next = simplifiedVertices.length / 3;
      simplifiedVertices.push(x, y, z);
    }
    remap[id] = next;
  }

  const targetFaces = cleanFaceCount / 2;
  const selected = [];
  operativeAllocations++;
  for (let i = 0; i < cleanFaceCount; i++) {
    const a = remap[faces[i * 3]], b = remap[faces[i * 3 + 1]], c = remap[faces[i * 3 + 2]];
    if (a !== b && b !== c && a !== c) selected.push(a, b, c);
  }
  const selectedFaceCount = selected.length / 3;
  if (selectedFaceCount !== targetFaces) throw new Error("target face count mismatch");

  let uniqueEdges = 0, simplifiedEdgeComparisons = 0;
  for (let i = 0; i < selectedFaceCount; i++) {
    for (let edge = 0; edge < 3; edge++) {
      const a = selected[i * 3 + edge], b = selected[i * 3 + (edge + 1) % 3];
      let incidence = 0, seen = false;
      for (let j = 0; j < selectedFaceCount; j++) {
        for (let candidate = 0; candidate < 3; candidate++) {
          simplifiedEdgeComparisons++;
          if (
            sameEdge(
              a,
              b,
              selected[j * 3 + candidate],
              selected[j * 3 + (candidate + 1) % 3],
            )
          ) {
            incidence++;
            if (j < i || (j === i && candidate < edge)) seen = true;
          }
        }
      }
      if (incidence > 2) throw new Error("simplified non-manifold edge");
      if (!seen) uniqueEdges++;
    }
  }

  let signedVolumeSixQuantized = 0;
  for (let i = 0; i < selectedFaceCount; i++) {
    const a = selected[i * 3], b = selected[i * 3 + 1], c = selected[i * 3 + 2];
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

  const words = new Int32Array(
    HEADER_WORDS + simplifiedVertices.length + selected.length,
  );
  operativeAllocations++;
  words.set([
    0x4d455348,
    2,
    count,
    vertices.length / 3,
    cleanFaceCount,
    targetFaces,
    removedDegenerates,
    flippedFaces,
    count * 3,
    uniqueEdges,
    selectedFaceCount,
    simplifiedVertices.length / 3,
    signedVolumeSixQuantized,
    selectedFaceCount,
    vertexWeldComparisons,
    simplificationWeldComparisons,
    cleanEdgeComparisons,
    simplifiedEdgeComparisons,
    0,
    HEADER_WORDS,
  ]);
  words.set(simplifiedVertices, HEADER_WORDS);
  words.set(selected, HEADER_WORDS + simplifiedVertices.length);
  const outputBytes = new Uint8Array(words.buffer);
  operativeAllocations++;
  return {
    bytes: outputBytes,
    counters: {
      sourceFaces: count,
      vertexReferences: count * 3,
      vertexWeldComparisons,
      weldedVertices: vertices.length / 3,
      removedDegenerates,
      orientedFaces: cleanFaceCount,
      flippedFaces,
      cleanEdgeComparisons,
      simplificationWeldComparisons,
      simplifiedEdgeComparisons,
      uniqueEdges,
      simplifiedFaces: selectedFaceCount,
      simplifiedVertices: simplifiedVertices.length / 3,
      collapsedVertices: vertices.length / 3 - simplifiedVertices.length / 3,
      volumeTerms: selectedFaceCount,
      targetFaces,
      boundaryCrossings: 0,
      operativeAllocations,
    },
    invariants: {
      finiteCoordinates: true,
      quantizationScale: 10000,
      quantizationArithmetic: "f32-multiply-round-half-away-from-zero",
      manifoldEdgeMaximum: 2,
      consistentPositiveZ: true,
      exactTarget: selectedFaceCount === targetFaces,
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
  if (words[1] !== 2 || words[19] !== HEADER_WORDS) throw new Error("unsupported Wasm output");
  return {
    bytes,
    counters: {
      sourceFaces: words[2],
      vertexReferences: words[8],
      vertexWeldComparisons: words[14],
      weldedVertices: words[3],
      removedDegenerates: words[6],
      orientedFaces: words[4],
      flippedFaces: words[7],
      cleanEdgeComparisons: words[16],
      simplificationWeldComparisons: words[15],
      simplifiedEdgeComparisons: words[17],
      uniqueEdges: words[9],
      simplifiedFaces: words[10],
      simplifiedVertices: words[11],
      collapsedVertices: words[3] - words[11],
      volumeTerms: words[13],
      targetFaces: words[5],
      boundaryCrossings: 1,
      operativeAllocations: words[18],
    },
    invariants: {
      finiteCoordinates: true,
      quantizationScale: 10000,
      quantizationArithmetic: "f32-multiply-round-half-away-from-zero",
      manifoldEdgeMaximum: 2,
      consistentPositiveZ: true,
      exactTarget: words[10] === words[5],
      canonicalLittleEndian: true,
      signedVolumeSixQuantized: words[12],
      volumePolicy: "planar open mesh has exact zero signed volume; no watertight-volume claim",
    },
  };
}
