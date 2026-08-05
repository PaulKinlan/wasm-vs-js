// M3 Operations tests: reconciliation, tombstone deletion, retention.
import { assert, assertEquals } from "./assert.ts";
import { KvRunStore } from "../lib/kv-store.ts";
import { reconcileSummaries, verifyIntegrity } from "../lib/kv-reconcile.ts";
import { hashCanonicalEnvelope } from "../lib/canonical.ts";
import { validRun } from "./fixture.ts";

async function makeKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

Deno.test({
  name: "m3-reconcile: summary matches after inserting runs",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    for (let i = 0; i < 3; i++) {
      const run = await validRun({
        capturedAt: new Date(Date.now() + i * 1000).toISOString(),
        runId: `reconcile-run-${String(i).padStart(16, "0")}`,
      });
      run.payloadSha256 = await hashCanonicalEnvelope(run);
      await store.put(run);
    }

    const result = await reconcileSummaries(store, false);
    assertEquals(result.scannedRuns, 3);
    assertEquals(result.computedCounts.totalRuns, 3);
    assertEquals(result.storedCounts.totalRuns, 3);
    assertEquals(result.drift.totalDrift, 0);
    assertEquals(result.reconciled, false);

    kv.close();
  },
});

Deno.test({
  name: "m3-reconcile: detects drift after manual KV mutation",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const run = await validRun({
      capturedAt: new Date().toISOString(),
      runId: `drift-test-${"0".repeat(15)}1`,
    });
    run.payloadSha256 = await hashCanonicalEnvelope(run);
    await store.put(run);

    // Manually corrupt the summary counter
    await kv.set(["summaries", "total_count"], 999);

    const result = await reconcileSummaries(store, false);
    assertEquals(result.scannedRuns, 1);
    assertEquals(result.storedCounts.totalRuns, 999);
    assert(result.drift.totalDrift > 0, "should detect drift");

    // Reconcile
    const fixed = await reconcileSummaries(store, true);
    assertEquals(fixed.reconciled, true);
    const afterSummary = await store.summary();
    assertEquals(afterSummary.totalRuns, 1);

    kv.close();
  },
});

Deno.test({
  name: "m3-tombstone: delete prevents resurrection",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const run = await validRun({
      capturedAt: new Date().toISOString(),
      runId: `tombstone-test-${"0".repeat(12)}1`,
    });
    run.payloadSha256 = await hashCanonicalEnvelope(run);
    await store.put(run);

    // Delete with tombstone
    const deleted = await store.delete(`tombstone-test-${"0".repeat(12)}1`);
    assertEquals(deleted.deleted, true);
    assertEquals(deleted.tombstoned, true);

    // Run is gone
    const gone = await store.get(`tombstone-test-${"0".repeat(12)}1`);
    assertEquals(gone, null);

    // Re-insertion blocked by tombstone
    let caught = false;
    try {
      await store.put(run);
    } catch (e) {
      caught = true;
      assert(e instanceof Error);
      assert(e.message.includes("tombstoned"), `unexpected error: ${e.message}`);
    }
    assert(caught, "should reject tombstoned payload");

    kv.close();
  },
});

Deno.test({
  name: "m3-tombstone: isTombstoned returns correct state",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const run = await validRun({
      capturedAt: new Date().toISOString(),
      runId: `tomb-check-${"0".repeat(14)}1`,
    });
    run.payloadSha256 = await hashCanonicalEnvelope(run);
    await store.put(run);

    // Before delete: not tombstoned
    const before = await store.isTombstoned(String(run.payloadSha256));
    assertEquals(before, false);

    // After delete: tombstoned
    await store.delete(`tomb-check-${"0".repeat(14)}1`);
    const after = await store.isTombstoned(String(run.payloadSha256));
    assertEquals(after, true);

    kv.close();
  },
});

Deno.test({
  name: "m3-integrity: verifyIntegrity on clean store",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const run = await validRun({
      capturedAt: new Date().toISOString(),
      runId: `integrity-${"0".repeat(15)}1`,
    });
    run.payloadSha256 = await hashCanonicalEnvelope(run);
    await store.put(run);

    const result = await verifyIntegrity(store);
    assertEquals(result.ok, true);
    assertEquals(result.runCount, 1);
    assertEquals(result.tombstoneCount, 0);
    assertEquals(result.issues.length, 0);

    kv.close();
  },
});

Deno.test({
  name: "m3-integrity: detects tombstoned run that still exists",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const kv = await makeKv();
    const store = new KvRunStore(kv);

    const run = await validRun({
      capturedAt: new Date().toISOString(),
      runId: `resurrect-${"0".repeat(14)}1`,
    });
    run.payloadSha256 = await hashCanonicalEnvelope(run);
    await store.put(run);

    // Manually add a tombstone WITHOUT deleting the run (simulates corruption)
    await kv.set(["runs_tombstone", `resurrect-${"0".repeat(14)}1`], {
      runId: `resurrect-${"0".repeat(14)}1`,
      payloadSha256: run.payloadSha256,
      deletedAt: new Date().toISOString(),
    });

    const result = await verifyIntegrity(store);
    assertEquals(result.ok, false);
    assert(result.issues.length > 0, "should detect resurrection");
    assert(result.issues[0].includes("tombstone"));

    kv.close();
  },
});
