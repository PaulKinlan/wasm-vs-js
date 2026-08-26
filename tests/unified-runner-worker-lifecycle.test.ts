// The reuse probe asks one question: will this worker serve a second task?
//
// It used a flat 20-second budget, which is shorter than a single task on the
// slower workloads — dom-virtualized-grid-v1 takes about 30 seconds — so the
// probe could not pass however healthy the worker was. Worse, a failure on the
// first warm-up rethrew instead of taking the respawn fallback the code
// immediately below it describes, so the whole benchmark ended on
// "worker task timed out after 20000 ms". That workload could never complete a
// run, and the message named neither the phase nor how long it had waited.

import { assert } from "./assert.ts";

const RUNNER = await Deno.readTextFile(
  new URL("../public/unified-runner.js", import.meta.url),
);

Deno.test("the reuse probe is budgeted against a task that already ran", () => {
  const at = RUNNER.indexOf("const probeTimeoutMs =");
  assert(at !== -1, "the probe budget is no longer computed");
  const block = RUNNER.slice(at, at + 400);
  assert(
    /firstUseMs/.test(block),
    "the probe must be budgeted against the observed first use, not a constant",
  );
  assert(
    /Math\.min\(\s*iterationTimeoutMs/.test(block),
    "the probe must still be bounded by the workload's own timeout",
  );
});

Deno.test("a failed reuse probe respawns rather than ending the run", () => {
  const at = RUNNER.indexOf("for (let i = 0; i < WARMUP_RUNS; i++)");
  assert(at !== -1, "warm-up loop not found");
  const block = RUNNER.slice(at, at + 900);
  assert(
    /workerReuse = "respawned-per-iteration";/.test(block),
    "a warm-up failure must fall back to a fresh worker per iteration",
  );
  // The rethrow is what turned a slow worker into a failed benchmark.
  assert(
    !/\bthrow err;/.test(block),
    "a warm-up failure must not end the run",
  );
  assert(
    /reuseProbeFailure = /.test(block),
    "why the worker was respawned must be recorded, not swallowed",
  );
});

Deno.test("a worker timeout names its phase and how long it waited", () => {
  const at = RUNNER.indexOf("function postTask(");
  assert(at !== -1, "postTask not found");
  const block = RUNNER.slice(at, at + 1600);
  assert(
    /phaseLabel = "task"/.test(block),
    "postTask must take a phase label so a timeout can name the phase",
  );
  assert(
    /worker \$\{phaseLabel\} timed out/.test(block),
    "the timeout message must name the phase",
  );
  assert(
    /ms elapsed/.test(block),
    "the timeout message must report how long the task actually ran",
  );
  // Every call site labels itself; an unlabelled one reports "task" and tells
  // the reader nothing, which is the state this test exists to prevent.
  for (const label of ["first use", "reuse probe", "warm-up", "timed run"]) {
    assert(
      RUNNER.includes(`"${label}"`) || RUNNER.includes(`\`${label}`),
      `no call site labels itself "${label}"`,
    );
  }
});
