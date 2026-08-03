import { sha256Hex } from "../lib/canonical.ts";
import { validateOlapBrowserResults } from "../benchmarks/base/database-olap-chart/browser-validation.js";
import { generateOlapFixture } from "../benchmarks/base/database-olap-chart/fixture.js";
import {
  instantiateOlapWasm,
  runOlapJavaScript,
  runOlapWasm,
} from "../benchmarks/base/database-olap-chart/engine.js";

const root = new URL("../", import.meta.url);
const out = new URL("public/artifacts/database-olap-chart/", root);
const evidence = new URL("public/evidence/base/database-olap-chart/", root);
await Deno.mkdir(out, { recursive: true });
await Deno.mkdir(evidence, { recursive: true });
const sourceArg = Deno.args.find((value) => value.startsWith("--source-commit="));
const sourceCommit = sourceArg?.slice(16) ?? "uncommitted-source";

async function command(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
}
const build = new URL(".build/", out).pathname;
await Deno.remove(build, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(build, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-fno-vectorize",
    "-fno-slp-vectorize",
    "-c",
    "benchmarks/base/database-olap-chart/olap.c",
    "-o",
    `${build}/olap.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=result_ptr",
    "--export=run",
    "--export=counter",
    "--initial-memory=1048576",
    "--max-memory=1048576",
    "--stack-first",
    `${build}/olap.o`,
    "-o",
    `${build}/database-olap-chart.wasm`,
  ]);
  await Deno.writeFile(
    new URL("database-olap-chart.wasm", out),
    await Deno.readFile(`${build}/database-olap-chart.wasm`),
  );
} finally {
  await Deno.remove(build, { recursive: true });
}
const fixture = generateOlapFixture();
await Deno.writeFile(new URL("fixture.bin", out), fixture);
const wasm = await Deno.readFile(new URL("database-olap-chart.wasm", out));
const js = runOlapJavaScript(fixture);
const linear = runOlapWasm(await instantiateOlapWasm(wasm), fixture);
if (
  js.digest !== linear.digest ||
  js.output.some((value: number, index: number) => value !== linear.output[index]) ||
  JSON.stringify(js.chartModels) !== JSON.stringify(linear.chartModels)
) {
  throw new Error("complete JavaScript/Wasm output mismatch");
}
const sourcePaths = [
  "benchmarks/base/database-olap-chart/implementation-contract.v1.json",
  "benchmarks/base/database-olap-chart/fixture.js",
  "benchmarks/base/database-olap-chart/engine.js",
  "benchmarks/base/database-olap-chart/browser-validation.js",
  "benchmarks/base/database-olap-chart/olap.c",
  "public/benchmarks/database-olap-chart/worker.js",
  "public/benchmarks/database-olap-chart/runner.js",
  "scripts/build-base-olap.ts",
  "schemas/base-implementation/registration.schema.json",
  "schemas/base-implementation/correctness-record.schema.json",
  "deno.json",
  "deno.lock",
];
const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.length, sha256: await sha256Hex(bytes) });
}
const fixtureSha256 = await sha256Hex(fixture);
const wasmSha256 = await sha256Hex(wasm);
const fixtureManifest = {
  schemaVersion: 1,
  workloadId: "database.olap-chart.v1",
  immutable: true,
  generator: {
    path: "benchmarks/base/database-olap-chart/fixture.js",
    seed: "0x91e10da5",
    rows: 10000,
    queries: 5,
  },
  fixture: {
    path: "public/artifacts/database-olap-chart/fixture.bin",
    bytes: fixture.length,
    sha256: fixtureSha256,
  },
  rights: {
    licenseSpdx: "CC0-1.0",
    owner: "Paul Kinlan / wasm-vs-js project",
    source: "project-generated",
    redistribution: "permitted",
    externalInputs: [],
  },
};
const outputManifest = {
  schemaVersion: 1,
  workloadId: "database.olap-chart.v1",
  status: "correctness-validation-not-performance",
  completeOutput: {
    words: js.output.length,
    bytes: js.output.byteLength,
    digestAlgorithm: "fnv1a-u32le-v1",
    digest: js.digest,
    values: Array.from(js.output),
    chartModels: js.chartModels,
  },
  counterUnits: {
    allocations:
      "one per explicit Array or TypedArray object/view in controlled compute; backing storage is part of the same unit; fixture validation, boundary adaptation, and chart-model decoding are excluded",
    boundaryCrossings:
      "one per host invocation of an exported Wasm function, including pointer, run, result, and counter calls",
  },
  variants: {
    "js-controlled": { status: "passed", counters: js.counters },
    "wasm-linear-controlled": { status: "passed", counters: linear.counters },
  },
  performanceClaims: [],
};
validateOlapBrowserResults(js, linear, outputManifest);
const fixtureManifestBytes = new TextEncoder().encode(
  `${JSON.stringify(fixtureManifest, null, 2)}\n`,
);
const outputManifestBytes = new TextEncoder().encode(
  `${JSON.stringify(outputManifest, null, 2)}\n`,
);
const toolchain = {
  deno: Deno.version.deno,
  clang: await command("clang", ["--version"]),
  wasmLd: await command("wasm-ld", ["--version"]),
};
const buildManifest = {
  schemaVersion: 1,
  workloadId: "database.olap-chart.v1",
  sourceCommit,
  command:
    "deno run --allow-read=. --allow-write=public/artifacts,public/evidence --allow-run=clang,wasm-ld scripts/build-base-olap.ts --source-commit=<commit>",
  flags: [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-fno-vectorize",
    "-fno-slp-vectorize",
    "--initial-memory=1048576",
    "--max-memory=1048576",
  ],
  toolchain,
  sources,
  artifacts: [
    {
      path: "public/artifacts/database-olap-chart/database-olap-chart.wasm",
      bytes: wasm.length,
      sha256: wasmSha256,
    },
    {
      path: "public/artifacts/database-olap-chart/fixture.bin",
      bytes: fixture.length,
      sha256: fixtureSha256,
    },
    {
      path: "public/artifacts/database-olap-chart/fixture-manifest.json",
      bytes: fixtureManifestBytes.length,
      sha256: await sha256Hex(fixtureManifestBytes),
    },
    {
      path: "public/artifacts/database-olap-chart/output-manifest.json",
      bytes: outputManifestBytes.length,
      sha256: await sha256Hex(outputManifestBytes),
    },
  ],
};
await Deno.writeFile(new URL("fixture-manifest.json", out), fixtureManifestBytes);
await Deno.writeFile(new URL("output-manifest.json", out), outputManifestBytes);
await Deno.writeTextFile(
  new URL("build-manifest.json", out),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
);
const record = {
  schemaVersion: 1,
  recordId: "database.olap-chart.v1.controlled-a1.correctness",
  workloadId: "database.olap-chart.v1",
  status: "passed-correctness-only",
  sourceCommit,
  fixtureSha256,
  wasmSha256,
  completeOutputDigest: js.digest,
  oracleChecks: {
    fixedFiveQueryTrace: true,
    completeChartModels: true,
    stableSortAndRowIds: true,
    exactCrossTargetOutput: true,
    exactCounters: true,
  },
  limitations: [
    "No performance samples or ranking are included.",
    "Chart rendering is separate; the complete canonical chart model is retained.",
  ],
};
await Deno.writeTextFile(
  new URL("correctness-record.json", evidence),
  `${JSON.stringify(record, null, 2)}\n`,
);
console.log(
  `base-olap: ${fixture.length} fixture bytes, ${wasm.length} Wasm bytes, digest ${js.digest}`,
);
