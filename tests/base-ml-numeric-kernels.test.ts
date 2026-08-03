import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import * as workload from "../benchmarks/base/ml-numeric-kernels/workload.js";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (
  options?: Record<string, unknown>,
) => { compile: (schema: unknown) => Validator };
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const CATALOG_HASH = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
const artifactRoot = "public/artifacts/ml-numeric-kernels/";

async function validatorFor(path: string) {
  const schema = JSON.parse(await Deno.readTextFile(path));
  return new Ajv2020({ strict: true, allErrors: true }).compile(schema);
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
async function gitBytes(commit: string, path: string) {
  const result = await new Deno.Command("git", {
    args: ["show", `${commit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  return result.stdout;
}

function bytes(value: ArrayBufferView) {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
function concat(values: ArrayBufferView[]) {
  const out = new Uint8Array(values.reduce((n, v) => n + v.byteLength, 0));
  let p = 0;
  for (const value of values) {
    out.set(bytes(value), p);
    p += value.byteLength;
  }
  return out;
}
type OutputArray = Float32Array | Int32Array | Uint8Array;
type OutputCtor = {
  new (buffer: ArrayBufferLike, byteOffset: number, length: number): OutputArray;
  BYTES_PER_ELEMENT: number;
};
async function instantiate() {
  return (await WebAssembly.instantiate(
    await Deno.readFile(`${artifactRoot}ml-numeric-kernels.wasm`),
  )).instance;
}
function wasmRun(
  instance: WebAssembly.Instance,
  fixtures: ReturnType<typeof workload.generateFixtures>,
) {
  const ex = instance.exports as Record<string, CallableFunction | WebAssembly.Memory>,
    memory = ex.memory as WebAssembly.Memory;
  function invoke(name: string, inputs: ArrayBufferView[], Ctor: OutputCtor, length: number) {
    let p = 4096;
    const offsets: number[] = [];
    for (const value of inputs) {
      p = (p + 3) & ~3;
      offsets.push(p);
      new Uint8Array(memory.buffer, p, value.byteLength).set(bytes(value));
      p += value.byteLength;
    }
    p = (p + 3) & ~3;
    const output = p;
    const status = (ex[name] as CallableFunction)(...offsets, output);
    return { status, output: new Ctor(memory.buffer, output, length).slice() };
  }
  return {
    gemmF32: invoke("gemm_f32", [fixtures.gemmF32A, fixtures.gemmF32B], Float32Array, 56),
    gemmI8: invoke("gemm_i8", [fixtures.gemmI8A, fixtures.gemmI8B], Int32Array, 56),
    convF32: invoke(
      "conv_f32",
      [fixtures.convF32Input, fixtures.convF32Weights],
      Float32Array,
      256,
    ),
    convI8: invoke("conv_i8", [fixtures.convI8Input, fixtures.convI8Weights], Int32Array, 256),
    softmaxF32: invoke("softmax_f32", [fixtures.softmaxF32Input], Float32Array, 128),
    softmaxI8: invoke("softmax_i8", [fixtures.softmaxI8Input], Uint8Array, 128),
  };
}

Deno.test("ml numeric supplemental registration preserves frozen v1 bytes and pins exact fixture", async () => {
  assertEquals(await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")), CATALOG_HASH);
  assertEquals(await sha256Hex(await Deno.readFile("public/data/workloads.v1.json")), CATALOG_HASH);
  const registration = JSON.parse(
    await Deno.readTextFile("catalog/implementations/ml.numeric-kernels.v1.json"),
  );
  const manifest = JSON.parse(await Deno.readTextFile(`${artifactRoot}fixture-manifest.json`));
  const validate = await validatorFor("schemas/base-implementation.schema.json");
  assert(validate(registration), JSON.stringify(validate.errors));
  assertEquals(registration.catalog.sha256, CATALOG_HASH);
  assertEquals(registration.catalog.immutable, true);
  assertEquals(manifest.dtypes, ["fp32", "int8"]);
  for (const [key, value] of Object.entries(workload.GEMM)) {
    assertEquals(manifest.shapes.gemm[key], value);
  }
  for (const [key, value] of Object.entries(workload.CONV)) {
    assertEquals(manifest.shapes.convolution[key], value);
  }
  for (const [key, value] of Object.entries(workload.SOFTMAX)) {
    assertEquals(manifest.shapes.softmax[key], value);
  }
  const generated = workload.generateFixtures();
  const generatedBytes = concat(Object.values(generated));
  assertEquals(await sha256Hex(generatedBytes), manifest.fixtureSha256);
  assertEquals(generatedBytes, await Deno.readFile(`${artifactRoot}fixture.bin`));
  const evidenceValidator = await validatorFor("schemas/ml-numeric-kernels-evidence.schema.json");
  for (const variant of ["js-controlled-scalar", "wasm-linear-controlled-scalar"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base-implementations/ml.numeric-kernels.v1/${variant}.json`,
      ),
    );
    assert(evidenceValidator(record), JSON.stringify(evidenceValidator.errors));
    assertEquals(record.variantId, variant);
    assertEquals(record.authoritativePerformanceEvidence, false);
    assert(record.validation.independentF32Oracle && record.validation.independentInt8Oracle);
    assert(record.validation.exactCounters);
    assertEquals(record.frozenCatalogSha256, CATALOG_HASH);
  }
  assertEquals(
    registration.artifacts,
    registration.artifactHashes.map(({ path }: { path: string }) => path),
  );
  for (const artifact of registration.artifactHashes) {
    const value = await Deno.readFile(artifact.path);
    assertEquals(value.byteLength, artifact.bytes);
    assertEquals(await sha256Hex(value), artifact.sha256);
  }
});

