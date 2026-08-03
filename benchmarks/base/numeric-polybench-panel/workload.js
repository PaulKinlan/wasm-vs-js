// Controlled Track A implementation for frozen catalog row numeric.polybench-panel.v1.
// Both targets use f64 row-major arrays, identical loop order, and no target-specific substitution.

export const CONTRACT_ID = "numeric.polybench-panel.v1-supplemental-contract-v1";
export const DIMENSIONS = Object.freeze({
  gemm: Object.freeze({ ni: 20, nj: 25, nk: 30 }),
  cholesky: Object.freeze({ n: 40 }),
  stencil: Object.freeze({ n: 30, sweeps: 1 }),
  jacobi2d: Object.freeze({ n: 30, timesteps: 20, sweepsPerTimestep: 2 }),
});
export const FP_POLICY = Object.freeze({
  type: "f64",
  absoluteTolerance: 1e-10,
  relativeTolerance: 1e-10,
});

/** @param {{ni:number,nj:number,nk:number}} d */
export function makeGemmFixture(d = DIMENSIONS.gemm) {
  const a = new Float64Array(d.ni * d.nk);
  const b = new Float64Array(d.nk * d.nj);
  const c = new Float64Array(d.ni * d.nj);
  for (let i = 0; i < d.ni; i++) {
    for (let k = 0; k < d.nk; k++) a[i * d.nk + k] = (i * (k + 1) % d.nk) / d.nk;
  }
  for (let k = 0; k < d.nk; k++) {
    for (let j = 0; j < d.nj; j++) b[k * d.nj + j] = (k * (j + 2) % d.nj) / d.nj;
  }
  for (let i = 0; i < d.ni; i++) {
    for (let j = 0; j < d.nj; j++) c[i * d.nj + j] = (i * j + 1) % d.ni / d.ni;
  }
  return { a, b, c, alpha: 1.5, beta: 1.2, ...d };
}

/** @param {number} n */
export function makeCholeskyFixture(n = DIMENSIONS.cholesky.n) {
  const lower = new Float64Array(n * n);
  const a = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) lower[i * n + j] = 1 - (j % n) / n;
    lower[i * n + i] = 1;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += lower[i * n + k] * lower[j * n + k];
      a[i * n + j] = sum;
    }
  }
  return { a, n };
}

/** @param {number} n */
export function makeGridFixture(n = DIMENSIONS.jacobi2d.n) {
  const a = new Float64Array(n * n);
  const b = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      a[i * n + j] = (i * (j + 2) + 2) / n;
      b[i * n + j] = (i * (j + 3) + 3) / n;
    }
  }
  return { a, b, n };
}

export function gemmJS(f) {
  const out = f.c.slice();
  for (let i = 0; i < f.ni; i++) {
    for (let j = 0; j < f.nj; j++) out[i * f.nj + j] *= f.beta;
    for (let k = 0; k < f.nk; k++) {
      for (let j = 0; j < f.nj; j++) {
        const p = i * f.nj + j;
        out[p] += f.alpha * f.a[i * f.nk + k] * f.b[k * f.nj + j];
      }
    }
  }
  return out;
}

export function choleskyJS(f) {
  const l = f.a.slice();
  const n = f.n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = l[i * n + j];
      for (let k = 0; k < j; k++) sum -= l[i * n + k] * l[j * n + k];
      l[i * n + j] = i === j ? Math.sqrt(sum) : sum / l[j * n + j];
    }
    for (let j = i + 1; j < n; j++) l[i * n + j] = 0;
  }
  return l;
}

export function stencilJS(f) {
  const out = f.b.slice();
  const n = f.n;
  for (let i = 1; i < n - 1; i++) {
    for (let j = 1; j < n - 1; j++) {
      const p = i * n + j;
      out[p] = 0.2 * (f.a[p] + f.a[p - 1] + f.a[p + 1] + f.a[p - n] + f.a[p + n]);
    }
  }
  return out;
}

/** @param {ReturnType<typeof makeGridFixture>} f @param {number} timesteps */
export function jacobi2dJS(f, timesteps = DIMENSIONS.jacobi2d.timesteps) {
  const a = f.a.slice();
  const b = f.b.slice();
  const n = f.n;
  const sweep = (source, target) => {
    for (let i = 1; i < n - 1; i++) {
      for (let j = 1; j < n - 1; j++) {
        const p = i * n + j;
        target[p] = 0.2 *
          (source[p] + source[p - 1] + source[p + 1] + source[p - n] + source[p + n]);
      }
    }
  };
  for (let t = 0; t < timesteps; t++) {
    sweep(a, b);
    sweep(b, a);
  }
  return a;
}

