import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const JS_STRING_BUILTINS = { builtins: ["js-string"] } as unknown as WebAssembly.ModuleImports;

const NI = 20, NJ = 25, NK = 30, N_CHOLESKY = 40, N_GRID = 30, STEPS = 20;

function makeGemmFixture() {
  const a = new Float64Array(NI * NK);
  const b = new Float64Array(NK * NJ);
  const c = new Float64Array(NI * NJ);
  for (let i = 0; i < NI; i++) {
    for (let k = 0; k < NK; k++) a[i * NK + k] = (i * (k + 1) % NK) / NK;
  }
  for (let k = 0; k < NK; k++) {
    for (let j = 0; j < NJ; j++) b[k * NJ + j] = (k * (j + 2) % NJ) / NJ;
  }
  for (let i = 0; i < NI; i++) {
    for (let j = 0; j < NJ; j++) c[i * NJ + j] = (i * j + 1) % NI / NI;
  }
  return { a, b, c, alpha: 1.5, beta: 1.2 };
}

function makeCholeskyFixture() {
  const n = N_CHOLESKY;
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

function makeGridFixture() {
  const n = N_GRID;
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

function assertBitIdentical(label: string, got: Float64Array, ref: Float64Array): void {
  for (let i = 0; i < ref.length; i++) {
    const diff = Math.abs(got[i] - ref[i]);
    assert(
      diff < 1e-10,
      `${label} output mismatch at ${i}: got=${got[i]} ref=${ref[i]} (diff=${diff})`,
    );
  }
}

function refGemm(gf: ReturnType<typeof makeGemmFixture>) {
  const out = gf.c.slice();
  for (let i = 0; i < NI; i++) {
    for (let j = 0; j < NJ; j++) out[i * NJ + j] *= gf.beta;
    for (let k = 0; k < NK; k++) {
      for (let j = 0; j < NJ; j++) {
        out[i * NJ + j] += gf.alpha * gf.a[i * NK + k] * gf.b[k * NJ + j];
      }
    }
  }
  return out;
}

function refCholesky(cf: ReturnType<typeof makeCholeskyFixture>) {
  const l = cf.a.slice();
  const n = cf.n;
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

function refJacobi2d(jf: ReturnType<typeof makeGridFixture>) {
  const a = jf.a.slice();
  const b = jf.b.slice();
  const n = jf.n;
  for (let t = 0; t < STEPS; t++) {
    for (let i = 1; i < n - 1; i++) {
      for (let j = 1; j < n - 1; j++) {
        const p = i * n + j;
        b[p] = 0.2 * (a[p] + a[p - 1] + a[p + 1] + a[p - n] + a[p + n]);
      }
    }
    for (let i = 1; i < n - 1; i++) {
      for (let j = 1; j < n - 1; j++) {
        const p = i * n + j;
        a[p] = 0.2 * (b[p] + b[p - 1] + b[p + 1] + b[p - n] + b[p + n]);
      }
    }
  }
  return a;
}

Deno.test(
  "multilang-polybench: C, C++, Rust, and Dart/WasmGC polybench kernels match JS reference oracles",
  async () => {
    const gf = makeGemmFixture();
    const cf = makeCholeskyFixture();
    const jf = makeGridFixture();

    const gemmRef = refGemm(gf);
    const cholRef = refCholesky(cf);
    const jacobiRef = refJacobi2d(jf);

    const linear = [
      ["polybench_c.wasm", "C"],
      ["polybench_cpp.wasm", "C++"],
      ["polybench_rs.wasm", "Rust"],
    ] as const;

    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const exports = mod.instance.exports as Record<string, (...args: unknown[]) => unknown>;

      // Test GEMM
      const aOff = 0;
      const bOff = gf.a.byteLength;
      const cOff = bOff + gf.b.byteLength;
      new Float64Array(mem.buffer, aOff, gf.a.length).set(gf.a);
      new Float64Array(mem.buffer, bOff, gf.b.length).set(gf.b);
      new Float64Array(mem.buffer, cOff, gf.c.length).set(gf.c);
      (exports.gemm as (
        a: number,
        b: number,
        c: number,
        ni: number,
        nj: number,
        nk: number,
        alpha: number,
        beta: number,
      ) => void)(aOff, bOff, cOff, NI, NJ, NK, gf.alpha, gf.beta);
      assertBitIdentical(`${label} GEMM`, new Float64Array(mem.buffer, cOff, gf.c.length), gemmRef);

      // Test Cholesky
      const cholOff = cOff + gf.c.byteLength;
      new Float64Array(mem.buffer, cholOff, cf.a.length).set(cf.a);
      const ok = (exports.cholesky as (a: number, n: number) => number)(cholOff, cf.n);
      assert(ok === 1, `${label} Cholesky returned failure ${ok}`);
      assertBitIdentical(
        `${label} Cholesky`,
        new Float64Array(mem.buffer, cholOff, cf.a.length),
        cholRef,
      );

      // Test Jacobi2D
      const gridAOff = cholOff + cf.a.byteLength;
      const gridBOff = gridAOff + jf.a.byteLength;
      new Float64Array(mem.buffer, gridAOff, jf.a.length).set(jf.a);
      new Float64Array(mem.buffer, gridBOff, jf.b.length).set(jf.b);
      (exports.jacobi2d as (a: number, b: number, n: number, steps: number) => void)(
        gridAOff,
        gridBOff,
        jf.n,
        STEPS,
      );
      assertBitIdentical(
        `${label} Jacobi2D`,
        new Float64Array(mem.buffer, gridAOff, jf.a.length),
        jacobiRef,
      );
    }

    // Test Dart
    const dartGlue = await import(`file://${ARTIFACTS}/polybench_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/polybench_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      gemm: (
        a: Float64Array,
        b: Float64Array,
        c: Float64Array,
        ni: number,
        nj: number,
        nk: number,
        alpha: number,
        beta: number,
      ) => void;
      cholesky: (a: Float64Array, n: number) => number;
      jacobi2d: (a: Float64Array, b: Float64Array, n: number, timesteps: number) => void;
    };
    assert(kernels && typeof kernels.gemm === "function", "dartKernels not published");

    const dGc = gf.c.slice();
    kernels.gemm(gf.a, gf.b, dGc, NI, NJ, NK, gf.alpha, gf.beta);
    assertBitIdentical("Dart GEMM", dGc, gemmRef);

    const dCa = cf.a.slice();
    const dCok = kernels.cholesky(dCa, cf.n);
    assert(dCok === 1, `Dart Cholesky returned failure ${dCok}`);
    assertBitIdentical("Dart Cholesky", dCa, cholRef);

    const dJa = jf.a.slice();
    const dJb = jf.b.slice();
    kernels.jacobi2d(dJa, dJb, jf.n, STEPS);
    assertBitIdentical("Dart Jacobi2D", dJa, jacobiRef);
  },
);

Deno.test("multilang-polybench: Dart artifact is a WasmGC module", async () => {
  const bytes = await Deno.readFile(`${ARTIFACTS}/polybench_dart.wasm`);
  const mod =
    new (WebAssembly.Module as unknown as new (b: Uint8Array, o?: unknown) => WebAssembly.Module)(
      bytes,
      JS_STRING_BUILTINS,
    );
  assert(
    WebAssembly.Module.imports(mod).some((i) => i.module === "dart2wasm"),
    "missing dart2wasm runtime imports",
  );
});
