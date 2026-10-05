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
// - A case with NO uncensored ok row in any run is a DEFECT, gets no
//   deadline, and the derived table fails the contract test for it until it
//   is fixed or re-derived — the derivation must not become a machine for
//   legitimising whatever the box happens to do.
// - This makes the fast majority STRICTER (blanket 5000ms -> measured), not
//   looser: it is a gate-sensitivity change, by design.
//
// Usage:
//   deno run --allow-read --allow-write --allow-run --allow-env --allow-sys=loadavg \
//     scripts/derive-runner-worker-deadlines.ts [--runs 5]
//   deno run --allow-read scripts/derive-runner-worker-deadlines.ts --check
//
// --check recomputes deadlines from the committed raw rows with the same
// formula and fails if the committed table disagrees (deterministic; it never
// re-measures). No external imports: deno.lock stays byte-identical.

const OUT_PATH = "tests/fixtures/runner-worker-deadlines.v1.json";
const TEST_PATH = "tests/runner-worker-contracts.test.ts";
const PROBE_DIR = ".deadline-probe";
const PROBE_PATH = `${PROBE_DIR}/probe.test.ts`;
const ROWS_PATH = `${PROBE_DIR}/rows.tsv`;
const FORMULA_VERSION = 1;
const FLOOR_MS = 500;
const MULTIPLIER = 2;
const MIN_RUNS = 5;

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
  deadlineMs: number | null;
}

function nearestRankP95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length); // nearest-rank, 1-based
  return sorted[rank - 1];
}

function deriveCases(rows: Row[]): { cases: Record<string, CaseStats>; defects: string[] } {
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.slug}|${r.target}`;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const cases: Record<string, CaseStats> = {};
  const defects: string[] = [];
  for (const [key, list] of [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const okRows = list.filter((r) => r.ok);
    const censored = list.filter((r) =>
      !r.ok && r.error.includes("timed out waiting for worker")
    ).length;
    const errors = list.length - okRows.length - censored;
    let p95Ms: number | null = null;
    let deadlineMs: number | null = null;
    if (okRows.length > 0) {
      p95Ms = nearestRankP95(okRows.map((r) => r.ms));
      deadlineMs = Math.max(FLOOR_MS, Math.ceil(MULTIPLIER * p95Ms));
    } else {
      defects.push(key);
    }
    cases[key] = { n: list.length, okRows: okRows.length, censored, errors, p95Ms, deadlineMs };
  }
  return { cases, defects };
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

if (Deno.args.includes("--check")) {
  const committed = JSON.parse(await Deno.readTextFile(OUT_PATH));
  if (committed.schemaVersion !== FORMULA_VERSION) {
    console.error(
      `derive-runner-worker-deadlines: schema drift (${committed.schemaVersion} != ${FORMULA_VERSION})`,
    );
    Deno.exit(1);
  }
  const { cases, defects } = deriveCases(committed.runs.flatMap((r: { rows: Row[] }) => r.rows));
  const mismatches: string[] = [];
  for (const [key, stats] of Object.entries(cases)) {
    const committedStats = committed.cases[key] as CaseStats | undefined;
    if (!committedStats || committedStats.deadlineMs !== stats.deadlineMs) {
      mismatches.push(
        `${key}: committed ${committedStats?.deadlineMs} != recomputed ${stats.deadlineMs}`,
      );
    }
  }
  if (JSON.stringify(committed.defects) !== JSON.stringify(defects)) {
    mismatches.push(
      `defects: committed ${JSON.stringify(committed.defects)} != recomputed ${
        JSON.stringify(defects)
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
    } cases, ${defects.length} defects)`,
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

// Fail-closed instrumented-copy transform (mirrors the tim-probe diff: timing
// before the round-trip promise, one raw-row append after it; the 5000ms
// deadline and every assertion stay byte-identical in the copy).
const ANCHOR_ASSERT = 'import { assert } from "./assert.ts";';
const ANCHOR_PROMISE =
  "        const res = await new Promise<{ ok: boolean; data?: unknown; error?: string }>(";
const ANCHOR_ASSERT_OK = "        assert(res.ok, `${slug}[${target}]: ${res.error}`);";
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
const LOG_APPEND = "        const __ms = performance.now() - __t0;\n" +
  "        await Deno.writeTextFile(" + JSON.stringify(ROWS_PATH) +
  ', `${slug}\\t${target}\\t${__ms.toFixed(1)}\\t${res.ok ? "ok" : "fail"}\\t${(res.error ?? "").replace(/\\s+/g, " ").slice(0, 100)}\\n`, { append: true });\n';
const probe = committedTest
  .replace(ANCHOR_ASSERT, 'import { assert } from "../tests/assert.ts";')
  .replace(
    ANCHOR_PROMISE,
    "        const __t0 = performance.now();\n" + ANCHOR_PROMISE,
  )
  .replace(ANCHOR_ASSERT_OK, LOG_APPEND + ANCHOR_ASSERT_OK);

await Deno.mkdir(PROBE_DIR, { recursive: true });
const runs: { index: number; exitCode: number; loadavg: string; rows: Row[] }[] = [];
try {
  await Deno.writeTextFile(PROBE_PATH, probe);
  for (let i = 1; i <= runCount; i++) {
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
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    const status = await child.status;
    let rows: Row[] = [];
    try {
      rows = parseRows(await Deno.readTextFile(ROWS_PATH), i);
    } catch (e) {
      console.error(
        `derive-runner-worker-deadlines: run ${i} produced no parseable rows: ${
          (e as Error).message
        }`,
      );
      Deno.exit(4);
    }
    runs.push({ index: i, exitCode: status.code, loadavg: Deno.loadavg().join(" "), rows });
  }
} finally {
  await Deno.remove(PROBE_DIR, { recursive: true }).catch(() => {});
}

const allRows = runs.flatMap((r) => r.rows);
const { cases, defects } = deriveCases(allRows);
if (defects.length > 0) {
  console.error(
    `derive-runner-worker-deadlines: DEFECTS (no uncensored ok row in any run, no deadline derived): ${
      defects.join(", ")
    }`,
  );
}

const commitBytes = await new Deno.Command("git", { args: ["rev-parse", "HEAD"], stdout: "piped" })
  .output();
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
    defectClause:
      "a case with no uncensored ok row in any run is a defect, gets no deadline, and fails the contract test until fixed or re-derived",
    gateSensitivity:
      "derived deadlines TIGHTEN the fast majority relative to the former blanket 5000ms; this is a deliberate gate-sensitivity change, not a loosening",
  },
  generatedFrom: {
    commit: new TextDecoder().decode(commitBytes.stdout).trim(),
    deno: Deno.version.deno,
    os: Deno.build.os,
    arch: Deno.build.arch,
    testPath: TEST_PATH,
    testSha256: [...new Uint8Array(testDigest)].map((x) => x.toString(16).padStart(2, "0")).join(
      "",
    ),
    loadavgStart: runs[0]?.loadavg ?? "",
    loadavgEnd: runs[runs.length - 1]?.loadavg ?? "",
  },
  runs,
  cases,
  defects,
};

await Deno.writeTextFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
console.error(
  `derive-runner-worker-deadlines: wrote ${OUT_PATH} (${
    Object.keys(cases).length
  } cases, ${defects.length} defects, ${allRows.length} raw rows)`,
);
if (defects.length > 0) Deno.exit(5);
