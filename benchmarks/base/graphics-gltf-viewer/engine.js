export const CONTRACT = Object.freeze({
  workloadId: "graphics.gltf-viewer.v1",
  frames: 600,
  viewportWidth: 96,
  viewportHeight: 96,
  checkpoints: Object.freeze([0, 119, 239, 359, 479, 599]),
  pickFrames: Object.freeze([25, 75, 125, 175, 225, 275, 325, 375, 425, 475, 525, 575]),
  positionScale: 1_000_000,
  normalScale: 32_767,
  uvScale: 65_535,
  rotationScale: 1_048_576,
});

export const OUTPUT_HEADER_WORDS = 28;
export const FRAME_WORDS = 8;
export const FRAME_PIXEL_BYTES = CONTRACT.viewportWidth * CONTRACT.viewportHeight * 4;
export const OUTPUT_BYTES = OUTPUT_HEADER_WORDS * 4 + CONTRACT.frames * FRAME_WORDS * 4 +
  CONTRACT.frames * FRAME_PIXEL_BYTES;

function assertFiniteArray(name, values, expectedMultiple) {
  if (!(values instanceof Float32Array) || values.length % expectedMultiple !== 0) {
    throw new Error(`${name} must be Float32Array aligned to ${expectedMultiple}`);
  }
  for (const value of values) if (!Number.isFinite(value)) throw new Error(`${name} non-finite`);
}

export function quantizeDecodedMesh(decoded) {
  assertFiniteArray("positions", decoded.positions, 3);
  assertFiniteArray("normals", decoded.normals, 3);
  assertFiniteArray("texcoords", decoded.texcoords, 2);
  if (!(decoded.indices instanceof Uint32Array) || decoded.indices.length % 3 !== 0) {
    throw new Error("indices must be triangle Uint32Array");
  }
  const vertexCount = decoded.positions.length / 3;
  if (decoded.normals.length / 3 !== vertexCount || decoded.texcoords.length / 2 !== vertexCount) {
    throw new Error("attribute vertex counts differ");
  }
  const positions = new Int32Array(decoded.positions.length);
  const normals = new Int32Array(decoded.normals.length);
  const texcoords = new Int32Array(decoded.texcoords.length);
  for (let i = 0; i < positions.length; i++) {
    positions[i] = Math.round(decoded.positions[i] * CONTRACT.positionScale);
  }
  for (let i = 0; i < normals.length; i++) {
    normals[i] = Math.max(
      -CONTRACT.normalScale,
      Math.min(CONTRACT.normalScale, Math.round(decoded.normals[i] * CONTRACT.normalScale)),
    );
  }
  for (let i = 0; i < texcoords.length; i++) {
    texcoords[i] = Math.max(
      0,
      Math.min(CONTRACT.uvScale, Math.round(decoded.texcoords[i] * CONTRACT.uvScale)),
    );
  }
  for (const index of decoded.indices) {
    if (index >= vertexCount) throw new Error("index out of range");
  }
  return { positions, normals, texcoords, indices: decoded.indices.slice(), vertexCount };
}

export function makeAnimationTable() {
  const table = new Int32Array(CONTRACT.frames * 3);
  for (let frame = 0; frame < CONTRACT.frames; frame++) {
    const angle = (frame * Math.PI * 2) / CONTRACT.frames;
    table[frame * 3] = Math.round(Math.cos(angle) * CONTRACT.rotationScale);
    table[frame * 3 + 1] = Math.round(Math.sin(angle) * CONTRACT.rotationScale);
    table[frame * 3 + 2] = Math.round(Math.sin(angle * 2) * 4000);
  }
  return table;
}

export function validateGltfContract(jsonText) {
  const gltf = JSON.parse(jsonText);
  if (gltf.asset?.version !== "2.0") throw new Error("glTF 2.0 required");
  const primitive = gltf.meshes?.[0]?.primitives?.[0];
  const extension = primitive?.extensions?.KHR_draco_mesh_compression;
  if (!extension || extension.bufferView !== 0 || primitive.mode !== 4) {
    throw new Error("fixed Draco triangle primitive missing");
  }
  const attrs = extension.attributes;
  const expected = { TEXCOORD_0: 0, NORMAL: 1, TANGENT: 2, POSITION: 3 };
  for (const [name, id] of Object.entries(expected)) {
    if (attrs?.[name] !== id) throw new Error(`Draco attribute ${name} mismatch`);
  }
  if (gltf.accessors?.[0]?.count !== 2046 || gltf.accessors?.[4]?.count !== 406) {
    throw new Error("fixed accessor counts mismatch");
  }
  const material = gltf.materials?.[0];
  if (material?.alphaMode !== "OPAQUE" || material?.doubleSided !== false) {
    throw new Error("fixed material policy mismatch");
  }
  if (!gltf.extensionsRequired?.includes("KHR_draco_mesh_compression")) {
    throw new Error("Draco extension must be required");
  }
  return { attributeIds: expected, indexCount: 2046, vertexCount: 406 };
}

