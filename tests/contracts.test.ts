import { validateBenchmark, validateRun } from "../lib/contracts.ts";
import { assert, assertEquals } from "./assert.ts";
import { validRun } from "./fixture.ts";

Deno.test("published sum-u32 benchmark passes schema and semantic validation", async () => {
  const benchmark = JSON.parse(await Deno.readTextFile("benchmarks/sum-u32/benchmark.json"));
  const result = validateBenchmark(benchmark);
  assert(result.ok, result.errors.join("; "));
});

Deno.test("runtime run validator rejects semantic identity and work mismatches", async () => {
  const run = await validRun();
  type MutableRun = {
    benchmark: Record<string, unknown>;
    variant: Record<string, unknown>;
    correctness: { workCounters: Record<string, unknown> };
    build: { artifacts: Array<Record<string, unknown>> };
  };
  const mutations: Array<(value: MutableRun) => void> = [
    (value) => value.benchmark.version = 99,
    (value) => value.variant.target = "wasm-linear",
    (value) => value.benchmark.inputManifestSha256 = "b".repeat(64),
    (value) => value.correctness.workCounters.items = 1,
    (value) => value.build.artifacts[0].sha256 = "b".repeat(64),
    (value) => value.variant.cacheState = "cold",
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(run) as unknown as MutableRun;
    mutate(invalid);
    assertEquals(validateRun(invalid).ok, false);
  }
});

Deno.test("runtime run validator preserves typed unavailable metrics", async () => {
  const run = await validRun({
    metrics: [{
      id: "memory-1",
      metric: "page-attributable-memory",
      availability: { state: "unavailable", reason: "api-absent" },
      scope: "page-agent-clusters",
      comparability: "within-browser-only",
      provenance: { source: "page-api", capturedAt: "2026-08-02T10:00:00Z" },
    }],
  });
  assertEquals(validateRun(run).ok, true);
  const invalid = structuredClone(run) as { metrics: Array<Record<string, unknown>> };
  invalid.metrics[0].value = 0;
  assertEquals(validateRun(invalid).ok, false);
});
