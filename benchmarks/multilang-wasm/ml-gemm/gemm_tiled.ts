// gemm_tiled.ts — Track B variant of gemm.ts: i/j cache blocking.
//
// Baseline (gemm.ts, engine key `asc`) walks the full j range for each i, so
// the inner k loop re-streams a whole column of B for every output element and
// the B working set for one i sweep is the entire matrix (n*k*4 bytes).
//
// This variant blocks the i and j loops into TILE x TILE panels:
//
//   for ii in steps of TILE:
//     for jj in steps of TILE:
//       for i in ii..ii+TILE:
//         for j in jj..jj+TILE:
//           acc = C0[i][j]; for t in 0..k: acc += A[i][t] * B[t][j]
//
// Within one panel the working set is TILE rows of A (TILE*k*4 bytes) and TILE
// columns of B (k*TILE*4 bytes). At 128^3 with TILE = 32 that is 16 KiB + 16
// KiB, versus 64 KiB for the whole of B untiled.
//
// Equivalence: bit-identical (docs/track-b-optimizations.md).
// Blocking i and j only reorders *which* output element is computed when. The
// k loop for each element is untouched, so every accumulation still runs
// ascending t with f32 rounding after each add. Blocking k would reassociate
// and would have to be declared `reassociated` with measured deviations; this
// variant deliberately does not block k.
//
// TILE is a property of the machine this was tuned on, not a universal
// constant. See the optimization log in docs/track-b-optimizations.md.

/** Panel edge in elements. 32 x 32 f32 panels = 4 KiB of C per panel. */
const TILE: u32 = 32;

export function gemm(
  a: usize,
  b: usize,
  c0: usize,
  out: usize,
  m: u32,
  n: u32,
  k: u32,
): void {
  for (let ii: u32 = 0; ii < m; ii += TILE) {
    const iMax: u32 = ii + TILE < m ? ii + TILE : m;
    for (let jj: u32 = 0; jj < n; jj += TILE) {
      const jMax: u32 = jj + TILE < n ? jj + TILE : n;
      for (let i: u32 = ii; i < iMax; i++) {
        const rowA: usize = a + <usize> (i * k) * 4;
        for (let j: u32 = jj; j < jMax; j++) {
          let acc: f32 = load<f32>(c0 + <usize> (i * n + j) * 4);
          for (let t: u32 = 0; t < k; t++) {
            acc += load<f32>(rowA + <usize> t * 4) * load<f32>(b + <usize> (t * n + j) * 4);
          }
          // "acc + 0" normalizes -0 to +0, matching the baseline kernel.
          store<f32>(out + <usize> (i * n + j) * 4, acc + 0.0);
        }
      }
    }
  }
}
