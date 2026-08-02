import { assertEquals, assertRejects } from "./assert.ts";
import {
  assertOnlyOwned,
  assertProfileIdentity,
  prepareProfile,
  readCgroupMembers,
  removeOwnedProfile,
  setProfileRemovalRaceHookForTest,
} from "../lib/process-ledger.ts";
import {
  assertRunningExecutable,
  closeOwnedChrome,
  launchOwnedChrome,
  waitDevToolsActivePort,
} from "../lib/owned-chrome.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";

function ids(info: Deno.FileInfo) {
  return { dev: Number(info.dev), ino: Number(info.ino) };
}
Deno.test("exact cgroup membership owns detached descendants and denies foreign processes", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${root}/cgroup.procs`, "700\n702\n701\n");
    const identity = ids(await Deno.lstat(root));
    const ledger = { cgroupPath: root, cgroupDev: identity.dev, cgroupIno: identity.ino };
    assertEquals(await readCgroupMembers(ledger), [700, 701, 702]);
    assertOnlyOwned([700, 702], { ...ledger, members: [700, 701, 702] } as never);
    let denied = false;
    try {
      assertOnlyOwned([999], { ...ledger, members: [700, 701, 702] } as never);
    } catch {
      denied = true;
    }
    assertEquals(denied, true);
    const replacement = await Deno.makeTempDir();
    await Deno.rename(root, `${replacement}/old`);
    await Deno.mkdir(root);
    await Deno.writeTextFile(`${root}/cgroup.procs`, "999\n");
    await assertRejects(() => readCgroupMembers(ledger), "cgroup identity changed");
    await Deno.remove(`${replacement}/old`, { recursive: true });
    await Deno.remove(replacement, { recursive: true });
  } finally {
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
});

Deno.test("private profile cleanup never follows symlink entries", async () => {
  const token = `test-${crypto.randomUUID()}`,
    profilePath = `/tmp/wasm-vs-js-owned-profiles/${token}/launch`,
    outside = await Deno.makeTempDir();
  await Deno.writeTextFile(`${outside}/keep`, "foreign");
  const profile = await prepareProfile(profilePath);
  try {
    await Deno.mkdir(`${profilePath}/nested`);
    await Deno.writeTextFile(`${profilePath}/nested/owned`, "owned");
    await Deno.symlink(outside, `${profilePath}/outside-link`);
    await removeOwnedProfile(profile);
    assertEquals(await Deno.readTextFile(`${outside}/keep`), "foreign");
    await assertRejects(() => Deno.lstat(profilePath), "No such file");
  } finally {
    await Deno.remove(profile.ownershipRoot, { recursive: true }).catch(() => {});
    await Deno.remove(outside, { recursive: true });
  }
});

Deno.test("fd-relative profile deletion rejects final-window root replacement", async () => {
  const root = `/tmp/wasm-vs-js-owned-profiles/race-${crypto.randomUUID()}/launch`,
    outside = await Deno.makeTempDir(),
    profile = await prepareProfile(root);
  await Deno.mkdir(`${root}/nested`, { mode: 0o700 });
  await Deno.writeTextFile(`${root}/nested/owned`, "owned");
  await Deno.writeTextFile(`${outside}/keep`, "foreign");
  let raced = false;
  setProfileRemovalRaceHookForTest(async (path) => {
    if (raced || path !== root) return;
    raced = true;
    await Deno.rename(root, `${profile.ownershipRoot}/held`);
    await Deno.symlink(outside, root);
  });
  try {
    await assertRejects(() => removeOwnedProfile(profile), "fd-relative profile removal failed");
    assertEquals(await Deno.readTextFile(`${outside}/keep`), "foreign");
  } finally {
    setProfileRemovalRaceHookForTest();
    await Deno.remove(profile.ownershipRoot, { recursive: true }).catch(() => {});
    await Deno.remove(outside, { recursive: true });
  }
});

Deno.test("profile containment rejects symlink parent and inode replacement", async () => {
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
  const root = `/tmp/wasm-vs-js-owned-profiles/replaced-${crypto.randomUUID()}/launch`,
    profile = await prepareProfile(root);
  try {
    await Deno.remove(root, { recursive: true });
    await Deno.mkdir(root);
    await assertRejects(() => assertProfileIdentity(profile), "mismatch");
    await assertRejects(() => removeOwnedProfile(profile), "mismatch");
  } finally {
    await Deno.remove(profile.ownershipRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test("running executable swap is rejected before navigation", () => {
  assertRunningExecutable(
    { dev: 1, ino: 2, sha256: "a".repeat(64) },
    { dev: 1, ino: 2, sha256: "a".repeat(64) },
  );
  let denied = false;
  try {
    assertRunningExecutable(
      { dev: 1, ino: 2, sha256: "a".repeat(64) },
      { dev: 1, ino: 2, sha256: "b".repeat(64) },
    );
  } catch {
    denied = true;
  }
  assertEquals(denied, true);
});

Deno.test("DevToolsActivePort retains exact port/path and rejects symlinks", async () => {
  const profile = await Deno.makeTempDir();
  try {
    setTimeout(
      () => Deno.writeTextFile(`${profile}/DevToolsActivePort`, "9222\n/devtools/browser/abc\n"),
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

Deno.test("production systemd launch/teardown uses only an injected exact-unit adapter", async () => {
  const root = await Deno.makeTempDir(),
    proc = `${root}/proc`,
    cgroups = `${root}/cgroup`,
    stageRoot = `${root}/stage`,
    binary = `${stageRoot}/chrome`,
    unit = "wasm-vs-js-0123456789abcdef.service",
    mainPid = 700;
  const profileRoot = `/tmp/wasm-vs-js-owned-profiles/fake-${crypto.randomUUID()}/launch`;
  await Deno.mkdir(stageRoot);
  await Deno.writeTextFile(binary, "fake chrome");
  const expectedSha256 = await sha256Hex(await Deno.readFile(binary));
  await Deno.chmod(binary, 0o500);
  await Deno.chmod(stageRoot, 0o500);
  const stageIdentity = ids(await Deno.lstat(stageRoot));
  const stagedChrome = {
    root: stageRoot,
    binary,
    binarySha256: expectedSha256,
    files: { chrome: expectedSha256 },
    manifestSha256: await sha256Hex(canonicalize({ chrome: expectedSha256 })),
    rootDev: stageIdentity.dev,
    rootIno: stageIdentity.ino,
  };
  const calls: Array<{ command: string; args: string[] }> = [];
  const lifecycle: string[] = [];
  let active = true, started = false;
  const fakeCommand = async (command: string, args: string[]) => {
    calls.push({ command, args });
    lifecycle.push(
      command.endsWith("systemd-run") ? "systemd-run" : args.includes("show") ? "show" : "other",
    );
    if (command.endsWith("systemd-run")) {
      started = true;
      const launchArgs = args.slice(args.indexOf("--") + 1);
      await Deno.mkdir(`${proc}/${mainPid}`, { recursive: true });
      await Deno.writeFile(
        `${proc}/${mainPid}/cmdline`,
        new TextEncoder().encode(launchArgs.join("\0") + "\0"),
      );
      await Deno.symlink(binary, `${proc}/${mainPid}/exe`);
      await Deno.mkdir(`${cgroups}/test.slice/${unit}`, { recursive: true });
      await Deno.writeTextFile(`${cgroups}/test.slice/${unit}/cgroup.procs`, `${mainPid}\n701\n`);
      await Deno.writeTextFile(`${cgroups}/test.slice/${unit}/cgroup.kill`, "");
      return { success: true, code: 0, stdout: "", stderr: "" };
    }
    if (args.includes("show")) {
      return {
        success: true,
        code: 0,
        stdout: started
          ? `MainPID=${mainPid}\nControlGroup=/test.slice/${unit}\nActiveState=${
            active ? "active" : "inactive"
          }\nSubState=${
            active ? "running" : "dead"
          }\nLoadState=loaded\nInvocationID=0123456789abcdef0123456789abcdef\n`
          : "MainPID=0\nControlGroup=\nActiveState=inactive\nSubState=dead\nLoadState=not-found\nInvocationID=\n",
        stderr: "",
      };
    }
    if (args.includes("kill")) {
      await Deno.writeTextFile(`${cgroups}/test.slice/${unit}/cgroup.procs`, "");
      return { success: true, code: 0, stdout: "", stderr: "" };
    }
    if (args.includes("stop")) active = false;
    return { success: true, code: 0, stdout: "", stderr: "" };
  };
  const expectedArguments = [
    `--user-data-dir=${profileRoot}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "about:blank",
  ];
  const browser = {
    send: (method: string) =>
      Promise.resolve(
        method === "Browser.getVersion"
          ? { product: "Chrome/150.0.7871.24" }
          : method === "Browser.getBrowserCommandLine"
          ? { arguments: expectedArguments }
          : {},
      ),
    on: () => () => {},
    close: () => {},
  };
  try {
    const owned = await launchOwnedChrome({
      stagedChrome,
      profileRoot,
      unitName: unit,
      command: fakeCommand,
      onSpawn: () => lifecycle.push("launch-attempted"),
      procRoot: proc,
      cgroupRoot: cgroups,
      endpoint: () => Promise.resolve({ port: 9222, browserPath: "/devtools/browser/fake" }),
      listenerAssertion: () => Promise.resolve(),
      discoverWebSocket: () => Promise.resolve("ws://127.0.0.1:9222/devtools/browser/fake"),
      connect: () => browser,
    });
    assertEquals(owned.arguments, expectedArguments);
    assertEquals(lifecycle.slice(0, 4), ["show", "systemd-run", "launch-attempted", "show"]);
    await Deno.writeTextFile(`${cgroups}/test.slice/${unit}/cgroup.procs`, "");
    await closeOwnedChrome(owned);
    assertEquals(calls.some((call) => call.command === "/usr/bin/systemd-run"), true);
    assertEquals(calls.some((call) => call.args.includes("kill")), false);
    assertEquals(calls.some((call) => call.args.includes("stop")), true);

    const deniedCalls: string[][] = [];
    const deniedProfile = `/tmp/wasm-vs-js-owned-profiles/denied-${crypto.randomUUID()}/launch`;
    await assertRejects(
      () =>
        launchOwnedChrome({
          stagedChrome,
          profileRoot: deniedProfile,
          command: async (command, args) => {
            await Promise.resolve();
            deniedCalls.push([command, ...args]);
            if (args.includes("show")) {
              return {
                success: true,
                code: 0,
                stderr: "",
                stdout:
                  "MainPID=0\nControlGroup=\nActiveState=inactive\nSubState=dead\nLoadState=not-found\nInvocationID=\n",
              };
            }
            return { success: false, code: 1, stdout: "", stderr: "launch denied" };
          },
        }),
      "launch failed",
    );
    assertEquals(deniedCalls.some((call) => call.includes("kill") || call.includes("stop")), false);
  } finally {
    await Deno.remove(root, { recursive: true }).catch(() => {});
    await Deno.remove(profileRoot.slice(0, profileRoot.lastIndexOf("/")), { recursive: true })
      .catch(() => {});
  }
});
