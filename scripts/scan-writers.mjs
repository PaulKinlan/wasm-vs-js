// Re-derive the race-freedom invariant for check-parallel.ts: run every
// non-writer test file in isolation and report any repo mutation (created,
// modified, or deleted files AND directories) under the artifact-bearing
// trees. The static WRITER_TESTS / reader classification in check-parallel
// dates from a manual mtime scan (2026-08-03); this regenerates the evidence.
//
// A file belongs in WRITER_TESTS (or an explicitly tolerated-writer slot)
// iff it mutates anything below. Reader stages must print zero mutations.
// Directory mutations are reported too: recursive-walk tests can race with
// transient scratch dirs even when no file bytes conflict (see the
// audio-opus flake fix, 2026-08-04).
//
// Usage: deno run --allow-run --allow-read --allow-write --allow-env --allow-net=127.0.0.1 scripts/scan-writers.mjs [testfile ...]

const TRACKED_TREES = ["public/artifacts", "public/evidence", "benchmarks", "catalog", "raw"];
const TEST_ARGS = [
  "test",
  "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_COMMIT",
  "--allow-net=127.0.0.1",
  "--allow-read",
  "--allow-write",
  "--allow-run",
];

async function snapshot() {
  const entries = new Map();
  for (const tree of TRACKED_TREES) {
    const command = new Deno.Command("find", {
      args: [tree, "-printf", "%y %p %T@\n"],
      stdout: "piped",
      stderr: "null",
    });
    const { stdout } = await command.output();
    for (const line of new TextDecoder().decode(stdout).trim().split("\n")) {
      if (!line) continue;
      const kind = line[0];
      const rest = line.slice(2);
      const at = rest.lastIndexOf(" ");
      entries.set(rest.slice(0, at), `${kind}@${rest.slice(at + 1)}`);
    }
  }
  return entries;
}

function diff(before, after) {
  const mutations = [];
  for (const [path, stamp] of after) {
    const prior = before.get(path);
    if (prior === undefined) mutations.push(`+ ${stamp[0]} ${path}`);
    else if (prior !== stamp) mutations.push(`~ ${stamp[0]} ${path}`);
  }
  for (const [path, stamp] of before) {
    if (!after.has(path)) mutations.push(`- ${stamp[0]} ${path}`);
  }
  return mutations.sort();
}

const targets = Deno.args;
if (targets.length === 0) {
  console.error("scan-writers: pass explicit test files (the caller's reader set)");
  Deno.exit(2);
}

let dirty = 0;
for (const file of targets) {
  const before = await snapshot();
  const child = new Deno.Command(Deno.execPath(), {
    args: [...TEST_ARGS, file],
    env: { WASM_VS_JS_COMMIT: "scan" },
    stdout: "null",
    stderr: "null",
  }).spawn();
  const status = await child.status;
  const after = await snapshot();
  const mutations = diff(before, after);
  if (mutations.length > 0) {
    dirty++;
    console.log(`${file} [exit ${status.code}]:`);
    for (const mutation of mutations) console.log(`  ${mutation}`);
  }
}
console.log(`scan-writers: ${targets.length - dirty}/${targets.length} files mutation-clean`);
Deno.exit(dirty === 0 ? 0 : 1);
