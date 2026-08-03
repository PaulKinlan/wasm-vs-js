import Ajv2020 from "ajv2020";
import { validateBenchmark, validateRun } from "../lib/contracts.ts";
import { validateCorpusSemantics } from "../lib/corpus-validation.ts";
import {
  loadNumericFftBundle,
  validateNumericFftSemantics,
} from "../lib/numeric-fft-spectral-filter-validation.ts";
const foundationSchemas = [
  "attempt-record.schema.json",
  "audio-fixture-manifest.schema.json",
  "audio-input-manifest.schema.json",
  "audio-reference-manifest.schema.json",
  "audio-output-manifest.schema.json",
  "audio-build-manifest.schema.json",
  "browser-permit.schema.json",
  "chrome-package-manifest.schema.json",
  "collection-stop.schema.json",
  "corpus.schema.json",
  "launch-evidence.schema.json",
  "paired-block.schema.json",
  "network-attestation.schema.json",
  "numeric-fft-spectral-filter-browser-evidence.schema.json",
  "numeric-fft-spectral-filter-build-manifest.schema.json",
  "numeric-fft-spectral-filter-fixture-manifest.schema.json",
  "numeric-fft-spectral-filter-output-manifest.schema.json",
  "numeric-fft-spectral-filter-registration.schema.json",
  "numeric-fft-spectral-filter-validation-record.schema.json",
  "permit-receipt.schema.json",
  "public-inspectability.schema.json",
  "source-manifest.schema.json",
];
for (const name of foundationSchemas) {
  const schema = JSON.parse(await Deno.readTextFile(`schemas/${name}`));
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    throw new Error(`${name} must be a closed object schema`);
  }
}
const numericBundle = await loadNumericFftBundle();
const numericSchemas = {
  registration: "numeric-fft-spectral-filter-registration.schema.json",
  fixture: "numeric-fft-spectral-filter-fixture-manifest.schema.json",
  output: "numeric-fft-spectral-filter-output-manifest.schema.json",
  build: "numeric-fft-spectral-filter-build-manifest.schema.json",
  record: "numeric-fft-spectral-filter-validation-record.schema.json",
};
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const [name, schemaName] of Object.entries(numericSchemas)) {
  const schema = JSON.parse(await Deno.readTextFile(`schemas/${schemaName}`));
  const validate = ajv.compile(schema);
  const values = name === "record" ? Object.values(numericBundle.records) : [numericBundle[name]];
  for (const value of values) {
    if (!validate(value)) throw new Error(`${schemaName}: ${JSON.stringify(validate.errors)}`);
  }
}
const numericSemantics = await validateNumericFftSemantics(numericBundle);
if (!numericSemantics.ok) throw new Error(numericSemantics.errors.join("; "));
const hash = "a".repeat(64);
const expectedCommit = Deno.env.get("WASM_VS_JS_COMMIT") ?? "";
const manifest = JSON.parse(
  await Deno.readTextFile("public/artifacts/sum-u32/build-manifest.json"),
);

const benchmark = {
  schemaVersion: 1,
  id: "sum-u32",
  version: 1,
  tier: "T2",
  title: "Sum unsigned integers",
  tracks: ["controlled", "optimized"],
  variants: [
    {
      id: "js-controlled",
      target: "javascript",
      track: "controlled",
      buildManifest: "build/js.json",
    },
    {
      id: "wasm-controlled",
      target: "wasm-linear",
      track: "controlled",
      buildManifest: "build/wasm.json",
    },
    {
      id: "js-optimized",
      target: "javascript",
      track: "optimized",
      buildManifest: "build/js-o.json",
      optimizationLog: "Typed-array loop.",
    },
  ],
  inputs: { manifestSha256: hash, immutable: true, generation: "seeded deterministic u32 corpus" },
  oracle: {
    kind: "complete-output",
    policy: "Exact unsigned 32-bit result.",
    deadCodeDefense: "Return and hash the sum.",
  },
  work: { fixed: true, complexity: "O(n)", counters: ["items"], tolerance: "Exact equality." },
};

