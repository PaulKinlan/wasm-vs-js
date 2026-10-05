// scripts/derive-runner-worker-deadlines.ts
//
// Derives the per-case worker-message deadline table for
// tests/runner-worker-contracts.test.ts from MEASURED round-trip behaviour,
// replacing the fixed 5000ms constant (bead wasm-vs-js-rkw).
//
// Why measured: the tim discriminator (wasm-vs-js-tim, reviewer-confirmed)
// showed the fixed 5000ms sits inside this environment's round-trip
// distribution body (passing tail at 4903ms; core cases passing at 4.7-4.9s
// on one target and timing out on another; failure count co-varying with
// background load). A pool p99 or bootstrap is not honestly computable from
// deadline-censored data, and a multiple of the median is a hand-picked
// constant. Per-case deadlines derived from each case's own multi-run
// distribution match the test's per-round-trip timer structure.
//
// Method (stated here because it is the contract, v1):
// - Runs an INSTRUMENTED COPY of the committed test N times (default 5). The
//   committed test is never modified; the copy differs only by per-round-trip
//   timing and a raw-row log append (the transform below is fail-closed: if
//   the committed test's anchors change, derivation stops, it never guesses).
// - A round trip that resolves ok=false with "timed out waiting for worker
//   message" is a CENSORED observation (true value > the probe's 5000ms
//   ceiling, unknown). Other failures are ERRORS. Neither enters p95.
// - Per (slug, target): deadlineMs = max(500, 2 x nearestRankP95(uncensored
//   ok rows pooled across all N runs)). Every raw row is retained in the
//   output file.
// - FALLBACK (hub ruling on wasm-vs-js-rkw, option d): a case with NO
//   uncensored ok row in any run keeps the existing 5000ms, and the table
//   records per case, verbatim: "no baseline measured; current constant
//   retained pending defect fix". STANDING INSTRUCTION: when a later
//   derivation produces a baseline for a fallback case, the fallback entry is
//   replaced by the derived deadline in the same change.
// - Derived deadlines TIGHTEN the fast majority (blanket 5000ms -> measured),
//   not loosen it: a gate-sensitivity change, by design. The fallback changes
//   nothing for the cases it cannot measure, and says so.
//
// Usage:
//   deno run --allow-read --allow-write --allow-run --allow-env --allow-sys=loadavg \
//     scripts/derive-runner-worker-deadlines.ts [--runs 5]
//   deno run --allow-read scripts/derive-runner-worker-deadlines.ts --check
//
// --check recomputes deadlines from the committed raw rows with the same
// formula and fails if the committed table disagrees (deterministic; it never
// re-measures). Imports only repo-local modules; deno.lock stays byte-identical.
// WORKLOAD_CONFIGS comes from public/unified-runner.js — the same module the
// committed test imports — to enumerate every expected (slug, target) key.
import { WORKLOAD_CONFIGS } from "../public/unified-runner.js";

const OUT_PATH = "tests/fixtures/runner-worker-deadlines.v1.json";
const TEST_PATH = "tests/runner-worker-contracts.test.ts";
const PROBE_DIR = ".deadline-probe";
const PROBE_PATH = `${PROBE_DIR}/probe.test.ts`;
const ROWS_PATH = `${PROBE_DIR}/rows.tsv`;
const FORMULA_VERSION = 1;
const FLOOR_MS = 500;
const MULTIPLIER = 2;
const MIN_RUNS = 5;
const FALLBACK_MS = 5000;
const FALLBACK_REASON = "no baseline measured; current constant retained pending defect fix";

interface Row {
  slug: string;
  target: string;
  ms: number;
  ok: boolean;
  error: string;
  run: number;
}

interface CaseStats {
  n: number;
  okRows: number;
  censored: number;
  errors: number;
  p95Ms: number | null;
  deadlineMs: number;
  fallback: boolean;
  fallbackReason: string | null;
}

