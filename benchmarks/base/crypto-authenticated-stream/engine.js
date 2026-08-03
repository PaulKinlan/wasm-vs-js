const MASK_32 = 0xffff_ffff;
const P1305 = (1n << 130n) - 5n;
const P128 = (1n << 128n) - 1n;

function readU32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;
}

function writeU32(bytes, offset, value) {
  bytes[offset] = value;
  bytes[offset + 1] = value >>> 8;
  bytes[offset + 2] = value >>> 16;
  bytes[offset + 3] = value >>> 24;
}

function rotl(value, count) {
  return ((value << count) | (value >>> (32 - count))) >>> 0;
}

function quarter(state, a, b, c, d) {
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotl(state[d] ^ state[a], 16);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotl(state[b] ^ state[c], 12);
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotl(state[d] ^ state[a], 8);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotl(state[b] ^ state[c], 7);
}

export function chacha20Block(key, counter, nonce) {
  if (key.length !== 32 || nonce.length !== 12) throw new Error("ChaCha20 key/nonce length");
  const initial = new Uint32Array(16);
  initial.set([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);
  for (let index = 0; index < 8; index++) initial[4 + index] = readU32(key, index * 4);
  initial[12] = counter >>> 0;
  initial[13] = readU32(nonce, 0);
  initial[14] = readU32(nonce, 4);
  initial[15] = readU32(nonce, 8);
  const state = initial.slice();
  for (let round = 0; round < 10; round++) {
    quarter(state, 0, 4, 8, 12);
    quarter(state, 1, 5, 9, 13);
    quarter(state, 2, 6, 10, 14);
    quarter(state, 3, 7, 11, 15);
    quarter(state, 0, 5, 10, 15);
    quarter(state, 1, 6, 11, 12);
    quarter(state, 2, 7, 8, 13);
    quarter(state, 3, 4, 9, 14);
  }
  const output = new Uint8Array(64);
  for (let index = 0; index < 16; index++) {
    writeU32(output, index * 4, (state[index] + initial[index]) & MASK_32);
  }
  return output;
}

function littleBigInt(bytes) {
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index--) {
    value = (value << 8n) | BigInt(bytes[index]);
  }
  return value;
}

function bigIntLittle(value, length) {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index++) {
    bytes[index] = Number(value & 255n);
    value >>= 8n;
  }
  return bytes;
}

export function poly1305(message, oneTimeKey) {
  if (oneTimeKey.length !== 32) throw new Error("Poly1305 key length");
  const rBytes = oneTimeKey.slice(0, 16);
  rBytes[3] &= 15;
  rBytes[7] &= 15;
  rBytes[11] &= 15;
  rBytes[15] &= 15;
  rBytes[4] &= 252;
  rBytes[8] &= 252;
  rBytes[12] &= 252;
  const r = littleBigInt(rBytes);
  const s = littleBigInt(oneTimeKey.subarray(16));
  let accumulator = 0n;
  for (let offset = 0; offset < message.length; offset += 16) {
    const block = message.subarray(offset, Math.min(offset + 16, message.length));
    const n = littleBigInt(block) + (1n << BigInt(block.length * 8));
    accumulator = ((accumulator + n) * r) % P1305;
  }
  return bigIntLittle((accumulator + s) & P128, 16);
}

function paddedLength(length) {
  return (length + 15) & ~15;
}

function writeU64(bytes, offset, value) {
  let n = BigInt(value);
  for (let index = 0; index < 8; index++) {
    bytes[offset + index] = Number(n & 255n);
    n >>= 8n;
  }
}

function macInput(aad, ciphertext) {
  const aadPadded = paddedLength(aad.length);
  const cipherPadded = paddedLength(ciphertext.length);
  const bytes = new Uint8Array(aadPadded + cipherPadded + 16);
  bytes.set(aad, 0);
  bytes.set(ciphertext, aadPadded);
  writeU64(bytes, aadPadded + cipherPadded, aad.length);
  writeU64(bytes, aadPadded + cipherPadded + 8, ciphertext.length);
  return bytes;
}

function streamXor(key, nonce, input) {
  const output = new Uint8Array(input.length);
  for (let offset = 0, counter = 1; offset < input.length; offset += 64, counter++) {
    const block = chacha20Block(key, counter, nonce);
    const count = Math.min(64, input.length - offset);
    for (let index = 0; index < count; index++) {
      output[offset + index] = input[offset + index] ^ block[index];
    }
  }
  return output;
}

function equalTag(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function sealJavaScript(key, nonce, aad, plaintext) {
  const polyKey = chacha20Block(key, 0, nonce).subarray(0, 32);
  const ciphertext = streamXor(key, nonce, plaintext);
  const tag = poly1305(macInput(aad, ciphertext), polyKey);
  return { ciphertext, tag };
}

export function openJavaScript(key, nonce, aad, ciphertext, tag) {
  const polyKey = chacha20Block(key, 0, nonce).subarray(0, 32);
  const expected = poly1305(macInput(aad, ciphertext), polyKey);
  if (!equalTag(expected, tag)) return null;
  return streamXor(key, nonce, ciphertext);
}

const KEY_OFF = 0;
const NONCE_OFF = 32;
const AAD_OFF = 64;
const INPUT_OFF = 256;
const OUTPUT_OFF = 131072;
const TAG_OFF = 262144;

export async function instantiateAeadWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports;
  if (
    !(exports.memory instanceof WebAssembly.Memory) || typeof exports.seal !== "function" ||
    typeof exports.open !== "function"
  ) throw new Error("invalid AEAD Wasm exports");
  return exports;
}

function copyInputs(memory, key, nonce, aad, input, tag = null) {
  if (aad.length > INPUT_OFF - AAD_OFF || input.length > OUTPUT_OFF - INPUT_OFF) {
    throw new Error("AEAD input exceeds fixed memory layout");
  }
  const bytes = new Uint8Array(memory.buffer);
  bytes.set(key, KEY_OFF);
  bytes.set(nonce, NONCE_OFF);
  bytes.set(aad, AAD_OFF);
  bytes.set(input, INPUT_OFF);
  if (tag) bytes.set(tag, TAG_OFF);
}

export function sealWasm(exports, key, nonce, aad, plaintext) {
  copyInputs(exports.memory, key, nonce, aad, plaintext);
  const written = exports.seal(
    KEY_OFF,
    NONCE_OFF,
    AAD_OFF,
    aad.length,
    INPUT_OFF,
    plaintext.length,
    OUTPUT_OFF,
    TAG_OFF,
  );
  if (written !== plaintext.length) throw new Error("Wasm seal length mismatch");
  const bytes = new Uint8Array(exports.memory.buffer);
  return {
    ciphertext: bytes.slice(OUTPUT_OFF, OUTPUT_OFF + written),
    tag: bytes.slice(TAG_OFF, TAG_OFF + 16),
  };
}

export function openWasm(exports, key, nonce, aad, ciphertext, tag) {
  copyInputs(exports.memory, key, nonce, aad, ciphertext, tag);
  const written = exports.open(
    KEY_OFF,
    NONCE_OFF,
    AAD_OFF,
    aad.length,
    INPUT_OFF,
    ciphertext.length,
    TAG_OFF,
    OUTPUT_OFF,
  );
  if (written < 0) return null;
  if (written !== ciphertext.length) throw new Error("Wasm open length mismatch");
  return new Uint8Array(exports.memory.buffer).slice(OUTPUT_OFF, OUTPUT_OFF + written);
}

export function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false;
  return true;
}
