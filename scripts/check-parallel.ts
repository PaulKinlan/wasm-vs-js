// Fast gate: identical stages to `deno task check`, but the test phase runs
// mostly in parallel. Stage set, permissions, and environment match the house
// `check` task exactly — only test-file scheduling changes.
//
// Why a script instead of the deno.json task: every artifact manifest embeds
// the deno.json sha256 in its provenance source graph, so editing deno.json
// forces a transitive rebind of dozens of manifests. This file adds the fast
// path without touching any pinned provenance.
//
// Test scheduling (race-free by construction):
// - WRITER_TESTS rebuild artifacts in place (identical bytes, but non-atomic
//   writes) and must never run concurrently with a test that reads the same
//   artifact. Identified empirically via per-file mtime scan (2026-08-03).
// - Phase A runs everything except the TAIL_READERS: read-only test files
//   under `deno test --parallel`, concurrently with every writer. Writer
//   write sets were captured empirically (mtime scan, 2026-08-03): each
//   writer touches only its own lane's artifact/evidence/registration
//   paths, pairwise disjoint, and no reader-phase test reads any of them
//   (verified by grep against the captured sets). The rigid-body writer's
//   only reader is its browser-collector test (held out of the reader
//   flock but concurrent here); the sum-u32 pair stays sequential because
//   traditional-web-build reads the sum-u32 manifest that build.test
//   rewrites, and starts only after the planning/contract statics that
//   read the same manifest. Race-freedom covers directory mutations too
//   (walker/writer audit, 2026-08-04): recursive-walk tests tolerate
//   transient builder scratch dirs vanishing mid-walk.
// - HEAVY_READERS (>5s isolated) run as single-file stages: deno test
//   --parallel packs multiple files per worker, so heavy files left in
//   the flock carried sequential queue-mates. They are staggered 1.2s
//   past the t=0 type-check storm (A/B-validated ~0.25s).
// - The read-only static stages (fmt/lint/typecheck/planning/contract/
//   catalog) overlap phase A after `task build`; all are --allow-read
//   only.
// - Phase B runs the TAIL_READERS (server/public-mode/inspectability),
//   which fetch writer-owned artifact bytes over HTTP routes and therefore
//   run only after every writer has finished.
// - New test files default to the parallel reader phase. If a flake ever
//   shows a truncated/empty artifact read, re-run the mtime scan and extend
//   the writer lists.
//
// Usage: deno run --allow-run --allow-read --allow-write --allow-env --allow-net=127.0.0.1 scripts/check-parallel.ts

const WRITER_TESTS = [
  "tests/archive-zip-workspace-v1.test.ts",
  "tests/audio-provenance.test.ts",
  "tests/base/cad-parametric-bracket.test.ts",
  "tests/base-crypto-authenticated-stream.test.ts",
  "tests/base/database-olap-chart.test.ts",
  "tests/base-document-pdf-viewer.test.ts",
  "tests/base/dom-virtualized-grid.test.ts",
  "tests/base/game-ecs-frame-update.test.ts",
  "tests/base-ml-numeric-kernels.test.ts",
  "tests/base-protobuf-gateway.test.ts",
  "tests/build.test.ts",
  "tests/cad-mesh-repair.test.ts",
  "tests/image-demos.test.ts",
  "tests/network-http2-quic-state.test.ts",
  "tests/traditional-web-build.test.ts",
  "tests/v1/simulation-rigid-body-2d.test.ts",
  "tests/v2/game-family.test.ts",
];

const RIGID_WRITER = "tests/v1/simulation-rigid-body-2d.test.ts";
const RIGID_READER = "tests/v1/simulation-rigid-body-2d-browser-collector.test.ts";
const AUDIO_WRITER = "tests/audio-provenance.test.ts";
const SUM_U32_PAIR = [
  "tests/build.test.ts",
  "tests/traditional-web-build.test.ts",
];
// image-editing-build rebuilds benchmarks/image-editing/{artifacts,fixtures};
// image-demos reads benchmarks/image-editing/artifacts/image-editing.wasm
// (scan-writers.mjs finding, 2026-08-04 — the build test was misclassified
// as a flock reader). Same sequential-pair pattern as sum-u32.
const IMAGE_PAIR = [
  "tests/image-editing-build.test.ts",
  "tests/image-demos.test.ts",
];
const SMALL_WRITERS = WRITER_TESTS.filter((f) =>
  f !== RIGID_WRITER && f !== AUDIO_WRITER && !SUM_U32_PAIR.includes(f) &&
  !IMAGE_PAIR.includes(f)
);

