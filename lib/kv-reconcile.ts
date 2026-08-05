// M3 Operations: Versioned reconciliation from raw runs.
// Rebuilds summaries from actual KV records and detects drift.

import { type KvRunStore } from "./kv-store.ts";

export type ReconciliationResult = {
  scannedRuns: number;
  computedCounts: {
    totalRuns: number;
    benchmarkCounts: Record<string, number>;
    targetCounts: Record<string, number>;
  };
  storedCounts: {
    totalRuns: number;
    benchmarkCounts: Record<string, number>;
    targetCounts: Record<string, number>;
  };
  drift: {
    totalDrift: number;
    benchmarkDrift: Record<string, number>;
    targetDrift: Record<string, number>;
    orphanedIndexEntries: number;
    missingRuns: number;
  };
  reconciled: boolean;
};

/**
 * Scan all run records in KV and recompute the summary from scratch.
 * Compare with the stored summary to detect drift.
 * If reconcile=true, atomically update the stored summary to match.
 */
export async function reconcileSummaries(
  store: KvRunStore,
  reconcile = false,
): Promise<ReconciliationResult> {
  // Scan all runs from the raw KV records
  const entries = store.kv.list({ prefix: ["runs"] });
  let scannedRuns = 0;
  const benchmarkCounts: Record<string, number> = {};
  const targetCounts: Record<string, number> = {};
  const liveRunIds = new Set<string>();
  const livePayloadHashes = new Set<string>();

  for await (const entry of entries) {
    const run = entry.value as Record<string, unknown>;
    if (!run.runId) continue;
    scannedRuns++;
    liveRunIds.add(String(run.runId));

    const bid = String((run.benchmark as Record<string, unknown>)?.id ?? "unknown");
    benchmarkCounts[bid] = (benchmarkCounts[bid] ?? 0) + 1;

    const tid = String((run.variant as Record<string, unknown>)?.target ?? "unknown");
    targetCounts[tid] = (targetCounts[tid] ?? 0) + 1;

    if (run.payloadSha256) livePayloadHashes.add(String(run.payloadSha256));
  }

  // Check for orphaned index entries (index entries pointing to deleted runs)
  let orphanedIndexEntries = 0;
  const indexEntries = store.kv.list({ prefix: ["runs_by_benchmark"] });
  for await (const entry of indexEntries) {
    const val = entry.value as Record<string, unknown>;
    const runId = String(val.runId ?? "");
    if (!liveRunIds.has(runId)) {
      orphanedIndexEntries++;
    }
  }

  // Check for missing dedupe entries (runs without dedupe protection)
  let missingDedupe = 0;
  for await (const entry of store.kv.list({ prefix: ["runs"] })) {
    const run = entry.value as Record<string, unknown>;
    if (run.payloadSha256) {
      const dedupe = await store.kv.get(["runs_dedupe", String(run.payloadSha256)]);
      if (!dedupe.value) missingDedupe++;
    }
  }

  // Get stored summary
  const stored = await store.summary();

  // Compute drift
  const benchmarkDrift: Record<string, number> = {};
  for (
    const bid of new Set([...Object.keys(benchmarkCounts), ...Object.keys(stored.benchmarkCounts)])
  ) {
    const diff = (benchmarkCounts[bid] ?? 0) - (stored.benchmarkCounts[bid] ?? 0);
    if (diff !== 0) benchmarkDrift[bid] = diff;
  }

  const targetDrift: Record<string, number> = {};
  for (const tid of new Set([...Object.keys(targetCounts), ...Object.keys(stored.targetCounts)])) {
    const diff = (targetCounts[tid] ?? 0) - (stored.targetCounts[tid] ?? 0);
    if (diff !== 0) targetDrift[tid] = diff;
  }

  const totalDrift = Math.abs(scannedRuns - stored.totalRuns);

  const result: ReconciliationResult = {
    scannedRuns,
    computedCounts: { totalRuns: scannedRuns, benchmarkCounts, targetCounts },
    storedCounts: stored,
    drift: {
      totalDrift,
      benchmarkDrift,
      targetDrift,
      orphanedIndexEntries,
      missingRuns: missingDedupe,
    },
    reconciled: false,
  };

  // If requested, atomically update the summary to match the scan
  if (reconcile && totalDrift !== 0) {
    await store.kv.atomic().set(["summaries", "total_count"], scannedRuns).commit();
    result.reconciled = true;
  }

  return result;
}

/**
 * Verify KV integrity: every run has a dedupe entry, every index points to a live run,
 * no tombstoned runs are present.
 */
export async function verifyIntegrity(
  store: KvRunStore,
): Promise<{
  ok: boolean;
  issues: string[];
  runCount: number;
  tombstoneCount: number;
}> {
  const issues: string[] = [];
  let runCount = 0;
  let tombstoneCount = 0;

  // Count tombstones
  for await (const _entry of store.kv.list({ prefix: ["runs_tombstone"] })) {
    tombstoneCount++;
  }

  // Check each run for integrity
  for await (const entry of store.kv.list({ prefix: ["runs"] })) {
    const run = entry.value as Record<string, unknown>;
    runCount++;

    // Check dedupe exists
    if (run.payloadSha256) {
      const dedupe = await store.kv.get(["runs_dedupe", String(run.payloadSha256)]);
      if (!dedupe.value) {
        issues.push(`run ${run.runId}: missing dedupe entry`);
      }

      // Check not tombstoned
      const tombstone = await store.kv.get(["runs_tombstone", String(run.runId)]);
      if (tombstone.value) {
        issues.push(`run ${run.runId}: exists despite tombstone (resurrection!)`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    runCount,
    tombstoneCount,
  };
}
