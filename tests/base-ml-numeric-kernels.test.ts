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
  const schema = JSON.parse(await Deno.readTextFile("schemas/base-implementation.schema.json"));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
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
  for (const variant of ["js-controlled-scalar", "wasm-linear-controlled-scalar"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base-implementations/ml.numeric-kernels.v1/${variant}.json`,
      ),
    );
    assertEquals(record.variantId, variant);
    assertEquals(record.authoritativePerformanceEvidence, false);
    assert(
      record.validation.passed && record.validation.completeOutputs &&
        record.validation.crossTargetExact,
    );
    assertEquals(record.frozenCatalogSha256, CATALOG_HASH);
  }
});

Deno.test("all six JS and material Wasm scalar kernels produce complete exact paired outputs", async () => {
  const fixtures = workload.generateFixtures(),
    js = workload.runAll(fixtures),
    wasm = wasmRun(await instantiate(), fixtures);
  const paired = wasm as Record<string, { status: number; output: OutputArray }>;
  for (const [key, value] of Object.entries(js)) {
    assertEquals(paired[key].status ?? 0, 0);
    assertEquals(paired[key].output, value);
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

Deno.test("independent f64 reference bounds and exact quantized invariants cover complete tensors", async () => {
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
  for (let row = 0; row < workload.SOFTMAX.rows; row++) {
    let fsum = 0, isum = 0;
    for (let c = 0; c < workload.SOFTMAX.cols; c++) {
      fsum += js.softmaxF32[row * workload.SOFTMAX.cols + c];
      isum += js.softmaxI8[row * workload.SOFTMAX.cols + c];
    }
    assert(Math.abs(fsum - 1) < 1e-6);
    assertEquals(isum, 255);
  }
  for (const value of [...js.gemmI8, ...js.convI8]) {
    assert(Number.isSafeInteger(value) && Math.abs(value) < 2 ** 31);
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

Deno.test("registered exact counters cover MACs, reads, writes, normalization, allocation and boundaries", () => {
  const js = workload.workCounters("javascript"), wasm = workload.workCounters("wasm-linear");
  assert(js["gemm-macs-per-dtype"] > 0 && js["conv-macs-per-dtype"] > 0);
  assertEquals(js["total-macs"], 2 * (js["gemm-macs-per-dtype"] + js["conv-macs-per-dtype"]));
  assert(js["tensor-reads"] > js["tensor-writes"]);
  assertEquals(js["exp-approximations"], 128);
  assertEquals(js.normalizations, 256);
  assertEquals(js.allocations, 6);
  assertEquals(js["boundary-crossings"], 0);
  assertEquals(wasm["boundary-crossings"], 6);
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
