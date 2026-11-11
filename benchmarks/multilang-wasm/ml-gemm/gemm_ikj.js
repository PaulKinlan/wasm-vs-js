// Track B JavaScript optimization for ml.gemm.v1:
// Loop interchange i/j/k -> i/k/j with row-offset hoisting over Float32Array.
// Streams B[t, 0..n] contiguously across each row instead of striding down columns,
// while accumulating each output cell in strict ascending t = 0..k-1 order.
// Equivalence class: bit-identical (0 ULP deviation against Track A workload.js).

export function gemmIkjF32(a, b, c0, out, m, n, kDim) {
  out.set(c0);
  for (let i = 0; i < m; i++) {
    const iOut = i * n;
    const iA = i * kDim;
    for (let t = 0; t < kDim; t++) {
      const ait = a[iA + t];
      const tB = t * n;
      for (let j = 0; j < n; j++) {
        out[iOut + j] = Math.fround(out[iOut + j] + Math.fround(ait * b[tB + j]));
      }
    }
  }
  const len = m * n;
  for (let idx = 0; idx < len; idx++) {
    out[idx] = out[idx] + 0;
  }
  return out;
}
