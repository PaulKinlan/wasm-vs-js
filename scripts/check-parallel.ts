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
// - Phase A runs the read-only test files under `deno test --parallel`,
//   concurrently with the rigid-body writer (its only reader is the
//   browser-collector test, held out for phase B) and the audio writer
//   (permission-scoped to public/artifacts/audio-{fft,fir,stft}; its only
//   readers are the TAIL_READERS, held out for phase C).
// - Phase B runs the small writers (each writes a disjoint per-lane
//   artifact dir), the sum-u32 writer/reader pair (sequential, they share
//   sum-u32), and the rigid-body reader.
// - Phase C runs the TAIL_READERS (server/public-mode/inspectability),
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
const SMALL_WRITERS = WRITER_TESTS.filter((f) =>
  f !== RIGID_WRITER && f !== AUDIO_WRITER && !SUM_U32_PAIR.includes(f)
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

// Readers that fetch audio/sum-u32/small-writer artifact bytes over HTTP
// routes. They must run after every writer has finished, so they get their
// own tail phase instead of joining the reader flock.
const TAIL_READERS = [
  "tests/inspectability.test.ts",
  "tests/public-mode.test.ts",
  "tests/server.test.ts",
];

const writers = new Set(WRITER_TESTS);
const allTests = await testFiles();
const readerTests = allTests.filter((f) =>
  !writers.has(f) && f !== RIGID_READER && !TAIL_READERS.includes(f)
);
const missing = [...WRITER_TESTS, RIGID_READER, ...TAIL_READERS].filter((f) =>
  !allTests.includes(f)
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

const staticStages: Stage[] = [
  { name: "build", args: ["task", "build"] },
  { name: "fmt", args: ["fmt", "--check"] },
  { name: "lint", args: ["lint"] },
  { name: "typecheck", args: ["task", "typecheck"] },
  { name: "planning", args: ["run", "--allow-read=.", "scripts/check-planning.mjs"] },
  { name: "contract", args: ["task", "contract"], env: testEnv },
  { name: "catalog", args: ["task", "catalog"] },
];

const started = performance.now();
for (const stage of staticStages) await runStage(stage);

// Phase A: parallel readers, concurrent with the rigid-body writer and the
// audio writer. The audio writer's subprocess is permission-scoped to
// public/artifacts/audio-{fft,fir,stft}; the only tests reading those bytes
// are the TAIL_READERS, which are held out.
await Promise.all([
  runStage({
    name: "test-readers",
    args: ["test", "--parallel", ...testArgs, ...readerTests],
    env: testEnv,
  }),
  runStage({ name: "test-rigid-writer", args: ["test", ...testArgs, RIGID_WRITER], env: testEnv }),
  runStage({ name: "test-audio-writer", args: ["test", ...testArgs, AUDIO_WRITER], env: testEnv }),
]);

// Phase B: small writers + rigid reader, and the sum-u32 pair — two disjoint
// groups, run concurrently.
await Promise.all([
  runStage({
    name: "test-writers-small",
    args: ["test", "--parallel", ...testArgs, ...SMALL_WRITERS, RIGID_READER],
    env: testEnv,
  }),
  runStage({
    name: "test-sum-u32-pair",
    args: ["test", ...testArgs, ...SUM_U32_PAIR],
    env: testEnv,
  }),
]);

// Phase C: route-level readers of writer-owned artifact bytes, alone.
await runStage({
  name: "test-tail-readers",
  args: ["test", "--parallel", ...testArgs, ...TAIL_READERS],
  env: testEnv,
});

console.error(
  `check-parallel: all stages ok in ${((performance.now() - started) / 1000).toFixed(1)}s`,
);