Deno.test("fixture, build, output, and evidence schemas reject omissions, extras, malformed hashes, and contradictory counters", async () => {
  const cases = [
    ["schemas/ml-numeric-kernels-fixture.schema.json", `${artifactRoot}fixture-manifest.json`],
    ["schemas/ml-numeric-kernels-build.schema.json", `${artifactRoot}build-manifest.json`],
    ["schemas/ml-numeric-kernels-output.schema.json", `${artifactRoot}output-manifest.json`],
    [
      "schemas/ml-numeric-kernels-evidence.schema.json",
      "public/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
    ],
  ] as const;
  for (const [schemaPath, recordPath] of cases) {
    const validate = await validatorFor(schemaPath);
    const record = JSON.parse(await Deno.readTextFile(recordPath));
    assert(validate(record), `${recordPath}: ${JSON.stringify(validate.errors)}`);
    const omitted = clone(record);
    delete omitted.schemaVersion;
    assert(!validate(omitted), `${recordPath} accepted required omission`);
    const extra = clone(record);
    extra.unregistered = true;
    assert(!validate(extra), `${recordPath} accepted an extra field`);
  }
  const fixture = JSON.parse(await Deno.readTextFile(`${artifactRoot}fixture-manifest.json`));
  fixture.fixtureSha256 = "not-a-hash";
  assert(!(await validatorFor("schemas/ml-numeric-kernels-fixture.schema.json"))(fixture));
  const build = JSON.parse(await Deno.readTextFile(`${artifactRoot}build-manifest.json`));
  build.build.lockfile.sha256 = "0".repeat(63);
  assert(!(await validatorFor("schemas/ml-numeric-kernels-build.schema.json"))(build));
  const output = JSON.parse(await Deno.readTextFile(`${artifactRoot}output-manifest.json`));
  output.counters.javascript["tensor-reads"] = 0;
  assert(!(await validatorFor("schemas/ml-numeric-kernels-output.schema.json"))(output));
  const evidence = JSON.parse(
    await Deno.readTextFile(
      "public/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
    ),
  );
  evidence.counters["tensor-writes"] = 880;
  assert(!(await validatorFor("schemas/ml-numeric-kernels-evidence.schema.json"))(evidence));
});

