import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import * as workload from "../benchmarks/base/ml-numeric-kernels/workload.js";

const root = new URL("../", import.meta.url);
const out = new URL("public/artifacts/ml-numeric-kernels/", root);
const PINNED_DENO = "2.9.0";
const PINNED_CLANG = "clang version 22.1.8";
const flags = [
  "--target=wasm32-unknown-unknown",
  "-O2",
  "-nostdlib",
  "-fno-builtin",
  "-fno-vectorize",
  "-fno-slp-vectorize",
  "-ffp-contract=off",
  "-fno-fast-math",
  "-Wl,--no-entry",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=131072",
  "-Wl,--max-memory=131072",
  "-Wl,--strip-all",
  "-Wl,--export=gemm_f32",
  "-Wl,--export=gemm_i8",
  "-Wl,--export=conv_f32",
  "-Wl,--export=conv_i8",
  "-Wl,--export=softmax_f32",
  "-Wl,--export=softmax_i8",
];
if (Deno.version.deno !== PINNED_DENO) throw new Error(`requires Deno ${PINNED_DENO}`);
const version = new TextDecoder().decode(
  (await new Deno.Command("clang", { args: ["--version"], stdout: "piped" }).output()).stdout,
).split("\n")[0];
if (version !== PINNED_CLANG) throw new Error(`requires ${PINNED_CLANG}; found ${version}`);
await Deno.mkdir(out, { recursive: true });
const sourcePath = "benchmarks/base/ml-numeric-kernels/ml-numeric-kernels.c";
const wasmPath = new URL("ml-numeric-kernels.wasm", out).pathname;
const compiled = await new Deno.Command("clang", {
  args: [...flags, sourcePath, "-o", wasmPath],
  cwd: new URL(".", root).pathname,
  stdout: "piped",
  stderr: "piped",
}).output();
if (!compiled.success) throw new Error(new TextDecoder().decode(compiled.stderr));

type Fixtures = {
  gemmF32A: Float32Array;
  gemmF32B: Float32Array;
  gemmI8A: Int8Array;
  gemmI8B: Int8Array;
  convF32Input: Float32Array;
  convF32Weights: Float32Array;
  convI8Input: Int8Array;
  convI8Weights: Int8Array;
  softmaxF32Input: Float32Array;
  softmaxI8Input: Int8Array;
};
type OutputArray = Float32Array | Int32Array | Uint8Array;
type OutputCtor = {
  new (buffer: ArrayBufferLike, byteOffset: number, length: number): OutputArray;
  BYTES_PER_ELEMENT: number;
};
const fixtures = workload.generateFixtures() as Fixtures;
const fixtureOrder = Object.keys(fixtures) as Array<keyof Fixtures>;
const concat = (arrays: ArrayBufferView[]) => {
  const length = arrays.reduce((n, x) => n + x.byteLength, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const x of arrays) {
    bytes.set(new Uint8Array(x.buffer, x.byteOffset, x.byteLength), offset);
    offset += x.byteLength;
  }
  return bytes;
};
const fixtureBytes = concat(fixtureOrder.map((key) => fixtures[key]));
await Deno.writeFile(new URL("fixture.bin", out), fixtureBytes);