const commit = new TextDecoder().decode(
  (await new Deno.Command("git", { args: ["rev-parse", "HEAD"], stdout: "piped" }).output()).stdout,
).trim();

async function testFiles(): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory) await walk(path);
      else if (entry.name.endsWith(".test.ts")) files.push(path);
    }
  }
  await walk("tests");
  return files.sort();
}

const testEnv = { WASM_VS_JS_COMMIT: commit };
const testArgs = [
  "--unstable-kv",
  "--no-lock",
  "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_COMMIT,WASM_VS_JS_REPORTER_TOKEN",
  "--allow-net=127.0.0.1",
  "--allow-import=127.0.0.1",
  "--allow-read",
  "--allow-write",
  "--allow-run",
];

interface Stage {
  name: string;
  args: string[];
  env?: Record<string, string>;
}

// --- Job-group discipline (wasm-vs-js-pz5) ----------------------------------
// Defect: on stage failure the wrapper used to Deno.exit() while sibling
// stages kept running, reparented to init, still holding the fleet-heavy
// slot — a present .exit file then meant "the wrapper returned", not "the
// tree is gone". Now every stage runs in its OWN process group (setsid on
// Linux; grandchildren inherit the group), and on any stage failure — or on
// SIGTERM/SIGINT to the wrapper itself — the wrapper SIGTERMs then SIGKILLs
// every outstanding stage group, reaps the children, and verifies each group
// is gone (kill -0) before it exits. The fleet's outer kill
// (`kill -TERM -- -<wrapper pgid>`) reaches the wrapper but not the stage
// groups, which is exactly why the signal handlers below run the same sweep.
// Consequence: a present .exit file implies no surviving stage children.
const GROUP_KILL = Deno.build.os === "linux";

interface LiveStage {
  name: string;
  child: Deno.ChildProcess;
  pgid: number;
  statusPromise: Promise<Deno.CommandStatus>;
}

const liveStages = new Map<string, LiveStage>();
let shuttingDown = false;

function signalStageGroup(
  ls: LiveStage,
  signal: "TERM" | "KILL",
): void {
  if (!GROUP_KILL) {
    // Best effort off Linux (no setsid): only the direct child dies.
    try {
      ls.child.kill(`SIG${signal}`);
    } catch { /* already exited */ }
    return;
  }
  // Negative pid targets the whole process group; the stage child is its
  // leader (spawned via setsid), so this reaches grandchildren too.
  // Deno.kill passes straight to kill(2), which takes negative pids. NOTE:
  // do NOT shell out to /bin/kill for this — procps kill misparses
  // `-TERM -PGID` without a `--` separator (exits 0, delivers nothing).
  try {
    Deno.kill(-ls.pgid, signal === "TERM" ? "SIGTERM" : "SIGKILL");
  } catch { /* group already gone (ESRCH) */ }
}

async function groupGone(pgid: number): Promise<boolean> {
  if (!GROUP_KILL) return true;
  // kill -0 to a negative pid fails with ESRCH only when no process in the
  // group remains. The `--` separator is load-bearing: without it procps
  // kill misparses the negative pid (exits 0 having delivered nothing).
  // try/catch, never a chained .catch: Deno 2.9's Command.output() throws
  // out of the call itself when the binary is absent (wasm-vs-js-ccs). And
  // a failed probe must NOT read as "gone": this check is the one thing
  // standing between a stage failure and a false all-clear, so an
  // inconclusive probe fails CLOSED — the caller retries, then reports a
  // DIRTY shutdown instead of claiming no survivors.
  let out: Deno.CommandOutput;
  try {
    out = await new Deno.Command("kill", {
      args: ["-0", "--", `-${pgid}`],
      stdout: "null",
      stderr: "null",
    }).output();
  } catch {
    return false; // probe inconclusive — not proven gone
  }
  return !out.success;
}

