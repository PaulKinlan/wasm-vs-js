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
  "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_COMMIT",
  "--allow-net=127.0.0.1",
  "--allow-read",
  "--allow-write",
  "--allow-run",
];

interface Stage {
  name: string;
  args: string[];
  env?: Record<string, string>;
}

// Note: taskset CPU pinning was tried and REJECTED (2026-08-04) — each deno
// process brings several V8 background threads, so pinned core sets
// oversubscribe ~3x and every long chain gets slower. Do not re-add.

// Readers that fetch audio/sum-u32/small-writer artifact bytes over HTTP
// routes. They must run after every writer has finished, so they get their
// own tail phase instead of joining the reader flock.
const TAIL_READERS = [
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
  "tests/corpus-operation-dispatch.test.ts",
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
  const child = new Deno.Command(Deno.execPath(), {
    args: stage.args,
    env: stage.env,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const status = await child.status;
  const elapsed = ((performance.now() - stageStart) / 1000).toFixed(1);
  if (!status.success) {
    console.error(`check-parallel: ${stage.name} FAILED in ${elapsed}s (exit ${status.code})`);
    Deno.exit(status.code);
  }
  console.error(`check-parallel: ${stage.name} ok (${elapsed}s)`);
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
  { name: "catalog", args: ["task", "catalog"] },
];
const manifestReaderStatics: Stage[] = [
  { name: "planning", args: ["run", "--allow-read=.", "scripts/check-planning.mjs"] },
  { name: "contract", args: ["task", "contract"], env: testEnv },
];

const started = performance.now();
await runStage({ name: "build", args: ["task", "build"] });

// Phase A: readers and every writer, all concurrent (write sets verified
// pairwise disjoint and unread by the reader flock — see header comment).
await Promise.all([
  ...staticStages.map(runStage),
  // Gated on the manifest-reading statics (see comment above).
  Promise.all(manifestReaderStatics.map(runStage)).then(() =>
    runStage({
      name: "test-sum-u32-pair",
      args: ["test", ...testArgs, ...SUM_U32_PAIR],
      env: testEnv,
    })
  ),
  // The light flock is ~35 core-seconds; 6 workers finish it in ~10-11s,
  // co-critical with the rigid writer lane (tuning curve measured
  // 2026-08-04: 12 jobs -> 13.9s wall, 8 -> 12.9s, 6 -> 12.2s; the rigid
  // physics chain is bandwidth-sensitive and prefers fewer flock threads).
  runStage({
    name: "test-readers",
    args: ["test", "--parallel", ...testArgs, ...readerTests],
    env: { ...testEnv, DENO_JOBS: "6" },
  }),
  ...HEAVY_READERS.map(async (file) => {
    // Stagger: the t=0 startup storm (12 deno processes type-checking) inflates
    // the critical rigid chain; these lanes have ~1s of slack before they would
    // become the binder, so a delayed start costs no wall time.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await runStage({
      name: `test-heavy-${
        file.replace(/^tests\//, "").replace(/\.test\.ts$/, "").replaceAll("/", "-")
      }`,
      args: ["test", ...testArgs, file],
      env: testEnv,
    });
  }),
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
