import Ajv2020 from "ajv2020";
import addFormats from "ajv-formats";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const benchmarkSchema = JSON.parse(await Deno.readTextFile("schemas/benchmark.schema.json"));
const runSchema = JSON.parse(await Deno.readTextFile("schemas/run.schema.json"));
const validateBenchmarkSchema = ajv.compile(benchmarkSchema);
const validateRunSchema = ajv.compile(runSchema);
const hash = "a".repeat(64);

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
  suite: { version: "0.1.0", commit: hash, collectorVersion: "0.1.0" },
  benchmark: { id: "sum-u32", version: 1, tier: "T2", inputManifestSha256: hash },
  variant: { id: "js-controlled", target: "javascript", track: "controlled", cacheState: "cold" },
  build: {
    sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
    sourceCommit: hash,
    sourceSha256: hash,
    artifacts: [{ name: "sum.js", sha256: hash }],
    lockfiles: [{ name: "deno.lock", sha256: hash }],
    command: "deno task build",
    toolchains: ["Deno 2.9.0"],
    flags: [],
    footprint: { rawBytes: 1, gzipBytes: 1, brotliBytes: 1, requestCount: 1 },
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
  correctness: { status: "passed", outputSha256: hash, workCounters: { items: 1024 } },
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

function semanticBenchmark(value) {
  const ids = value.variants.map((variant) => variant.id);
  if (new Set(ids).size !== ids.length) return false;
  const usedTracks = new Set(value.variants.map((variant) => variant.track));
  if (
    value.tracks.length !== usedTracks.size ||
    !value.tracks.every((track) => usedTracks.has(track))
  ) return false;
  const controlledTargets = new Set(
    value.variants.filter((variant) => variant.track === "controlled").map((variant) =>
      variant.target
    ),
  );
  return value.variants.every(
    (variant) => variant.track !== "optimized" || controlledTargets.has(variant.target),
  );
}

function validBenchmark(value) {
  return validateBenchmarkSchema(value) && semanticBenchmark(value);
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

expect("positive run", validateRunSchema(run), true);
expect(
  "source repository format is validated",
  validateRunSchema({ ...run, build: { ...run.build, sourceRepository: "not a URI" } }),
  false,
);
expect(
  "capture date format is validated",
  validateRunSchema({ ...run, capturedAt: "not a date" }),
  false,
);
expect("passed run requires samples", validateRunSchema({ ...run, samples: [] }), false);
expect(
  "work counters are non-empty",
  validateRunSchema({ ...run, correctness: { ...run.correctness, workCounters: {} } }),
  false,
);
expect(
  "invalid sample needs reason",
  validateRunSchema({
    ...run,
    samples: [{ iteration: 0, phase: "execute", durationMs: 1, valid: false }],
  }),
  false,
);
expect(
  "failed correctness cannot carry valid timing",
  validateRunSchema({
    ...run,
    correctness: { status: "failed", workCounters: { items: 1024 } },
    failures: [{ stage: "correctness", category: "output-mismatch", detail: "Digest differed." }],
  }),
  false,
);
expect(
  "failed correctness does not fabricate output hash",
  validateRunSchema({
    ...run,
    correctness: { status: "failed", workCounters: { items: 1024 } },
    samples: [{
      iteration: 0,
      phase: "execute",
      durationMs: 1,
      valid: false,
      exclusionReason: "Correctness failed.",
    }],
    failures: [{ stage: "correctness", category: "output-mismatch", detail: "Digest differed." }],
  }),
  true,
);
expect("metrics are non-empty", validateRunSchema({ ...run, metrics: [] }), false);
expect(
  "supported metric cannot be null",
  validateRunSchema({ ...run, metrics: [{ ...run.metrics[0], value: null }] }),
  false,
);
expect(
  "unavailable metric cannot have value",
  validateRunSchema({
    ...run,
    metrics: [{ ...run.metrics[0], availability: { state: "unavailable", reason: "api-absent" } }],
  }),
  false,
);

console.log("contract-check: positive fixtures and 15 negative invariants passed");