// Terminate every outstanding stage group, reap the children, and verify no
// group survives. Returns true only when every group is confirmed gone.
async function terminateJobGroup(reason: string): Promise<boolean> {
  const victims = [...liveStages.values()];
  liveStages.clear();
  if (victims.length === 0) return true;
  console.error(
    `check-parallel: ${reason}; terminating ${victims.length} outstanding stage group(s): ${
      victims.map((v) => `${v.name}(pgid ${v.pgid})`).join(", ")
    }`,
  );
  for (const v of victims) signalStageGroup(v, "TERM");
  // Grace period: stages that trap SIGTERM get a moment to exit before KILL.
  const settled = new Set<string>();
  await Promise.all(victims.map(async (v) => {
    const grace = new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await Promise.race([
      v.statusPromise.then(() => settled.add(v.name)),
      grace,
    ]);
  }));
  for (const v of victims) {
    if (!settled.has(v.name)) signalStageGroup(v, "KILL");
  }
  // Reap every child so neither zombie nor orphan outlives the wrapper.
  await Promise.allSettled(victims.map((v) => v.statusPromise));
  const survivors: string[] = [];
  for (const v of victims) {
    let gone = await groupGone(v.pgid);
    // Grandchildren are reaped by init, not by us: a just-killed grandchild
    // can linger as a zombie for a few hundred ms and still answer kill -0.
    // Give init a bounded moment before calling the group a survivor.
    for (let attempt = 0; !gone && attempt < 12; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      gone = await groupGone(v.pgid);
    }
    if (!gone) {
      survivors.push(`${v.name}(pgid ${v.pgid})`);
    }
  }
  if (survivors.length > 0) {
    console.error(
      `check-parallel: WARNING stage group(s) still present 3s after the termination sweep: ${
        survivors.join(", ")
      }`,
    );
    return false;
  }
  console.error(
    `check-parallel: all ${victims.length} stage group(s) reaped and verified gone — no surviving children`,
  );
  return true;
}

function reportShutdown(context: string, clean: boolean): void {
  console.error(
    clean
      ? `check-parallel: clean shutdown (${context}) — a present .exit file implies no surviving stage children`
      : `check-parallel: DIRTY shutdown (${context}) — survivor groups remain; sweep for orphans before trusting the box`,
  );
}

// The fleet kills runaway wrappers by signalling the wrapper's own process
// group; the stage groups (own pgids, via setsid) are NOT in it, so the
// wrapper itself must sweep them on the way down.
for (const [sig, code] of [["SIGTERM", 143], ["SIGINT", 130]] as const) {
  Deno.addSignalListener(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    terminateJobGroup(`wrapper received ${sig}`).then((clean) => {
      reportShutdown(sig, clean);
      Deno.exit(code);
    });
  });
}

// Note: taskset CPU pinning was tried and REJECTED (2026-08-04) — each deno
// process brings several V8 background threads, so pinned core sets
// oversubscribe ~3x and every long chain gets slower. Do not re-add.

// Readers that fetch audio/sum-u32/small-writer artifact bytes over HTTP
// routes, or assert clean working tree (corpus-operation-dispatch). They must
// run after every writer has finished, so they get their own tail phase instead
// of joining the reader flock.
const TAIL_READERS = [
  "tests/corpus-operation-dispatch.test.ts",
  "tests/inspectability.test.ts",
  "tests/public-mode.test.ts",
  "tests/server.test.ts",
];

// Read-only files whose isolated runtime exceeds ~5s (measured 2026-08-04).
// deno test --parallel packs several files per worker process, so a heavy
// file's worker also runs its queue-mates sequentially and the lane wall
// becomes (heavy file + queue-mates) instead of just the heavy file. Each
// heavy file gets its own single-file stage; the light flock keeps the
// --parallel pool.
const HEAVY_READERS = [
  "tests/audio-corruption-gate.test.ts",
  "tests/audio-f64-gates.test.ts",
  "tests/audio-harness-fft.test.ts",
  "tests/audio-harness-stft.test.ts",
  "tests/base-gltf-viewer.test.ts",
  "tests/m2-js-variants.test.ts",
  "tests/runner-worker-contracts.test.ts",
  "tests/v2/ml-neural-allocations.test.ts",
  "tests/v2/ml-neural-build-records.test.ts",
  "tests/v2/ml-neural-counters-phases.test.ts",
];

const writers = new Set(WRITER_TESTS);
const allTests = await testFiles();
const readerTests = allTests.filter((f) =>
  !writers.has(f) && f !== RIGID_READER && !TAIL_READERS.includes(f) &&
  !HEAVY_READERS.includes(f) && !IMAGE_PAIR.includes(f)
);
const missing = [
  ...WRITER_TESTS,
  RIGID_READER,
  ...TAIL_READERS,
  ...HEAVY_READERS,
  ...IMAGE_PAIR,
].filter(
  (f) => !allTests.includes(f),
);
if (missing.length > 0) {
  console.error(`check-parallel: expected test files not found on disk: ${missing.join(", ")}`);
  Deno.exit(2);
}

