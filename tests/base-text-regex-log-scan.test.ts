import Ajv2020Module from "ajv2020";
import wabtFactory from "wabt";
import { sha256Hex } from "../lib/canonical.ts";
import {
  CORPUS_BYTES,
  EXPECTED_MATCHES,
  EXPECTED_MATCHES_PER_PATTERN,
  generateCorpus,
  makeAdversarialCorpus,
  SAFE_PATTERNS,
} from "../benchmarks/text-regex-log-scan/input.js";
import {
  canonicalOutput,
  scanJsControlled,
  scanWasmControlled,
  WASM_OUTPUT_CAPACITY,
} from "../benchmarks/text-regex-log-scan/workload.js";
import { createHandler } from "../server.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

async function compileAuthoredWasm() {
  const wabt = await wabtFactory();
  const module = wabt.parseWat(
    "text-regex-log-scan.wat",
    await Deno.readTextFile("benchmarks/text-regex-log-scan/text-regex-log-scan.wat"),
    { simd: false, threads: false, exceptions: false },
  );
  module.resolveNames();
  module.validate();
  const bytes = new Uint8Array(
    module.toBinary({ canonicalize_lebs: true, write_debug_names: false }).buffer,
  );
  module.destroy();
  return bytes;
}

Deno.test("base regex registration preserves frozen v1 bytes and validates against its schema", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  const publicCatalog = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assertEquals(publicCatalog, catalog);

  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-workload-registration.schema.json"),
  );
  const registration = JSON.parse(
    await Deno.readTextFile("benchmarks/text-regex-log-scan/registration.json"),
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert(validate(registration), JSON.stringify(validate.errors));
  const publicRegistration = JSON.parse(
    await Deno.readTextFile("public/data/base-implementations/text.regex-log-scan.v1.json"),
  );
  assert(validate(publicRegistration), JSON.stringify(validate.errors));
  assertEquals(
    publicRegistration.implementation.buildManifest,
    "/artifacts/text-regex-log-scan/build-manifest.json",
  );
  assertEquals(registration.catalogMutation, false);
  assertEquals(registration.fixedWork.inputBytes, 100 * 1024 * 1024);
  assertEquals(registration.fixedWork.patternDefinitions, 20);
  assertEquals(registration.limits.outputCapacity, WASM_OUTPUT_CAPACITY);
  assertEquals(registration.claims.reducedFixture, false);
  assertEquals(SAFE_PATTERNS.length, 20);
});

Deno.test("base regex exact 100 MiB corpus passes complete JS and material Wasm oracles", async () => {
  const input = generateCorpus();
  assertEquals(input.byteLength, CORPUS_BYTES);
  const js = await scanJsControlled(input);
  const artifact = await Deno.readFile(
    "public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
  );
  const linear = await scanWasmControlled(
    input,
    await WebAssembly.instantiate(await WebAssembly.compile(artifact), {}),
  );
  for (const result of [js, linear]) {
    assertEquals(
      result.inputSha256,
      "3d5810310d15b7bebf227bdc384035bd961684d4e1240b2ee93b4cb37350d388",
    );
    assertEquals(
      result.outputSha256,
      "6078822d35d3daea452751e74229c762e43eb4b973ca40bd1a0ac7c9c9e899de",
    );
    assertEquals(result.counters.matchesFound, EXPECTED_MATCHES);
    assertEquals(result.counters.logicalPatternBytes, 2_097_152_000);
    assertEquals(result.counters.perPattern, new Array(20).fill(EXPECTED_MATCHES_PER_PATTERN));
    assertEquals(result.counters.candidateStarts, 6_732_995);
    assertEquals(result.counters.prefixByteComparisons, 15_570_166);
    assertEquals(result.counters.tailByteComparisons, 861_922);
  }
  assertEquals(linear.matches, js.matches);
  assertEquals(linear.counters, { ...js.counters, boundaryCrossings: 1 });
  const retained = await Deno.readFile(
    "public/artifacts/text-regex-log-scan/ordered-captures.bin",
  );
  assertEquals(retained, canonicalOutput(js.matches, input));
  assertEquals(await sha256Hex(retained), js.outputSha256);
});