const run = {
  schemaVersion: 1,
  runId: "run_0000000000000001",
  capturedAt: "2026-08-02T10:00:00Z",
  suite: { version: "0.1.0", commit: expectedCommit, collectorVersion: "0.1.0" },
  benchmark: {
    id: "sum-u32",
    version: 1,
    tier: "T2",
    inputManifestSha256: manifest.input.sha256,
  },
  variant: {
    id: "js-controlled",
    target: "javascript",
    track: "controlled",
    cacheState: "validation",
  },
  build: {
    sourceRepository: manifest.sourceRepository,
    sourceCommit: expectedCommit,
    sourceSha256: manifest.sourceSha256,
    artifacts: [{
      name: "benchmarks/sum-u32/workload.js",
      sha256: manifest.variants["js-controlled"].sha256,
    }],
    lockfiles: manifest.lockfiles,
    command: manifest.build.command,
    toolchains: manifest.build.toolchains,
    flags: manifest.build.flags,
    footprint: manifest.variants["js-controlled"].footprint,
  },
  environment: {
    browser: {
      name: "Chrome",
      version: "150.0.0.0",
      engine: "Blink/V8",
      headless: false,
      launchArguments: [],
    },
    os: "Linux",
    kernel: "Linux 6.x",
    architecture: "x86_64",
    hardware: "fixture-host",
    physicalCores: 8,
    logicalCores: 16,
    ramBytes: 1,
    automation: "fixture",
    automationProtocol: "CDP fixture",
    profileId: "profile-1",
    freshLaunchId: "launch-1",
    pairedBlockId: "block-1",
    viewport: { width: 1280, height: 720, dpr: 1 },
    refreshHz: 60,
  },
  conditions: {
    secureContext: true,
    crossOriginIsolated: true,
    serviceWorker: "none",
    network: "localhost",
    throttling: "none",
    profilerEnabled: false,
    randomSeed: "seed-1",
    orderIndex: 0,
  },
  capabilities: {
    pilot: true,
    measurementBatchSize: 1,
    coldProfileAttested: false,
    assetsPrimed: false,
  },
  correctness: {
    status: "passed",
    outputSha256: manifest.oracle.outputSha256,
    workCounters: {
      items: 65_536,
      "input-bytes": 262_144,
      additions: 65_536,
      loads: 65_536,
      "boundary-crossings": 1,
    },
  },
  samples: [{ iteration: 0, phase: "execute", durationMs: 1, valid: true }],
  metrics: [{
    id: "metric-1",
    metric: "execute-duration",
    availability: { state: "supported" },
    value: 1,
    unit: "ms",
    scope: "window",
    comparability: "cross-browser-standardized",
    provenance: { source: "performance-timeline", capturedAt: "2026-08-02T10:00:00Z" },
  }],
  failures: [],
  payloadSha256: hash,
};

function validBenchmark(value) {
  return validateBenchmark(value).ok;
}

function validRun(value) {
  return validateRun(value).ok;
}