function nearestRankP95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length); // nearest-rank, 1-based
  return sorted[rank - 1];
}

function expectedKeys(): string[] {
  const keys: string[] = [];
  for (
    const [slug, config] of Object.entries(
      WORKLOAD_CONFIGS as Record<string, { workerType?: string }>,
    )
  ) {
    if (config.workerType === "classic") continue; // skips the dynamic block; unmeasured by design
    keys.push(`${slug}|js`, `${slug}|wasm`);
  }
  return keys.sort();
}

function deriveCases(rows: Row[]): { cases: Record<string, CaseStats>; fallbacks: string[] } {
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.slug}|${r.target}`;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const cases: Record<string, CaseStats> = {};
  const fallbacks: string[] = [];
  for (const key of expectedKeys()) {
    const list = byKey.get(key) ?? [];
    const okRows = list.filter((r) => r.ok);
    const censored = list.filter((r) =>
      !r.ok && r.error.includes("timed out waiting for worker")
    ).length;
    const errors = list.length - okRows.length - censored;
    let p95Ms: number | null = null;
    let fallback = false;
    let unmeasured = false;
    let deadlineMs: number;
    if (okRows.length > 0) {
      p95Ms = nearestRankP95(okRows.map((r) => r.ms));
      deadlineMs = Math.max(FLOOR_MS, Math.ceil(MULTIPLIER * p95Ms));
    } else {
      fallback = true;
      unmeasured = list.length === 0; // the case aborted at an earlier target before this round trip ran
      deadlineMs = FALLBACK_MS;
      fallbacks.push(key);
    }
    cases[key] = {
      n: list.length,
      okRows: okRows.length,
      censored,
      errors,
      p95Ms,
      deadlineMs,
      fallback,
      fallbackReason: fallback ? FALLBACK_REASON : null,
      ...(unmeasured ? { unmeasured: true } : {}),
    };
  }
  return { cases, fallbacks };
}

// /proc/stat aggregate CPU sampling: steal (time taken by the hypervisor)
// is recorded per run — on this fleet's VMs steal dominates the environment
// (measured 86.7% of CPU-time delta at 2026-10-05T03:54Z), so a table that
// records only loadavg misdescribes the machine it was derived on.
async function readCpuTimes(): Promise<{ total: number; steal: number }> {
  // /proc is outside Deno's fs sandbox (readTextFile demands --allow-all), so
  // sample via a spawned cat — inside the --allow-run permission the
  // generator already holds for its deno/git children.
  const out = await new Deno.Command("cat", { args: ["/proc/stat"], stdout: "piped" })
    .output();
  const line = new TextDecoder().decode(out.stdout).split("\n")[0];
  const fields = line.split(" ").slice(2).map(Number); // user nice system idle iowait irq softirq steal ...
  const steal = fields[7] ?? 0;
  const total = fields.reduce((a, b) => a + b, 0);
  return { total, steal };
}

function stealPctBetween(
  a: { total: number; steal: number },
  b: { total: number; steal: number },
): number {
  const dt = b.total - a.total;
  return dt > 0 ? Math.round(((b.steal - a.steal) / dt) * 1000) / 10 : 0;
}

function parseRows(log: string, run: number): Row[] {
  const rows: Row[] = [];
  for (const line of log.split("\n")) {
    if (!line.trim()) continue;
    const [slug, target, ms, ok, ...errorParts] = line.split("\t");
    const error = (errorParts.join("\t") ?? "").trim();
    if (!slug || !target || !ms || (ok !== "ok" && ok !== "fail")) {
      throw new Error(`probe row parse failed (run ${run}): ${JSON.stringify(line)}`);
    }
    rows.push({ slug, target, ms: Number(ms), ok: ok === "ok", error, run });
  }
  return rows;
}

if (Deno.args.includes("--rebuild")) {
  // Recompute cases from the committed raw runs with the CURRENT method
  // (e.g. after the expected-key enumeration changed) without re-measuring.
  const committed = JSON.parse(await Deno.readTextFile(OUT_PATH));
  if (committed.schemaVersion !== FORMULA_VERSION) {
    console.error(
      `derive-runner-worker-deadlines: schema drift (${committed.schemaVersion} != ${FORMULA_VERSION})`,
    );
    Deno.exit(1);
  }
  const { cases, fallbacks } = deriveCases(committed.runs.flatMap((r: { rows: Row[] }) => r.rows));
  committed.cases = cases;
  committed.fallbacks = fallbacks;
  await Deno.writeTextFile(OUT_PATH, JSON.stringify(committed, null, 2) + "\n");
  console.error(
    `derive-runner-worker-deadlines: rebuilt ${OUT_PATH} (${
      Object.keys(cases).length
    } cases, ${fallbacks.length} fallbacks) from ${committed.runs.length} committed runs`,
  );
  Deno.exit(0);
}

if (Deno.args.includes("--check")) {
  const committed = JSON.parse(await Deno.readTextFile(OUT_PATH));
  if (committed.schemaVersion !== FORMULA_VERSION) {
    console.error(
      `derive-runner-worker-deadlines: schema drift (${committed.schemaVersion} != ${FORMULA_VERSION})`,
    );
    Deno.exit(1);
  }
  const { cases, fallbacks } = deriveCases(committed.runs.flatMap((r: { rows: Row[] }) => r.rows));
  const mismatches: string[] = [];
  // Censoring invariant: the probe's ceiling is a hard 5000ms (the transform
  // forces it on every shape), so an ok row above that ceiling proves the
  // derivation ran without it and the whole table is invalid.
  for (const run of committed.runs as { index: number; rows: Row[] }[]) {
    for (const r of run.rows) {
      if (r.ok && r.ms > 5001) {
        mismatches.push(
          `run ${run.index}: ok row above the 5000ms probe ceiling (${r.ms}ms, ${r.slug}|${r.target}) — invalid derivation`,
        );
      }
    }
  }
  // Full deep compare, not just deadlineMs: a table that mislabels a case
  // (missing fallbackReason, altered p95/counts, extra or missing keys) must
  // fail --check even when every deadlineMs happens to match.
  const committedCases = committed.cases as Record<string, CaseStats>;
  for (const [key, stats] of Object.entries(cases)) {
    const committedStats = committedCases[key];
    if (!committedStats || JSON.stringify(committedStats) !== JSON.stringify(stats)) {
      mismatches.push(
        `${key}: committed ${JSON.stringify(committedStats)} != recomputed ${
          JSON.stringify(stats)
        }`,
      );
    }
  }
  for (const key of Object.keys(committedCases)) {
    if (!(key in cases)) mismatches.push(`${key}: committed entry has no recomputed counterpart`);
  }
  if (JSON.stringify(committed.fallbacks) !== JSON.stringify(fallbacks)) {
    mismatches.push(
      `fallbacks: committed ${JSON.stringify(committed.fallbacks)} != recomputed ${
        JSON.stringify(fallbacks)
      }`,
    );
  }
  if (mismatches.length > 0) {
    console.error(
      `derive-runner-worker-deadlines: table out of sync with its own raw rows:\n  ${
        mismatches.join("\n  ")
      }`,
    );
    Deno.exit(1);
  }
  console.log(
    `derive-runner-worker-deadlines: check ok (${
      Object.keys(cases).length
    } cases, ${fallbacks.length} fallbacks)`,
  );
  Deno.exit(0);
}

// --- measurement mode -------------------------------------------------------

const runsIdx = Deno.args.indexOf("--runs");
const runCount = runsIdx >= 0 ? Number(Deno.args[runsIdx + 1]) : 5;
if (!Number.isInteger(runCount) || runCount < MIN_RUNS) {
  console.error(
    `derive-runner-worker-deadlines: --runs must be an integer >= ${MIN_RUNS} (reviewer-accepted floor)`,
  );
  Deno.exit(2);
}

const committedTest = await Deno.readTextFile(TEST_PATH);

// The committed test's import of server.ts validates WASM_VS_JS_COMMIT at
// module load ("must identify the local Git checkout") — the gate sets it to
// the checked-out commit; the probe must run under the same contract.
const commitOut = await new Deno.Command("git", { args: ["rev-parse", "HEAD"], stdout: "piped" })
  .output();
const commit = new TextDecoder().decode(commitOut.stdout).trim();

// Fail-closed instrumented-copy transform (mirrors the tim-probe diff: timing
// before the round-trip promise, one raw-row append after it; every assertion
// stays byte-identical in the copy). The probe's round-trip ceiling is
// FORCED to 5000ms regardless of the committed test's shape: on the pristine
// test the literal is already 5000; on the table-driven test the probe
// replaces the lookup timer value with the hard ceiling so censoring
// semantics ("censored = did not finish under 5000ms") hold for every
// re-derivation. Exactly one ceiling shape is accepted; anything else is
// refused.
const ANCHOR_ASSERT = 'import { assert } from "./assert.ts";';
const ANCHOR_PROMISE =
  "        const res = await new Promise<{ ok: boolean; data?: unknown; error?: string }>(";
const ANCHOR_ASSERT_OK = "        assert(res.ok, `${slug}[${target}]: ${res.error}`);";
const ANCHOR_FIXED_CEILING = "            }, 5000);";
const ANCHOR_TABLE_CEILING = "            }, deadlineMs);";
for (const a of [ANCHOR_ASSERT, ANCHOR_PROMISE, ANCHOR_ASSERT_OK]) {
  if (!committedTest.includes(a)) {
    console.error(
      `derive-runner-worker-deadlines: committed test anchor changed, transform refused: ${
        JSON.stringify(a)
      }`,
    );
    Deno.exit(3);
  }
}
const hasFixedCeiling = committedTest.includes(ANCHOR_FIXED_CEILING);
const hasTableCeiling = committedTest.includes(ANCHOR_TABLE_CEILING);
if (hasFixedCeiling === hasTableCeiling) {
  console.error(
    `derive-runner-worker-deadlines: expected exactly one round-trip ceiling shape in the committed test (fixed: ${hasFixedCeiling}, table: ${hasTableCeiling}) — transform refused`,
  );
  Deno.exit(3);
}
const LOG_APPEND = "        const __ms = performance.now() - __t0;\n" +
  "        await Deno.writeTextFile(" + JSON.stringify(ROWS_PATH) +
  ', `${slug}\\t${target}\\t${__ms.toFixed(1)}\\t${res.ok ? "ok" : "fail"}\\t${(res.error ?? "").replace(/\\s+/g, " ").slice(0, 100)}\\n`, { append: true });\n';
const probe = committedTest
  .replace(ANCHOR_ASSERT, 'import { assert } from "../tests/assert.ts";')
  .replace(ANCHOR_PROMISE, "        const __t0 = performance.now();\n" + ANCHOR_PROMISE)
  .replace(ANCHOR_ASSERT_OK, LOG_APPEND + ANCHOR_ASSERT_OK)
  .replace(ANCHOR_TABLE_CEILING, ANCHOR_FIXED_CEILING); // no-op on the pristine shape

await Deno.mkdir(PROBE_DIR, { recursive: true });
const runs: {
  index: number;
  exitCode: number;
  loadavg: string;
  stealPct: number | null;
  rows: Row[];
}[] = [];
let fatal = 0;
try {
  await Deno.writeTextFile(PROBE_PATH, probe);
  for (let i = 1; i <= runCount && fatal === 0; i++) {
    await Deno.remove(ROWS_PATH).catch(() => {});
    console.error(
      `derive-runner-worker-deadlines: probe run ${i}/${runCount}... (loadavg ${
        Deno.loadavg().join(" ")
      })`,
    );
    const child = new Deno.Command(Deno.execPath(), {
      args: [
        "test",
        "--unstable-kv",
        "--no-lock",
        "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_COMMIT,WASM_VS_JS_REPORTER_TOKEN",
        "--allow-net=127.0.0.1",
        "--allow-import=127.0.0.1",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        PROBE_PATH,
      ],
      cwd: Deno.cwd(),
      env: { ...Deno.env.toObject(), WASM_VS_JS_COMMIT: commit },
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    const cpuBefore = await readCpuTimes();
    const status = await child.status;
    const cpuAfter = await readCpuTimes();
    const stealPct = stealPctBetween(cpuBefore, cpuAfter);
    try {
      const rows = parseRows(await Deno.readTextFile(ROWS_PATH), i);
      runs.push({
        index: i,
        exitCode: status.code,
        loadavg: Deno.loadavg().join(" "),
        stealPct,
        rows,
      });
    } catch (e) {
      console.error(
        `derive-runner-worker-deadlines: run ${i} produced no parseable rows: ${
          (e as Error).message
        }`,
      );
      fatal = 4;
    }
  }
} finally {
  await Deno.remove(PROBE_DIR, { recursive: true }).catch(() => {});
}
if (fatal !== 0) Deno.exit(fatal);

const allRows = runs.flatMap((r) => r.rows);
const { cases, fallbacks } = deriveCases(allRows);
if (fallbacks.length > 0) {
  console.error(
    `derive-runner-worker-deadlines: FALLBACKS (${FALLBACK_REASON}): ${fallbacks.join(", ")}`,
  );
}

const testDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(committedTest));
const out = {
  schemaVersion: FORMULA_VERSION,
  method: {
    formula:
      `deadlineMs = max(${FLOOR_MS}, ${MULTIPLIER} x nearestRankP95(uncensored ok rows pooled across runs))`,
    censoring:
      "ok=false with 'timed out waiting for worker message' = censored (true value > probe ceiling, excluded from p95); other failures = errors (excluded); all retained as raw rows",
    p95: "nearest-rank (1-based) over uncensored ok rows pooled across runs",
    floorMs: FLOOR_MS,
    multiplier: MULTIPLIER,
    minRuns: MIN_RUNS,
    fallbackMs: FALLBACK_MS,
    fallbackClause:
      `a case with no uncensored ok row in any run keeps the existing ${FALLBACK_MS}ms with the ledger sentence "${FALLBACK_REASON}" (hub ruling, option d)`,
    standingInstruction:
      "when a later derivation produces a baseline for a fallback case, the fallback entry is replaced by the derived deadline in the same change",
    gateSensitivity:
      "derived deadlines TIGHTEN the fast majority relative to the former blanket 5000ms; this is a deliberate gate-sensitivity change, not a loosening",
  },
  generatedFrom: {
    commit,
    deno: Deno.version.deno,
    os: Deno.build.os,
    arch: Deno.build.arch,
    testPath: TEST_PATH,
    testSha256: [...new Uint8Array(testDigest)].map((x) => x.toString(16).padStart(2, "0")).join(
      "",
    ),
    loadavgStart: runs[0]?.loadavg ?? "",
    loadavgEnd: runs[runs.length - 1]?.loadavg ?? "",
    stealPctPerRun: runs.map((r) => r.stealPct),
    stealNote:
      "stealPct = share of CPU-time delta taken by the hypervisor during each run (/proc/stat, two samples per run). Deadlines are environment-relative: derived under the recorded loadavg AND steal; re-derive on a different environment rather than reusing this table.",
  },
  runs,
  cases,
  fallbacks,
};

await Deno.writeTextFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
console.error(
  `derive-runner-worker-deadlines: wrote ${OUT_PATH} (${
    Object.keys(cases).length
  } cases, ${fallbacks.length} fallbacks, ${allRows.length} raw rows)`,
);