Deno.test("base regex JS and Wasm reject malformed boundaries and agree on Unicode logs", async () => {
  const authored = await compileAuthoredWasm();
  const instance = await WebAssembly.instantiate(await WebAssembly.compile(authored), {});
  const cases = [
    ["日志 https://node.example.test/東京 status=200 🚀 ip=192.168.1.1"],
    ["http://", "https://bad+tail", "status=099", "status=600", "status=2000"],
    ["ip=01.2.3.4", "ip=256.1.1.1", "ip=1.2.3", "ip=1.2.3.4.5"],
    ["client-ip:0.0.0.0", "source-ip:255.255.255.255", "dest-ip:127.0.0.1"],
    ["http-status:404", "response-status:500", "result-status:201", "status-code:302"],
    ["prefixhttp://a.test/xsuffix", "code=418", "wss://socket.example.test/path"],
    ["café 東京 🚀 запись", "\u0000status=204\u0000", "api://a.example.test/v1"],
  ];
  for (let index = 0; index < 40; index++) {
    cases.push([
      `日志-${index} http://node-${index}.example.test/p/${index}`,
      `ip=${index % 256}.${(index * 3) % 256}.${(index * 7) % 256}.${(index * 11) % 256}`,
      `status=${100 + index}`,
      `bad ip=00.${index}.1.1 status=${600 + index}`,
    ]);
  }
  for (const lines of cases) {
    const input = makeAdversarialCorpus(lines);
    const js = await scanJsControlled(input);
    const linear = await scanWasmControlled(input, instance);
    assertEquals(linear.matches, js.matches);
    assertEquals(linear.outputSha256, js.outputSha256);
    assertEquals(linear.counters, { ...js.counters, boundaryCrossings: 1 });
  }

  const url96 = makeAdversarialCorpus([`http://${"a".repeat(96)}!`]);
  const url96Js = await scanJsControlled(url96);
  const url96Wasm = await scanWasmControlled(url96, instance);
  assertEquals(url96Js.matches, [{ patternId: 0, start: 0, end: 103 }]);
  assertEquals(url96Wasm.matches, url96Js.matches);

  const url97 = makeAdversarialCorpus([`http://${"a".repeat(97)}!`]);
  const url97Js = await scanJsControlled(url97);
  const url97Wasm = await scanWasmControlled(url97, instance);
  assertEquals(url97Js.matches, []);
  assertEquals(url97Wasm.matches, []);

  const encoder = new TextEncoder();
  const malformedUtf8 = Uint8Array.from([
    ...encoder.encode("status=200 "),
    0xc3,
    0x28,
    0xa0,
    0xa1,
    ...encoder.encode(" ip=1.2.3.4"),
  ]);
  const malformedJs = await scanJsControlled(malformedUtf8);
  const malformedWasm = await scanWasmControlled(malformedUtf8, instance);
  assertEquals(
    malformedJs.matches.map((match: { patternId: number }) => match.patternId),
    [14, 8],
  );
  assertEquals(malformedWasm.matches, malformedJs.matches);
  assertEquals(malformedWasm.outputSha256, malformedJs.outputSha256);

  const overCapacity = makeAdversarialCorpus(new Array(50_001).fill("status=200"));
  await assertRejects(
    () => scanWasmControlled(overCapacity, instance),
    "Wasm output capacity exceeded",
  );
});

