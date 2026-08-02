import { LocalRunStore } from "../lib/run-store.ts";
import { generateSummary } from "../lib/summary.ts";
import { assertEquals, assertRejects } from "./assert.ts";
import { validRun } from "./fixture.ts";

Deno.test("local run records are immutable and summaries retain first/full trajectories", async () => {
  const root = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(root);
    await store.initialize();
    const run = await validRun();
    await store.put(run);
    await assertRejects(() => store.put(run), "already exists");
    const stored = await store.get(String(run.runId));
    assertEquals(stored?.payloadSha256, run.payloadSha256);
    const summary = generateSummary(await store.list());
    assertEquals(summary.claimStatus, "pilot-only");
    assertEquals(summary.runCount, 1);
    assertEquals(summary.pairedBlockCount, 1);
    assertEquals(summary.cells[0].firstIterationMedianMs, 2);
    assertEquals(summary.cells[0].medianMs, 1.5);
    assertEquals(summary.cells[0].trajectories, [{
      runId: "run_0000000000000001",
      samples: [
        { iteration: 0, durationMs: 2, valid: true },
        { iteration: 1, durationMs: 1, valid: true },
      ],
    }]);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("store rejects schema-invalid or hash-mismatched records", async () => {
  const root = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(root);
    await store.initialize();
    const run = await validRun();
    await assertRejects(() => store.put({ ...run, metrics: [] }), "schema denied");
    await assertRejects(() => store.put({ ...run, payloadSha256: "b".repeat(64) }), "payload hash");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
