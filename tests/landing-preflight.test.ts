// Tests for scripts/landing-preflight.sh: the single tracked implementation of
// the four-branch assert-then-act landing gate. The real `git` binary is never
// touched — a fake `git` on PATH stubs every command, and the real `push` is
// recorded to a log file so no probe ref is ever created on a real remote.
//
// Branch matrix exercised here:
//   0  OK: genuine update row / brand-new target ref — push runs.
//   2  Nothing to land: "Everything up-to-date" — no push.
//   3  Refused: "[rejected]" — no push.
//   4  Unrecognised dry-run output (synthetic fixture) — no push.
//   1  Precondition/assertion failures (dirty tree, HEAD == remote tip,
//      update-row sha mismatch) — no push.
import { assert, assertEquals } from "./assert.ts";

const root = new URL("../", import.meta.url);
const preflightPath = new URL("../scripts/landing-preflight.sh", import.meta.url).pathname;

// Real dry-run output abbreviates the shas; `git rev-parse` returns full
// 40-hex. The fake git stores full shas and resolves the abbreviations back.
const HEAD = "60ecc75a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d";
const REMOTE = "b70e45601c2d3e4f5a6b7c8d9e0f1a2b3c4d";
const HEAD_SHORT = "60ecc75";
const REMOTE_SHORT = "b70e456";

const ANCHORED_UPDATE_ROW = "^ *[0-9a-f]{4,}..[0-9a-f]{4,} +HEAD -> ";

// A fake `git` that reads its scenario from sibling files (no environment
// variables needed, so it works under Deno's restricted --allow-env).
const FAKE_GIT_LINES = [
  "#!/usr/bin/env bash",
  "set -uo pipefail",
  'd="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
  'cmd="${1:-}"; shift || true',
  'case "$cmd" in',
  "  status)",
  '    [ -f "$d/status" ] && cat "$d/status"',
  "    exit 0",
  "    ;;",
  "  rev-parse)",
  '    if [ "$1" = "--verify" ]; then',
  '      if [ "$2" = "--quiet" ]; then',
  '        if [ -f "$d/remote-tip" ]; then cat "$d/remote-tip"; exit 0; fi',
  "        exit 1",
  "      fi",
  '      sha="${2:-}"',
  '      head="$(cat "$d/head" 2>/dev/null || true)"',
  '      remote="$(cat "$d/remote-tip" 2>/dev/null || true)"',
  '      if [[ -n "$head" && "$head" == "$sha"* ]]; then echo "$head"; exit 0; fi',
  '      if [[ -n "$remote" && "$remote" == "$sha"* ]]; then echo "$remote"; exit 0; fi',
  "      exit 1",
  '    elif [ "$1" = "HEAD" ]; then',
  '      cat "$d/head"',
  "      exit 0",
  "    else",
  '      if [ -f "$d/remote-tip" ]; then cat "$d/remote-tip"; exit 0; fi',
  "      exit 1",
  "    fi",
  "    ;;",
  "  push)",
  '    for a in "$@"; do',
  '      if [ "$a" = "--dry-run" ]; then',
  '        [ -f "$d/dry-run-out" ] && cat "$d/dry-run-out"',
  '        if [ -f "$d/dry-run-rc" ]; then exit "$(cat "$d/dry-run-rc")"; fi',
  "        exit 0",
  "      fi",
  "    done",
  '    printf "push %s\\n" "$*" >> "$d/push-log"',
  "    exit 0",
  "    ;;",
  "  *)",
  '    echo "unexpected git command: $cmd $*" >&2',
  "    exit 99",
  "    ;;",
  "esac",
].join("\n") + "\n";

interface Scenario {
  dir: string;
  bin: string;
}

async function makeScenario(files: Record<string, string>): Promise<Scenario> {
  const dir = await Deno.makeTempDir({ prefix: "landing-preflight-" });
  const bin = `${dir}/bin`;
  await Deno.mkdir(bin);
  await Deno.writeTextFile(`${bin}/git`, FAKE_GIT_LINES);
  await Deno.chmod(`${bin}/git`, 0o755);
  for (const [name, content] of Object.entries(files)) {
    await Deno.writeTextFile(`${bin}/${name}`, content);
  }
  return { dir, bin };
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  pushLog: string;
}

