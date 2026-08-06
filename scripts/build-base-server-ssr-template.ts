import { sha256Hex } from "../lib/canonical.ts";
import {
  COUNTER_NAMES,
  generateFixture,
  instantiateSsrWasm,
  RECORDS,
  renderJavaScript,
  renderWasm,
  TOKEN_COUNT_PER_RESPONSE,
  WORKLOAD_ID,
} from "../benchmarks/v1/server-ssr-template/workload.js";

const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/base-server-ssr-template/", root);
const registrationDir = new URL("catalog/v1-implementation-registrations/", root);
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(registrationDir, { recursive: true });

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

const buildDir = new URL(".build/", artifactDir);
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
const objectPath = new URL("server-ssr-template.o", buildDir).pathname;
const wasmPath = new URL("server-ssr-template.wasm", buildDir).pathname;
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-fno-ident",
    "-c",
    "benchmarks/v1/server-ssr-template/server-ssr-template.c",
    "-o",
    objectPath,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=output_ptr",
    "--export=counters_ptr",
    "--export=render_corpus",
    "--initial-memory=16777216",
    "--max-memory=16777216",
    "--stack-first",
    "--strip-all",
    objectPath,
    "-o",
    wasmPath,
  ]);
  await Deno.writeFile(
    new URL("server-ssr-template.wasm", artifactDir),
    await Deno.readFile(wasmPath),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const fixture = generateFixture();
const wasm = await Deno.readFile(new URL("server-ssr-template.wasm", artifactDir));
const js = renderJavaScript(fixture);
const wasmResult = renderWasm(await instantiateSsrWasm(wasm), fixture);
if (await sha256Hex(js.output) !== await sha256Hex(wasmResult.output)) {
  throw new Error("complete JavaScript/Wasm output mismatch");
}
const jsCounters = js.counters as Record<string, number>;
const wasmCounters = wasmResult.counters as Record<string, number>;
for (const name of COUNTER_NAMES) {
  if (name === "boundary-crossings") continue;
  if (jsCounters[name] !== wasmCounters[name]) throw new Error(`counter mismatch: ${name}`);
}
await Deno.writeFile(new URL("fixture.bin", artifactDir), fixture);
await Deno.writeFile(new URL("reference-output.bin", artifactDir), js.output);

const catalogBytes = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
const publicCatalogBytes = await Deno.readFile(new URL("public/data/workloads.v1.json", root));
const catalogHash = await sha256Hex(catalogBytes);
if (catalogHash !== "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4") {
  throw new Error("frozen catalog bytes changed");
}
if (catalogHash !== await sha256Hex(publicCatalogBytes)) throw new Error("catalog copies diverged");
const sourceCommit = (await Deno.readTextFile(
  new URL("artifacts/base/server-ssr-template/source-commit.txt", root),
)).trim();
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("invalid source commit pin");

const sourcePaths = [
  "benchmarks/v1/server-ssr-template/workload.js",
  "benchmarks/v1/server-ssr-template/server-ssr-template.c",
  "scripts/build-base-server-ssr-template.ts",
  "schemas/v1-implementation-registration.schema.json",
  "public/base-server-ssr-demo.js",
  "public/base-server-ssr-worker.js",
  "public/benchmarks/server.ssr-template.v1/index.html",
  "server.ts",
  "tests/base-server-ssr-template.test.ts",
  "deno.json",
  "deno.lock",
];
const sources = await Promise.all(sourcePaths.map(async (path) => {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.length, sha256: await sha256Hex(bytes) };
}));
const clangVersion = (await command("clang", ["--version"])).split("\n")[0];
const linkerVersion = await command("wasm-ld", ["--version"]);
const fixtureHash = await sha256Hex(fixture);
const outputHash = await sha256Hex(js.output);
const wasmHash = await sha256Hex(wasm);
const jsHash = await sha256Hex(
  await Deno.readFile(new URL("benchmarks/v1/server-ssr-template/workload.js", root)),
);

