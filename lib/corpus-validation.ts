import { PairInput } from "./corpus-store.ts";
import { evaluateAttemptCheckpoint } from "./paired-statistics.ts";
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
  jsMedianMs: number | null;
  wasmMedianMs: number | null;
  sha256: string;
};
function evidenceMap(value: unknown, label: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) {
    throw new Error(`${label} evidence map invalid`);
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label} evidence invalid`);
    }
    const item = entry as Record<string, unknown>;
    if (
      !["supported-value", "unavailable", "blocked", "not-observed"].includes(
        String(item.status),
      ) ||
      typeof item.source !== "string" || typeof item.scope !== "string" ||
      !Number.isFinite(Date.parse(String(item.collectedAt)))
    ) throw new Error(`${label} evidence fields invalid`);
    if (
      item.status === "supported-value"
        ? !("value" in item) || "reason" in item
        : typeof item.reason !== "string" || "value" in item
    ) {
      throw new Error(`${label} evidence availability invalid`);
    }
  }
}
export function validateLaunchEvidenceSemantics(value: Record<string, unknown>): void {
  const keys = [
    "schemaVersion",
    "launchId",
    "blockId",
    "sourceCommit",
    "browser",
    "profile",
    "host",
    "page",
    "network",
    "artifacts",
    "cleanup",
  ].sort();
  if (
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys) ||
    value.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/.test(String(value.sourceCommit))
  ) throw new Error("launch evidence shape invalid");
  evidenceMap(value.browser, "browser");
  evidenceMap(value.host, "host");
  evidenceMap(value.page, "page");
  const profile = value.profile as Record<string, unknown>,
    cleanup = value.cleanup as Record<string, unknown>;
  if (
    !profile || !/^[a-f0-9]{64}$/.test(String(profile.rootSha256)) || profile.fresh !== true ||
    profile.removed !== true ||
    !cleanup || cleanup.complete !== true || cleanup.profileRemoved !== true ||
    !Array.isArray(cleanup.remainingPids) || cleanup.remainingPids.length !== 0
  ) {
    throw new Error("launch cleanup/profile evidence invalid");
  }
  for (const hash of Object.values(value.artifacts as Record<string, unknown>)) {
    if (!/^[a-f0-9]{64}$/.test(String(hash))) throw new Error("launch artifact hash invalid");
  }
}

export type FrozenScheduleEntry = {
  blockId: string;
  stratum: "cold" | "warm";
  order: string[];
};
export function validateCorpusSemantics(
  corpus: Record<string, unknown>,
  schedule: FrozenScheduleEntry[],
): void {
  const planned = Number(corpus.planned),
    attempted = Number(corpus.attempted),
    committed = Number(corpus.committed),
    failed = Number(corpus.failed),
    blocked = Number(corpus.blocked),
    unstarted = Number(corpus.unstarted);
  const blocks = corpus.blocks as AttemptRecord[];
  if (
    planned !== 120 || schedule.length !== 120 || !Array.isArray(blocks) ||
    attempted !== blocks.length ||
    attempted + unstarted !== planned || committed + failed + blocked !== attempted
  ) throw new Error("corpus accounting mismatch");
  if (
    new Set(blocks.map((b) => b.scheduleIndex)).size !== blocks.length ||
    new Set(blocks.map((b) => b.blockId)).size !== blocks.length ||
    blocks.some((block, index) =>
      index > 0 && block.scheduleIndex <= blocks[index - 1].scheduleIndex
    )
  ) throw new Error("duplicate or unordered corpus attempt identity");
  const counts = { committed: 0, failed: 0, blocked: 0 };
  for (const block of blocks) {
    const expected = schedule[block.scheduleIndex];
    if (
      !statuses.has(block.status) || !Number.isSafeInteger(block.scheduleIndex) ||
      block.scheduleIndex < 0 || block.scheduleIndex > 119 ||
      !/^[a-f0-9]{64}$/.test(block.sha256) ||
      !expected || block.blockId !== expected.blockId || block.stratum !== expected.stratum ||
      JSON.stringify(block.order) !== JSON.stringify(expected.order)
    ) throw new Error("invalid attempt record or frozen schedule mismatch");
    counts[block.status] += 1;
    if (
      block.status === "committed" && (
        block.category !== "committed" || block.reason !== null ||
        !Number.isFinite(block.jsMedianMs) || Number(block.jsMedianMs) <= 0 ||
        !Number.isFinite(block.wasmMedianMs) || Number(block.wasmMedianMs) <= 0
      )
    ) throw new Error("committed attempt metadata mismatch");
    if (
      block.status !== "committed" && (
        !block.category || !block.reason || block.jsMedianMs !== null || block.wasmMedianMs !== null
      )
    ) throw new Error("failure classification missing");
    if (
      block.status === "failed" &&
      !["failed-correctness", "failed-measurement"].includes(block.category)
    ) throw new Error("failed attempt category mismatch");
    if (
      block.status === "blocked" &&
      !["blocked-containment", "blocked-cache", "blocked-provenance"].includes(block.category)
    ) throw new Error("blocked attempt category mismatch");
  }
  if (counts.committed !== committed || counts.failed !== failed || counts.blocked !== blocked) {
    throw new Error("corpus status counts mismatch");
  }
  const strata = corpus.strata as Record<string, Record<string, unknown>>;
  if (!strata || Object.keys(strata).sort().join(",") !== "cold,warm") {
    throw new Error("corpus strata summary missing");
  }
  const terminals: string[] = [];
  for (const name of ["cold", "warm"] as const) {
    const cellBlocks = blocks.filter((block) => block.stratum === name), cell = strata[name];
    const expectedPositions = schedule.flatMap((entry, index) =>
      entry.stratum === name ? [index] : []
    ).slice(0, cellBlocks.length);
    if (
      JSON.stringify(cellBlocks.map((block) => block.scheduleIndex)) !==
        JSON.stringify(expectedPositions)
    ) throw new Error(`stratum ${name} attempt positions are not a frozen prefix`);
    const js = cellBlocks.filter((block) => block.status === "committed").map((block) =>
      Number(block.jsMedianMs)
    );
    const wasm = cellBlocks.filter((block) => block.status === "committed").map((block) =>
      Number(block.wasmMedianMs)
    );
    const cellCounts = {
      attempted: cellBlocks.length,
      committed: js.length,
      failed: cellBlocks.filter((block) => block.status === "failed").length,
      blocked: cellBlocks.filter((block) => block.status === "blocked").length,
    };
    for (const [key, value] of Object.entries(cellCounts)) {
      if (cell[key] !== value) throw new Error(`stratum ${name} ${key} mismatch`);
    }
    let expectedTerminal = "continue";
    if ([20, 30, 40, 50, 60].includes(cellCounts.attempted)) {
      const category = (wanted: string) =>
        cellBlocks.filter((block) => block.category === wanted).length;
      expectedTerminal = evaluateAttemptCheckpoint(
        {
          attempted: cellCounts.attempted,
          committed: cellCounts.committed,
          failedCorrectness: category("failed-correctness"),
          failedMeasurement: category("failed-measurement"),
          blockedContainment: category("blocked-containment"),
          blockedCache: category("blocked-cache"),
          blockedProvenance: category("blocked-provenance"),
        },
        js,
        wasm,
      ).terminal;
    }
    if (cell.terminal !== expectedTerminal) throw new Error(`stratum ${name} terminal mismatch`);
    if (cell.terminal === "cap-inconclusive" && cellCounts.attempted !== 60) {
      throw new Error(`stratum ${name} cap before 60 attempts`);
    }
    terminals.push(String(cell.terminal));
  }
  if (corpus.status === "precision-met" && !terminals.every((value) => value === "precision-met")) {
    throw new Error("precision terminal contradiction");
  }
  if (
    corpus.status === "cap-inconclusive" && (
      terminals.includes("continue") || !terminals.includes("cap-inconclusive")
    )
  ) throw new Error("cap terminal contradiction");
  const stop = corpus.stop as Record<string, unknown> | null;
  if (corpus.status === "containment-blocked") {
    const hasBlockedContainment = blocks.some((block) => block.category === "blocked-containment");
    const validStop = stop !== null &&
      Number.isSafeInteger(stop.scheduleIndex) && Number(stop.scheduleIndex) >= 0 &&
      Number(stop.scheduleIndex) < 120 &&
      stop.blockId === schedule[Number(stop.scheduleIndex)]?.blockId &&
      stop.category === "blocked-containment" && typeof stop.reason === "string" &&
      stop.reason.length > 0 && /^[a-f0-9]{64}$/.test(String(stop.artifactSha256));
    if (!hasBlockedContainment && !validStop) throw new Error("containment terminal contradiction");
  } else if (stop !== null) {
    throw new Error("non-containment corpus cannot reference stop evidence");
  }
}
