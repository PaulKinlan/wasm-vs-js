import { PairInput } from "./corpus-store.ts";
const statuses = new Set(["committed", "failed", "blocked"]);
export function median(values: number[]): number {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v <= 0)) {
    throw new Error("invalid samples");
  }
  const sorted = [...values].sort((a, b) => a - b), i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
export function validatePairSemantics(pair: PairInput): void {
  if (
    pair.records.length !== 2 ||
    pair.order.join("|") !== pair.records.map((r) => r.variantId).join("|")
  ) throw new Error("pair identity/order mismatch");
  for (const record of pair.records) {
    if (record.medianMs !== median(record.samples)) throw new Error("pair median mismatch");
  }
  if (!pair.cleanup.complete || !pair.cleanup.profileRemoved || pair.cleanup.remainingPids.length) {
    throw new Error("pair cleanup mismatch");
  }
}
export type AttemptRecord = {
  blockId: string;
  scheduleIndex: number;
  stratum: "cold" | "warm";
  order: string[];
  status: "committed" | "failed" | "blocked";
  category: string;
  reason: string | null;
  sha256: string;
};
export function validateCorpusSemantics(corpus: Record<string, unknown>): void {
  const planned = Number(corpus.planned),
    attempted = Number(corpus.attempted),
    committed = Number(corpus.committed),
    failed = Number(corpus.failed),
    blocked = Number(corpus.blocked),
    unstarted = Number(corpus.unstarted);
  const blocks = corpus.blocks as AttemptRecord[];
  if (
    planned !== 120 || !Array.isArray(blocks) || attempted !== blocks.length ||
    attempted + unstarted !== planned || committed + failed + blocked !== attempted
  ) throw new Error("corpus accounting mismatch");
  if (
    new Set(blocks.map((b) => b.scheduleIndex)).size !== blocks.length ||
    new Set(blocks.map((b) => b.blockId)).size !== blocks.length
  ) throw new Error("duplicate corpus attempt identity");
  const counts = { committed: 0, failed: 0, blocked: 0 };
  for (const block of blocks) {
    if (
      !statuses.has(block.status) || !Number.isSafeInteger(block.scheduleIndex) ||
      block.scheduleIndex < 0 || block.scheduleIndex > 119 || !/^[a-f0-9]{64}$/.test(block.sha256)
    ) throw new Error("invalid attempt record");
    counts[block.status] += 1;
    if (block.status === "committed" && (block.category !== "committed" || block.reason !== null)) {
      throw new Error("committed attempt metadata mismatch");
    }
    if (block.status !== "committed" && (!block.category || !block.reason)) {
      throw new Error("failure classification missing");
    }
  }
  if (counts.committed !== committed || counts.failed !== failed || counts.blocked !== blocked) {
    throw new Error("corpus status counts mismatch");
  }
  if (corpus.status === "precision-met" && (unstarted < 0 || committed < 40)) {
    throw new Error("precision terminal contradiction");
  }
  if (corpus.status === "containment-blocked" && blocked < 1) {
    throw new Error("containment terminal contradiction");
  }
}
