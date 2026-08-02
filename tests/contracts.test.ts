import { validateBenchmark, validateRun } from "../lib/contracts.ts";
import { assert, assertEquals } from "./assert.ts";
import { validRun } from "./fixture.ts";

Deno.test("published sum-u32 benchmark passes schema and semantic validation", async () => {
  const benchmark = JSON.parse(await Deno.readTextFile("benchmarks/sum-u32/benchmark.json"));
  const result = validateBenchmark(benchmark);
  assert(result.ok, result.errors.join("; "));
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
