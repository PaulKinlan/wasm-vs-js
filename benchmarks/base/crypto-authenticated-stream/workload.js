import {
  bytesEqual,
  instantiateAeadWasm,
  openJavaScript,
  openWasm,
  sealJavaScript,
  sealWasm,
} from "./engine.js";

export const WORKLOAD_ID = "crypto.authenticated-stream.v1";
export const FRAME_COUNT = 10_000;
export const FRAME_SIZES = Object.freeze([
  0,
  1,
  15,
  16,
  17,
  31,
  32,
  63,
  64,
  65,
  127,
  128,
  255,
  256,
  511,
  1024,
]);
export const KEY = Uint8Array.from([
  0x80,
  0x81,
  0x82,
  0x83,
  0x84,
  0x85,
  0x86,
  0x87,
  0x88,
  0x89,
  0x8a,
  0x8b,
  0x8c,
  0x8d,
  0x8e,
  0x8f,
  0x90,
  0x91,
  0x92,
  0x93,
  0x94,
  0x95,
  0x96,
  0x97,
  0x98,
  0x99,
  0x9a,
  0x9b,
  0x9c,
  0x9d,
  0x9e,
  0x9f,
]);
const SESSION = Uint8Array.from([
  0x57,
  0x41,
  0x53,
  0x4d,
  0x2d,
  0x56,
  0x53,
  0x2d,
  0x4a,
  0x53,
  0x2d,
  0x31,
]);

function xorshift32(value) {
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function frameAt(index) {
  if (!Number.isInteger(index) || index < 0 || index >= FRAME_COUNT) {
    throw new Error("frame index out of range");
  }
  const size = FRAME_SIZES[index % FRAME_SIZES.length];
  const plaintext = new Uint8Array(size);
  let state = (0x6d2b79f5 ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  for (let offset = 0; offset < size; offset++) {
    state = xorshift32(state);
    plaintext[offset] = state >>> 24;
  }
  const nonce = new Uint8Array(12);
  nonce.set([0x43, 0x41, 0x53, 0x31]);
  new DataView(nonce.buffer).setBigUint64(4, BigInt(index), true);
  const aad = new Uint8Array(24);
  const view = new DataView(aad.buffer);
  view.setUint32(0, index, true);
  view.setUint32(4, size, true);
  view.setUint32(8, index % 7, true);
  aad.set(SESSION, 12);
  return { index, plaintext, nonce, aad };
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function transcriptRecord(index, ciphertext, tag) {
  const bytes = new Uint8Array(8 + ciphertext.length + tag.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, index, true);
  view.setUint32(4, ciphertext.length, true);
  bytes.set(ciphertext, 8);
  bytes.set(tag, 8 + ciphertext.length);
  return bytes;
}

function plaintextRecord(index, plaintext) {
  const bytes = new Uint8Array(8 + plaintext.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, index, true);
  view.setUint32(4, plaintext.length, true);
  bytes.set(plaintext, 8);
  return bytes;
}

function concatenate(parts, length) {
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  if (offset !== length) throw new Error("transcript length mismatch");
  return output;
}

/**
 * @param {"js-controlled"|"wasm-linear-controlled"} variant
 * @param {Uint8Array|null} wasmBytes
 * @param {number} frameCount
 */
export async function runWorkload(variant, wasmBytes = null, frameCount = FRAME_COUNT) {
  if (variant !== "js-controlled" && variant !== "wasm-linear-controlled") {
    throw new Error("unknown variant");
  }
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > FRAME_COUNT) {
    throw new Error("invalid frame count");
  }
  const runtime = variant === "wasm-linear-controlled"
    ? await instantiateAeadWasm(wasmBytes)
    : null;
  const cipherRecords = [];
  const plainRecords = [];
  let payloadBytes = 0;
  let cipherTranscriptBytes = 0;
  let plainTranscriptBytes = 0;
  let streamBlocks = 0;
  let polyBlocks = 0;
  let tamperRejections = 0;
  for (let index = 0; index < frameCount; index++) {
    const { plaintext, nonce, aad } = frameAt(index);
    const sealed = runtime
      ? sealWasm(runtime, KEY, nonce, aad, plaintext)
      : sealJavaScript(KEY, nonce, aad, plaintext);
    const opened = runtime
      ? openWasm(runtime, KEY, nonce, aad, sealed.ciphertext, sealed.tag)
      : openJavaScript(KEY, nonce, aad, sealed.ciphertext, sealed.tag);
    if (opened === null || !bytesEqual(opened, plaintext)) {
      throw new Error(`frame ${index} complete open mismatch`);
    }
    if (index === 0 || index === frameCount - 1 || index % 997 === 0) {
      const badTag = sealed.tag.slice();
      badTag[index & 15] ^= 1;
      const rejected = runtime
        ? openWasm(runtime, KEY, nonce, aad, sealed.ciphertext, badTag)
        : openJavaScript(KEY, nonce, aad, sealed.ciphertext, badTag);
      if (rejected !== null) throw new Error(`frame ${index} accepted a changed tag`);
      tamperRejections++;
    }
    const cipherRecord = transcriptRecord(index, sealed.ciphertext, sealed.tag);
    const plainRecord = plaintextRecord(index, opened);
    cipherRecords.push(cipherRecord);
    plainRecords.push(plainRecord);
    cipherTranscriptBytes += cipherRecord.length;
    plainTranscriptBytes += plainRecord.length;
    payloadBytes += plaintext.length;
    streamBlocks += 2 * (1 + Math.ceil(plaintext.length / 64));
    polyBlocks += 2 * (Math.ceil(aad.length / 16) + Math.ceil(plaintext.length / 16) + 1);
  }
  const cipherTranscript = concatenate(cipherRecords, cipherTranscriptBytes);
  const plainTranscript = concatenate(plainRecords, plainTranscriptBytes);
  const counters = {
    frames: frameCount,
    sealOperations: frameCount,
    openOperations: frameCount,
    payloadBytes,
    associatedDataBytes: frameCount * 24 * 2,
    ciphertextBytes: payloadBytes,
    tagBytes: frameCount * 16,
    chacha20Blocks: streamBlocks,
    poly1305Blocks: polyBlocks,
    tamperRejections,
    ownedTranscriptAllocations: frameCount * 2 + 2,
    boundaryCrossings: runtime ? frameCount * 2 + tamperRejections : 0,
  };
  return {
    workloadId: WORKLOAD_ID,
    variant,
    target: runtime ? "linear-wasm" : "javascript",
    algorithm: "RFC 8439 ChaCha20-Poly1305 with fixed 96-bit nonce schedule",
    frameCount,
    cipherTranscriptSha256: await sha256(cipherTranscript),
    plaintextTranscriptSha256: await sha256(plainTranscript),
    counters,
    oracle: {
      allFramesOpened: true,
      allTagsVerifiedBeforeOpen: true,
      nonceCount: frameCount,
      nonceReuse: 0,
      sampledTamperRejections: tamperRejections,
    },
  };
}