function gemmReference(a: Float32Array, b: Float32Array) {
  const o = new Float64Array(workload.GEMM.m * workload.GEMM.n);
  for (let i = 0; i < workload.GEMM.m; i++) {
    for (let j = 0; j < workload.GEMM.n; j++) {
      for (let k = 0; k < workload.GEMM.k; k++) {
        o[i * workload.GEMM.n + j] += a[i * workload.GEMM.k + k] * b[k * workload.GEMM.n + j];
      }
    }
  }
  return o;
}
function convReference(input: Float32Array, weights: Float32Array) {
  const C = workload.CONV, o = new Float64Array(C.height * C.width * C.outChannels);
  for (let y = 0; y < C.height; y++) {
    for (let x = 0; x < C.width; x++) {
      for (let oc = 0; oc < C.outChannels; oc++) {
        for (let ky = 0; ky < C.kernel; ky++) {
          for (let kx = 0; kx < C.kernel; kx++) {
            const iy = y + ky - C.padding, ix = x + kx - C.padding;
            if (iy < 0 || ix < 0 || iy >= C.height || ix >= C.width) continue;
            for (let ic = 0; ic < C.inChannels; ic++) {
              o[(y * C.width + x) * C.outChannels + oc] +=
                input[(iy * C.width + ix) * C.inChannels + ic] *
                weights[((ky * C.kernel + kx) * C.inChannels + ic) * C.outChannels + oc];
            }
          }
        }
      }
    }
  }
  return o;
}
function softmaxReference(input: Float32Array) {
  const S = workload.SOFTMAX, o = new Float64Array(input.length);
  for (let r = 0; r < S.rows; r++) {
    const base = r * S.cols;
    let max = -Infinity;
    for (let c = 0; c < S.cols; c++) max = Math.max(max, input[base + c]);
    let sum = 0;
    for (let c = 0; c < S.cols; c++) {
      o[base + c] = Math.exp(input[base + c] - max);
      sum += o[base + c];
    }
    for (let c = 0; c < S.cols; c++) o[base + c] /= sum;
  }
  return o;
}
const f64Reference = concat([
  gemmReference(fixtures.gemmF32A, fixtures.gemmF32B),
  convReference(fixtures.convF32Input, fixtures.convF32Weights),
  softmaxReference(fixtures.softmaxF32Input),
]);
await Deno.writeFile(new URL("reference.f64", out), f64Reference);
const bounds = new Float64Array(440);
let bi = 0;
for (
  const ref of new Float64Array(
    f64Reference.buffer,
    f64Reference.byteOffset,
    f64Reference.byteLength / 8,
  )
) bounds[bi++] = bi <= 312 ? Math.max(1e-6, Math.abs(ref) * 1e-5) : 0.003;
await Deno.writeFile(new URL("bounds.f64", out), new Uint8Array(bounds.buffer));

const jsOutputs = workload.runAll(fixtures);
for (const value of jsOutputs.gemmF32) {
  if (!Number.isFinite(value)) throw new Error("nonfinite GEMM");
}
for (const value of jsOutputs.convF32) {
  if (!Number.isFinite(value)) throw new Error("nonfinite convolution");
}
for (const value of jsOutputs.softmaxF32) {
  if (!Number.isFinite(value)) throw new Error("nonfinite softmax");
}
const referenceView = new Float64Array(f64Reference.buffer, f64Reference.byteOffset, 440);
const controlledF32 = [...jsOutputs.gemmF32, ...jsOutputs.convF32, ...jsOutputs.softmaxF32];
for (let i = 0; i < controlledF32.length; i++) {
  if (Math.abs(controlledF32[i] - referenceView[i]) > bounds[i]) {
    throw new Error(`reference bound failed at ${i}`);
  }
}

