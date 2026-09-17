// gemm_ikj.ts — Track B variant of gemm.ts: loop interchange i/j/k -> i/k/j.
//
// Baseline (gemm.ts, engine key `asc`), for each output element:
//
//   acc = C0[i][j]
//   for t in 0..k:  acc += A[i][t] * B[t][j]      // B strides by n*4 = 512 B
//   OUT[i][j] = acc + 0
//
// B is read down a column in the innermost loop, so every iteration touches a
// different 64-byte line. At 128x128x128 that is 128 distinct lines (8 KiB of
// B) walked per output element, and the walk restarts for every j.
//
// This variant interchanges the two inner loops:
//
//   OUT[i][*] = C0[i][*]
//   for t in 0..k:
//     aik = A[i][t]                                // scalar, loaded once per t
//     for j in 0..n:  OUT[i][j] += aik * B[t][j]   // B[t][*] read contiguously
//
// Now B is streamed along a row — sequential addresses, full 64-byte line
// utilisation, hardware-prefetcher friendly — and A[i][t] is a loop-invariant
// scalar. The cost is that the accumulator lives in OUT rather than in a
// register, so each inner iteration is a load/store pair instead of a single
// FMA chain.
//
// Equivalence: bit-identical (docs/track-b-optimizations.md).
// For any fixed (i, j) the terms are still added in ascending t, and OUT is an
// f32 array so every partial sum is rounded to f32 after each add — the same
// rounding the baseline's f32 accumulator performs. Interchanging i/k/j moves
// *when* each add happens, never the order of adds into a given element. That
// is why this qualifies as bit-identical and not `reassociated`: no
// accumulation order changes anywhere.
//
// The "+ 0.0" normalisation of -0 to +0 is applied in a final pass over the
// row, matching the baseline's per-element `acc + 0.0`.

export function gemm(
  a: usize,
  b: usize,
  c0: usize,
  out: usize,
  m: u32,
  n: u32,
  k: u32,
): void {
  for (let i: u32 = 0; i < m; i++) {
    const rowOut: usize = out + <usize> (i * n) * 4;
    const rowC0: usize = c0 + <usize> (i * n) * 4;

    // Seed the output row with C0 so the k loop can accumulate in place.
    for (let j: u32 = 0; j < n; j++) {
      store<f32>(rowOut + <usize> j * 4, load<f32>(rowC0 + <usize> j * 4));
    }

    for (let t: u32 = 0; t < k; t++) {
      const aik: f32 = load<f32>(a + <usize> (i * k + t) * 4);
      const rowB: usize = b + <usize> (t * n) * 4;
      for (let j: u32 = 0; j < n; j++) {
        const at: usize = rowOut + <usize> j * 4;
        store<f32>(at, load<f32>(at) + aik * load<f32>(rowB + <usize> j * 4));
      }
    }

    // Normalise -0 to +0, matching the baseline's "acc + 0.0" per element.
    for (let j: u32 = 0; j < n; j++) {
      const at: usize = rowOut + <usize> j * 4;
      store<f32>(at, load<f32>(at) + 0.0);
    }
  }
}