function expect(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

expect("positive benchmark", validBenchmark(benchmark), true);
expect("benchmark requires variants", validBenchmark({ ...benchmark, variants: undefined }), false);
expect(
  "benchmark variant IDs are unique",
  validBenchmark({
    ...benchmark,
    variants: [benchmark.variants[0], { ...benchmark.variants[1], id: benchmark.variants[0].id }],
  }),
  false,
);
expect(
  "declared tracks match variants",
  validBenchmark({ ...benchmark, tracks: ["controlled"] }),
  false,
);
expect(
  "optimized variant requires same-target controlled baseline",
  validBenchmark({
    ...benchmark,
    variants: benchmark.variants.filter((variant) => variant.id !== "js-controlled"),
  }),
  false,
);
expect(
  "optimized variant requires log",
  validBenchmark({
    ...benchmark,
    variants: benchmark.variants.map((variant) =>
      variant.track === "optimized"
        ? {
          id: variant.id,
          target: variant.target,
          track: variant.track,
          buildManifest: variant.buildManifest,
        }
        : variant
    ),
  }),
  false,
);

expect("positive run", validRun(run), true);
expect(
  "source repository format is validated",
  validRun({ ...run, build: { ...run.build, sourceRepository: "not a URI" } }),
  false,
);
expect(
  "capture date format is validated",
  validRun({ ...run, capturedAt: "not a date" }),
  false,
);
expect("passed run requires samples", validRun({ ...run, samples: [] }), false);
expect(
  "work counters are non-empty",
  validRun({ ...run, correctness: { ...run.correctness, workCounters: {} } }),
  false,
);
expect(
  "invalid sample needs reason",
  validRun({
    ...run,
    samples: [{ iteration: 0, phase: "execute", durationMs: 1, valid: false }],
  }),
  false,
);
expect(
  "failed correctness cannot carry valid timing",
  validRun({
    ...run,
    correctness: { status: "failed", workCounters: run.correctness.workCounters },
    failures: [{ stage: "correctness", category: "output-mismatch", detail: "Digest differed." }],
  }),
  false,
);
expect(
  "failed correctness does not fabricate output hash",
  validRun({
    ...run,
    correctness: { status: "failed", workCounters: run.correctness.workCounters },
    samples: [{
      iteration: 0,
      phase: "correctness",
      durationMs: 1,
      valid: false,
      exclusionReason: "Correctness failed.",
    }],
    failures: [{ stage: "correctness", category: "output-mismatch", detail: "Digest differed." }],
  }),
  true,
);
expect("metrics are non-empty", validRun({ ...run, metrics: [] }), false);
expect(
  "supported metric cannot be null",
  validRun({ ...run, metrics: [{ ...run.metrics[0], value: null }] }),
  false,
);
expect(
  "unavailable metric cannot have value",
  validRun({
    ...run,
    metrics: [{ ...run.metrics[0], availability: { state: "unavailable", reason: "api-absent" } }],
  }),
  false,
);

const attempt = {
  blockId: "cold-01",
  scheduleIndex: 0,
  stratum: "cold",
  order: ["js-controlled", "wasm-linear-controlled"],
  status: "committed",
  category: "committed",
  reason: null,
  jsMedianMs: 10,
  wasmMedianMs: 5,
  sha256: hash,
};
const corpus = {
  schemaVersion: 1,
  corpusId: "corpus-1",
  experimentId: "m1-chrome-sum-u32-v1",
  permitDigest: hash,
  sourceManifestSha256: hash,
  preregistrationSha256: "d13aed9404ec289046f885f79a1d7b9f04923d2264de22b1fee60a4e7a8d6f61",
  planned: 120,
  attempted: 1,
  committed: 1,
  failed: 0,
  blocked: 0,
  unstarted: 119,
  blocks: [attempt],
  prelaunchFailures: [],
  strata: {
    cold: { attempted: 1, committed: 1, failed: 0, blocked: 0, terminal: "continue" },
    warm: { attempted: 0, committed: 0, failed: 0, blocked: 0, terminal: "continue" },
  },
  stop: {
    scheduleIndex: 1,
    blockId: "cold-02",
    category: "blocked-containment",
    reason: "pre-spawn containment stop fixture",
    artifactSha256: hash,
  },
  status: "containment-blocked",
};
const frozenSchedule = JSON.parse(
  await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
).pairing.schedule;
validateCorpusSemantics(corpus, frozenSchedule);
let semanticRejected = false;
try {
  validateCorpusSemantics({ ...corpus, attempted: 0 }, frozenSchedule);
} catch {
  semanticRejected = true;
}
expect("corpus accounting semantic validator", semanticRejected, true);

console.log(
  `contract-check: positive fixtures, 16 negative invariants, ${foundationSchemas.length} closed schemas, and numeric FFT schema/semantic gates passed`,
);