Deno.test("base regex artifact, evidence records, routes, and lifecycle source are complete", async () => {
  const authored = await compileAuthoredWasm();
  const artifact = await Deno.readFile(
    "public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
  );
  assertEquals(artifact, authored);
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/text-regex-log-scan/build-manifest.json"),
  );
  const { IDENTITY } = await import(
    `../public/demos/base/text.regex-log-scan.v1/identity.js?test=${Date.now()}`
  );
  const identityPaths: Record<string, string> = {
    registration: "public/data/base-implementations/text.regex-log-scan.v1.json",
    buildManifest: "public/artifacts/text-regex-log-scan/build-manifest.json",
    inputManifest: "public/artifacts/text-regex-log-scan/input-manifest.json",
    outputManifest: "public/artifacts/text-regex-log-scan/output-manifest.json",
    wasm: "public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
    captures: "public/artifacts/text-regex-log-scan/ordered-captures.bin",
    inputModule: "benchmarks/text-regex-log-scan/input.js",
    workloadModule: "benchmarks/text-regex-log-scan/workload.js",
    workerModule: "public/demos/base/text.regex-log-scan.v1/worker.js",
  };
  for (const [name, path] of Object.entries(identityPaths)) {
    assertEquals(await sha256Hex(await Deno.readFile(path)), IDENTITY.rawSha256[name]);
  }
  assertEquals(build.variants["wasm-linear-controlled"].artifactSha256, await sha256Hex(artifact));
  assertEquals(build.variants["wasm-linear-controlled"].algorithm.includes("automaton"), true);
  assertEquals(build.fixture.distributedBytes, false);
  const recordSchema = JSON.parse(
    await Deno.readTextFile("schemas/base-workload-correctness-record.schema.json"),
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(recordSchema);
  const records = [];
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base/text.regex-log-scan.v1/${variant}.json`,
      ),
    );
    assert(validate(record), JSON.stringify(validate.errors));
    assertEquals(record.scope.performanceClaim, false);
    assertEquals(record.scope.performanceCorpus, "unavailable");
    records.push(record);
  }
  const invalidRecords = [
    { ...structuredClone(records[0]), counters: { ...records[0].counters, matchesFound: -1 } },
    { ...structuredClone(records[0]), counters: { ...records[0].counters, perPattern: [] } },
    {
      ...structuredClone(records[0]),
      assertions: { ...records[0].assertions, exactOutputHash: false },
    },
    {
      ...structuredClone(records[0]),
      assertions: { ...records[0].assertions, wasmMaterialMatchingSemantics: true },
    },
    { ...structuredClone(records[1]), counters: { ...records[1].counters, boundaryCrossings: 0 } },
  ];
  for (const invalid of invalidRecords) {
    assert(!validate(invalid), "invalid passed correctness record must fail closed");
  }

  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/base/text.regex-log-scan.v1/",
      "/demos/base/text.regex-log-scan.v1/demo.js",
      "/demos/base/text.regex-log-scan.v1/worker.js",
      "/demos/base/text.regex-log-scan.v1/identity.js",
      "/benchmarks/text-regex-log-scan/input.js",
      "/benchmarks/text-regex-log-scan/workload.js",
      "/data/base-implementations/text.regex-log-scan.v1.json",
      "/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
      "/artifacts/text-regex-log-scan/ordered-captures.bin",
      "/artifacts/text-regex-log-scan/build-manifest.json",
      "/evidence/base/text.regex-log-scan.v1/js-controlled.json",
      "/evidence/base/text.regex-log-scan.v1/wasm-linear-controlled.json",
    ]
  ) assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/demos/base/text.regex-log-scan.v1/", { method: "POST" }),
    )).status,
    403,
  );

  const demo = await Deno.readTextFile("public/demos/base/text.regex-log-scan.v1/demo.js");
  assert(demo.includes('new Worker("./worker.js", { type: "module" })'));
  assert(demo.includes("120_000"));
  assert(demo.includes('addEventListener("pagehide", cleanup)'));
  assert(demo.includes("ownedWorker") && demo.includes("runToken !== token"));
  assert(demo.includes("worker.terminate()"));
  const html = await Deno.readTextFile("public/benchmarks/base/text.regex-log-scan.v1/index.html");
  assert(html.includes("No performance claim."));
  assert(html.includes("Nothing is uploaded or stored."));
  assert(html.includes("104,857,600 input bytes"));
  assert(html.includes("separate from the 1 MiB regex automata duel"));
});