Deno.test("all six JS and material Wasm scalar kernels produce complete exact paired outputs", async () => {
  const fixtures = workload.generateFixtures(),
    js = workload.runAll(fixtures),
    wasm = wasmRun(await instantiate(), fixtures);
  const outputManifest = JSON.parse(await Deno.readTextFile(`${artifactRoot}output-manifest.json`));
  const paired = wasm as Record<string, { status: number; output: OutputArray }>;
  for (const [key, value] of Object.entries(js)) {
    assertEquals(paired[key].status ?? 0, 0);
    assertEquals(paired[key].output, value);
    assertEquals(await sha256Hex(bytes(value)), outputManifest.jsControlledSha256[key]);
    assertEquals(
      await sha256Hex(bytes(paired[key].output)),
      outputManifest.wasmLinearControlledSha256[key],
    );
  }
  const module = await WebAssembly.compile(
    await Deno.readFile(`${artifactRoot}ml-numeric-kernels.wasm`),
  );
  assertEquals(WebAssembly.Module.imports(module), []);
  assertEquals(
    WebAssembly.Module.exports(module).map((x) => x.name).sort(),
    ["conv_f32", "conv_i8", "gemm_f32", "gemm_i8", "memory", "softmax_f32", "softmax_i8"].sort(),
  );
});

Deno.test("independent retained FP32, INT32, and UINT8 oracles cover complete tensors", async () => {
  const output = JSON.parse(await Deno.readTextFile(`${artifactRoot}output-manifest.json`));
  assert(output.passed && output.completeOutputs && output.crossTargetExact);
  const references = new Float64Array((await Deno.readFile(`${artifactRoot}reference.f64`)).buffer);
  const bounds = new Float64Array((await Deno.readFile(`${artifactRoot}bounds.f64`)).buffer);
  assertEquals(references.length, 440);
  assertEquals(bounds.length, 440);
  const js = workload.runAll();
  const actual = [...js.gemmF32, ...js.convF32, ...js.softmaxF32];
  for (let i = 0; i < actual.length; i++) {
    assert(Math.abs(actual[i] - references[i]) <= bounds[i], `bound ${i}`);
  }
  const int32Reference = new Int32Array(
    (await Deno.readFile(`${artifactRoot}reference.i32`)).buffer,
  );
  const uint8Reference = await Deno.readFile(`${artifactRoot}reference.u8`);
  assertEquals(int32Reference.length, 312);
  assertEquals(uint8Reference.length, 128);
  assertEquals([...js.gemmI8, ...js.convI8], [...int32Reference]);
  assertEquals(js.softmaxI8, uint8Reference);
  for (let row = 0; row < workload.SOFTMAX.rows; row++) {
    let fsum = 0, isum = 0;
    for (let c = 0; c < workload.SOFTMAX.cols; c++) {
      fsum += js.softmaxF32[row * workload.SOFTMAX.cols + c];
      isum += uint8Reference[row * workload.SOFTMAX.cols + c];
    }
    assert(Math.abs(fsum - 1) < 1e-6);
    assertEquals(isum, 255);
  }
  assertEquals(
    await sha256Hex(await Deno.readFile(`${artifactRoot}reference.f64`)),
    output.oracle.f32Reference.sha256,
  );
  assertEquals(
    await sha256Hex(await Deno.readFile(`${artifactRoot}bounds.f64`)),
    output.oracle.f32Bounds.sha256,
  );
  assertEquals(
    await sha256Hex(await Deno.readFile(`${artifactRoot}reference.i32`)),
    output.oracle.int32Reference.sha256,
  );
  assertEquals(await sha256Hex(uint8Reference), output.oracle.uint8Reference.sha256);
});

