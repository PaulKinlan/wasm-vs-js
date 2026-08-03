import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import * as workload from "../benchmarks/base/ml-numeric-kernels/workload.js";

const root = new URL("../", import.meta.url);
const out = new URL("public/artifacts/ml-numeric-kernels/", root);
const PINNED_DENO = "2.9.0";
const PINNED_CLANG = "clang version 22.1.8";
const REPOSITORY = "https://github.com/PaulKinlan/wasm-vs-js";
const sourcePaths = [
  "benchmarks/base/ml-numeric-kernels/ml-numeric-kernels.c",
  "benchmarks/base/ml-numeric-kernels/workload.js",
  "public/ml-numeric-kernels-demo.js",
  "public/ml-numeric-kernels-worker.js",
  "scripts/build-base-ml-numeric-kernels.ts",
  "lib/canonical.ts",
  "schemas/base-implementation.schema.json",
  "schemas/ml-numeric-kernels-fixture.schema.json",
  "schemas/ml-numeric-kernels-build.schema.json",
  "schemas/ml-numeric-kernels-output.schema.json",
  "schemas/ml-numeric-kernels-evidence.schema.json",
  "deno.json",
  "deno.lock",
];
const sourceCommitArgument = Deno.args.find((value) => value.startsWith("--source-commit="));
let sourceCommit = sourceCommitArgument?.slice("--source-commit=".length) ?? "";
if (!sourceCommit) {
  try {
    sourceCommit = JSON.parse(
      await Deno.readTextFile(new URL("build-manifest.json", out)),
    ).sourceCommit;
  } catch {
    // The first attestation must name its committed source tree explicitly.
  }
}
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex Git commit> is required for first build");
}
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
const sources = await Promise.all(sourcePaths.map(async (path) => {
  const working = await Deno.readFile(new URL(path, root));
  const committed = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!committed.success || await sha256Hex(committed.stdout) !== await sha256Hex(working)) {
    throw new Error(`working source does not match ${sourceCommit}:${path}`);
  }
  return { path, bytes: working.byteLength, sha256: await sha256Hex(working) };
}));
const sourceIdentity = sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join("");
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
function gemmInt32Reference(a: Int8Array, b: Int8Array) {
  const output = new Int32Array(workload.GEMM.m * workload.GEMM.n);
  for (let row = 0; row < workload.GEMM.m; row++) {
    for (let column = 0; column < workload.GEMM.n; column++) {
      let sum = 0;
      for (let inner = 0; inner < workload.GEMM.k; inner++) {
        sum += Number(a[row * workload.GEMM.k + inner]) *
          Number(b[inner * workload.GEMM.n + column]);
      }
      output[row * workload.GEMM.n + column] = sum;
    }
  }
  return output;
}
function convInt32Reference(input: Int8Array, weights: Int8Array) {
  const C = workload.CONV;
  const output = new Int32Array(C.height * C.width * C.outChannels);
  for (let outputY = 0; outputY < C.height; outputY++) {
    for (let outputX = 0; outputX < C.width; outputX++) {
      for (let outputChannel = 0; outputChannel < C.outChannels; outputChannel++) {
        let sum = 0;
        for (let filterY = 0; filterY < C.kernel; filterY++) {
          const inputY = outputY + filterY - C.padding;
          if (inputY < 0 || inputY >= C.height) continue;
          for (let filterX = 0; filterX < C.kernel; filterX++) {
            const inputX = outputX + filterX - C.padding;
            if (inputX < 0 || inputX >= C.width) continue;
            for (let inputChannel = 0; inputChannel < C.inChannels; inputChannel++) {
              const inputOffset = (inputY * C.width + inputX) * C.inChannels + inputChannel;
              const weightOffset = ((filterY * C.kernel + filterX) * C.inChannels + inputChannel) *
                  C.outChannels + outputChannel;
              sum += Number(input[inputOffset]) * Number(weights[weightOffset]);
            }
          }
        }
        output[(outputY * C.width + outputX) * C.outChannels + outputChannel] = sum;
      }
    }
  }
  return output;
}
function softmaxUint8Reference(input: Int8Array) {
  const { rows, cols } = workload.SOFTMAX;
  const independentLut = [256, 94, 35, 13, 5, 2, 1, 0, 0];
  const output = new Uint8Array(input.length);
  for (let row = 0; row < rows; row++) {
    const base = row * cols;
    let maximum = Number(input[base]), maximumColumn = 0;
    for (let column = 1; column < cols; column++) {
      const value = Number(input[base + column]);
      if (value > maximum) {
        maximum = value;
        maximumColumn = column;
      }
    }
    const weights = new Array<number>(cols);
    let denominator = 0;
    for (let column = 0; column < cols; column++) {
      const weight = independentLut[Math.min(8, maximum - Number(input[base + column]))];
      weights[column] = weight;
      denominator += weight;
    }
    let emitted = 0;
    for (let column = 0; column < cols; column++) {
      const quantized = Math.trunc(
        (weights[column] * 255 + Math.trunc(denominator / 2)) / denominator,
      );
      output[base + column] = quantized;
      emitted += quantized;
    }
    output[base + maximumColumn] = output[base + maximumColumn] + 255 - emitted;
  }
  return output;
}
const f64Reference = concat([
  gemmReference(fixtures.gemmF32A, fixtures.gemmF32B),
  convReference(fixtures.convF32Input, fixtures.convF32Weights),
  softmaxReference(fixtures.softmaxF32Input),
]);
const int32Reference = concat([
  gemmInt32Reference(fixtures.gemmI8A, fixtures.gemmI8B),
  convInt32Reference(fixtures.convI8Input, fixtures.convI8Weights),
]);
const uint8Reference = softmaxUint8Reference(fixtures.softmaxI8Input);
await Deno.writeFile(new URL("reference.f64", out), f64Reference);
await Deno.writeFile(new URL("reference.i32", out), int32Reference);
await Deno.writeFile(new URL("reference.u8", out), uint8Reference);
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
const controlledInt32 = [...jsOutputs.gemmI8, ...jsOutputs.convI8];
const int32ReferenceView = new Int32Array(
  int32Reference.buffer,
  int32Reference.byteOffset,
  int32Reference.byteLength / 4,
);
if (!controlledInt32.every((value, index) => value === int32ReferenceView[index])) {
  throw new Error("independent int32 reference failed");
}
if (!jsOutputs.softmaxI8.every((value, index) => value === uint8Reference[index])) {
  throw new Error("independent uint8 reference failed");
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
const artifactRecord = async (path: string) => {
  const value = await Deno.readFile(new URL(path, root));
  return { path, bytes: value.byteLength, sha256: await sha256Hex(value) };
};
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
  sourceRepository: REPOSITORY,
  sourceCommit,
  sourceSha256: await sha256Hex(sourceIdentity),
  fullSourceGraph: sources,
  build: {
    cwd: ".",
    task: "deno task build:ml-numeric-kernels",
    command: [
      "clang",
      ...flags,
      sourcePath,
      "-o",
      "public/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm",
    ],
    toolchain: {
      deno: PINNED_DENO,
      v8: Deno.version.v8,
      typescript: Deno.version.typescript,
      clang: PINNED_CLANG,
    },
    lockfile: {
      path: "deno.lock",
      sha256: await sha256Hex(await Deno.readFile(new URL("deno.lock", root))),
    },
  },
  scalarProof: {
    simd: false,
    vectorization: false,
    autoVectorizationFlags: ["-fno-vectorize", "-fno-slp-vectorize"],
    fpContraction: false,
    threads: false,
  },
  artifact: await artifactRecord("public/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm"),
};
await Deno.writeTextFile(
  new URL("fixture-manifest.json", out),
  `${canonicalize(fixtureManifest)}\n`,
);
await Deno.writeTextFile(new URL("build-manifest.json", out), `${canonicalize(buildManifest)}\n`);
const buildManifestSha256 = await sha256Hex(
  await Deno.readFile(new URL("build-manifest.json", out)),
);
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
    kind: "independent-f64-int32-and-u8-retained-artifacts",
    f32Reference: await artifactRecord("public/artifacts/ml-numeric-kernels/reference.f64"),
    f32Bounds: await artifactRecord("public/artifacts/ml-numeric-kernels/bounds.f64"),
    int32Reference: await artifactRecord("public/artifacts/ml-numeric-kernels/reference.i32"),
    uint8Reference: await artifactRecord("public/artifacts/ml-numeric-kernels/reference.u8"),
    f32Policy: "strict-scalar-f32; finite-only; +0 normalization; abs+relative stored bounds",
    int8Policy: "independent loops; i8 inputs; i32 exact accumulation; u8 Q0.8 softmax sum=255",
  },
  counters: {
    javascript: workload.workCounters("javascript"),
    wasmLinear: workload.workCounters("wasm-linear"),
  },
  buildManifestSha256,
};
await Deno.writeTextFile(new URL("output-manifest.json", out), `${canonicalize(outputManifest)}\n`);
const outputManifestSha256 = await sha256Hex(
  await Deno.readFile(new URL("output-manifest.json", out)),
);
const evidenceDir = new URL("public/evidence/base-implementations/ml.numeric-kernels.v1/", root);
await Deno.mkdir(evidenceDir, { recursive: true });
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
    sourceRepository: REPOSITORY,
    sourceCommit,
    sourceSha256: buildManifest.sourceSha256,
    frozenCatalogSha256: fixtureManifest.frozenCatalogSha256,
    fixtureSha256: fixtureManifest.fixtureSha256,
    buildManifestSha256,
    outputManifestSha256,
    completeOutputSha256: outputSha256,
    counters,
    validation: {
      passed: true,
      completeOutputs: true,
      crossTargetExact: true,
      independentF32Oracle: true,
      independentInt8Oracle: true,
      exactCounters: true,
    },
  };
  const path = new URL(`${variantId}.json`, evidenceDir);
  await Deno.writeTextFile(path, `${canonicalize(record)}\n`);
}
const artifactPaths = [
  "public/artifacts/ml-numeric-kernels/fixture-manifest.json",
  "public/artifacts/ml-numeric-kernels/build-manifest.json",
  "public/artifacts/ml-numeric-kernels/output-manifest.json",
  "public/artifacts/ml-numeric-kernels/fixture.bin",
  "public/artifacts/ml-numeric-kernels/reference.f64",
  "public/artifacts/ml-numeric-kernels/bounds.f64",
  "public/artifacts/ml-numeric-kernels/reference.i32",
  "public/artifacts/ml-numeric-kernels/reference.u8",
  "public/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm",
  "public/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
  "public/evidence/base-implementations/ml.numeric-kernels.v1/wasm-linear-controlled-scalar.json",
];
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
  artifacts: artifactPaths,
  artifactHashes: await Promise.all(artifactPaths.map(artifactRecord)),
};
await Deno.mkdir(new URL("catalog/implementations/", root), { recursive: true });
const registrationPath = new URL("catalog/implementations/ml.numeric-kernels.v1.json", root);
await Deno.writeTextFile(registrationPath, `${canonicalize(registration)}\n`);
console.log(
  `built ml.numeric-kernels.v1 ${wasm.byteLength} byte Wasm; exact outputs ${
    Object.keys(jsOutputs).length
  }/6`,
);
