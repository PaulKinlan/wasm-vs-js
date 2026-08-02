import type { RunRecord } from "./run-store.ts";

function quantile(values: number[], position: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export type Summary = {
  schemaVersion: 1;
  algorithmVersion: "m1-pilot-1";
  claimStatus: "no-runs" | "pilot-only";
  runCount: number;
  pairedBlockCount: number;
  cells: Array<Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
};

export function generateSummary(runs: RunRecord[]): Summary {
  const groups = new Map<string, RunRecord[]>();
  for (const run of runs) {
    const key = [run.benchmark.id, run.variant.id, run.variant.cacheState].join("|");
    const group = groups.get(key) ?? [];
    group.push(run);
    groups.set(key, group);
  }
  const cells = [...groups.entries()].map(([key, records]) => {
    const validSamples = records.flatMap((run) =>
      run.samples.filter((sample) => sample.valid).map((sample) => sample.durationMs)
    );
    const firstIterations = records.flatMap((run) =>
      run.samples.filter((sample) => sample.valid && sample.iteration === 0).map((sample) =>
        sample.durationMs
      )
    );
    const [benchmarkId, variantId, cacheState] = key.split("|");
    return {
      benchmarkId,
      variantId,
      target: records[0].variant.target,
      track: records[0].variant.track,
      cacheState,
      runCount: records.length,
      sampleCount: validSamples.length,
      freshLaunchCount: new Set(records.map((run) => run.environment.freshLaunchId)).size,
      pilot: records.every((run) => run.capabilities?.pilot === true),
      firstIterationMedianMs: quantile(firstIterations, 0.5),
      medianMs: quantile(validSamples, 0.5),
      p95Ms: quantile(validSamples, 0.95),
      trajectories: records.map((run) => ({
        runId: run.runId,
        samples: run.samples.map((sample) => ({
          iteration: sample.iteration,
          durationMs: sample.durationMs,
          valid: sample.valid,
        })),
      })),
    };
  });
  return {
    schemaVersion: 1,
    algorithmVersion: "m1-pilot-1",
    claimStatus: runs.length === 0 ? "no-runs" : "pilot-only",
    runCount: runs.length,
    pairedBlockCount: new Set(runs.map((run) => run.environment.pairedBlockId)).size,
    cells,
    runs: runs.map((run) => ({
      runId: run.runId,
      capturedAt: run.capturedAt,
      benchmark: run.benchmark,
      variant: run.variant,
      environment: run.environment,
      correctness: run.correctness,
      build: run.build,
      conditions: run.conditions,
      capabilities: run.capabilities,
      metrics: run.metrics,
      failures: run.failures,
      samples: run.samples,
      payloadSha256: run.payloadSha256,
    })),
  };
}