const wasm = await Deno.readFile(new URL("ml-numeric-kernels.wasm", out));
const { instance } = await WebAssembly.instantiate(wasm);
const ex = instance.exports as Record<string, CallableFunction | WebAssembly.Memory>;
const memory = ex.memory as WebAssembly.Memory;
let ptr = 4096;
function copy<T extends ArrayBufferView>(value: T): number {
  ptr = (ptr + 3) & ~3;
  const at = ptr;
  new Uint8Array(memory.buffer, at, value.byteLength).set(
    new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
  );
  ptr += value.byteLength;
  return at;
}
function call2(
  name: string,
  a: ArrayBufferView,
  b: ArrayBufferView,
  Ctor: OutputCtor,
  length: number,
) {
  const ap = copy(a), bp = copy(b);
  ptr = (ptr + 3) & ~3;
  const op = ptr;
  ptr += length * Ctor.BYTES_PER_ELEMENT;
  const status = (ex[name] as CallableFunction)(ap, bp, op);
  if (status) throw new Error(`${name} rejected valid fixture`);
  return new Ctor(memory.buffer, op, length).slice();
}
function call1(
  name: string,
  a: ArrayBufferView,
  Ctor: OutputCtor,
  length: number,
) {
  const ap = copy(a);
  ptr = (ptr + 3) & ~3;
  const op = ptr;
  ptr += length * Ctor.BYTES_PER_ELEMENT;
  const status = (ex[name] as CallableFunction)(ap, op);
  if (status) throw new Error(`${name} rejected valid fixture`);
  return new Ctor(memory.buffer, op, length).slice();
}
const wasmOutputs: Record<string, OutputArray> = {
  gemmF32: call2("gemm_f32", fixtures.gemmF32A, fixtures.gemmF32B, Float32Array, 56),
  gemmI8: call2("gemm_i8", fixtures.gemmI8A, fixtures.gemmI8B, Int32Array, 56),
  convF32: call2("conv_f32", fixtures.convF32Input, fixtures.convF32Weights, Float32Array, 256),
  convI8: call2("conv_i8", fixtures.convI8Input, fixtures.convI8Weights, Int32Array, 256),
  softmaxF32: call1("softmax_f32", fixtures.softmaxF32Input, Float32Array, 128),
  softmaxI8: call1("softmax_i8", fixtures.softmaxI8Input, Uint8Array, 128),
};
const typedJsOutputs = jsOutputs as Record<string, OutputArray>;
for (const key of Object.keys(typedJsOutputs)) {
  const a = typedJsOutputs[key], b = wasmOutputs[key];
  if (a.length !== b.length || !a.every((v: number, i: number) => Object.is(v, b[i]))) {
    throw new Error(`cross-target mismatch: ${key}`);
  }
}
const hashMap = async (object: Record<string, ArrayBufferView>) =>
  Object.fromEntries(
    await Promise.all(
      Object.entries(object).map(async (
        [key, value],
      ) => [
        key,
        await sha256Hex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
      ]),
    ),
  );