Deno.test("build provenance resolves exact repository commit, task, lockfile, source graph, and artifacts", async () => {
  const build = JSON.parse(await Deno.readTextFile(`${artifactRoot}build-manifest.json`));
  const outputBytes = await Deno.readFile(`${artifactRoot}output-manifest.json`);
  const output = JSON.parse(new TextDecoder().decode(outputBytes));
  assertEquals(build.sourceRepository, "https://github.com/PaulKinlan/wasm-vs-js");
  assertEquals(build.build.task, "deno task build:ml-numeric-kernels");
  assertEquals(build.build.toolchain.deno, "2.9.0");
  assertEquals(build.build.lockfile.sha256, await sha256Hex(await Deno.readFile("deno.lock")));
  const sourceIdentity = build.fullSourceGraph.map(
    ({ path, sha256 }: { path: string; sha256: string }) => `${path}\0${sha256}\n`,
  )
    .join("");
  assertEquals(await sha256Hex(sourceIdentity), build.sourceSha256);
  for (const source of build.fullSourceGraph) {
    const working = await Deno.readFile(source.path);
    assertEquals(working.byteLength, source.bytes);
    assertEquals(await sha256Hex(working), source.sha256);
    assertEquals(await sha256Hex(await gitBytes(build.sourceCommit, source.path)), source.sha256);
  }
  assertEquals(await sha256Hex(await Deno.readFile(build.artifact.path)), build.artifact.sha256);
  assertEquals(
    await sha256Hex(await Deno.readFile(`${artifactRoot}build-manifest.json`)),
    output.buildManifestSha256,
  );
  for (const variant of ["js-controlled-scalar", "wasm-linear-controlled-scalar"]) {
    const evidence = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base-implementations/ml.numeric-kernels.v1/${variant}.json`,
      ),
    );
    assertEquals(evidence.sourceRepository, build.sourceRepository);
    assertEquals(evidence.sourceCommit, build.sourceCommit);
    assertEquals(evidence.sourceSha256, build.sourceSha256);
    assertEquals(evidence.outputManifestSha256, await sha256Hex(outputBytes));
  }
});

Deno.test("nonfinite f32 inputs reject in JS and Wasm without accepting partial output", async () => {
  const fixtures = workload.generateFixtures();
  fixtures.gemmF32A[3] = NaN;
  await assertRejects(
    () => Promise.resolve().then(() => workload.gemmF32(fixtures.gemmF32A, fixtures.gemmF32B)),
    "non-finite",
  );
  const result = wasmRun(await instantiate(), fixtures);
  assertEquals(result.gemmF32.status, 1);
  const soft = workload.generateFixtures();
  soft.softmaxF32Input[0] = Infinity;
  await assertRejects(
    () => Promise.resolve().then(() => workload.softmaxF32(soft.softmaxF32Input)),
    "non-finite",
  );
  assertEquals(wasmRun(await instantiate(), soft).softmaxF32.status, 1);
});

Deno.test("registered counters equal every operative access and boundary exactly", () => {
  const expected = {
    "gemm-macs-per-dtype": 504,
    "conv-macs-per-dtype": 5808,
    "total-macs": 12624,
    "kernel-tensor-reads": 26024,
    "validation-tensor-reads": 563,
    "tensor-reads": 26587,
    "tensor-writes": 1016,
    "exp-approximations": 128,
    "normalizations": 256,
    allocations: 6,
  };
  assertEquals(workload.workCounters("javascript"), { ...expected, "boundary-crossings": 0 });
  assertEquals(workload.workCounters("wasm-linear"), { ...expected, "boundary-crossings": 6 });
});

Deno.test("demo and every exact-contract artifact route are closed public GET surfaces", async () => {
  const handler = createHandler(null, "public");
  const paths = [
    "/benchmarks/ml-numeric-kernels-v1/",
    "/ml-numeric-kernels-demo.js",
    "/ml-numeric-kernels-worker.js",
    "/benchmarks/base/ml-numeric-kernels/workload.js",
    "/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm",
    "/artifacts/ml-numeric-kernels/fixture-manifest.json",
    "/artifacts/ml-numeric-kernels/build-manifest.json",
    "/artifacts/ml-numeric-kernels/output-manifest.json",
    "/artifacts/ml-numeric-kernels/fixture.bin",
    "/artifacts/ml-numeric-kernels/reference.f64",
    "/artifacts/ml-numeric-kernels/reference.i32",
    "/artifacts/ml-numeric-kernels/reference.u8",
    "/artifacts/ml-numeric-kernels/bounds.f64",
    "/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
    "/evidence/base-implementations/ml.numeric-kernels.v1/wasm-linear-controlled-scalar.json",
  ];
  for (const path of paths) {
    assertEquals((await handler(new Request(`http://local${path}`))).status, 200);
  }
  assertEquals(
    (await handler(new Request("http://local/artifacts/ml-numeric-kernels/not-listed"))).status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://local/benchmarks/ml-numeric-kernels-v1/", { method: "POST" }),
    )).status,
    403,
  );
});
