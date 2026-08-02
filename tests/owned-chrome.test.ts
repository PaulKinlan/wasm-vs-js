import { assertEquals, assertRejects } from "./assert.ts";
import { assertOnlyOwned, createLedger, teardownLedger } from "../lib/process-ledger.ts";
import { waitDevToolsActivePort } from "../lib/owned-chrome.ts";
async function fakeProc(root: string, pid: number, ppid: number) {
  await Deno.mkdir(`${root}/${pid}`, { recursive: true });
  await Deno.writeTextFile(`${root}/${pid}/stat`, `${pid} (fake) S ${ppid} 0 0 0`);
}
Deno.test("owned ledger discovers descendants but never accepts foreign PID", async () => {
  const proc = await Deno.makeTempDir();
  try {
    await fakeProc(proc, 100, 1);
    await fakeProc(proc, 101, 100);
    await fakeProc(proc, 999, 1);
    const ledger = await createLedger(100, "/tmp/wasm-vs-js-owned-profiles/test", proc);
    assertEquals(ledger.ownedPids, [100, 101]);
    let failed = false;
    try {
      assertOnlyOwned([999], ledger);
    } catch {
      failed = true;
    }
    assertEquals(failed, true);
  } finally {
    await Deno.remove(proc, { recursive: true });
  }
});
Deno.test("DevToolsActivePort is profile-bound, validated and timeout-bounded", async () => {
  const profile = `/tmp/wasm-vs-js-owned-profiles/test-${crypto.randomUUID()}`;
  await Deno.mkdir(profile, { recursive: true });
  try {
    setTimeout(
      () => Deno.writeTextFile(`${profile}/DevToolsActivePort`, `9222\n/devtools/browser/abc\n`),
      20,
    );
    assertEquals(await waitDevToolsActivePort(profile, 500), 9222);
    await Deno.writeTextFile(`${profile}/DevToolsActivePort`, `bad\nwrong\n`);
    await assertRejects(() => waitDevToolsActivePort(profile, 50), "invalid");
  } finally {
    await Deno.remove(profile, { recursive: true });
  }
  await assertRejects(
    () =>
      waitDevToolsActivePort(`/tmp/wasm-vs-js-owned-profiles/missing-${crypto.randomUUID()}`, 30),
    "timeout",
  );
});
Deno.test("normal simulated teardown removes exact profile; hung cleanup reports failure and preserves foreign process", async () => {
  const profile = `/tmp/wasm-vs-js-owned-profiles/test-${crypto.randomUUID()}`;
  await Deno.mkdir(profile, { recursive: true });
  const alive = new Set([100, 101, 999]);
  const ledger = {
    rootPid: 100,
    ownedPids: [100, 101],
    profileRoot: profile,
    recordedAt: new Date().toISOString(),
  };
  const result = await teardownLedger(ledger, {
    exists: (p) => alive.has(p),
    kill: (p) => alive.delete(p),
  });
  assertEquals(result.cleaned, true);
  assertEquals(alive.has(999), true);
  const hungProfile = `/tmp/wasm-vs-js-owned-profiles/hung-${crypto.randomUUID()}`;
  await Deno.mkdir(hungProfile, { recursive: true });
  const hung = await teardownLedger({
    ...ledger,
    ownedPids: [200],
    rootPid: 200,
    profileRoot: hungProfile,
  }, { exists: () => true, kill: () => {}, removeProfile: false });
  assertEquals(hung.cleaned, false);
  await Deno.remove(hungProfile, { recursive: true });
});
Deno.test("wrong profile root fails before process ownership", async () => {
  await assertRejects(() => createLedger(10, "/tmp/foreign-profile"), "outside ownership");
});
