import { hashCanonicalEnvelope } from "../lib/canonical.ts";

const hash = "a".repeat(64);

export async function validRun(overrides: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = {
    schemaVersion: 1,
    runId: "run_0000000000000001",
    capturedAt: "2026-08-02T10:00:00Z",
    suite: { version: "0.1.0-m1-pilot", commit: "a".repeat(40), collectorVersion: "0.1.0" },
    benchmark: { id: "sum-u32", version: 1, tier: "T2", inputManifestSha256: hash },
    variant: {
      id: "js-controlled",
      target: "javascript",
      track: "controlled",
      cacheState: "validation",
    },
    build: {
      sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
      sourceCommit: "a".repeat(40),
      sourceSha256: hash,
      artifacts: [{ name: "workload.js", sha256: hash }],
      lockfiles: [{ name: "deno.lock", sha256: hash }],
      command: "deno task build",
      toolchains: ["Deno 2.9.0", "wabt 1.0.37"],
      flags: ["canonicalize_lebs=true"],
      footprint: {
        sourceBytes: 10,
        glueBytes: 0,
        rawBytes: 10,
        gzipBytes: 10,
        brotliBytes: 10,
        requestCount: 1,
      },
    },
    environment: {
      browser: {
        name: "Fixture Browser",
        version: "1",
        engine: "Fixture",
        headless: false,
        launchArguments: [],
      },
      os: "Fixture OS",
      kernel: "Fixture kernel",
      architecture: "x86_64",
      hardware: "fixture",
      physicalCores: 1,
      logicalCores: 1,
      ramBytes: 1,
      automation: "fixture",
      automationProtocol: "fixture",
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
      network: "fixture",
      throttling: "none",
      profilerEnabled: false,
      randomSeed: "seed",
      orderIndex: 0,
    },
    capabilities: { pilot: true, measurementBatchSize: 1 },
    correctness: { status: "passed", outputSha256: hash, workCounters: { items: 65_536 } },
    samples: [
      { iteration: 0, phase: "execute", durationMs: 2, valid: true },
      { iteration: 1, phase: "execute", durationMs: 1, valid: true },
    ],
    metrics: [{
      id: "metric-1",
      metric: "timer-quantum",
      availability: { state: "supported" },
      value: 0.001,
      unit: "ms",
      scope: "window",
      comparability: "cross-browser-with-conditions",
      provenance: { source: "performance-timeline", capturedAt: "2026-08-02T10:00:00Z" },
    }],
    failures: [],
    ...overrides,
  };
  value.payloadSha256 = await hashCanonicalEnvelope(value);
  return value;
}
