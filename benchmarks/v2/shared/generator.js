// Deterministic fixture generator for v2 proposal workloads, revision
// "proposal-generator-v1". One xorshift32 stream per tensor, in declared
// parameter order. Stream i starts from state (seed + i * 0x9e3779b9) mod 2^32
// and advances with the same 13/17/5 recurrence as the frozen sum-u32
// workload. Each u32 draw d maps to the f32 value (d / 2^32) * 2 * scale -
// scale, computed in f64 and rounded once on store. No transcendentals are
// involved, so every runtime reproduces the stream byte-for-byte.

export function xorshift32Stream(seed, streamIndex) {
  let state = (seed + Math.imul(streamIndex, 0x9e3779b9)) >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

export function fillUniformF32(seed, streamIndex, out, scale) {
  if (!(out instanceof Float32Array)) throw new Error("output must be Float32Array");
  if (!(scale > 0) || !Number.isFinite(scale)) throw new Error("invalid scale");
  const next = xorshift32Stream(seed, streamIndex);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = (next() / 4294967296) * 2 * scale - scale;
  }
  return out;
}
