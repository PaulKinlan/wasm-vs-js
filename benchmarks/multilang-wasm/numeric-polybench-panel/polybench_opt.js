// Track B JavaScript optimization for numeric.polybench-panel.v1:
// Hoists loop-invariant row pointers and scalar products (alpha * A[i, k]),
// and reuses pre-allocated Float64Array workspaces instead of allocating .slice()
// buffers on every invocation. Preserves exact left-to-right IEEE-754 f64
// evaluation order across GEMM, Cholesky, and Jacobi-2D.
// Equivalence class: bit-identical (0 ULP deviation against Track A JS oracle).

export function createPolybenchOptWorkspace(ni, nj, nCholesky, nGrid) {
  return {
    gemmOut: new Float64Array(ni * nj),
    cholA: new Float64Array(nCholesky * nCholesky),
    ja: new Float64Array(nGrid * nGrid),
    jb: new Float64Array(nGrid * nGrid),
  };
}

export function runPolybenchOptF64(gf, cf, jf, ni, nj, nk, steps, ws) {
  const { gemmOut, cholA, ja, jb } = ws;

  // 1. GEMM: C := beta * C + alpha * A * B (hoisted row bases + alpha * A[i, k])
  gemmOut.set(gf.c);
  const a = gf.a;
  const b = gf.b;
  const alpha = gf.alpha;
  const beta = gf.beta;
  for (let i = 0; i < ni; i++) {
    const iOut = i * nj;
    const iA = i * nk;
    for (let j = 0; j < nj; j++) {
      gemmOut[iOut + j] *= beta;
    }
    for (let k = 0; k < nk; k++) {
      const alphaAik = alpha * a[iA + k];
      const kB = k * nj;
      for (let j = 0; j < nj; j++) {
        gemmOut[iOut + j] += alphaAik * b[kB + j];
      }
    }
  }

  // 2. Cholesky decomposition (hoisted row bases)
  cholA.set(cf.a);
  const n = cf.n;
  for (let i = 0; i < n; i++) {
    const iRow = i * n;
    for (let j = 0; j <= i; j++) {
      const jRow = j * n;
      let sum = cholA[iRow + j];
      for (let k = 0; k < j; k++) {
        sum -= cholA[iRow + k] * cholA[jRow + k];
      }
      cholA[iRow + j] = i === j ? Math.sqrt(sum) : sum / cholA[jRow + j];
    }
    cholA.fill(0, iRow + i + 1, iRow + n);
  }

  // 3. Jacobi-2D 5-point stencil (hoisted row offsets, pre-allocated ping-pong buffers)
  ja.set(jf.a);
  jb.set(jf.b);
  const jn = jf.n;
  const limit = jn - 1;
  for (let t = 0; t < steps; t++) {
    for (let i = 1; i < limit; i++) {
      const row = i * jn;
      for (let j = 1; j < limit; j++) {
        const p = row + j;
        jb[p] = 0.2 * (ja[p] + ja[p - 1] + ja[p + 1] + ja[p - jn] + ja[p + jn]);
      }
    }
    for (let i = 1; i < limit; i++) {
      const row = i * jn;
      for (let j = 1; j < limit; j++) {
        const p = row + j;
        ja[p] = 0.2 * (jb[p] + jb[p - 1] + jb[p + 1] + jb[p - jn] + jb[p + jn]);
      }
    }
  }

  return { gemm: gemmOut, cholesky: cholA, jacobi: ja };
}
