const GRID = 32;
const VALID_FACES = GRID * GRID * 2;
const DEGENERATE_FACES = 64;
const encoder = new TextEncoder();

function writeVertex(view, offset, x, y, z) {
  view.setFloat32(offset, x, true);
  view.setFloat32(offset + 4, y, true);
  view.setFloat32(offset + 8, z, true);
}

export function generateDirtyStl() {
  const faceCount = VALID_FACES + DEGENERATE_FACES;
  const bytes = new Uint8Array(84 + faceCount * 50);
  bytes.set(encoder.encode("wasm-vs-js cad.mesh-repair.v1 generated grid seed 0x4d455348"), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, faceCount, true);
  let face = 0;
  const emit = (vertices, reverse = false) => {
    const at = 84 + face * 50;
    const order = reverse ? [0, 2, 1] : [0, 1, 2];
    for (let i = 0; i < 3; i++) writeVertex(view, at + 12 + i * 12, ...vertices[order[i]]);
    face++;
  };
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const a = [x, y, 0], b = [x + 1, y, 0], c = [x + 1, y + 1, 0], d = [x, y + 1, 0];
      const cell = y * GRID + x;
      emit([a, b, c], cell % 5 === 0);
      emit([a, c, d], cell % 7 === 0);
    }
  }
  for (let i = 0; i < DEGENERATE_FACES; i++) {
    const x = i % GRID, y = Math.floor(i / GRID);
    emit([[x, y, 0], [x, y, 0], [x, y, 0]]);
  }
  return bytes;
}

export const fixtureParameters = Object.freeze({
  seed: "0x4d455348",
  grid: GRID,
  sourceFaces: VALID_FACES + DEGENERATE_FACES,
  validFaces: VALID_FACES,
  degenerateFaces: DEGENERATE_FACES,
  weldedVertices: (GRID + 1) * (GRID + 1),
  targetFaces: VALID_FACES / 2,
  quantizationScale: 10000,
  simplificationPolicy:
    "collapse every odd quantized X column onto its preceding even X column, then remove collapsed faces",
});
