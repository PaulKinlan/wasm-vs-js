import { assert, assertEquals, assertRejects } from "../assert.ts";
import {
  assertEquivalent,
  CONTRACT,
  exactCounters,
  instantiateWasm,
  runJavaScript,
  runWasm,
  sha256Hex,
  syntheticValidationPcm,
} from "../../benchmarks/base/ml-keyword-spotting/engine.js";
import { createHandler } from "../../server.ts";

const paths = {
  fixture: "benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json",
  contract: "benchmarks/base/ml-keyword-spotting/implementation-contract.v1.json",
  registration: "public/artifacts/base-ml-keyword-spotting/registration.v1.json",
  output: "public/artifacts/base-ml-keyword-spotting/output-manifest.v1.json",
};
const fixture = JSON.parse(await Deno.readTextFile(paths.fixture));
const contract = JSON.parse(await Deno.readTextFile(paths.contract));
const registration = JSON.parse(await Deno.readTextFile(paths.registration));
const output = JSON.parse(await Deno.readTextFile(paths.output));
const checkpoint = JSON.parse(
  await Deno.readTextFile("benchmarks/base/ml-keyword-spotting/model-checkpoint.v1.json"),
);
const wasmBytes = await Deno.readFile(
  "public/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm",
);
function clone(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
function schemaAt(root: Record<string, unknown>, pointer: string): Record<string, unknown> {
  let value: unknown = root;
  for (const part of pointer.slice(2).split("/")) value = (value as Record<string, unknown>)[part];
  return value as Record<string, unknown>;
}
function validateSchema(
  value: unknown,
  schema: Record<string, unknown>,
  root = schema,
  at = "$",
): void {
  if (schema.$ref) return validateSchema(value, schemaAt(root, schema.$ref as string), root, at);
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    throw new Error(`${at}: const`);
  }
  if (
    schema.enum &&
    !(schema.enum as unknown[]).some((entry) => JSON.stringify(entry) === JSON.stringify(value))
  ) throw new Error(`${at}: enum`);
  const type = schema.type;
  if (type === "object") {
    if (value === null || Array.isArray(value) || typeof value !== "object") {
      throw new Error(`${at}: object`);
    }
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    for (const key of (schema.required ?? []) as string[]) {
      if (!(key in object)) throw new Error(`${at}.${key}: required`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) {
        if (!(key in properties)) throw new Error(`${at}.${key}: additional`);
      }
    }
    for (const [key, child] of Object.entries(properties)) {
      if (key in object) validateSchema(object[key], child, root, `${at}.${key}`);
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) throw new Error(`${at}: array`);
    if (schema.minItems !== undefined && value.length < (schema.minItems as number)) {
      throw new Error(`${at}: minItems`);
    }
    if (schema.maxItems !== undefined && value.length > (schema.maxItems as number)) {
      throw new Error(`${at}: maxItems`);
    }
    if (schema.items) {
      value.forEach((entry, index) =>
        validateSchema(entry, schema.items as Record<string, unknown>, root, `${at}[${index}]`)
      );
    }
  } else if (type === "string" && typeof value !== "string") throw new Error(`${at}: string`);
  else if (type === "integer" && (!Number.isInteger(value))) throw new Error(`${at}: integer`);
  else if (type === "number" && typeof value !== "number") throw new Error(`${at}: number`);
  if (
    schema.pattern &&
    (typeof value !== "string" || !(new RegExp(schema.pattern as string)).test(value))
  ) throw new Error(`${at}: pattern`);
}
async function loadSchema(name: string) {
  return JSON.parse(
    await Deno.readTextFile(`schemas/base-ml-keyword-spotting-${name}.schema.json`),
  );
}

Deno.test("keyword spotting preserves the byte-identical frozen catalog", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  const publicCatalog = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(await sha256Hex(publicCatalog), await sha256Hex(catalog));
  const row = JSON.parse(new TextDecoder().decode(catalog)).entries.find((entry: { id: string }) =>
    entry.id === CONTRACT.workloadId
  );
  assertEquals(row.status, "proposed");
  assertEquals(
    row.fixedWork.description,
    "Exactly 3,000 hops with frozen preprocessing and model.",
  );
});

Deno.test("Speech Commands recipe pins 60 exact files and 60 seconds without redistributing audio", () => {
  assertEquals(fixture.status, "frozen-recipe-only");
  assertEquals(fixture.redistribution, "recipe-only");
  assertEquals(
    fixture.archive.sha256,
    "cc2a00c1147c2254e9be3fa0f779d8c17421dc349b86366567a8edfa9acd51df",
  );
  assertEquals(fixture.files.length, 60);
  assertEquals(new Set(fixture.files.map((entry: { path: string }) => entry.path)).size, 60);
  assertEquals(fixture.selection.samples, 960000);
  assertEquals(
    fixture.normalizedPcmSha256,
    "1643258d45167c2a1b3795b2c4f2fb11a885b08806fde7f4d235e55be61482ae",
  );
});

