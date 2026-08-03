import { ControlledSha256, hex } from "./sha256.js";

export const WORKLOAD_ID = "crypto.file-integrity.v1";
export const FIXTURE_SEED = 0x6d2b79f5;
export const REGISTERED_SIZES = Object.freeze([1 << 20, 16 << 20, 256 << 20]);
export const REGISTERED_SCHEDULES = Object.freeze([1024, 65536, "whole-buffer"]);
export const REGISTERED_KINDS = Object.freeze(["seeded-pseudorandom", "all-zero"]);

export function generateFixture(kind, byteLength, seed = FIXTURE_SEED) {
  if (!REGISTERED_KINDS.includes(kind)) throw new RangeError("unknown fixture kind");
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > 256 << 20) {
    throw new RangeError("invalid fixture byte length");
  }
  const out = new Uint8Array(byteLength);
  if (kind === "all-zero") return out;
  let state = seed >>> 0;
  for (let offset = 0; offset < out.length;) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    for (let i = 0; i < 4 && offset < out.length; i++, offset++) out[offset] = state >>> (i * 8);
  }
  return out;
}

export function resolveChunkSize(schedule, byteLength) {
  if (schedule === "whole-buffer") return Math.max(1, byteLength);
  if (schedule !== 1024 && schedule !== 65536) throw new RangeError("unknown chunk schedule");
  return schedule;
}

export function countersFor(byteLength, schedule, target) {
  const chunkSize = resolveChunkSize(schedule, byteLength);
  const chunks = byteLength === 0 ? 0 : Math.ceil(byteLength / chunkSize);
  return {
    "input-bytes": byteLength,
    "scheduled-chunks": chunks,
    "sha256-compression-blocks": Math.ceil((byteLength + 9) / 64),
    "copied-bytes": target === "wasm-linear-controlled" ? byteLength : 0,
    "boundary-crossings": target === "wasm-linear-controlled" ? chunks + 2 : 0,
    allocations: target === "wasm-linear-controlled" ? 2 : 4,
  };
}

export function runJavaScript(bytes, schedule) {
  const sha = new ControlledSha256();
  const chunkSize = resolveChunkSize(schedule, bytes.length);
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    sha.update(bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
  }
  return {
    digest: hex(sha.digest()),
    counters: countersFor(bytes.length, schedule, "js-controlled"),
  };
}

export async function instantiateWasm(moduleBytes) {
  const { instance } = await WebAssembly.instantiate(moduleBytes, {});
  const exports = instance.exports;
  if (
    !(exports.memory instanceof WebAssembly.Memory) || typeof exports.sha256_reset !== "function" ||
    typeof exports.sha256_update !== "function" || typeof exports.sha256_finish !== "function"
  ) throw new Error("SHA-256 Wasm exports are incomplete");
  return exports;
}

export function runWasm(exports, bytes, schedule) {
  const inputPtr = 131072;
  const chunkSize = resolveChunkSize(schedule, bytes.length);
  const requiredBytes = inputPtr + chunkSize;
  if (requiredBytes > exports.memory.buffer.byteLength) {
    exports.memory.grow(Math.ceil((requiredBytes - exports.memory.buffer.byteLength) / 65536));
  }
  exports.sha256_reset();
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    new Uint8Array(exports.memory.buffer, inputPtr, chunk.length).set(chunk);
    exports.sha256_update(inputPtr, chunk.length);
  }
  const digestPtr = exports.sha256_finish();
  const digest = new Uint8Array(exports.memory.buffer, digestPtr, 32).slice();
  return {
    digest: hex(digest),
    counters: countersFor(bytes.length, schedule, "wasm-linear-controlled"),
  };
}
