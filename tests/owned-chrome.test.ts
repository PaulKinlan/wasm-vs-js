import { assertEquals, assertRejects } from "./assert.ts";
import {
  assertLedgerProcessesCurrent,
  assertOnlyOwned,
  assertProfileIdentity,
  createLedger,
  prepareProfile,
  readProcessIdentity,
  removeOwnedProfile,
  teardownLedger,
} from "../lib/process-ledger.ts";
import { waitDevToolsActivePort } from "../lib/owned-chrome.ts";

async function fakeProc(
  root: string,
  pid: number,
  ppid: number,
  profile: string,
  exe: string,
  start = String(pid),
) {
  await Deno.mkdir(`${root}/${pid}/fd`, { recursive: true });
  await Deno.writeTextFile(
    `${root}/${pid}/stat`,
    `${pid} (fake chrome) S ${ppid} 100 100 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 ${start}\n`,
  );
  await Deno.writeFile(
    `${root}/${pid}/cmdline`,
    new TextEncoder().encode(`${exe}\0--user-data-dir=${profile}\0`),
  );
  await Deno.symlink(exe, `${root}/${pid}/exe`);
}
async function fixture() {
  const token = `test-${crypto.randomUUID()}`,
    profilePath = `/tmp/wasm-vs-js-owned-profiles/${token}/launch`;
  const profile = await prepareProfile(profilePath),
    proc = await Deno.makeTempDir(),
    exe = `${proc}/chrome`;
  await Deno.writeTextFile(exe, "fake chrome executable");
  await fakeProc(proc, 100, 1, profilePath, exe, "1000");
  await fakeProc(proc, 101, 100, profilePath, exe, "1001");
  await Deno.mkdir(`${proc}/999`, { recursive: true });
  await Deno.writeTextFile(
    `${proc}/999/stat`,
    `999 (foreign) S 1 999 999 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 9999\n`,
  );
  return { profile, profilePath, proc, exe };
}
async function cleanupFixture(value: Awaited<ReturnType<typeof fixture>>) {
  await Deno.remove(value.proc, { recursive: true }).catch(() => {});
  await Deno.remove(value.profile.ownershipRoot, { recursive: true }).catch(() => {});
}
Deno.test("owned ledger records immutable process identity and denies foreign or reused PID", async () => {
  const f = await fixture();
  try {
    const ledger = await createLedger(100, f.profile, f.proc);
    assertEquals(ledger.ownedPids, [100, 101]);
    assertEquals(ledger.processes[0].startTimeTicks, "1000");
    assertEquals(ledger.processes[0].executable.sha256.length, 64);
    let denied = false;
    try {
      assertOnlyOwned([999], ledger);
    } catch {
      denied = true;
    }
    assertEquals(denied, true);
    await Deno.writeTextFile(
      `${f.proc}/100/stat`,
      `100 (reused) S 1 100 100 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 2000\n`,
    );
    const signalled: number[] = [];
    const result = await teardownLedger(ledger, {
      procRoot: f.proc,
      removeProfile: false,
      kill: (pid) => signalled.push(pid),
      sleep: async () => {},
    });
    assertEquals(signalled.includes(100), false);
    assertEquals(result.cleaned, false);
  } finally {
    await cleanupFixture(f);
  }
});
Deno.test("owned descendant ancestry survives missing profile/group flags and executable rewrites deny signalling", async () => {
  const f = await fixture();
  try {
    await Deno.writeTextFile(
      `${f.proc}/101/stat`,
      `101 (detached child) S 100 900 901 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1001\n`,
    );
    await Deno.writeFile(
      `${f.proc}/101/cmdline`,
      new TextEncoder().encode(`${f.exe}\0--type=renderer\0`),
    );
    const ledger = await createLedger(100, f.profile, f.proc);
    assertEquals(ledger.ownedPids, [100, 101]);
    await assertLedgerProcessesCurrent(ledger, f.proc);
    // In-place replacement preserves dev/inode but must change the freshly recomputed digest.
    await Deno.writeTextFile(f.exe, "rewritten executable bytes");
    const signalled: number[] = [];
    const result = await teardownLedger(ledger, {
      procRoot: f.proc,
      removeProfile: false,
      kill: (pid) => signalled.push(pid),
      sleep: async () => {},
    });
    assertEquals(signalled, []);
    assertEquals(result.cleaned, false);
    assertEquals(result.identityMismatches.length > 0, true);
  } finally {
    await cleanupFixture(f);
  }
});

Deno.test("DevToolsActivePort retains exact port and browser path and rejects symlinks", async () => {
  const profile = `/tmp/wasm-vs-js-owned-profiles/test-${crypto.randomUUID()}`;
  await Deno.mkdir(profile, { recursive: true });
  try {
    setTimeout(
      () => Deno.writeTextFile(`${profile}/DevToolsActivePort`, `9222\n/devtools/browser/abc\n`),
      20,
    );
    assertEquals(await waitDevToolsActivePort(profile, 500), {
      port: 9222,
      browserPath: "/devtools/browser/abc",
    });
    await Deno.writeTextFile(`${profile}/bad`, "9222\n/devtools/browser/abc\n");
    await Deno.remove(`${profile}/DevToolsActivePort`);
    await Deno.symlink(`${profile}/bad`, `${profile}/DevToolsActivePort`);
    await assertRejects(() => waitDevToolsActivePort(profile, 50), "unsafe");
  } finally {
    await Deno.remove(profile, { recursive: true });
  }
});
Deno.test("teardown repeatedly revalidates identity, removes only verified profile, and discovers late child", async () => {
  const f = await fixture();
  try {
    const ledger = await createLedger(100, f.profile, f.proc), signalled: number[] = [];
    await fakeProc(f.proc, 102, 100, f.profilePath, f.exe, "1002");
    const result = await teardownLedger(ledger, {
      procRoot: f.proc,
      kill: (pid) => {
        signalled.push(pid);
        Deno.removeSync(`${f.proc}/${pid}`, { recursive: true });
      },
      sleep: async () => {},
    });
    assertEquals(result.cleaned, true);
    assertEquals(signalled.includes(102), true);
    await assertRejects(() => Deno.lstat(f.profilePath), "No such file");
  } finally {
    await cleanupFixture(f);
  }
});
Deno.test("profile containment rejects symlinked parent and identity replacement", async () => {
  const token = `link-${crypto.randomUUID()}`, target = await Deno.makeTempDir();
  await Deno.symlink(target, `/tmp/wasm-vs-js-owned-profiles/${token}`);
  try {
    await assertRejects(
      () => prepareProfile(`/tmp/wasm-vs-js-owned-profiles/${token}/launch`),
      "unsafe",
    );
  } finally {
    await Deno.remove(`/tmp/wasm-vs-js-owned-profiles/${token}`);
    await Deno.remove(target, { recursive: true });
  }
  const f = await fixture();
  try {
    await Deno.remove(f.profilePath, { recursive: true });
    await Deno.mkdir(f.profilePath);
    await assertRejects(() => assertProfileIdentity(f.profile), "identity changed");
    await assertRejects(() => removeOwnedProfile(f.profile), "identity changed");
    await assertRejects(() => readProcessIdentity(100, "/tmp/wrong", f.proc), "profile");
  } finally {
    await cleanupFixture(f);
  }
});