function align8(value) {
  return (value + 7) & ~7;
}
function write(memory, offset, values) {
  new Float64Array(memory.buffer, offset, values.length).set(values);
  return align8(offset + values.byteLength);
}
function read(memory, offset, length) {
  return new Float64Array(memory.buffer, offset, length).slice();
}

/** @typedef {WebAssembly.Exports & {memory: WebAssembly.Memory, gemm: Function, cholesky: Function, stencil5: Function, jacobi2d: Function}} PanelExports */
export async function instantiatePanelWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports;
  for (const name of ["memory", "gemm", "cholesky", "stencil5", "jacobi2d"]) {
    if (!(name in exports)) throw new Error(`missing Wasm export ${name}`);
  }
  return /** @type {PanelExports} */ (exports);
}

export function runGemmWasm(wasm, f) {
  let off = 0;
  const aOff = off;
  off = write(wasm.memory, off, f.a);
  const bOff = off;
  off = write(wasm.memory, off, f.b);
  const cOff = off;
  write(wasm.memory, off, f.c);
  wasm.gemm(aOff, bOff, cOff, f.ni, f.nj, f.nk, f.alpha, f.beta);
  return read(wasm.memory, cOff, f.c.length);
}
export function runCholeskyWasm(wasm, f) {
  const off = 0;
  write(wasm.memory, off, f.a);
  const ok = wasm.cholesky(off, f.n);
  if (ok !== 1) throw new Error("Wasm Cholesky rejected the SPD matrix");
  return read(wasm.memory, off, f.a.length);
}
export function runStencilWasm(wasm, f) {
  const aOff = 0;
  const bOff = align8(f.a.byteLength);
  write(wasm.memory, aOff, f.a);
  write(wasm.memory, bOff, f.b);
  wasm.stencil5(aOff, bOff, f.n);
  return read(wasm.memory, bOff, f.a.length);
}
/** @param {WebAssembly.Exports & {memory: WebAssembly.Memory, jacobi2d: Function}} wasm @param {ReturnType<typeof makeGridFixture>} f @param {number} timesteps */
export function runJacobiWasm(wasm, f, timesteps = DIMENSIONS.jacobi2d.timesteps) {
  const aOff = 0;
  const bOff = align8(f.a.byteLength);
  write(wasm.memory, aOff, f.a);
  write(wasm.memory, bOff, f.b);
  wasm.jacobi2d(aOff, bOff, f.n, timesteps);
  return read(wasm.memory, aOff, f.a.length);
}

export function compareNumeric(actual, expected, policy = FP_POLICY) {
  if (actual.length !== expected.length) {
    return { passed: false, violations: 1, maxAbs: Infinity, maxRel: Infinity };
  }
  let violations = 0, maxAbs = 0, maxRel = 0;
  for (let i = 0; i < actual.length; i++) {
    if (!Number.isFinite(actual[i]) || !Number.isFinite(expected[i])) {
      violations++;
      continue;
    }
    const abs = Math.abs(actual[i] - expected[i]);
    const rel = abs / Math.max(1, Math.abs(expected[i]));
    maxAbs = Math.max(maxAbs, abs);
    maxRel = Math.max(maxRel, rel);
    if (abs > policy.absoluteTolerance && rel > policy.relativeTolerance) violations++;
  }
  return { passed: violations === 0, violations, maxAbs, maxRel };
}

export function countersFor(kernel, dimensions = DIMENSIONS) {
  if (kernel === "gemm") {
    const { ni, nj, nk } = dimensions.gemm;
    return {
      kernels: 1,
      outputElements: ni * nj,
      multiplyAdds: ni * nj * nk,
      scaleMultiplications: ni * nj,
      inputBytes: (ni * nk + nk * nj + ni * nj) * 8,
      boundaryCrossings: 1,
    };
  }
  if (kernel === "cholesky") {
    const n = dimensions.cholesky.n;
    let products = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) products += j;
    return {
      kernels: 1,
      outputElements: n * n,
      multiplySubtracts: products,
      diagonalRoots: n,
      inputBytes: n * n * 8,
      boundaryCrossings: 1,
    };
  }
  const d = kernel === "stencil" ? dimensions.stencil : dimensions.jacobi2d;
  const sweeps = kernel === "stencil" ? d.sweeps : d.timesteps * d.sweepsPerTimestep;
  return {
    kernels: 1,
    outputElements: d.n * d.n,
    stencilPoints: (d.n - 2) ** 2 * sweeps,
    inputBytes: d.n * d.n * 8,
    boundaryCrossings: 1,
  };
}
