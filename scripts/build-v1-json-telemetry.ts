import { sha256Hex } from "../lib/canonical.ts";
import {
  generateTelemetryFixture,
  GENERATOR_REVISION,
  GENERATOR_SEED,
  REGISTERED_COUNTS,
  runTelemetryJS,
  runTelemetryWasm,
  WORKLOAD_ID,
} from "../benchmarks/v1/serialization-json-telemetry/workload.js";

if (Deno.version.deno !== "2.9.0") {
  throw new Error(`requires Deno 2.9.0, found ${Deno.version.deno}`);
}
const source = "benchmarks/v1/serialization-json-telemetry/telemetry.c";
const artifactDir = "public/artifacts/serialization-json-telemetry";
const artifact = `${artifactDir}/telemetry.wasm`;
await Deno.mkdir(artifactDir, { recursive: true });
const flags = [
  "--target=wasm32",
  "-O3",
  "-nostdlib",
  "-fno-builtin",
  "-fno-ident",
  "-Wl,--no-entry",
  "-Wl,--strip-all",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=131072",
  "-Wl,--max-memory=268435456",
  "-Wl,--stack-first",
  "-Wl,--export=process",
  "-Wl,--export=get_records",
  "-Wl,--export=get_input_bytes",
  "-Wl,--export=get_numeric_values",
  "-Wl,--export=get_string_values",
  "-Wl,--export=get_booleans",
  "-Wl,--export=get_query_aggregates",
  "-Wl,--export=get_allocations",
  "-o",
  artifact,
  source,
];
const build = await new Deno.Command("clang", { args: flags, stdout: "piped", stderr: "piped" })
  .output();
if (!build.success) throw new Error(new TextDecoder().decode(build.stderr));
const wasm = await Deno.readFile(artifact);
const sourcePaths = [
  source,
  "benchmarks/v1/serialization-json-telemetry/workload.js",
  "scripts/build-v1-json-telemetry.ts",
  "deno.json",
  "deno.lock",
];
const sourceGraph = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(path);
  sourceGraph.push({ path, bytes: bytes.length, sha256: await sha256Hex(bytes) });
}
const fixtures = [];
const outputs = [];
for (const records of REGISTERED_COUNTS) {
  const input = generateTelemetryFixture(records);
  const js = runTelemetryJS(input);
  const wasmResult = await runTelemetryWasm(input, wasm);
  if (js.text !== wasmResult.text) throw new Error(`${records}: JS/Wasm canonical output mismatch`);
  const expectedWasmCounters = { ...js.counters, allocations: 0, "boundary-crossings": 2 };
  if (JSON.stringify(wasmResult.counters) !== JSON.stringify(expectedWasmCounters)) {
    throw new Error(`${records}: JS/Wasm counter mismatch`);
  }
  fixtures.push({ records, bytes: input.length, sha256: await sha256Hex(input) });
  outputs.push({
    records,
    bytes: js.outputBytes.length,
    sha256: await sha256Hex(js.outputBytes),
    canonicalSummary: js.text,
    variants: {
      "js-controlled": { counters: js.counters },
      "wasm-linear-controlled": { counters: wasmResult.counters },
    },
  });
  console.log(`${records}: ${input.length} bytes -> ${js.outputBytes.length} bytes`);
}
const writeJson = (path: string, value: unknown) =>
  Deno.writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
await writeJson(`${artifactDir}/fixture-manifest.json`, {
  schemaVersion: 1,
  workload: WORKLOAD_ID,
  registration: "v1-base-implementation-registration-v1",
  generator: {
    algorithm: "xorshift32",
    seed: `0x${GENERATOR_SEED.toString(16)}`,
    revision: GENERATOR_REVISION,
    source: "benchmarks/v1/serialization-json-telemetry/workload.js",
    licenseSpdx: "CC0-1.0",
  },
  grammar: {
    encoding: "UTF-8 without BOM",
    document: "one compact JSON array",
    recordOrder: ["id", "ts", "region", "kind", "ok", "value", "meta"],
    metaOrder: ["label", "tag"],
    unsignedInteger:
      "ASCII decimal, no sign, fraction, exponent, whitespace, or leading zero except zero",
    strings: "no escape sequences; exact frozen UTF-8 vocabulary",
    region: ["ap", "eu", "na", "sa"],
    kind: ["click", "purchase", "view"],
    label: ["Café", "東京", "مرحبا", "🚀"],
    tag: ["α", "数据", "mañana", "🧪"],
    nesting: "meta is the only nested object",
  },
  tiers: fixtures,
  giantBlobsCommitted: false,
  counterDefinitions: {
    allocations:
      "operative target-phase dynamic values after fixture generation: JavaScript records exactly six through the allocation probe (parser state, kind vector, region vector, summary aggregate, canonical summary text, canonical summary bytes); linear Wasm exports zero because its parser uses fixed linear memory and stack storage; module vocabulary initialization and post-target validation envelopes are outside this counter",
    boundaryCrossings:
      "zero for JavaScript; two for linear Wasm: one input copy into linear memory and one output copy back",
  },
});
await writeJson(`${artifactDir}/input-manifest.json`, {
  schemaVersion: 1,
  workload: WORKLOAD_ID,
  serialization: "compact frozen JSON grammar in fixture-manifest.json",
  tiers: fixtures,
});
await writeJson(`${artifactDir}/output-manifest.json`, {
  schemaVersion: 1,
  workload: WORKLOAD_ID,
  oracle: "byte-exact canonical summary and exact structural counters",
  canonicalization:
    "fixed UTF-8 key order; unsigned base-10 integers without leading zeros; no whitespace",
  querySet: [
    "record count",
    "false ok count",
    "kind counts for click/purchase/view",
    "true ok count",
    "region counts for ap/eu/na/sa",
    "sum of value",
  ],
  tiers: outputs,
  performanceClaims: [],
});
await writeJson(`${artifactDir}/build-manifest.json`, {
  schemaVersion: 1,
  workload: WORKLOAD_ID,
  variant: "wasm-linear-controlled",
  toolchain: [
    { name: "Deno", version: "2.9.0" },
    { name: "Clang", version: "22.1.8" },
    { name: "LLD", version: "22.1.8" },
  ],
  command: ["clang", ...flags],
  features: {
    simd: false,
    threads: false,
    exceptions: false,
    memoryGrowth: true,
    maximumPages: 4096,
  },
  artifact: { path: artifact, bytes: wasm.length, sha256: await sha256Hex(wasm) },
  fullSourceGraph: sourceGraph,
});
console.log(`wasm ${wasm.length} bytes ${await sha256Hex(wasm)}`);
