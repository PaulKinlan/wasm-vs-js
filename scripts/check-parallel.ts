// Fast gate: identical stages to `deno task check`, but the test phase runs
// mostly in parallel. Stage set, permissions, and environment match the house
// `check` task exactly — only test-file scheduling changes.
//
// Why a script instead of the deno.json task: every artifact manifest embeds
// the deno.json sha256 in its provenance source graph, so editing deno.json
// forces a transitive rebind of dozens of manifests. This file adds the fast
// path without touching any pinned provenance.
//
// Test scheduling: most test files are read-only with respect to
// public/artifacts and run under `deno test --parallel`. The files in
// WRITER_TESTS rebuild artifacts in place (identical bytes, but non-atomic
// writes), which can race with concurrent readers — they run sequentially in
// a single `deno test` invocation, exactly matching house-gate semantics.
// WRITER_TESTS was identified empirically (mtime snapshot per test file,
// 2026-08-03); new test files default to the parallel phase. If a future
// flake shows a truncated/empty artifact read, re-run the mtime scan and add
// the writer here.
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

// Writer scheduling: the two heavy writers run in their own parallel pair
// (disjoint artifact dirs), the pair touching shared sum-u32 references runs
// sequentially, and the remaining small writers (<=2s each) run in one
// parallel batch.
const BIG_WRITERS = [
  "tests/v1/simulation-rigid-body-2d.test.ts",
  "tests/audio-provenance.test.ts",
];
const SUM_U32_PAIR = [
  "tests/build.test.ts",
  "tests/traditional-web-build.test.ts",
];
const SMALL_WRITERS = WRITER_TESTS.filter((f) =>
  !BIG_WRITERS.includes(f) && !SUM_U32_PAIR.includes(f)
);

const writers = new Set(WRITER_TESTS);
const allTests = await testFiles();
const parallelTests = allTests.filter((f) => !writers.has(f));
const missing = WRITER_TESTS.filter((f) => !allTests.includes(f));
if (missing.length > 0) {
  console.error(`check-parallel: WRITER_TESTS entries not found on disk: ${missing.join(", ")}`);
  Deno.exit(2);
}

const stages: Stage[] = [
  { name: "build", args: ["task", "build"] },
  { name: "fmt", args: ["fmt", "--check"] },
  { name: "lint", args: ["lint"] },
  { name: "typecheck", args: ["task", "typecheck"] },
  { name: "planning", args: ["run", "--allow-read=.", "scripts/check-planning.mjs"] },
  { name: "contract", args: ["task", "contract"], env: testEnv },
  { name: "catalog", args: ["task", "catalog"] },
  {
    name: "test-parallel",
    args: ["test", "--parallel", ...testArgs, ...parallelTests],
    env: testEnv,
  },
  {
    name: "test-writers-small",
    args: ["test", "--parallel", ...testArgs, ...SMALL_WRITERS],
    env: testEnv,
  },
  { name: "test-writers-pair", args: ["test", ...testArgs, ...SUM_U32_PAIR], env: testEnv },
  {
    name: "test-writers-big",
    args: ["test", "--parallel", ...testArgs, ...BIG_WRITERS],
    env: testEnv,
  },
];

const started = performance.now();
for (const stage of stages) {
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
console.error(
  `check-parallel: all ${stages.length} stages ok in ${
    ((performance.now() - started) / 1000).toFixed(1)
  }s`,
);