async function runPreflight(bin: string, target = "main"): Promise<RunResult> {
  const cmd = new Deno.Command("bash", {
    args: ["-c", 'PATH="$1:$PATH"; exec bash "$2" "$3"', "preflight", bin, preflightPath, target],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  });
  const out = await cmd.output();
  let pushLog = "";
  try {
    pushLog = await Deno.readTextFile(`${bin}/push-log`);
  } catch {
    // No real push happened — the log file was never created.
  }
  return {
    code: out.code,
    stdout: new TextDecoder().decode(out.stdout),
    stderr: new TextDecoder().decode(out.stderr),
    pushLog,
  };
}

async function grepMatches(pattern: string, input: string, fixed: boolean): Promise<boolean> {
  const args = ["-q", ...(fixed ? ["-F"] : ["-E"]), pattern];
  const child = new Deno.Command("grep", {
    args,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(input));
  await writer.close();
  const out = await child.output();
  return out.code === 0;
}

function realPushOnly(pushLog: string, target = "main"): void {
  assert(pushLog.includes(`push origin HEAD:${target}`), `expected a real push, got: ${pushLog}`);
  assert(!pushLog.includes("--dry-run"), "a dry-run must not be recorded as a real push");
}

Deno.test("landing-preflight OK: genuine update row asserts shas and pushes", async () => {
  // Real row shape "b70e456..60ecc75  HEAD -> main": FIRST sha is the OLD
  // value (remote tip), SECOND is the NEW value (HEAD).
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "dry-run-out": `To ../origin.git\n   ${REMOTE_SHORT}..${HEAD_SHORT}  HEAD -> main\n`,
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 0, r.stderr);
    realPushOnly(r.pushLog);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight OK: brand-new target ref pushes without a sha pair", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "dry-run-out": "To ../origin.git\n * [new branch]      HEAD -> main\n",
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 0, r.stderr);
    realPushOnly(r.pushLog);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight nothing-to-land: exit 2, no push", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "dry-run-out": "Everything up-to-date\n",
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 2, r.stderr);
    assertEquals(r.pushLog, "");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight refused: exit 3, no push", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "dry-run-out":
      "To ../origin.git\n ! [rejected]        HEAD -> main (fetch first)\nerror: failed to push some refs to '../origin.git'\n",
    "dry-run-rc": "1",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 3, r.stderr);
    assertEquals(r.pushLog, "");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight unrecognised: exit 4, no push (synthetic fixture)", async () => {
  // SYNTHETIC fixture: this wording never appears in a real dry-run; it stands
  // in for any output the four known branches do not match.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "dry-run-out": "remote: Something totally unexpected happened\n",
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 4, r.stderr);
    assertEquals(r.pushLog, "");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight precondition: dirty worktree exits 1 without a push", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    status: " M some/file.ts\n",
    "dry-run-out": `   ${REMOTE_SHORT}..${HEAD_SHORT}  HEAD -> main\n`,
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("not clean"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight precondition: HEAD == remote tip exits 1 without a push", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": HEAD, // uncommitted merge: HEAD never advanced past origin/main
    "dry-run-out": "Everything up-to-date\n",
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight sha assertion: NEW sha not HEAD exits 1 without a push", async () => {
  // Correction 1: the SECOND sha is the NEW value and must resolve to HEAD.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "dry-run-out": `   ${REMOTE_SHORT}..deadbee  HEAD -> main\n`,
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("NEW sha"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight sha assertion: OLD sha not remote tip exits 1 without a push", async () => {
  // Correction 1: the FIRST sha is the OLD value and must resolve to the
  // remote tip — a stale fetch makes it lie about the remote.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "dry-run-out": `   cafebab..${HEAD_SHORT}  HEAD -> main\n`,
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("OLD sha"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight anchored regex: loose substring hits refusal, anchored row does not", async () => {
  // The measured reason for anchoring: the loose substring "HEAD -> main"
  // matches a REFUSAL row, while the anchored update-row regex does not.
  const refusal = " ! [rejected]        HEAD -> main (fetch first)\n";
  const update = `   ${REMOTE_SHORT}..${HEAD_SHORT}  HEAD -> main\n`;

  assert(await grepMatches("HEAD -> main", refusal, true), "loose substring must hit refusal");
  assert(
    !(await grepMatches(ANCHORED_UPDATE_ROW, refusal, false)),
    "anchored regex must miss refusal",
  );
  assert(await grepMatches(ANCHORED_UPDATE_ROW, update, false), "anchored regex must hit update");
});
