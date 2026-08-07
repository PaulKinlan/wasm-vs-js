// Track B — sum-u32 optimized JavaScript variant (INDEPENDENTLY OPTIMIZED).
// Track A baseline = the sum kernel in public/multilang-runner.js (KEPT
// UNTOUCHED); mirrored verbatim below as `sumBaseline` for the side-by-side.
//
// OPTIMIZATION LOG: 4-way unrolled loop with four independent accumulators.
// u32 addition is associative mod 2^32 → BIT-IDENTICAL result, but four
// independent add chains cut the loop-carried dependency stall and the
// per-iteration loop overhead (1 iteration per 4 adds).

export function sumBaseline(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

export function sumOpt(arr) {
  const len = arr.length;
  let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
  let i = 0;
  for (; i + 4 <= len; i += 4) {
    a0 += arr[i];
    a1 += arr[i + 1];
    a2 += arr[i + 2];
    a3 += arr[i + 3];
  }
  for (; i < len; i++) a0 += arr[i];
  return (a0 + a1 + a2 + a3) >>> 0;
}
