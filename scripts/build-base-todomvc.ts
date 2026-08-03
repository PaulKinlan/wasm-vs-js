import wabtFactory from "wabt";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  assertEquivalent,
  instantiateTodoWasm,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/dom-todomvc-journey/engine.js";
import {
  BASE_CATALOG_ID,
  finalAxOracle,
  finalDomOracle,
  fixtureDocument,
  IMPLEMENTATION_ID,
  ROUTE,
} from "../benchmarks/base/dom-todomvc-journey/fixture.js";

const root = new URL("../", import.meta.url);
const sourceArgument = Deno.args.find((arg) => arg.startsWith("--source-commit="));
const sourceCommit = sourceArgument?.slice("--source-commit=".length) ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex> is required");
}
if (Deno.version.deno !== "2.9.0") throw new Error(`Deno 2.9.0 required, got ${Deno.version.deno}`);

const artifactDir = new URL("public/artifacts/base-dom-todomvc-journey/", root);
const evidenceDir = new URL("public/evidence/base/dom-todomvc-journey/", root);
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
const bundle = await new Deno.Command(Deno.execPath(), {
  cwd: root,
  args: [
    "bundle",
    "--platform",
    "browser",
    "--format",
    "esm",
    "--no-remote",
    "--frozen",
    "benchmarks/base/dom-todomvc-journey/runtime-entry.js",
    "--output",
    "public/artifacts/base-dom-todomvc-journey/runtime.js",
  ],
  stdout: "piped",
  stderr: "piped",
}).output();
if (!bundle.success) throw new Error(new TextDecoder().decode(bundle.stderr));
const runtimeUrl = new URL("runtime.js", artifactDir);
const bundledRuntime = `// deno-lint-ignore-file no-unused-vars\n${
  (await Deno.readTextFile(runtimeUrl)).replace(/^var /gm, "const ")
}`;
await Deno.writeTextFile(runtimeUrl, bundledRuntime);
const runtimeBytes = await Deno.readFile(runtimeUrl);

