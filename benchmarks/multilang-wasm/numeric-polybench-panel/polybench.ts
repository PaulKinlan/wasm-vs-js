// polybench.ts — AssemblyScript multilang kernel for numeric.polybench-panel.v1.
//
// Mirrors polybench.c and benchmarks/base/numeric-polybench-panel/workload.js:
// four f64 kernels — gemm, cholesky, stencil5 and jacobi2d — in the same loop
// order with the same term ordering, so every rounding step matches.
//
// AssemblyScript emits unfused f64 mul and add, matching the C build's
// -ffp-contract=off and the JS oracle's scalar accumulation. Pointers are raw
// linear-memory byte offsets; no allocation, no runtime imports.

export function gemm(
  a: usize,
  b: usize,
  c: usize,
  ni: i32,
  nj: i32,
  nk: i32,
  alpha: f64,
  beta: f64,
): void {
  for (let i = 0; i < ni; ++i) {
    for (let j = 0; j < nj; ++j) {
      const p: usize = c + (<usize> (i * nj + j)) * 8;
      store<f64>(p, load<f64>(p) * beta);
    }
    for (let k = 0; k < nk; ++k) {
      const av: f64 = load<f64>(a + (<usize> (i * nk + k)) * 8);
      for (let j = 0; j < nj; ++j) {
        const p: usize = c + (<usize> (i * nj + j)) * 8;
        store<f64>(p, load<f64>(p) + alpha * av * load<f64>(b + (<usize> (k * nj + j)) * 8));
      }
    }
  }
}

export function cholesky(a: usize, n: i32): i32 {
  for (let i = 0; i < n; ++i) {
    for (let j = 0; j < i; ++j) {
      const pij: usize = a + (<usize> (i * n + j)) * 8;
      for (let k = 0; k < j; ++k) {
        store<f64>(
          pij,
          load<f64>(pij) -
            load<f64>(a + (<usize> (i * n + k)) * 8) * load<f64>(a + (<usize> (j * n + k)) * 8),
        );
      }
      store<f64>(pij, load<f64>(pij) / load<f64>(a + (<usize> (j * n + j)) * 8));
    }
    const pii: usize = a + (<usize> (i * n + i)) * 8;
    for (let k = 0; k < i; ++k) {
      const v: f64 = load<f64>(a + (<usize> (i * n + k)) * 8);
      store<f64>(pii, load<f64>(pii) - v * v);
    }
    if (!(load<f64>(pii) > 0.0)) return 0;
    store<f64>(pii, Math.sqrt(load<f64>(pii)));
    for (let j = i + 1; j < n; ++j) {
      store<f64>(a + (<usize> (i * n + j)) * 8, 0.0);
    }
  }
  return 1;
}

export function stencil5(a: usize, out: usize, n: i32): void {
  for (let i = 1; i < n - 1; ++i) {
    for (let j = 1; j < n - 1; ++j) {
      const p: i32 = i * n + j;
      const base: usize = a + (<usize> p) * 8;
      const sum: f64 = load<f64>(base) + load<f64>(base - 8) + load<f64>(base + 8) +
        load<f64>(a + (<usize> (p - n)) * 8) + load<f64>(a + (<usize> (p + n)) * 8);
      store<f64>(out + (<usize> p) * 8, 0.2 * sum);
    }
  }
}

export function jacobi2d(a: usize, b: usize, n: i32, timesteps: i32): void {
  for (let t = 0; t < timesteps; ++t) {
    stencil5(a, b, n);
    stencil5(b, a, n);
  }
}
