import { browserWebSocketUrl, CdpClient } from "./cdp-client.ts";
import { StagedChrome, verifyStagedChrome } from "./chrome-stage.ts";
import {
  assertProfileIdentity,
  CgroupLedger,
  executableSnapshot,
  prepareProfile,
  readCgroupMembers,
  refreshLedger,
  removeOwnedProfile,
} from "./process-ledger.ts";

export type DevToolsEndpoint = { port: number; browserPath: string };
export type CommandResult = { success: boolean; code: number; stdout: string; stderr: string };
export type CommandAdapter = (command: string, args: string[]) => Promise<CommandResult>;
const realCommand: CommandAdapter = async (command, args) => {
  const out = await new Deno.Command(command, { args, stdout: "piped", stderr: "piped" }).output();
  return {
    success: out.success,
    code: out.code,
    stdout: new TextDecoder().decode(out.stdout),
    stderr: new TextDecoder().decode(out.stderr),
  };
};
export type BrowserClient = Pick<CdpClient, "send" | "on" | "close">;
export type OwnedChrome = {
  ledger: CgroupLedger;
  port: number;
  browserPath: string;
  browser: BrowserClient;
  version: Record<string, unknown>;
  arguments: string[];
  binarySha256: string;
  resolvedBinary: string;
  command: CommandAdapter;
};
export async function waitDevToolsActivePort(
  profileRoot: string,
  timeoutMs = 10_000,
): Promise<DevToolsEndpoint> {
  const path = `${profileRoot}/DevToolsActivePort`, deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const info = await Deno.lstat(path);
      if (info.isSymlink || !info.isFile) throw new Error("unsafe DevToolsActivePort");
      const lines = (await Deno.readTextFile(path)).trim().split(/\r?\n/),
        port = Number(lines[0]),
        browserPath = lines[1] ?? "";
      if (
        Number.isSafeInteger(port) && port > 0 && port <= 65535 &&
        /^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(browserPath) && lines.length === 2
      ) return { port, browserPath };
      throw new Error("invalid DevToolsActivePort");
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Chrome startup timeout");
}
function numeric(value: number | bigint | null | undefined, label: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} unavailable`);
  return n;
}
async function cgroupIdentity(path: string) {
  const info = await Deno.lstat(path);
  if (info.isSymlink || !info.isDirectory || await Deno.realPath(path) !== path) {
    throw new Error("unsafe cgroup identity");
  }
  return { dev: numeric(info.dev, "cgroup dev"), ino: numeric(info.ino, "cgroup inode") };
}
function parseShow(text: string): Record<string, string> {
  return Object.fromEntries(
    text.trim().split("\n").filter(Boolean).map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
  );
}
async function showUnit(command: CommandAdapter, unit: string) {
  const result = await command("/usr/bin/systemctl", [
    "--user",
    "show",
    unit,
    "--property=MainPID,ControlGroup,ActiveState,SubState,LoadState",
  ]);
  if (!result.success) throw new Error(`systemd unit unavailable: ${result.stderr.trim()}`);
  return parseShow(result.stdout);
}
async function waitUnit(command: CommandAdapter, unit: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await showUnit(command, unit),
      mainPid = Number(state.MainPID),
      controlGroup = state.ControlGroup ?? "";
    if (
      Number.isSafeInteger(mainPid) && mainPid > 1 && /^\/[^\s]+$/.test(controlGroup) &&
      state.ActiveState === "active"
    ) return { mainPid, controlGroup };
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("systemd Chrome service startup timeout");
}
async function listenerInode(port: number, procRoot = "/proc"): Promise<string> {
  const wanted = port.toString(16).toUpperCase().padStart(4, "0");
  for (const file of [`${procRoot}/net/tcp`, `${procRoot}/net/tcp6`]) {
    try {
      for (const line of (await Deno.readTextFile(file)).trim().split("\n").slice(1)) {
        const fields = line.trim().split(/\s+/),
          [address, p] = (fields[1] ?? "").split(":"),
          state = fields[3],
          inode = fields[9];
        const loopback = address === "0100007F" || address === "00000000000000000000000001000000";
        if (p === wanted && state === "0A" && loopback && /^\d+$/.test(inode)) return inode;
      }
    } catch { /* unavailable */ }
  }
  throw new Error("DevTools listener socket not found on loopback");
}
export async function assertListenerOwned(
  port: number,
  ledger: CgroupLedger,
  procRoot = "/proc",
): Promise<void> {
  const members = await readCgroupMembers(ledger),
    wanted = `socket:[${await listenerInode(port, procRoot)}]`;
  for (const pid of members) {
    try {
      for await (const fd of Deno.readDir(`${procRoot}/${pid}/fd`)) {
        try {
          if (await Deno.readLink(`${procRoot}/${pid}/fd/${fd.name}`) === wanted) return;
        } catch { /* raced */ }
      }
    } catch { /* raced */ }
  }
  throw new Error("DevTools listener is not owned by exact Chrome cgroup");
}
async function commandLine(pid: number, procRoot = "/proc"): Promise<string[]> {
  return new TextDecoder().decode(await Deno.readFile(`${procRoot}/${pid}/cmdline`)).split("\0")
    .filter(Boolean);
}
async function cleanupUnit(command: CommandAdapter, ledger: CgroupLedger, removeProfile = true) {
  const mapped = await showUnit(command, ledger.unit);
  if (mapped.LoadState === "not-found" || mapped.ControlGroup !== ledger.controlGroup) {
    throw new Error("owned Chrome unit mapping unavailable during cleanup");
  }
  const cgroup = await cgroupIdentity(ledger.cgroupPath);
  if (cgroup.dev !== ledger.cgroupDev || cgroup.ino !== ledger.cgroupIno) {
    throw new Error("owned Chrome cgroup identity changed before cleanup");
  }
  const killed = await command("/usr/bin/systemctl", [
    "--user",
    "kill",
    "--kill-whom=all",
    "--signal=KILL",
    ledger.unit,
  ]);
  if (!killed.success) throw new Error(`owned Chrome unit kill failed: ${killed.stderr.trim()}`);
  const stopped = await command("/usr/bin/systemctl", ["--user", "stop", ledger.unit]);
  if (!stopped.success) throw new Error(`owned Chrome unit stop failed: ${stopped.stderr.trim()}`);
  const deadline = Date.now() + 5_000;
  let remaining: number[] = [], state: Record<string, string> = {};
  while (Date.now() < deadline) {
    remaining = await readCgroupMembers(ledger).catch((e) => {
      if (e instanceof Deno.errors.NotFound) return [];
      throw e;
    });
    state = await showUnit(command, ledger.unit);
    const inactive = ["inactive", "failed"].includes(state.ActiveState) ||
      state.LoadState === "not-found";
    if (!remaining.length && inactive) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (
    remaining.length ||
    (!(["inactive", "failed"].includes(state.ActiveState ?? "")) && state.LoadState !== "not-found")
  ) {
    throw new Error("owned Chrome cgroup cleanup failed");
  }
  const after = await executableSnapshot(ledger.executable.path);
  if (
    after.path !== ledger.executable.path || after.dev !== ledger.executable.dev ||
    after.ino !== ledger.executable.ino || after.sha256 !== ledger.executable.sha256
  ) throw new Error("Chrome executable changed across launch");
  if (removeProfile) await removeOwnedProfile(ledger.profile);
  return {
    cleaned: true,
    remaining: [],
    identityMismatches: [] as number[],
    stoppedAt: new Date().toISOString(),
  };
}
export async function launchOwnedChrome(options: {
  stagedChrome: StagedChrome;
  profileRoot: string;
  extraArguments?: string[];
  timeoutMs?: number;
  beforeSpawn?: () => void;
  onSpawn?: (pid: number) => void;
  command?: CommandAdapter;
  unitName?: string;
  connect?: (url: string) => BrowserClient;
  procRoot?: string;
  cgroupRoot?: string;
  endpoint?: (profileRoot: string, timeoutMs: number) => Promise<DevToolsEndpoint>;
  listenerAssertion?: (port: number, ledger: CgroupLedger, procRoot: string) => Promise<void>;
  discoverWebSocket?: (port: number, browserPath: string) => Promise<string>;
}): Promise<OwnedChrome> {
  const command = options.command ?? realCommand,
    profile = await prepareProfile(options.profileRoot);
  await verifyStagedChrome(options.stagedChrome).catch(async (error) => {
    await removeOwnedProfile(profile);
    throw error;
  });
  const binary = await executableSnapshot(options.stagedChrome.binary).catch(async (error) => {
    await removeOwnedProfile(profile);
    throw error;
  });
  if (binary.sha256 !== options.stagedChrome.binarySha256) {
    await removeOwnedProfile(profile);
    throw new Error("staged Chrome binary hash mismatch");
  }
  const unit = options.unitName ?? `wasm-vs-js-${crypto.randomUUID().replaceAll("-", "")}.service`;
  if (!/^wasm-vs-js-[a-z0-9]{16,64}\.service$/.test(unit)) {
    await removeOwnedProfile(profile);
    throw new Error("unsafe systemd unit name");
  }
  const launchArguments = [
    `--user-data-dir=${options.profileRoot}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    ...(options.extraArguments ?? []),
    "about:blank",
  ];
  let ledger: CgroupLedger | undefined;
  let systemdRunSucceeded = false;
  try {
    const absent = await showUnit(command, unit);
    if (absent.LoadState !== "not-found") throw new Error("systemd unit name already exists");
    options.beforeSpawn?.();
    const started = await command("/usr/bin/systemd-run", [
      "--user",
      `--unit=${unit}`,
      "--collect",
      "--quiet",
      "--property=Type=exec",
      "--property=KillMode=control-group",
      "--property=CollectMode=inactive-or-failed",
      "--",
      binary.path,
      ...launchArguments,
    ]);
    if (!started.success) throw new Error(`systemd Chrome launch failed: ${started.stderr.trim()}`);
    systemdRunSucceeded = true;
    options.onSpawn?.(0);
    const running = await waitUnit(command, unit, options.timeoutMs ?? 10_000);
    const cgroupPath = `${options.cgroupRoot ?? "/sys/fs/cgroup"}${running.controlGroup}`,
      cgroup = await cgroupIdentity(cgroupPath);
    const procRoot = options.procRoot ?? "/proc",
      argv = await commandLine(running.mainPid, procRoot),
      procExe = await Deno.realPath(`${procRoot}/${running.mainPid}/exe`);
    if (
      procExe !== binary.path || argv[0] !== binary.path ||
      !launchArguments.every((arg) => argv.includes(arg))
    ) throw new Error("systemd Chrome argv/executable mismatch");
    ledger = {
      unit,
      controlGroup: running.controlGroup,
      cgroupPath,
      cgroupDev: cgroup.dev,
      cgroupIno: cgroup.ino,
      mainPid: running.mainPid,
      members: [],
      membershipSnapshots: [],
      executable: binary,
      commandLine: argv,
      profile,
      profileRoot: profile.profileRoot,
      launchedAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
    };
    ledger = await refreshLedger(ledger);
    if (!ledger.members.includes(running.mainPid)) {
      throw new Error("Chrome main PID absent from exact cgroup");
    }
    const endpoint = await (options.endpoint ?? waitDevToolsActivePort)(
        profile.profileRoot,
        options.timeoutMs ?? 10_000,
      ),
      check = () =>
        (options.listenerAssertion ?? assertListenerOwned)(endpoint.port, ledger!, procRoot);
    await check();
    const ws = await (options.discoverWebSocket ?? browserWebSocketUrl)(
      endpoint.port,
      endpoint.browserPath,
    );
    await check();
    const browser = options.connect?.(ws) ?? new CdpClient(ws);
    const version = await browser.send("Browser.getVersion");
    await check();
    const effective = (await browser.send("Browser.getBrowserCommandLine")).arguments;
    if (
      !Array.isArray(effective) ||
      !launchArguments.filter((x) => x.startsWith("--")).every((x) => effective.includes(x))
    ) throw new Error("Chrome command line mismatch");
    await assertProfileIdentity(profile);
    return {
      ledger,
      port: endpoint.port,
      browserPath: endpoint.browserPath,
      browser,
      version,
      arguments: launchArguments,
      binarySha256: binary.sha256,
      resolvedBinary: binary.path,
      command,
    };
  } catch (error) {
    if (ledger) {
      await cleanupUnit(command, ledger).catch((cleanup) => {
        throw new Error(`Chrome startup containment cleanup failed: ${cleanup}`);
      });
    } else if (systemdRunSucceeded) {
      // The launch is counted, but without a positively mapped cgroup it is unsafe to target the
      // unit name or remove the live profile. Retain both as immutable containment evidence.
      throw new Error(`Chrome startup containment blocked before unit mapping: ${error}`);
    } else {
      // systemd-run did not create an owned unit, so no process may be targeted.
      await removeOwnedProfile(profile).catch((cleanup) => {
        throw new Error(`Chrome pre-launch profile cleanup failed: ${cleanup}`);
      });
    }
    throw error;
  }
}
export async function closeOwnedChrome(owned: OwnedChrome) {
  await owned.browser.send("Browser.close", {}, undefined, 2_000).catch(() => {});
  owned.browser.close();
  return await cleanupUnit(owned.command, owned.ledger);
}