const fixtureManifest = {
  schemaVersion: 1,
  workloadId: WORKLOAD_ID,
  immutable: true,
  generator: {
    source: "benchmarks/v1/server-ssr-template/workload.js",
    revision: sourceCommit,
    seed: "0x53535231",
    records: RECORDS,
  },
  rights: {
    owner: "Wasm versus JavaScript project",
    source: "project-generated; no external text, user data, templates, or media",
    licenseSpdx: "CC0-1.0",
    redistribution: "permitted",
  },
  fixture: {
    path: "public/artifacts/base-server-ssr-template/fixture.bin",
    bytes: fixture.length,
    sha256: fixtureHash,
  },
};
const outputManifest = {
  schemaVersion: 1,
  workloadId: WORKLOAD_ID,
  oracle: "complete canonical UTF-8 byte framing plus per-response length framing",
  responses: RECORDS,
  reference: {
    path: "public/artifacts/base-server-ssr-template/reference-output.bin",
    bytes: js.output.length,
    sha256: outputHash,
  },
  variants: {
    "js-controlled": { status: "passed", outputSha256: outputHash, counters: js.counters },
    "wasm-linear-controlled": {
      status: "passed",
      outputSha256: outputHash,
      counters: wasmResult.counters,
    },
  },
  performanceClaims: [],
};
const buildManifest = {
  schemaVersion: 1,
  workloadId: WORKLOAD_ID,
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sources,
  variants: {
    "js-controlled": {
      source: sourcePaths[0],
      sha256: jsHash,
      algorithm: "owned binary fixture parser and fixed token interpreter",
    },
    "wasm-linear-controlled": {
      source: sourcePaths[1],
      artifact: "public/artifacts/base-server-ssr-template/server-ssr-template.wasm",
      sha256: wasmHash,
      algorithm: "owned binary fixture parser and fixed token interpreter in linear memory",
    },
  },
  build: {
    deno: Deno.version.deno,
    clang: clangVersion,
    linker: linkerVersion,
    command: "deno task build",
    compilerFlags: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
      "-fno-ident",
    ],
    linkerFlags: [
      "--no-entry",
      "--export-memory",
      "--initial-memory=16777216",
      "--max-memory=16777216",
      "--stack-first",
      "--strip-all",
    ],
  },
};
const registration = {
  schemaVersion: 1,
  workloadId: WORKLOAD_ID,
  sourceCommit,
  frozenCatalog: {
    path: "catalog/workloads.v1.json",
    sha256: catalogHash,
    immutability: "byte-for-byte",
  },
  status: "candidate-pending-independent-review",
  equivalence: {
    class: "semantic-product-choice",
    algorithmFamily: "ssr-fixed-template-escaping",
    aggregation: "excluded-from-algorithm-equivalent-aggregate",
  },
  fixture: {
    path: fixtureManifest.fixture.path,
    sha256: fixtureHash,
    records: RECORDS,
    rights: fixtureManifest.rights,
  },
  fixedWork: {
    responses: RECORDS,
    grammar:
      "23-token fixed interpreter: literals, UTF-8 text, HTML attribute, URL component, unsigned decimal, fixed Gregorian YYYY-MM-DD",
    localePolicy:
      "ASCII syntax, USD decimal point, and frozen YYYY-MM-DD only; locale-dependent Intl is prohibited",
    framing:
      "SSF1 little-endian input; SSO1 little-endian output; u32 count; every UTF-8 string/response length-prefixed",
    contexts: {
      text: "escape ampersand, less-than, greater-than",
      attribute: "text escapes plus double quote to &quot; and apostrophe to &#39;",
      urlComponent: "UTF-8 bytes percent-encoded unless RFC 3986 unreserved",
    },
  },
  variants: {
    "js-controlled": { target: "javascript", source: sourcePaths[0], sha256: jsHash },
    "wasm-linear-controlled": {
      target: "linear-wasm",
      source: sourcePaths[1],
      artifact: buildManifest.variants["wasm-linear-controlled"].artifact,
      sha256: wasmHash,
    },
  },
  oracle: {
    kind: "canonical-semantic",
    completeOutputSha256: outputHash,
    bytes: js.output.length,
    responses: RECORDS,
    crossTargetByteIdentical: true,
  },
  counters: {
    names: COUNTER_NAMES,
    expected: { ...js.counters, "boundary-crossings": { javascript: 0, wasm: 1 } },
    tokenCountPerResponse: TOKEN_COUNT_PER_RESPONSE,
  },
  artifacts: {
    buildManifest: {
      path: "public/artifacts/base-server-ssr-template/build-manifest.json",
      sha256: "pending",
    },
    fixtureManifest: {
      path: "public/artifacts/base-server-ssr-template/fixture-manifest.json",
      sha256: "pending",
    },
    outputManifest: {
      path: "public/artifacts/base-server-ssr-template/output-manifest.json",
      sha256: "pending",
    },
  },
  limitations: [
    "Correctness package and runnable demo only; no performance corpus or ranking.",
    "Semantic-product-choice results cannot enter an algorithm-equivalent aggregate.",
    "Runtime-managed allocations and GC events are unavailable; allocations counts the single application-owned output arena only.",
  ],
};
const serializedArtifacts = {
  fixtureManifest: `${JSON.stringify(fixtureManifest, null, 2)}\n`,
  outputManifest: `${JSON.stringify(outputManifest, null, 2)}\n`,
  buildManifest: `${JSON.stringify(buildManifest, null, 2)}\n`,
};
registration.artifacts.fixtureManifest.sha256 = await sha256Hex(
  serializedArtifacts.fixtureManifest,
);
registration.artifacts.outputManifest.sha256 = await sha256Hex(serializedArtifacts.outputManifest);
registration.artifacts.buildManifest.sha256 = await sha256Hex(serializedArtifacts.buildManifest);
await Deno.writeTextFile(
  new URL("fixture-manifest.json", artifactDir),
  serializedArtifacts.fixtureManifest,
);
await Deno.writeTextFile(
  new URL("output-manifest.json", artifactDir),
  serializedArtifacts.outputManifest,
);
await Deno.writeTextFile(
  new URL("build-manifest.json", artifactDir),
  serializedArtifacts.buildManifest,
);
await Deno.writeTextFile(
  new URL("server.ssr-template.v1.json", registrationDir),
  `${JSON.stringify(registration, null, 2)}\n`,
);
console.log(
  `build: ${WORKLOAD_ID} ${fixture.length} fixture bytes, ${js.output.length} exact output bytes, ${wasm.length} Wasm bytes`,
);