Deno.test("trained checkpoint has MLPerf-Tiny-style DS-CNN topology, provenance and held-out accuracy", () => {
  assertEquals(checkpoint.layers.map((layer: { name: string }) => layer.name), [
    "conv0",
    "dw0",
    "pw0",
    "dw1",
    "pw1",
    "dw2",
    "pw2",
    "dw3",
    "pw3",
    "dense",
  ]);
  assert(
    checkpoint.layers.reduce(
      (sum: number, layer: { weights: number[] }) => sum + layer.weights.length,
      0,
    ) > 900,
  );
  assertEquals(checkpoint.accuracy.trainingExamples, 3930);
  assertEquals(checkpoint.accuracy.validationExamples, 960);
  assert(checkpoint.accuracy.quantizedValidation > 0.49);
  assertEquals(contract.model.checkpoint, "model-checkpoint.v1.json");
  assertEquals(contract.model.licenseSpdx, "MIT");
  assertEquals(contract.fixedWork.contextFrames, 49);
  assertEquals(contract.model.operatorOrder.length, 12);
  assertEquals(contract.performanceClaims, []);
});

Deno.test("generated DSP/model constants reproduce byte-for-byte", async () => {
  const temp = await Deno.makeTempDir({ dir: ".", prefix: ".kws-constants-" });
  try {
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read=.",
        `--allow-write=${temp}`,
        "scripts/generate-base-ml-keyword-spotting-constants.ts",
        `--output-dir=${temp}`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(result.success, new TextDecoder().decode(result.stderr));
    for (const file of ["constants.v1.js", "constants.v1.h"]) {
      assertEquals(
        await sha256Hex(await Deno.readFile(`${temp}/${file}`)),
        await sha256Hex(await Deno.readFile(`benchmarks/base/ml-keyword-spotting/${file}`)),
      );
    }
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

Deno.test("complete 3000-hop JS and material Wasm outputs are exact", async () => {
  const pcm = syntheticValidationPcm();
  const js = runJavaScript(pcm);
  const wasm = runWasm(await instantiateWasm(wasmBytes), pcm);
  assertEquivalent(js, wasm);
  assertEquals(js.features.length, 30000);
  assertEquals(js.scores.length, 36000);
  const repeated = runJavaScript(pcm);
  assertEquals(await sha256Hex(js.features), await sha256Hex(repeated.features));
  assertEquals(await sha256Hex(js.scores), await sha256Hex(repeated.scores));
  assertEquals(await sha256Hex(js.detections), await sha256Hex(repeated.detections));
});

Deno.test("work counters match operative model loops, scoped allocations and all Wasm exports", async () => {
  const js = exactCounters("javascript") as Record<string, number>;
  const wasm = exactCounters("wasm-linear") as Record<string, number>;
  assertEquals(js.conv2dMacs, 120000000);
  assertEquals(js.depthwiseMacs, 108000000);
  assertEquals(js.pointwiseMacs, 96000000);
  assertEquals(js.outputMacs, 288000);
  assertEquals(js.javascriptEngineOwnedTypedArrayConstructions, 10);
  assertEquals(wasm.wasmExportCalls, 6);
  const source = await Deno.readTextFile("benchmarks/base/ml-keyword-spotting/engine.js");
  const body = source.slice(
    source.indexOf("export function runJavaScript"),
    source.indexOf("export async function instantiateWasm"),
  );
  assertEquals((body.match(/new (?:Int8Array|Int32Array)/g) ?? []).length, 9);
  assertEquals((body.match(/\.slice\(/g) ?? []).length, 1);
  assert(!body.includes("subarray("));
  const real = await instantiateWasm(wasmBytes);
  let calls = 0;
  const wrapped: Record<string, unknown> = { memory: real.memory };
  for (
    const name of [
      "pcm_ptr",
      "run",
      "detection_count",
      "features_ptr",
      "scores_ptr",
      "detections_ptr",
    ]
  ) {
    wrapped[name] = (...args: unknown[]) => {
      calls += 1;
      return (real[name] as CallableFunction)(...args);
    };
  }
  runWasm(wrapped, syntheticValidationPcm());
  assertEquals(calls, 6);
});

Deno.test("fixture, contract, registration and output schemas are closed and reject negative mutations", async () => {
  for (const [name, document] of Object.entries({ fixture, contract, registration, output })) {
    const schema = await loadSchema(name);
    validateSchema(document, schema);
    const added = clone(document);
    added.unexpected = true;
    let failures = 0;
    for (
      const changed of [
        added,
        (() => {
          const x = clone(document);
          delete x.workloadId;
          if (name === "fixture") delete x.fixtureId;
          return x;
        })(),
        (() => {
          const x = clone(document);
          x.schemaVersion = 999;
          return x;
        })(),
      ]
    ) {
      try {
        validateSchema(changed, schema);
      } catch {
        failures += 1;
      }
    }
    assert(failures === 3, `${name} schema accepted a negative mutation`);
  }
});

Deno.test("wrong input, corrupted artifact and output-changing boundaries fail closed", async () => {
  let rejected = false;
  try {
    runJavaScript(new Int16Array(959999));
  } catch (error) {
    rejected = error instanceof RangeError;
  }
  assert(rejected);
  await assertRejects(() => WebAssembly.compile(wasmBytes.slice(0, -1)), "extends past end");
  const zero = new Int16Array(CONTRACT.samples);
  const edge = new Int16Array(CONTRACT.samples);
  edge[100] = 32767;
  edge[420] = -32768;
  const zeroResult = runJavaScript(zero);
  const edgeResult = runJavaScript(edge);
  assert((await sha256Hex(zeroResult.features)) !== (await sha256Hex(edgeResult.features)));
  assertEquivalent(edgeResult, runWasm(await instantiateWasm(wasmBytes), edge));
});

Deno.test("pinned Clang build and complete source graph reproduce exact committed bytes", async () => {
  const temp = await Deno.makeTempDir();
  try {
    const object = `${temp}/keyword-spotting.o`, artifact = `${temp}/keyword-spotting.wasm`;
    const compile = await new Deno.Command("clang", {
      args: [
        "--target=wasm32-unknown-unknown",
        "-O3",
        "-nostdlib",
        "-ffreestanding",
        "-fno-builtin",
        "-fwrapv",
        "-Ibenchmarks/base/ml-keyword-spotting",
        "-c",
        "benchmarks/base/ml-keyword-spotting/keyword-spotting.c",
        "-o",
        object,
      ],
    }).output();
    assert(compile.success, new TextDecoder().decode(compile.stderr));
    const link = await new Deno.Command("wasm-ld", {
      args: [
        "--no-entry",
        "--export-memory",
        "--export=pcm_ptr",
        "--export=features_ptr",
        "--export=scores_ptr",
        "--export=detections_ptr",
        "--export=detection_count",
        "--export=run",
        "--initial-memory=4194304",
        "--max-memory=4194304",
        "--stack-first",
        object,
        "-o",
        artifact,
      ],
    }).output();
    assert(link.success, new TextDecoder().decode(link.stderr));
    assertEquals(await sha256Hex(await Deno.readFile(artifact)), await sha256Hex(wasmBytes));
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
  for (const source of registration.sourceGraph) {
    assertEquals(await sha256Hex(await Deno.readFile(source.path)), source.sha256);
    const git = await new Deno.Command("git", {
      args: ["show", `${registration.sourceCommit}:${source.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(git.success, source.path);
    assertEquals(await sha256Hex(git.stdout), source.sha256);
  }
});

Deno.test("real Speech Commands record binds every tensor, detection, counter and trained model", async () => {
  assertEquals(registration.status, "proposal-validation-complete");
  assertEquals(
    registration.model.quantizedValidationAccuracy,
    checkpoint.accuracy.quantizedValidation,
  );
  assertEquals(registration.artifact.sha256, await sha256Hex(wasmBytes));
  assertEquals(output.outputs.features.elements, 30000);
  assertEquals(output.outputs.scores.elements, 36000);
  assertEquals(
    output.variants["js-controlled"].counters.javascriptEngineOwnedTypedArrayConstructions,
    10,
  );
  assertEquals(output.variants["wasm-linear-controlled"].counters.wasmExportCalls, 6);
  assertEquals(output.performanceClaims, []);
});

Deno.test("browser worker validates every mode's tensors, detections and counters before exact copy", async () => {
  const worker = await Deno.readTextFile("public/base-ml-keyword-spotting-worker.js");
  const demo = await Deno.readTextFile("public/base-ml-keyword-spotting-demo.js");
  assert(!worker.includes('"default"'));
  for (const evidence of ["features", "scores", "detections", "jsCounters", "wasmCounters"]) {
    assert(worker.includes(evidence));
  }
  assert(worker.includes("counter oracle mismatch"));
  assert(demo.includes("Exact tensors, detections, and work counters validated."));
  assert(!demo.includes("unchecked"));
});

Deno.test("public routes are closed, readable and mutation-denied", async () => {
  const handler = createHandler(null, "public", null);
  for (
    const route of [
      "/benchmarks/ml-keyword-spotting-v1/",
      "/base-ml-keyword-spotting-demo.js",
      "/base-ml-keyword-spotting-worker.js",
      "/benchmarks/base/ml-keyword-spotting/engine.js",
      "/benchmarks/base/ml-keyword-spotting/constants.v1.js",
      "/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm",
      "/artifacts/base-ml-keyword-spotting/fixture-manifest.json",
      "/artifacts/base-ml-keyword-spotting/registration.v1.json",
      "/artifacts/base-ml-keyword-spotting/output-manifest.v1.json",
    ]
  ) {
    const response = await handler(new Request(`http://local.test${route}`));
    assert(response.status === 200, `${route} returned ${response.status}`);
  }
  assertEquals(
    (await handler(new Request("http://local.test/artifacts/base-ml-keyword-spotting/private")))
      .status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://local.test/benchmarks/ml-keyword-spotting-v1/", { method: "POST" }),
    )).status,
    403,
  );
});