function divTrunc(value, divisor) {
  return Math.trunc(value / divisor);
}
function hashWord(hash, value) {
  hash ^= value >>> 0;
  return Math.imul(hash, 16777619) >>> 0;
}
function edge(ax, ay, bx, by, px, py) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

export function normalizeControlledOutput(output) {
  if (!(output instanceof Uint8Array) || output.length !== OUTPUT_BYTES) {
    throw new Error("output size mismatch");
  }
  const normalized = output.slice();
  const words = new Uint32Array(normalized.buffer);
  words[14] = 0; // target-specific total JS/Wasm boundary crossings
  words[15] = 0; // target-specific explicit harness/engine allocations
  words[19] = 0; // target identity marker
  words[20] = 0; // target-specific decoder allocations
  words[22] = 0; // target-specific Draco JS/Wasm crossings
  words[23] = 0; // target-specific engine JS/Wasm crossings
  words[24] = 0; // target-specific engine allocations
  return normalized;
}

export function runJavaScript(
  mesh,
  texture,
  animation = makeAnimationTable(),
  decoderMetrics = { allocations: 18, apiCalls: 6002, wasmBoundaryCrossings: 0 },
) {
  const { positions, normals, texcoords, indices, vertexCount } = mesh;
  if (!(texture instanceof Uint8Array) || texture.length !== 64 * 64 * 4) {
    throw new Error("64x64 RGBA texture required");
  }
  if (!(animation instanceof Int32Array) || animation.length !== CONTRACT.frames * 3) {
    throw new Error("animation table mismatch");
  }
  const output = new Uint8Array(OUTPUT_BYTES);
  const words = new Uint32Array(output.buffer);
  const frames = new Int32Array(
    output.buffer,
    OUTPUT_HEADER_WORDS * 4,
    CONTRACT.frames * FRAME_WORDS,
  );
  const sx = new Int32Array(vertexCount);
  const sy = new Int32Array(vertexCount);
  const sz = new Int32Array(vertexCount);
  const rny = new Int32Array(vertexCount);
  const framePixels = new Uint8Array(CONTRACT.viewportWidth * CONTRACT.viewportHeight * 4);
  const depthBuffer = new Int32Array(CONTRACT.viewportWidth * CONTRACT.viewportHeight);
  const pixelsOffset = (OUTPUT_HEADER_WORDS + CONTRACT.frames * FRAME_WORDS) * 4;
  let visibleTotal = 0;
  let pickHits = 0;
  let transformHash = 2166136261;
  let drawHash = 2166136261;
  let rasterizedPixels = 0;
  for (let frame = 0; frame < CONTRACT.frames; frame++) {
    const cos = animation[frame * 3];
    const sin = animation[frame * 3 + 1];
    const bounce = animation[frame * 3 + 2];
    let minX = 2_147_483_647, minY = 2_147_483_647, maxX = -2_147_483_648, maxY = -2_147_483_648;
    for (let i = 0; i < vertexCount; i++) {
      const p = i * 3;
      const x = -positions[p]; // fixed node quaternion [0,1,0,0]
      const y = -positions[p + 1] + bounce;
      const z = positions[p + 2];
      const rx = divTrunc(x * cos - z * sin, CONTRACT.rotationScale);
      const rz = divTrunc(x * sin + z * cos, CONTRACT.rotationScale);
      const depth = 2_000_000 + rz;
      sx[i] = 48 + divTrunc(rx * 1000, depth);
      sy[i] = 58 - divTrunc(y * 1000, depth);
      sz[i] = depth;
      rny[i] = -normals[p + 1];
      minX = Math.min(minX, sx[i]);
      minY = Math.min(minY, sy[i]);
      maxX = Math.max(maxX, sx[i]);
      maxY = Math.max(maxY, sy[i]);
      transformHash = hashWord(transformHash, sx[i]);
      transformHash = hashWord(transformHash, sy[i]);
      transformHash = hashWord(transformHash, depth);
    }
    let visible = 0;
    let picked = -1;
    let bestPickDepth = 2_147_483_647;
    const pick = frame >= 25 && frame <= 575 && (frame - 25) % 50 === 0;
    const pickX = 48 + ((frame / 50 | 0) % 3 - 1) * 4;
    const pickY = 70 + ((frame / 50 | 0) % 2) * 6;
    for (let tri = 0; tri < indices.length / 3; tri++) {
      const a = indices[tri * 3], b = indices[tri * 3 + 1], c = indices[tri * 3 + 2];
      const area = edge(sx[a], sy[a], sx[b], sy[b], sx[c], sy[c]);
      if (area >= 0) continue;
      visible++;
      drawHash = hashWord(drawHash, tri);
      drawHash = hashWord(drawHash, frame);
      if (pick) {
        const e0 = edge(sx[a], sy[a], sx[b], sy[b], pickX, pickY);
        const e1 = edge(sx[b], sy[b], sx[c], sy[c], pickX, pickY);
        const e2 = edge(sx[c], sy[c], sx[a], sy[a], pickX, pickY);
        if (e0 <= 0 && e1 <= 0 && e2 <= 0) {
          const depth = Math.trunc((sz[a] + sz[b] + sz[c]) / 3);
          if (depth < bestPickDepth) {
            bestPickDepth = depth;
            picked = tri;
          }
        }
      }
    }
    if (pick && picked >= 0) pickHits++;
    visibleTotal += visible;
    const fo = frame * FRAME_WORDS;
    frames[fo] = minX;
    frames[fo + 1] = minY;
    frames[fo + 2] = maxX;
    frames[fo + 3] = maxY;
    frames[fo + 4] = visible;
    frames[fo + 5] = picked;
    frames[fo + 6] = transformHash | 0;
    frames[fo + 7] = drawHash | 0;
    framePixels.fill(0);
    depthBuffer.fill(2_147_483_647);
    for (let tri = 0; tri < indices.length / 3; tri++) {
      const a = indices[tri * 3], b = indices[tri * 3 + 1], c = indices[tri * 3 + 2];
      const area = edge(sx[a], sy[a], sx[b], sy[b], sx[c], sy[c]);
      if (area >= 0) continue;
      const loX = Math.max(0, Math.min(sx[a], sx[b], sx[c]));
      const hiX = Math.min(95, Math.max(sx[a], sx[b], sx[c]));
      const loY = Math.max(0, Math.min(sy[a], sy[b], sy[c]));
      const hiY = Math.min(95, Math.max(sy[a], sy[b], sy[c]));
      const avgDepth = Math.trunc((sz[a] + sz[b] + sz[c]) / 3);
      const u = Math.max(0, Math.min(63, divTrunc(texcoords[a * 2] * 63, CONTRACT.uvScale)));
      const v = Math.max(0, Math.min(63, divTrunc(texcoords[a * 2 + 1] * 63, CONTRACT.uvScale)));
      const ti = (v * 64 + u) * 4;
      const light = Math.max(
        64,
        Math.min(255, 128 + divTrunc(rny[a] * 127, CONTRACT.normalScale)),
      );
      for (let y = loY; y <= hiY; y++) {
        for (let x = loX; x <= hiX; x++) {
          const e0 = edge(sx[a], sy[a], sx[b], sy[b], x, y);
          const e1 = edge(sx[b], sy[b], sx[c], sy[c], x, y);
          const e2 = edge(sx[c], sy[c], sx[a], sy[a], x, y);
          const pi = y * 96 + x;
          if (e0 <= 0 && e1 <= 0 && e2 <= 0 && avgDepth < depthBuffer[pi]) {
            depthBuffer[pi] = avgDepth;
            const po = pi * 4;
            framePixels[po] = divTrunc(texture[ti] * light, 255);
            framePixels[po + 1] = divTrunc(texture[ti + 1] * light, 255);
            framePixels[po + 2] = divTrunc(texture[ti + 2] * light, 255);
            framePixels[po + 3] = 255;
            rasterizedPixels++;
          }
        }
      }
    }
    output.set(framePixels, pixelsOffset + frame * FRAME_PIXEL_BYTES);
  }
  words[0] = 0x474c5446;
  words[1] = vertexCount;
  words[2] = indices.length;
  words[3] = CONTRACT.frames;
  words[4] = visibleTotal;
  words[5] = pickHits;
  words[6] = transformHash;
  words[7] = drawHash;
  words[8] = rasterizedPixels;
  words[9] = vertexCount * CONTRACT.frames;
  words[10] = (indices.length / 3) * CONTRACT.frames * 2;
  words[11] = CONTRACT.frames;
  words[12] = CONTRACT.frames;
  words[13] = CONTRACT.pickFrames.length;
  words[14] = decoderMetrics.wasmBoundaryCrossings;
  words[15] = decoderMetrics.allocations + 9;
  words[16] = positions.byteLength + normals.byteLength + texcoords.byteLength +
    indices.byteLength + texture.byteLength;
  words[17] = output.byteLength;
  words[18] = 1;
  words[19] = 0;
  words[20] = decoderMetrics.allocations;
  words[21] = decoderMetrics.apiCalls;
  words[22] = decoderMetrics.wasmBoundaryCrossings;
  words[23] = 0;
  words[24] = 9;
  words[25] = CONTRACT.frames;
  words[26] = CONTRACT.frames;
  words[27] = 0;
  return output;
}