async function gitBytes(path: string) {
  const output = await new Deno.Command("git", {
    cwd: root,
    args: ["show", `${sourceCommit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(`${path} is absent from ${sourceCommit}`);
  return output.stdout;
}

const sourcePaths = [
  "benchmarks/base/dom-todomvc-journey/benchmark.json",
  "benchmarks/base/dom-todomvc-journey/fixture.js",
  "benchmarks/base/dom-todomvc-journey/engine.js",
  "benchmarks/base/dom-todomvc-journey/runtime-entry.js",
  "benchmarks/base/dom-todomvc-journey/todomvc.wat",
  "public/benchmarks/base-dom-todomvc-journey/index.html",
  "public/benchmarks/base-dom-todomvc-journey/controller.js",
  "public/benchmarks/base-dom-todomvc-journey/worker.js",
  "public/benchmarks/base-dom-todomvc-journey/styles.css",
  "lib/base-todomvc-gate.ts",
  "lib/base-todomvc-network.ts",
  "schemas/base-workload-implementation.schema.json",
  "schemas/base-todomvc-browser-evidence.schema.json",
  "scripts/build-base-todomvc.ts",
  "scripts/validate-base-todomvc-browser.ts",
  "tests/base-todomvc.test.ts",
  "tests/base-todomvc-network.test.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const sourceGraph = [];
for (const path of sourcePaths) {
  const disk = await Deno.readFile(new URL(path, root));
  const committed = await gitBytes(path);
  const diskHash = await sha256Hex(disk);
  if (diskHash !== await sha256Hex(committed)) {
    throw new Error(`${path} differs from ${sourceCommit}`);
  }
  sourceGraph.push({
    path,
    bytes: disk.byteLength,
    sha256: diskHash,
    immutableUrl: `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${path}`,
  });
}

const watBytes = await Deno.readFile(
  new URL("benchmarks/base/dom-todomvc-journey/todomvc.wat", root),
);
const wabt = await wabtFactory();
const parsed = wabt.parseWat("todomvc.wat", new TextDecoder().decode(watBytes), {
  exceptions: false,
  threads: false,
  simd: false,
});
parsed.resolveNames();
parsed.validate();
const binary = parsed.toBinary({
  canonicalize_lebs: true,
  relocatable: false,
  write_debug_names: false,
});
parsed.destroy();
const wasm = new Uint8Array(binary.buffer);
await Deno.writeFile(new URL("todomvc.wasm", artifactDir), wasm);

const fixtureBytes = new TextEncoder().encode(`${canonicalize(fixtureDocument())}\n`);
await Deno.writeFile(new URL("fixture.json", artifactDir), fixtureBytes);
const js = runJavaScript();
const wasmResult = runWasm(await instantiateTodoWasm(wasm));
assertEquivalent(js, wasmResult);
const normalize = (value: typeof js) => ({
  commands: value.commands,
  flags: value.flags,
  versions: value.versions,
  summary: value.summary,
});
const canonicalOutputBytes = new TextEncoder().encode(canonicalize(normalize(js)));
const canonicalDom = finalDomOracle();
const canonicalAx = finalAxOracle();
const outputManifest = {
  schemaVersion: 1,
  catalogId: BASE_CATALOG_ID,
  implementationId: IMPLEMENTATION_ID,
  status: "static-validation-passed-browser-pending",
  authoritativePerformanceEvidence: false,
  oracle: {
    kind: "canonical-semantic-and-physical-dom",
    semanticOutputSha256: await sha256Hex(canonicalOutputBytes),
    typedCommandSha256: await sha256Hex(new Uint8Array(new Int32Array(js.commands).buffer)),
    finalState: js.summary,
    canonicalDom,
    canonicalDomSha256: await sha256Hex(canonicalize(canonicalDom)),
    canonicalAx,
    canonicalAxSha256: await sha256Hex(canonicalize(canonicalAx)),
    requiredBrowserAssertions: [
      "90 physical list items in canonical ID order",
      "30 checked and 60 unchecked native checkboxes",
      "all items visible under the final All filter",
      "all 90 per-ID labels, checked states, class names, edit values, edit visibility, and ARIA attributes equal the retained canonical DOM oracle",
      "focus remains on edit input 95 with collapsed UTF-16 selection at the end",
      "actual CDP AX-tree checkbox and remove-button names equal the retained per-ID AX oracle",
      "exact adapter counters include 500 created elements, 500 appends, 10 removes, 347 reuses, and 2,402 physical mutations",
    ],
  },
  variants: {
    "js-controlled": { status: "passed", target: "javascript", counters: js.counters },
    "wasm-linear-controlled": {
      status: "passed",
      target: "wasm-linear",
      counters: wasmResult.counters,
    },
  },
  crossTarget: {
    completeSemanticEquality: true,
    commandCount: 150,
    commandFields: 600,
  },
};
const outputBytes = new TextEncoder().encode(`${canonicalize(outputManifest)}\n`);
await Deno.writeFile(new URL("output-manifest.json", artifactDir), outputBytes);

const frozenCatalog = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
const publicCatalog = await Deno.readFile(new URL("public/data/workloads.v1.json", root));
const catalogHash = await sha256Hex(frozenCatalog);
if (catalogHash !== await sha256Hex(publicCatalog)) throw new Error("frozen catalog copies differ");
const buildManifest = {
  schemaVersion: 1,
  catalogId: BASE_CATALOG_ID,
  implementationId: IMPLEMENTATION_ID,
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sourceGraph,
  sourceGraphSha256: await sha256Hex(
    sourceGraph.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join(""),
  ),
  build: {
    command:
      `deno run --allow-read=. --allow-write=public/artifacts/base-dom-todomvc-journey,public/evidence/base/dom-todomvc-journey,catalog/base-dom-todomvc-journey.v1.json,public/data/base-dom-todomvc-journey.v1.json --allow-run scripts/build-base-todomvc.ts --source-commit=${sourceCommit}`,
    toolchains: ["Deno 2.9.0", "wabt 1.0.37"],
    flags: [
      "deno bundle platform=browser format=esm no-remote frozen",
      "wabt canonicalize_lebs=true",
      "write_debug_names=false",
      "simd=false",
      "threads=false",
      "exceptions=false",
      "memory initial=1 page max=1 page",
    ],
    reproducible: true,
  },
  frozenCatalog: { sha256: catalogHash, immutable: true, entryCount: 38 },
  outputs: {
    runtime: { bytes: runtimeBytes.byteLength, sha256: await sha256Hex(runtimeBytes) },
    wasm: { bytes: wasm.byteLength, sha256: await sha256Hex(wasm) },
    fixture: { bytes: fixtureBytes.byteLength, sha256: await sha256Hex(fixtureBytes) },
    oracle: { bytes: outputBytes.byteLength, sha256: await sha256Hex(outputBytes) },
  },
};
const buildBytes = new TextEncoder().encode(`${canonicalize(buildManifest)}\n`);
await Deno.writeFile(new URL("build-manifest.json", artifactDir), buildBytes);

const routeByPath = new Map([
  ["catalog/workloads.v1.json", "/data/workloads.v1.json"],
  [
    "benchmarks/base/dom-todomvc-journey/benchmark.json",
    "/benchmarks/base/dom-todomvc-journey/benchmark.json",
  ],
  [
    "benchmarks/base/dom-todomvc-journey/fixture.js",
    "/benchmarks/base/dom-todomvc-journey/fixture.js",
  ],
  [
    "benchmarks/base/dom-todomvc-journey/engine.js",
    "/benchmarks/base/dom-todomvc-journey/engine.js",
  ],
  [
    "benchmarks/base/dom-todomvc-journey/todomvc.wat",
    "/benchmarks/base/dom-todomvc-journey/todomvc.wat",
  ],
  ["public/benchmarks/base-dom-todomvc-journey/index.html", ROUTE],
  [
    "public/benchmarks/base-dom-todomvc-journey/controller.js",
    "/benchmarks/base-dom-todomvc-journey/controller.js",
  ],
  [
    "public/benchmarks/base-dom-todomvc-journey/worker.js",
    "/benchmarks/base-dom-todomvc-journey/worker.js",
  ],
  [
    "public/benchmarks/base-dom-todomvc-journey/styles.css",
    "/benchmarks/base-dom-todomvc-journey/styles.css",
  ],
  [
    "schemas/base-workload-implementation.schema.json",
    "/data/base-workload-implementation.schema.json",
  ],
  [
    "schemas/base-todomvc-browser-evidence.schema.json",
    "/data/base-todomvc-browser-evidence.schema.json",
  ],
]);
const artifacts = [];
for (const [path, route] of routeByPath) {
  const bytes = path === "catalog/workloads.v1.json"
    ? publicCatalog
    : await Deno.readFile(new URL(path, root));
  artifacts.push({ path, route, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}
for (
  const [path, route, bytes] of [
    [
      "public/artifacts/base-dom-todomvc-journey/runtime.js",
      "/artifacts/base-dom-todomvc-journey/runtime.js",
      runtimeBytes,
    ],
    [
      "public/artifacts/base-dom-todomvc-journey/todomvc.wasm",
      "/artifacts/base-dom-todomvc-journey/todomvc.wasm",
      wasm,
    ],
    [
      "public/artifacts/base-dom-todomvc-journey/fixture.json",
      "/artifacts/base-dom-todomvc-journey/fixture.json",
      fixtureBytes,
    ],
    [
      "public/artifacts/base-dom-todomvc-journey/output-manifest.json",
      "/artifacts/base-dom-todomvc-journey/output-manifest.json",
      outputBytes,
    ],
    [
      "public/artifacts/base-dom-todomvc-journey/build-manifest.json",
      "/artifacts/base-dom-todomvc-journey/build-manifest.json",
      buildBytes,
    ],
  ] as const
) artifacts.push({ path, route, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
const fixture = artifacts.find(({ route }) => route.endsWith("/fixture.json"));
const oracle = artifacts.find(({ route }) => route.endsWith("/output-manifest.json"));
if (!fixture || !oracle) throw new Error("registration roots missing");
const registration = {
  schemaVersion: 1,
  catalogId: BASE_CATALOG_ID,
  implementationId: IMPLEMENTATION_ID,
  status: "implementation-candidate",
  sourceCommit,
  frozenCatalog: buildManifest.frozenCatalog,
  route: ROUTE,
  variants: ["js-controlled", "wasm-linear-controlled"],
  fixture,
  oracle,
  artifacts,
  limitations: [
    "Frozen-v1 remains byte-for-byte unchanged; this supplemental candidate does not count as accepted 1/38 coverage before independent review and retained browser evidence.",
    "The controlled implementations are framework-free and therefore do not generalize to framework product-choice performance.",
    "The route publishes correctness and work evidence only; it records no timing, persistence, upload, or ranking.",
  ],
};
const registrationBytes = new TextEncoder().encode(`${JSON.stringify(registration, null, 2)}\n`);
await Deno.writeFile(new URL("catalog/base-dom-todomvc-journey.v1.json", root), registrationBytes);
await Deno.writeFile(
  new URL("public/data/base-dom-todomvc-journey.v1.json", root),
  registrationBytes,
);

for (const value of [js, wasmResult]) {
  const record = {
    schemaVersion: 1,
    catalogId: BASE_CATALOG_ID,
    implementationId: IMPLEMENTATION_ID,
    variantId: value.variantId,
    status: "static-validation-passed-browser-pending",
    sourceCommit,
    fixtureSha256: fixture.sha256,
    oracleSha256: oracle.sha256,
    semanticOutputSha256: outputManifest.oracle.semanticOutputSha256,
    typedCommandSha256: outputManifest.oracle.typedCommandSha256,
    counters: value.counters,
    browserEvidence: {
      status: "uncollected",
      reason: "authoritative parent-owned Chrome run pending",
    },
    performanceClaims: [],
  };
  await Deno.writeTextFile(
    new URL(`${value.variantId}.json`, evidenceDir),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}
console.log(
  `build:base-todomvc ${wasm.byteLength} byte Wasm; 150 commands; source ${sourceCommit}`,
);
