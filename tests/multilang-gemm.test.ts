import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// V8's js-string builtins option is not in the TS WebAssembly types.
const JS_STRING_BUILTINS = { builtins: ["js-string"] } as unknown as WebAssembly.ModuleImports;

const M = 16, N = 16, K = 16;
let seed = 0x91e10da5;
function nextF32(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return Math.fround((seed / 4294967296) * 2 - 1);
}

function makeInputs() {
  const a = new Float32Array(M * K);
  const b = new Float32Array(K * N);
  const c0 = new Float32Array(M * N);
  for (let i = 0; i < a.length; i++) a[i] = nextF32();
  for (let i = 0; i < b.length; i++) b[i] = nextF32();
  for (let i = 0; i < c0.length; i++) c0[i] = nextF32();
  return { a, b, c0 };
}

// Exact mirror of benchmarks/v2/ml-gemm/workload.js gemmMatrixF32.
function oracle(a: Float32Array, b: Float32Array, c0: Float32Array): Float32Array {
  const out = new Float32Array(M * N);
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      let acc = c0[i * N + j];
      for (let kk = 0; kk < K; kk++) {
        acc = Math.fround(acc + Math.fround(a[i * K + kk] * b[kk * N + j]));
      }
      out[i * N + j] = acc + 0;
    }
  }
  return out;
}

function assertBitIdentical(label: string, got: Float32Array, ref: Float32Array): void {
  for (let i = 0; i < ref.length; i++) {
    assert(
      Object.is(got[i], ref[i]),
      `${label} output mismatch at ${i}: got=${got[i]} ref=${ref[i]}`,
    );
  }
}

Deno.test(
  "multilang-gemm: C, C++, Rust, AssemblyScript, and Dart/WasmGC GEMM kernels are bit-identical to the JS fround oracle",
  async () => {
    const { a, b, c0 } = makeInputs();
    const ref = oracle(a, b, c0);

    const linear = [
      ["gemm_c.wasm", "C"],
      ["gemm_cpp.wasm", "C++"],
      ["gemm_rs.wasm", "Rust"],
      ["gemm_asc.wasm", "AssemblyScript"],
    ] as const;
    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const aOff = 0, bOff = M * K * 4, c0Off = (M * K + K * N) * 4;
      const outOff = (M * K + K * N + M * N) * 4;
      new Float32Array(mem.buffer, aOff, M * K).set(a);
      new Float32Array(mem.buffer, bOff, K * N).set(b);
      new Float32Array(mem.buffer, c0Off, M * N).set(c0);
      (mod.instance.exports.gemm as (
        a: number,
        b: number,
        c0: number,
        o: number,
        m: number,
        n: number,
        k: number,
      ) => void)(aOff, bOff, c0Off, outOff, M, N, K);
      assertBitIdentical(label, new Float32Array(mem.buffer, outOff, M * N), ref);
    }

    const dartGlue = await import(`file://${ARTIFACTS}/gemm_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/gemm_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      gemm: (
        a: Float32Array,
        b: Float32Array,
        c0: Float32Array,
        out: Float32Array,
        m: number,
        n: number,
        k: number,
      ) => void;
    };
    assert(kernels && typeof kernels.gemm === "function", "dartKernels not published");
    const out = new Float32Array(M * N);
    kernels.gemm(a, b, c0, out, M, N, K);
    assertBitIdentical("Dart/WasmGC", out, ref);
  },
);

Deno.test("multilang-gemm: Dart artifact is a WasmGC module", async () => {
  const bytes = await Deno.readFile(`${ARTIFACTS}/gemm_dart.wasm`);
  const mod =
    new (WebAssembly.Module as unknown as new (b: Uint8Array, o?: unknown) => WebAssembly.Module)(
      bytes,
      JS_STRING_BUILTINS,
    );
  assert(
    WebAssembly.Module.imports(mod).some((i) => i.module === "dart2wasm"),
    "missing dart2wasm runtime imports",
  );
  let offset = 8;
  while (offset < bytes.length) {
    const id = bytes[offset++];
    let size = 0, shift = 0;
    while (true) {
      const byte = bytes[offset++];
      size |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    if (id === 1) {
      const payload = bytes.slice(offset, offset + size);
      assert(
        [0x5f, 0x5e, 0x4e, 0x50].some((op) => payload.includes(op)),
        "type section lacks GC struct/array/rec/sub forms",
      );
      return;
    }
    offset += size;
  }
  assert(false, "no type section found");
});

Deno.test("multilang-gemm: report contains a measured ml-gemm workload with 6+ variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const gemm = report.workloads.find((w: { name: string }) => w.name === "ml-gemm");
  assert(gemm, "ml-gemm workload missing from report");
  assert(gemm.variants.length >= 6, "ml-gemm needs 6+ variants");
  for (const variant of gemm.variants) {
    assert(
      typeof variant.warmExecutionMs === "number",
      `ml-gemm ${variant.language} warmExecutionMs must be measured`,
    );
  }
  const languages = gemm.variants.map((v: { language: string }) => v.language);
  for (
    const expected of [
      "Rust / Wasm",
      "Dart / WasmGC",
      "C / Wasm",
      "C++ / Wasm",
      "AssemblyScript / Wasm",
      "JavaScript",
    ]
  ) {
    assert(languages.includes(expected), `ml-gemm missing ${expected}`);
  }
});
