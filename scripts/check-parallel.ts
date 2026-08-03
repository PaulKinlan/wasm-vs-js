// Fast gate: identical stages to `deno task check`, but the test phase runs
// with `deno test --parallel`. Stage set, permissions, and environment match
// the house `check` task exactly — only test-file scheduling changes.
//
// Why a script instead of the deno.json task: every artifact manifest embeds
// the deno.json sha256 in its provenance source graph, so editing deno.json
// forces a transitive rebind of dozens of manifests. This file adds the fast
// path without touching any pinned provenance.
//
// Usage: deno run --allow-run --allow-read --allow-write --allow-env --allow-net=127.0.0.1 scripts/check-parallel.ts

const commit = new TextDecoder().decode(
  (await new Deno.Command("git", { args: ["rev-parse", "HEAD"], stdout: "piped" }).output()).stdout,
).trim();

interface Stage {
  name: string;
  args: string[];
  env?: Record<string, string>;
}

const commitEnv = { WASM_VS_JS_COMMIT: commit };
// PORT/HOST/SERVER_MODE are not set here — the house test task only sets
// WASM_VS_JS_COMMIT and merely allows the others to be read from the env.
const stages: Stage[] = [
  { name: "build", args: ["task", "build"] },
  { name: "fmt", args: ["fmt", "--check"] },
  { name: "lint", args: ["lint"] },
  { name: "typecheck", args: ["task", "typecheck"] },
  { name: "planning", args: ["run", "--allow-read=.", "scripts/check-planning.mjs"] },
  { name: "contract", args: ["task", "contract"], env: commitEnv },
  { name: "catalog", args: ["task", "catalog"] },
  {
    name: "test",
    args: [
      "test",
      "--parallel",
      "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_COMMIT",
      "--allow-net=127.0.0.1",
      "--allow-read",
      "--allow-write",
      "--allow-run",
    ],
    env: commitEnv,
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
    console.error(`check-parallel: ${stage} FAILED in ${elapsed}s (exit ${status.code})`);
    Deno.exit(status.code);
  }
  console.error(`check-parallel: ${stage} ok (${elapsed}s)`);
}
console.error(
  `check-parallel: all ${stages.length} stages ok in ${
    ((performance.now() - started) / 1000).toFixed(1)
  }s`,
);