const sourceRefs: Record<string, string> = {};
for (
  const path of [
    sourcePath,
    "benchmarks/base/ml-numeric-kernels/workload.js",
    "scripts/build-base-ml-numeric-kernels.ts",
    "deno.json",
    "deno.lock",
  ]
) sourceRefs[path] = await sha256Hex(await Deno.readFile(new URL(path, root)));
const fixtureManifest = {
  schemaVersion: 1,
  catalogId: "ml.numeric-kernels.v1",
  frozenCatalogSha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  contractId: workload.CONTRACT_ID,
  rights: { licenseSpdx: "CC0-1.0", source: "project-generated", redistribution: "permitted" },
  generator: { algorithm: "xorshift32", seed: workload.SEED },
  tensorOrder: fixtureOrder,
  shapes: { gemm: workload.GEMM, convolution: workload.CONV, softmax: workload.SOFTMAX },
  dtypes: ["fp32", "int8"],
  layout: { gemm: "row-major NN", convolution: "NHWC/HWIO", softmax: "row-major" },
  fixtureBytes: fixtureBytes.byteLength,
  fixtureSha256: await sha256Hex(fixtureBytes),
};
const buildManifest = {
  schemaVersion: 1,
  catalogId: "ml.numeric-kernels.v1",
  contractId: workload.CONTRACT_ID,
  toolchain: { deno: PINNED_DENO, clang: PINNED_CLANG },
  scalarProof: {
    simd: false,
    vectorization: false,
    autoVectorizationFlags: ["-fno-vectorize", "-fno-slp-vectorize"],
    fpContraction: false,
    threads: false,
  },
  command: [
    "clang",
    ...flags,
    sourcePath,
    "-o",
    "public/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm",
  ],
  sourceRefs,
  artifact: {
    path: "public/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm",
    bytes: wasm.byteLength,
    sha256: await sha256Hex(wasm),
  },
};
const outputManifest = {
  schemaVersion: 1,
  catalogId: "ml.numeric-kernels.v1",
  contractId: workload.CONTRACT_ID,
  passed: true,
  completeOutputs: true,
  jsControlledSha256: await hashMap(typedJsOutputs),
  wasmLinearControlledSha256: await hashMap(wasmOutputs),
  crossTargetExact: true,
  oracle: {
    reference: "independent-f64-and-int32",
    referenceSha256: await sha256Hex(f64Reference),
    boundsSha256: await sha256Hex(new Uint8Array(bounds.buffer)),
    f32Policy: "strict-scalar-f32; finite-only; +0 normalization; abs+relative stored bounds",
    int8Policy: "i8 inputs; i32 exact accumulation; u8 Q0.8 softmax sum=255",
  },
  counters: {
    javascript: workload.workCounters("javascript"),
    wasmLinear: workload.workCounters("wasm-linear"),
  },
};
const jsonArtifacts: Array<[string, unknown]> = [
  ["fixture-manifest.json", fixtureManifest],
  ["build-manifest.json", buildManifest],
  ["output-manifest.json", outputManifest],
];
for (const [name, value] of jsonArtifacts) {
  await Deno.writeTextFile(new URL(name, out), `${canonicalize(value)}\n`);
}
const evidenceDir = new URL("public/evidence/base-implementations/ml.numeric-kernels.v1/", root);
await Deno.mkdir(evidenceDir, { recursive: true });
const buildManifestSha256 = await sha256Hex(
  await Deno.readFile(new URL("build-manifest.json", out)),
);
const recordPaths: string[] = [];
for (
  const [variantId, outputSha256, counters] of [
    ["js-controlled-scalar", outputManifest.jsControlledSha256, outputManifest.counters.javascript],
    [
      "wasm-linear-controlled-scalar",
      outputManifest.wasmLinearControlledSha256,
      outputManifest.counters.wasmLinear,
    ],
  ] as const
) {
  const record = {
    schemaVersion: 1,
    status: "correctness-validation-package",
    authoritativePerformanceEvidence: false,
    workloadId: "ml.numeric-kernels.v1",
    contractId: workload.CONTRACT_ID,
    variantId,
    frozenCatalogSha256: fixtureManifest.frozenCatalogSha256,
    fixtureSha256: fixtureManifest.fixtureSha256,
    buildManifestSha256,
    completeOutputSha256: outputSha256,
    counters,
    validation: { passed: true, completeOutputs: true, crossTargetExact: true },
  };
  const name = `${variantId}.json`;
  const path = new URL(name, evidenceDir);
  await Deno.writeTextFile(path, `${canonicalize(record)}\n`);
  recordPaths.push(path.pathname);
}
const registration = {
  schemaVersion: 1,
  status: "supplemental-controlled-implementation",
  catalog: {
    id: "workload-catalog-v1",
    sha256: fixtureManifest.frozenCatalogSha256,
    immutable: true,
  },
  workloadId: "ml.numeric-kernels.v1",
  contractId: workload.CONTRACT_ID,
  variants: ["js-controlled-scalar", "wasm-linear-controlled-scalar"],
  tracksExcluded: ["simd", "autovectorized", "layout-alternative"],
  artifacts: [
    "fixture-manifest.json",
    "build-manifest.json",
    "output-manifest.json",
    "fixture.bin",
    "reference.f64",
    "bounds.f64",
    "ml-numeric-kernels.wasm",
    "public/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
    "public/evidence/base-implementations/ml.numeric-kernels.v1/wasm-linear-controlled-scalar.json",
  ],
};
await Deno.mkdir(new URL("catalog/implementations/", root), { recursive: true });
const registrationPath = new URL("catalog/implementations/ml.numeric-kernels.v1.json", root);
await Deno.writeTextFile(registrationPath, `${canonicalize(registration)}\n`);
const format = await new Deno.Command("deno", {
  args: ["fmt", registrationPath.pathname, ...recordPaths],
  stdout: "piped",
  stderr: "piped",
}).output();
if (!format.success) throw new Error(new TextDecoder().decode(format.stderr));
console.log(
  `built ml.numeric-kernels.v1 ${wasm.byteLength} byte Wasm; exact outputs ${
    Object.keys(jsOutputs).length
  }/6`,
);
