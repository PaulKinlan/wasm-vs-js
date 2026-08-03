import wabtFactory from "wabt";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { generateCorpus } from "../benchmarks/text-regex-log-scan/input.js";
import {
  canonicalOutput,
  scanJsControlled,
  scanWasmControlled,
} from "../benchmarks/text-regex-log-scan/workload.js";

const root = new URL("../", import.meta.url);
const outputDir = new URL("public/artifacts/text-regex-log-scan/", root);
const evidenceDir = new URL("public/evidence/base/text.regex-log-scan.v1/", root);
const dataDir = new URL("public/data/base-implementations/", root);
await Deno.mkdir(outputDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
await Deno.mkdir(dataDir, { recursive: true });

const registration = JSON.parse(
  await Deno.readTextFile(new URL("benchmarks/text-regex-log-scan/registration.json", root)),
);
const catalogBytes = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
if (await sha256Hex(catalogBytes) !== registration.catalogSha256) {
  throw new Error("frozen v1 catalog bytes changed");
}

const watPath = "benchmarks/text-regex-log-scan/text-regex-log-scan.wat";
const wat = await Deno.readTextFile(new URL(watPath, root));
const wabt = await wabtFactory();
const module = wabt.parseWat(watPath, wat, { exceptions: false, threads: false, simd: false });
module.resolveNames();
module.validate();
const binary = module.toBinary({
  canonicalize_lebs: true,
  relocatable: false,
  write_debug_names: false,
});
module.destroy();
const wasm = new Uint8Array(binary.buffer);
const instance = await WebAssembly.instantiate(await WebAssembly.compile(wasm), {});

const input = generateCorpus();
const js = await scanJsControlled(input);
const wasmResult = await scanWasmControlled(input, instance);
for (const result of [js, wasmResult]) {
  if (result.inputSha256 !== registration.fixture.sha256) throw new Error("input hash mismatch");
  if (result.outputSha256 !== registration.oracle.sha256) throw new Error("oracle mismatch");
  for (const [name, value] of Object.entries(registration.structuralCounters)) {
    const actual = (result.counters as Record<string, unknown>)[name];
    if (JSON.stringify(actual) !== JSON.stringify(value)) {
      throw new Error(`counter mismatch: ${name}`);
    }
  }
}
if (canonicalize(js.matches) !== canonicalize(wasmResult.matches)) {
  throw new Error("JS/Wasm complete capture tuples differ");
}
const captureBytes = canonicalOutput(js.matches, input);
if (captureBytes.byteLength !== registration.oracle.canonicalOutputBytes) {
  throw new Error("canonical capture artifact length mismatch");
}

let sourceCommit = "uncommitted-source-tree";
try {
  const candidate = (await Deno.readTextFile(
    new URL("artifacts/base/text-regex-log-scan/source-commit.txt", root),
  )).trim();
  if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("invalid source commit pin");
  sourceCommit = candidate;
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}

const sourcePaths = [
  "benchmarks/text-regex-log-scan/input.js",
  "benchmarks/text-regex-log-scan/workload.js",
  "benchmarks/text-regex-log-scan/text-regex-log-scan.wat",
  "benchmarks/text-regex-log-scan/registration.json",
  "scripts/build-text-regex-log-scan.ts",
  "public/demos/base/text.regex-log-scan.v1/index.html",
  "public/demos/base/text.regex-log-scan.v1/demo.js",
  "public/demos/base/text.regex-log-scan.v1/worker.js",
  "schemas/base-workload-registration.schema.json",
  "schemas/base-workload-correctness-record.schema.json",
  "tests/base-text-regex-log-scan.test.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}
const sourceSha256 = await sha256Hex(
  sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join(""),
);
const wasmSha256 = await sha256Hex(wasm);
const outputSha256 = await sha256Hex(captureBytes);
const buildManifest = {
  schemaVersion: 1,
  workloadId: registration.catalogEntryId,
  registrationId: registration.registrationId,
  track: "controlled",
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sourceSha256,
  frozenCatalog: { path: "catalog/workloads.v1.json", sha256: registration.catalogSha256 },
  fixture: {
    generator: "benchmarks/text-regex-log-scan/input.js#generateCorpus",
    bytes: input.byteLength,
    sha256: js.inputSha256,
    distributedBytes: false,
  },
  oracle: {
    kind: registration.oracle.kind,
    outputArtifact: "public/artifacts/text-regex-log-scan/ordered-captures.bin",
    bytes: captureBytes.byteLength,
    sha256: outputSha256,
  },
  variants: {
    "js-controlled": {
      executedSource: "benchmarks/text-regex-log-scan/workload.js",
      algorithm: registration.semantics.model,
      boundaryCrossings: 0,
    },
    "wasm-linear-controlled": {
      authoredSource: watPath,
      artifact: "public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
      artifactSha256: wasmSha256,
      algorithm: registration.semantics.model,
      memory: { initialPages: 1800, maximumPages: 1800, growth: false },
      features: { simd: false, threads: false, memory64: false, exceptions: false },
      boundaryCrossings: 1,
    },
  },
  build: {
    command:
      "deno run --allow-read=. --allow-write=public/artifacts,public/evidence,public/data,public/demos/base/text.regex-log-scan.v1 scripts/build-text-regex-log-scan.ts",
    toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
    flags: ["canonicalize_lebs=true", "write_debug_names=false", "fixed memory 1800 pages"],
    lockfile: {
      path: "deno.lock",
      sha256: await sha256Hex(await Deno.readFile(new URL("deno.lock", root))),
    },
  },
  sources,
};

const publicRegistration = {
  ...registration,
  implementation: {
    sourceCommit,
    buildManifest: "/artifacts/text-regex-log-scan/build-manifest.json",
    artifact: "/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
    canonicalOutput: "/artifacts/text-regex-log-scan/ordered-captures.bin",
    demo: "/demos/base/text.regex-log-scan.v1/",
    evidence: [
      "/evidence/base/text.regex-log-scan.v1/js-controlled.json",
      "/evidence/base/text.regex-log-scan.v1/wasm-linear-controlled.json",
    ],
  },
};

function evidence(result: typeof js) {
  return {
    schemaVersion: 1,
    recordType: "base-workload-correctness-validation",
    workloadId: registration.catalogEntryId,
    registrationId: registration.registrationId,
    sourceCommit,
    variant: result.variant,
    status: "passed",
    input: { bytes: input.byteLength, sha256: result.inputSha256 },
    output: {
      capturesArtifact: "/artifacts/text-regex-log-scan/ordered-captures.bin",
      bytes: captureBytes.byteLength,
      sha256: result.outputSha256,
    },
    counters: result.counters,
    assertions: {
      exactInputHash: true,
      exactOutputHash: true,
      completeTupleIdentityAcrossTargets: true,
      structuralCountersExact: true,
      wasmMaterialMatchingSemantics: result.variant === "wasm-linear-controlled" ? true : null,
    },
    scope: {
      correctnessOnly: true,
      browserEvidence: "uncollected-by-implementation-worker",
      performanceCorpus: "unavailable",
      performanceClaim: false,
    },
  };
}

const buildText = `${canonicalize(buildManifest)}\n`;
const inputText = `${
  canonicalize({
    schemaVersion: 1,
    workloadId: registration.catalogEntryId,
    ...registration.fixture,
  })
}\n`;
const outputText = `${
  canonicalize({
    schemaVersion: 1,
    workloadId: registration.catalogEntryId,
    ...registration.oracle,
    structuralCounters: registration.structuralCounters,
  })
}\n`;
const registrationText = `${JSON.stringify(publicRegistration, null, 2)}\n`;
const jsEvidenceText = `${JSON.stringify(evidence(js), null, 2)}\n`;
const wasmEvidenceText = `${JSON.stringify(evidence(wasmResult), null, 2)}\n`;
await Deno.writeFile(new URL("text-regex-log-scan.wasm", outputDir), wasm);
await Deno.writeFile(new URL("ordered-captures.bin", outputDir), captureBytes);
await Deno.writeTextFile(new URL("build-manifest.json", outputDir), buildText);
await Deno.writeTextFile(new URL("input-manifest.json", outputDir), inputText);
await Deno.writeTextFile(new URL("output-manifest.json", outputDir), outputText);
await Deno.writeTextFile(new URL("text.regex-log-scan.v1.json", dataDir), registrationText);
await Deno.writeTextFile(new URL("js-controlled.json", evidenceDir), jsEvidenceText);
await Deno.writeTextFile(new URL("wasm-linear-controlled.json", evidenceDir), wasmEvidenceText);
const identity = {
  workloadId: registration.catalogEntryId,
  sourceCommit,
  rawSha256: {
    registration: await sha256Hex(registrationText),
    buildManifest: await sha256Hex(buildText),
    inputManifest: await sha256Hex(inputText),
    outputManifest: await sha256Hex(outputText),
    wasm: wasmSha256,
    captures: outputSha256,
    inputModule: sources.find((entry) => entry.path.endsWith("/input.js"))!.sha256,
    workloadModule: sources.find((entry) => entry.path.endsWith("/workload.js"))!.sha256,
    workerModule: sources.find((entry) => entry.path.endsWith("/worker.js"))!.sha256,
  },
};
const identityEntries = Object.entries(identity.rawSha256)
  .map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`)
  .join("\n");
const identityText =
  `// Generated by scripts/build-text-regex-log-scan.ts; source commit is the trust root.\nexport const IDENTITY = {\n  "workloadId": ${
    JSON.stringify(identity.workloadId)
  },\n  "sourceCommit": ${
    JSON.stringify(identity.sourceCommit)
  },\n  "rawSha256": {\n${identityEntries}\n  },\n};\n`;
await Deno.writeTextFile(
  new URL("public/demos/base/text.regex-log-scan.v1/identity.js", root),
  identityText,
);
console.log(
  `build: text.regex-log-scan.v1 ${input.byteLength} input bytes, ${js.matches.length} captures, ${wasm.byteLength} Wasm bytes`,
);
