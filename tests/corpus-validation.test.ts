import { assertEquals } from "./assert.ts";
import { validateCorpusSemantics } from "../lib/corpus-validation.ts";
import { COLLECTOR_ROUTES, collectorRouteHashes } from "../lib/source-identity.ts";
const preregistration = JSON.parse(
  await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
);
const schedule = preregistration.pairing.schedule;
const attempt = (status: "committed" | "failed" | "blocked", index: number) => ({
  blockId: schedule[index].blockId,
  scheduleIndex: index,
  stratum: schedule[index].stratum as "cold" | "warm",
  order: schedule[index].order,
  status,
  category: status === "committed"
    ? "committed"
    : status === "failed"
    ? "failed-measurement"
    : "blocked-provenance",
  reason: status === "committed" ? null : "typed reason",
  jsMedianMs: status === "committed" ? 10 : null,
  wasmMedianMs: status === "committed" ? 5 : null,
  sha256: "a".repeat(64),
});
function corpus(blocks = [attempt("committed", 0)]) {
  return {
    schemaVersion: 1,
    corpusId: "c",
    experimentId: "m1-chrome-sum-u32-v1",
    permitDigest: "b".repeat(64),
    sourceManifestSha256: "c".repeat(64),
    chromePackageManifestSha256: "d".repeat(64),
    preregistrationSha256: "d13aed9404ec289046f885f79a1d7b9f04923d2264de22b1fee60a4e7a8d6f61",
    planned: 120,
    attempted: blocks.length,
    committed: blocks.filter((b) => b.status === "committed").length,
    failed: blocks.filter((b) => b.status === "failed").length,
    blocked: blocks.filter((b) => b.status === "blocked").length,
    unstarted: 120 - blocks.length,
    blocks,
    strata: {
      cold: {
        attempted: blocks.filter((b) => b.stratum === "cold").length,
        committed: blocks.filter((b) => b.stratum === "cold" && b.status === "committed").length,
        failed: blocks.filter((b) => b.stratum === "cold" && b.status === "failed").length,
        blocked: blocks.filter((b) => b.stratum === "cold" && b.status === "blocked").length,
        terminal: "continue",
      },
      warm: { attempted: 0, committed: 0, failed: 0, blocked: 0, terminal: "continue" },
    },
    stop: {
      scheduleIndex: blocks.length,
      blockId: schedule[blocks.length].blockId,
      category: "blocked-containment",
      reason: "pre-spawn containment stop",
      artifactSha256: "d".repeat(64),
    },
    status: "containment-blocked",
  };
}
Deno.test("corpus accounting semantically reconciles attempts and rejects invented totals", () => {
  validateCorpusSemantics(
    corpus([attempt("committed", 0), attempt("failed", 1), attempt("blocked", 2)]),
    schedule,
  );
  for (
    const broken of [{ attempted: 0 }, { committed: 2 }, { unstarted: 0 }, { stop: null }, {
      blocks: [attempt("committed", 0), attempt("committed", 0)],
    }, {
      blocks: [{ ...attempt("failed", 0), category: "blocked-provenance" }],
      attempted: 1,
      committed: 0,
      failed: 1,
      blocked: 0,
    }]
  ) {
    const value = { ...corpus(), ...broken };
    let denied = false;
    try {
      validateCorpusSemantics(value, schedule);
    } catch {
      denied = true;
    }
    assertEquals(denied, true);
  }
});
Deno.test("only private permit and corpus raw roots are ignored", async () => {
  for (const path of ["raw/permits/example.json", "raw/corpora/example/corpus.json"]) {
    const output = await new Deno.Command("git", { args: ["check-ignore", "-q", path] }).output();
    assertEquals(output.success, true);
  }
  const visible = await new Deno.Command("git", {
    args: ["check-ignore", "-q", "raw/other/evidence.json"],
  }).output();
  assertEquals(visible.success, false);
});

Deno.test("source collector hash denominator includes local UI, worker, core, styles, and benchmark bytes", async () => {
  const hashes = await collectorRouteHashes();
  assertEquals(Object.keys(hashes).sort(), Object.keys(COLLECTOR_ROUTES).sort());
  assertEquals("/styles.css" in hashes, true);
  for (const hash of Object.values(hashes)) assertEquals(/^[a-f0-9]{64}$/.test(hash), true);
});