async function runStage(stage: Stage): Promise<void> {
  const stageStart = performance.now();
  // Each stage is its own process-group leader (setsid) so the failure sweep
  // can take down the whole group — workers, servers and other grandchildren
  // included — with one signal to the negative pgid.
  const child = GROUP_KILL
    ? new Deno.Command("setsid", {
      args: [Deno.execPath(), ...stage.args],
      env: stage.env,
      stdout: "inherit",
      stderr: "inherit",
    }).spawn()
    : new Deno.Command(Deno.execPath(), {
      args: stage.args,
      env: stage.env,
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
  const live: LiveStage = {
    name: stage.name,
    child,
    pgid: child.pid,
    statusPromise: child.status,
  };
  liveStages.set(stage.name, live);
  const status = await live.statusPromise;
  const elapsed = ((performance.now() - stageStart) / 1000).toFixed(1);
  if (!status.success) {
    if (shuttingDown) {
      // Killed by a sibling's failure sweep or by a signal to the wrapper.
      // Never resolve: if this promise returned, the main-line Promise.all
      // could march on to later phases and SPAWN NEW STAGES while the sweep
      // owner is still verifying the kill — re-creating the orphan defect
      // through the signal path. The sweep owner always ends in Deno.exit.
      await new Promise(() => {});
    }
    shuttingDown = true;
    console.error(`check-parallel: ${stage.name} FAILED in ${elapsed}s (exit ${status.code})`);
    // The failed stage stays registered: its own group may still hold
    // grandchildren (e.g. a server the dying test left behind).
    const clean = await terminateJobGroup(
      `${stage.name} failed (exit ${status.code})`,
    );
    reportShutdown(`${stage.name} failed`, clean);
    Deno.exit(status.code);
  }
  liveStages.delete(stage.name);
  console.error(`check-parallel: ${stage.name} ok (${elapsed}s)`);
}

// Acceptance driver for the group-kill discipline (wasm-vs-js-pz5): a
// deliberately failing stage alongside a long-running stage that spawns a
// grandchild. Expected: the wrapper logs the sweep, exits with the failing
// stage's code (3), and no selftest process survives — verifiable from
// outside: `ps -eo pid,ppid,pgid,cmd | grep selftest-group-kill` must return
// nothing once the wrapper's .exit file exists. Exercises the same runStage
// code path as the real fan-out without running the gate.
if (Deno.args.includes("--self-test-group-kill")) {
  const marker = "selftest-group-kill";
  await Promise.all([
    runStage({
      name: "selftest-long",
      args: [
        "eval",
        `/*${marker}*/ new Deno.Command(Deno.execPath(), { args: ["eval", "/*${marker}-grandchild*/ setTimeout(()=>{},120000)"] }).spawn(); setTimeout(()=>{},120000);`,
      ],
    }),
    runStage({
      name: "selftest-fail",
      args: [
        "eval",
        `/*${marker}*/ await new Promise((r) => setTimeout(r, 750)); Deno.exit(3);`,
      ],
    }),
  ]);
  // The failing stage must win the race; reaching here means the sweep never
  // ran and the defect is present.
  console.error(
    "check-parallel: SELF-TEST FAILED — failing stage did not terminate the run",
  );
  Deno.exit(1);
}

// `task build` writes public/artifacts and must finish first. Every static
// stage is read-only (fmt --check/lint/typecheck/planning/contract/catalog all
// run with --allow-read only) so they overlap phase A — with one hazard pair:
// planning and contract read public/artifacts/sum-u32/build-manifest.json,
// which the sum-u32 writer pair rewrites. The pair therefore starts only
// after those two statics finish (~0.7s; the pair ends ~3s in, far from the
// critical path). lint reads committed .js under public/artifacts but no gate
// writer rewrites .js files there.
const staticStages: Stage[] = [
  { name: "fmt", args: ["fmt", "--check"] },
  { name: "lint", args: ["lint"] },
  { name: "typecheck", args: ["task", "typecheck"] },
  // `deno check` does not check plain .js by default, so the runner modules
  // shipped with three undefined identifiers and every run on every page ended
  // with "multilangResults is not defined". checkJs over the runner modules
  // catches that class of defect at gate time. Invoked directly rather than
  // as a deno.json task: every artifact manifest pins the deno.json sha256.
  {
    name: "runner-checkjs",
    args: [
      "check",
      // A second --config re-resolves npm deps and rewrites deno.lock, which
      // then fails every hash-pinned manifest test in the same run. The test
      // stages below use --no-lock for the same reason.
      "--no-lock",
      "--config",
      "tsconfig.runners.json",
      "public/measurement-model.js",
      "public/benchmark-report.js",
      "public/unified-runner.js",
      "public/coverage.js",
    ],
  },
  { name: "catalog", args: ["task", "catalog"] },
  { name: "coverage", args: ["run", "--allow-read=.", "scripts/build-coverage.ts", "--check"] },
  // Track B registry: fails if a manifest gained or lost an engine without the
  // registry being regenerated, and if any track "B" engine omits its baseline,
  // equivalence class or optimization log (docs/track-b-optimizations.md).
  {
    name: "track-b",
    args: ["run", "--allow-read=.", "scripts/build-track-b-registry.ts", "--check"],
  },
];
const manifestReaderStatics: Stage[] = [
  { name: "planning", args: ["run", "--allow-read=.", "scripts/check-planning.mjs"] },
  { name: "contract", args: ["task", "contract"], env: testEnv },
];

const REFERENCE_CLANG_TESTS = new Set([
  "tests/audio-demo.test.ts",
  "tests/base-crypto-file-integrity.test.ts",
  "tests/base-gltf-viewer.test.ts",
  "tests/base-network-pcap-decode.test.ts",
  "tests/base-server-ssr-template.test.ts",
  "tests/base-v1-graphics-cpu-path-tracer.test.ts",
  "tests/base/ml-keyword-spotting.test.ts",
  "tests/base/polybench-panel.test.ts",
  "tests/base/tooling-c-to-wasm-compile.test.ts",
  "tests/m2-build-variants.test.ts",
  "tests/m2-simd-vectors.test.ts",
  "tests/numeric-fft-browser-collector-negative.test.ts",
  "tests/server-wasi-qualification.test.ts",
  "tests/text-gc-document-edit.test.ts",
  "tests/traditional-demos.test.ts",
  "tests/v1-json-telemetry-browser-evidence.test.ts",
  "tests/v1-json-telemetry.test.ts",
  "tests/v2/ml-neural-build-records.test.ts",
  "tests/v2/ml-neural-controlled.test.ts",
]);

// The probe must be try/catch, never a chained .catch: when the binary is
// absent, Deno 2.9's Command.output() throws out of the call itself, so the
// rejection escapes as Uncaught and the handler is never entered
// (wasm-vs-js-ccs — a clang-less machine crashed the gate instead of
// degrading to the reduced path).
let clangOut: Deno.CommandOutput | { success: false; stdout: Uint8Array };
try {
  clangOut = await new Deno.Command("clang", {
    args: ["--version"],
    stdout: "piped",
    stderr: "null",
  }).output();
} catch {
  clangOut = { success: false, stdout: new Uint8Array() };
}
const clangFirstLine = clangOut.success
  ? new TextDecoder().decode(clangOut.stdout).split("\n")[0]?.trim() ?? ""
  : "";
const skipInPlaceWriters = Deno.args.includes("--no-writers") ||
  !clangFirstLine.startsWith("clang version 22.1.8");
if (skipInPlaceWriters) {
  const skipReason = Deno.args.includes("--no-writers")
    ? "--no-writers"
    : clangOut.success
    ? `non-reference clang (${JSON.stringify(clangFirstLine)})`
    : "no clang on PATH";
  console.error(
    `check-parallel: skipping in-place WRITER_TESTS and task build on ${skipReason} to preserve committed artifact bytes`,
  );
}
const activeReaderTests = skipInPlaceWriters
  ? readerTests.filter((f) => !REFERENCE_CLANG_TESTS.has(f))
  : readerTests;
const activeHeavyReaders = skipInPlaceWriters
  ? HEAVY_READERS.filter((f) => !REFERENCE_CLANG_TESTS.has(f))
  : HEAVY_READERS;

const started = performance.now();
if (!skipInPlaceWriters) {
  await runStage({ name: "build", args: ["task", "build"] });
}

// Phase A: readers and every writer, all concurrent (write sets verified
// pairwise disjoint and unread by the reader flock — see header comment).
await Promise.all([
  ...staticStages.map(runStage),
  // Gated on the manifest-reading statics (see comment above).
  Promise.all(manifestReaderStatics.map(runStage)).then(async () => {
    if (!skipInPlaceWriters) {
      await runStage({
        name: "test-sum-u32-pair",
        args: ["test", ...testArgs, ...SUM_U32_PAIR],
        env: testEnv,
      });
    }
  }).then(() =>
    // Fresh-profile CDP smoke: homepage summary, every card route 200, and
    // three representative cards run to Complete in a real browser. Chained
    // after the sum-u32 pair so the smoke's fast card never fetches the wasm
    // mid-rewrite; everything else it touches is read-only in-gate.
    runStage({
      name: "smoke-cdp",
      args: [
        "run",
        // cdp-smoke reads CHROME_BIN before falling back to well-known paths;
        // without the grant the stage died on NotCapable before launching a
        // browser, so the one stage that drives real pages never ran.
        "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_REPORTER_TOKEN,CHROME_BIN",
        "--allow-net=127.0.0.1",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "scripts/cdp-smoke.ts",
        "--base=http://127.0.0.1:0",
      ],
    })
  ),
  // The light flock grew to ~90 core-seconds (contract suite, route codegen,
  // M1-M4 reader tests); 6 workers made it the gate binder. Re-tuned
  // 2026-08-05: standalone flock 11.9s @6 / 10.4s @8 (interleaved, 2 pairs);
  // in-gate ~14.3s @8 vs ~15.5s @6 on a quiet machine. The rigid physics
  // chain is bandwidth-sensitive, so 8 balances flock shrink vs lane inflation
  // (at 10 the rigid lane starts inflating for <0.1s total gain).
  runStage({
    name: "test-readers",
    args: ["test", "--parallel", ...testArgs, ...activeReaderTests],
    env: { ...testEnv, DENO_JOBS: "8" },
  }),
  ...activeHeavyReaders.map(async (file) => {
    // Stagger: the t=0 startup storm (12 deno processes type-checking) inflates
    // the critical rigid chain; these lanes have ~1s of slack before they would
    // become the binder, so a delayed start costs no wall time. The two
    // server-spawning contract heavies (runner-worker-contracts spawns a server
    // per contract; m2-js-variants builds variants) move to a 4s start so their
    // process/IO bursts miss the rigid lane's bandwidth-critical early phase —
    // measured 2026-08-05: 1.2s start inflated rigid 13.0 -> 13.6-14.0.
    const isServerHeavy = file.endsWith("runner-worker-contracts.test.ts") ||
      file.endsWith("m2-js-variants.test.ts");
    await new Promise((resolve) => setTimeout(resolve, isServerHeavy ? 4000 : 1200));
    await runStage({
      name: `test-heavy-${
        file.replace(/^tests\//, "").replace(/\.test\.ts$/, "").replaceAll("/", "-")
      }`,
      args: ["test", ...testArgs, file],
      env: testEnv,
    });
  }),
  ...(skipInPlaceWriters
    ? [
      runStage({
        name: "test-rigid-reader",
        args: ["test", ...testArgs, RIGID_READER],
        env: testEnv,
      }),
    ]
    : [
      runStage({
        name: "test-rigid-writer",
        args: ["test", ...testArgs, RIGID_WRITER],
        env: testEnv,
      }),
      runStage({
        name: "test-audio-writer",
        args: ["test", ...testArgs, AUDIO_WRITER],
        env: testEnv,
      }),
      runStage({
        name: "test-writers-small",
        args: ["test", "--parallel", ...testArgs, ...SMALL_WRITERS, RIGID_READER],
        env: testEnv,
      }),
      runStage({
        name: "test-image-editing-pair",
        args: ["test", ...testArgs, ...IMAGE_PAIR],
        env: testEnv,
      }),
    ]),
]);

// Phase B: route-level readers of writer-owned artifact bytes, alone.
await runStage({
  name: "test-tail-readers",
  args: ["test", "--parallel", ...testArgs, ...TAIL_READERS],
  env: testEnv,
});

const totalSeconds = (performance.now() - started) / 1000;
console.error(`check-parallel: all stages ok in ${totalSeconds.toFixed(1)}s`);
// Machine-readable for the autoresearch harness.
console.log(`METRIC total_s=${totalSeconds.toFixed(1)}`);
