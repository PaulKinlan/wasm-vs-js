import { assertEquals } from "./assert.ts";
import { validateCorpusSemantics } from "../lib/corpus-validation.ts";
import { COLLECTOR_ROUTES, collectorRouteHashes } from "../lib/source-identity.ts";
const attempt = (status: "committed" | "failed" | "blocked", index: number) => ({
  blockId: `block-${index}`,
  scheduleIndex: index,
  stratum: index % 2 ? "warm" : "cold",
  order: ["js-controlled", "wasm-linear-controlled"],
  status,
  category: status === "committed"
    ? "committed"
    : status === "failed"
    ? "failed-measurement"
    : "blocked-provenance",
  reason: status === "committed" ? null : "typed reason",
  sha256: "a".repeat(64),
});
function corpus(blocks = [attempt("committed", 0)]) {
  return {
    schemaVersion: 1,
    corpusId: "c",
    experimentId: "m1-chrome-sum-u32-v1",
    permitDigest: "b".repeat(64),
    sourceManifestSha256: "c".repeat(64),
    preregistrationSha256: "d13aed9404ec289046f885f79a1d7b9f04923d2264de22b1fee60a4e7a8d6f61",
    planned: 120,
    attempted: blocks.length,
    committed: blocks.filter((b) => b.status === "committed").length,
    failed: blocks.filter((b) => b.status === "failed").length,
    blocked: blocks.filter((b) => b.status === "blocked").length,
    unstarted: 120 - blocks.length,
    blocks,
    status: "cap-inconclusive",
  };
}
Deno.test("corpus accounting semantically reconciles attempts and rejects invented totals", () => {
  validateCorpusSemantics(
    corpus([attempt("committed", 0), attempt("failed", 1), attempt("blocked", 2)]),
  );
  for (
    const broken of [{ attempted: 0 }, { committed: 2 }, { unstarted: 0 }, {
      blocks: [attempt("committed", 0), attempt("committed", 0)],
    }]
  ) {
    const value = { ...corpus(), ...broken };
    let denied = false;
    try {
      validateCorpusSemantics(value);
    } catch {
      denied = true;
    }
    assertEquals(denied, true);
  }
});
Deno.test("source collector hash denominator includes local UI, worker, core, and benchmark bytes", async () => {
  const hashes = await collectorRouteHashes();
  assertEquals(Object.keys(hashes).sort(), Object.keys(COLLECTOR_ROUTES).sort());
  for (const hash of Object.values(hashes)) assertEquals(/^[a-f0-9]{64}$/.test(hash), true);
});
