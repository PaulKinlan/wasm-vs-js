// Tests for scripts/landing-preflight.sh: the single tracked implementation of
// the assert-then-act landing gate. The real `git` binary is never touched —
// a fake `git` on PATH stubs every command, and the real `push` is recorded
// to a log file so no probe ref is ever created on a real remote.
//
// WORKING INVOCATION: a bare `deno test tests/landing-preflight.test.ts` fails
// every case with a `NotCapable` permission error — the test writes its temp
// scenario dir (needs --allow-write) and spawns `bash` and `grep` (needs
// --allow-run). Run with the repo task's flags (or via its test task) instead:
//
//   deno test --allow-read --allow-write --allow-run tests/landing-preflight.test.ts
//
// Branch matrix exercised here (exit codes):
//   0  OK: genuine update row / brand-new target ref (--new-branch) — push runs.
//   1  Precondition/assertion failure — no push: dirty tree, HEAD == remote tip,
//      typo'd/non-existent target without --new-branch, dry-run non-zero rc,
//      update-row sha mismatch.
//   2  Nothing to land: "Everything up-to-date" (stale tracking ref) — no push.
//   3  Refused: "[rejected]" — no push.
//   4  Unrecognised dry-run output (synthetic fixture) — no push.
//   5  Real push attempted and failed — push attempted, non-zero.
import { assert, assertEquals } from "./assert.ts";

const root = new URL("../", import.meta.url);
const preflightPath = new URL("../scripts/landing-preflight.sh", import.meta.url).pathname;

// Real dry-run output abbreviates the shas; `git rev-parse` returns full
// 40-hex. The fake git stores full shas and resolves the abbreviations back.
const HEAD = "60ecc75a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d";
const REMOTE = "b70e45601c2d3e4f5a6b7c8d9e0f1a2b3c4d";
const HEAD_SHORT = "60ecc75";
const REMOTE_SHORT = "b70e456";

const ANCHORED_UPDATE_ROW = String.raw`^ *[0-9a-f]{4,}\.\.[0-9a-f]{4,} +HEAD -> `;
const ANCHORED_NEW_BRANCH_ROW = String.raw`^ *\* \[new branch\] +HEAD -> `;

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
  '        ref="${3:-}"',
  '        case "$ref" in',
  "          refs/remotes/origin/*)",
  '            name="${ref#refs/remotes/origin/}"',
  '            if [ -f "$d/remote-ref" ] && [ -f "$d/remote-tip" ] && grep -qxF "$name" "$d/remote-ref"; then',
  '              cat "$d/remote-tip"; exit 0;',
  "            fi",
  "            exit 1",
  "            ;;",
  "          refs/heads/*)",
  '            name="${ref#refs/heads/}"',
  '            if [ -f "$d/local-heads" ] && grep -qxF "$name" "$d/local-heads"; then echo "$ref"; exit 0; fi',
  "            exit 1",
  "            ;;",
  "          refs/tags/*)",
  '            name="${ref#refs/tags/}"',
  '            if [ -f "$d/local-tags" ] && grep -qxF "$name" "$d/local-tags"; then echo "$ref"; exit 0; fi',
  "            exit 1",
  "            ;;",
  "          *)",
  '            if [ -f "$d/local-heads" ] && grep -qxF "$ref" "$d/local-heads"; then echo "$ref"; exit 0; fi',
  '            if [ -f "$d/local-tags" ] && grep -qxF "$ref" "$d/local-tags"; then echo "$ref"; exit 0; fi',
  '            if [[ "$ref" == origin/* ]]; then',
  '              name="${ref#origin/}"',
  '              if [ -f "$d/remote-ref" ] && [ -f "$d/remote-tip" ] && grep -qxF "$name" "$d/remote-ref"; then',
  '                cat "$d/remote-tip"; exit 0;',
  "              fi",
  "            fi",
  "            exit 1",
  "            ;;",
  "        esac",
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
  '    if [ -f "$d/push-fail-rc" ]; then exit "$(cat "$d/push-fail-rc")"; fi',
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

async function runPreflight(bin: string, args: string[] = ["main"]): Promise<RunResult> {
  const cmd = new Deno.Command("bash", {
    args: [
      "-c",
      'PATH="$1:$PATH"; shift; exec bash "$@"',
      "preflight",
      bin,
      preflightPath,
      ...args,
    ],
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

// Run the fake git directly to assert HOW it models ref resolution: the
// unqualified origin/<x> form must resolve via a local head/tag (the bypass),
// while the qualified refs/remotes/origin/<x> form must not when the remote
// has no such branch (the fix).
async function runFakeGit(
  bin: string,
  ...args: string[]
): Promise<{ code: number; stdout: string }> {
  const cmd = new Deno.Command(`${bin}/git`, { args, stdout: "piped", stderr: "piped" });
  const out = await cmd.output();
  return { code: out.code, stdout: new TextDecoder().decode(out.stdout) };
}

async function expectReject(bin: string, args: string[], needle: string): Promise<void> {
  const r = await runPreflight(bin, args);
  assertEquals(r.code, 1, r.stderr);
  assertEquals(r.pushLog, "");
  assert(
    r.stderr.includes(needle),
    `stderr must include ${JSON.stringify(needle)}; got: ${r.stderr}`,
  );
}

Deno.test("landing-preflight OK: genuine update row asserts shas and pushes", async () => {
  // Real row shape "b70e456..60ecc75  HEAD -> main": FIRST sha is the OLD
  // value (remote tip), SECOND is the NEW value (HEAD).
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "remote-ref": "main\n",
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

Deno.test("landing-preflight OK: brand-new target ref with --new-branch pushes without a sha pair", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "dry-run-out": "To ../origin.git\n * [new branch]      HEAD -> main\n",
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin, ["--new-branch", "main"]);
    assertEquals(r.code, 0, r.stderr);
    realPushOnly(r.pushLog);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight typo target: non-existent origin/<target> exits 1 without --new-branch, no push", async () => {
  // No remote-tip file: origin/mian does not exist. The existence check must
  // fail closed BEFORE the dry-run, naming the typo, and never push — even
  // though the dry-run would have emitted a "* [new branch]" row for it.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "dry-run-out": "To ../origin.git\n * [new branch]      HEAD -> mian\n",
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin, ["mian"]);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("mian"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight OK branch: non-zero dry-run rc on an update row exits non-zero, no push (synthetic fixture)", async () => {
  // SYNTHETIC fixture: real git pairs rc=1 with a [rejected] row, never with a
  // genuine update row. This stubs exactly that impossible combination to
  // prove rc gates the push even when the output looks green.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "remote-ref": "main\n",
    "dry-run-out": `To ../origin.git\n   ${REMOTE_SHORT}..${HEAD_SHORT}  HEAD -> main\n`,
    "dry-run-rc": "1",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("non-zero"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight new-branch: non-zero dry-run rc exits non-zero, no push (synthetic fixture)", async () => {
  // SYNTHETIC fixture: real git would not exit non-zero while printing a
  // new-branch row; this stubs that combination so rc must still gate the push.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "dry-run-out": "To ../origin.git\n * [new branch]      HEAD -> main\n",
    "dry-run-rc": "1",
  });
  try {
    const r = await runPreflight(bin, ["--new-branch", "main"]);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("non-zero"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight real push fails after passing dry-run: exit 5, push attempted", async () => {
  // A rejecting pre-receive hook bypasses --dry-run (dryrc=0) but declines the
  // real push. Distinct from "never attempted": exit 5, with the push recorded.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "remote-ref": "main\n",
    "dry-run-out": `To ../origin.git\n   ${REMOTE_SHORT}..${HEAD_SHORT}  HEAD -> main\n`,
    "dry-run-rc": "0",
    "push-fail-rc": "1",
  });
  try {
    const r = await runPreflight(bin);
    assertEquals(r.code, 5, r.stderr);
    realPushOnly(r.pushLog);
    assert(r.stderr.includes("attempted"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight new branch: real push fails after passing dry-run exits 5", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "dry-run-out": "To ../origin.git\n * [new branch]      HEAD -> main\n",
    "dry-run-rc": "0",
    "push-fail-rc": "1",
  });
  try {
    const r = await runPreflight(bin, ["--new-branch", "main"]);
    assertEquals(r.code, 5, r.stderr);
    realPushOnly(r.pushLog);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight nothing-to-land: exit 2, no push", async () => {
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-tip": REMOTE,
    "remote-ref": "main\n",
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
    "remote-ref": "main\n",
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
    "remote-ref": "main\n",
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
    "remote-ref": "main\n",
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
    "remote-ref": "main\n",
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
    "remote-ref": "main\n",
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
    "remote-ref": "main\n",
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
  // An unescaped `..` would match ANY two separator characters, e.g. `XY`;
  // the escaped `\.\.` must not.
  const badSeparator = "   71213e5XYa495762  HEAD -> main\n";

  assert(await grepMatches("HEAD -> main", refusal, true), "loose substring must hit refusal");
  assert(
    !(await grepMatches(ANCHORED_UPDATE_ROW, refusal, false)),
    "anchored regex must miss refusal",
  );
  assert(await grepMatches(ANCHORED_UPDATE_ROW, update, false), "anchored regex must hit update");
  assert(
    !(await grepMatches(ANCHORED_UPDATE_ROW, badSeparator, false)),
    "escaped dots must not match arbitrary separator characters",
  );
});

// --- Second fix cycle: the three refuted bypasses plus the closed-name class ---

async function assertOriginLocalRefBypass(kind: "head" | "tag"): Promise<void> {
  const file = kind === "head" ? "local-heads" : "local-tags";
  const { dir, bin } = await makeScenario({
    head: HEAD,
    [file]: "origin/feat\n",
    "dry-run-out": "To ../origin.git\n * [new branch]      HEAD -> feat\n",
    "dry-run-rc": "0",
  });
  try {
    // Prove the fake models the bypass: the unqualified origin/feat resolves
    // via the local head/tag, while the qualified refs/remotes/origin/feat does
    // not (the remote has no feat). The script must query the qualified form.
    const unqualified = await runFakeGit(bin, "rev-parse", "--verify", "--quiet", "origin/feat");
    assertEquals(unqualified.code, 0, `unqualified origin/feat must resolve via the local ${kind}`);
    const qualified = await runFakeGit(
      bin,
      "rev-parse",
      "--verify",
      "--quiet",
      "refs/remotes/origin/feat",
    );
    assertEquals(qualified.code, 1, "refs/remotes/origin/feat must NOT resolve");
    const r = await runPreflight(bin, ["feat"]);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("does not exist"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("landing-preflight bypass: local branch origin/feat does not satisfy the qualified check, no push", async () => {
  await assertOriginLocalRefBypass("head");
});

Deno.test("landing-preflight bypass: local tag origin/feat does not satisfy the qualified check, no push", async () => {
  await assertOriginLocalRefBypass("tag");
});

Deno.test("landing-preflight bypass: target HEAD is refused before any git, no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["HEAD"], "symbolic ref");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight new-branch row without --new-branch: fail closed, no push (stale tracking ref)", async () => {
  // Models a stale remote-tracking ref: refs/remotes/origin/feat still exists
  // locally (so the existence check reads green) but the remote has since
  // deleted feat, so the dry-run reports "* [new branch]". Without
  // --new-branch this must NOT push.
  const { dir, bin } = await makeScenario({
    head: HEAD,
    "remote-ref": "feat\n",
    "remote-tip": REMOTE,
    "dry-run-out": "To ../origin.git\n * [new branch]      HEAD -> feat\n",
    "dry-run-rc": "0",
  });
  try {
    const r = await runPreflight(bin, ["feat"]);
    assertEquals(r.code, 1, r.stderr);
    assertEquals(r.pushLog, "");
    assert(r.stderr.includes("--new-branch"), r.stderr);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight target validation: */HEAD is refused as a symbolic ref, no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["feature/HEAD"], "symbolic ref");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight target validation: refs/heads/main is refused (not a branch name), no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["refs/heads/main"], "ref path");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight target validation: '..' is refused, no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["feat..branch"], "must not contain '..'");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight target validation: ':' is refused, no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["feat:branch"], "must not contain ':'");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight target validation: whitespace is refused, no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["feat branch"], "whitespace");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight target validation: characters outside the allowed set are refused, no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["feat@branch"], "allowed characters");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight target validation: leading '-' is refused (as an unknown option), no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["-feat"], "unknown option");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight multiple positional targets: usage error, no push", async () => {
  const { dir, bin } = await makeScenario({ head: HEAD });
  try {
    await expectReject(bin, ["branchA", "branchB"], "too many targets");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("landing-preflight new-branch row: anchored regex misses a remote MOTD line containing the text", async () => {
  const motd = "remote: staging hook says * [new branch] is coming\n";
  const row = " * [new branch]      HEAD -> main\n";
  assert(
    !(await grepMatches(ANCHORED_NEW_BRANCH_ROW, motd, false)),
    "a remote MOTD line must not match the anchored new-branch regex",
  );
  assert(
    await grepMatches(ANCHORED_NEW_BRANCH_ROW, row, false),
    "the real new-branch row must match",
  );
});
