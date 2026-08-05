import { browserWebSocketUrl, CdpClient } from "./cdp-client.ts";
import { StagedChrome, verifyStagedChrome } from "./chrome-stage.ts";
import {
  assertProfileIdentity,
  CgroupLedger,
  executableSnapshot,
  prepareProfile,
  ProfileReservation,
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
  cleanupPromise?: Promise<CleanupResult>;
};
export type CleanupResult = {
  cleaned: true;
  remaining: number[];
  identityMismatches: number[];
  stoppedAt: string;
};

export class ChromeLaunchLifecycleError extends Error {
  constructor(
    message: string,
    readonly launchBegan: boolean,
    readonly cleanupResolved: boolean,
    cause: unknown,
  ) {
    super(message, { cause });
    this.name = "ChromeLaunchLifecycleError";
  }
}
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
    "--property=MainPID,ControlGroup,ActiveState,SubState,LoadState,InvocationID",
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
    const invocationId = state.InvocationID ?? "";
    if (
      Number.isSafeInteger(mainPid) && mainPid > 1 && /^\/[^\s]+$/.test(controlGroup) &&
      /^[a-f0-9]{32}$/.test(invocationId) && state.ActiveState === "active"
    ) return { mainPid, controlGroup, invocationId };
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
export function assertRunningExecutable(
  reviewed: { dev: number; ino: number; sha256: string },
  running: { dev: number; ino: number; sha256: string },
): void {
  if (
    running.dev !== reviewed.dev || running.ino !== reviewed.ino ||
    running.sha256 !== reviewed.sha256
  ) throw new Error("running Chrome executable differs from reviewed staged binary");
}

async function processesInCgroup(cgroupPath: string): Promise<number[]> {
  // Walk /proc for processes whose cgroup membership includes the unit's
  // control group (systemd-run --user places the whole unit tree there).
  const wanted = cgroupPath.replace(/^\/sys\/fs\/cgroup\/?/, "");
  const pids: number[] = [];
  for await (const entry of Deno.readDir("/proc")) {
    if (!/^\d+$/.test(entry.name)) continue;
    try {
      const cgroup = new TextDecoder().decode(
        await Deno.readFile(`/proc/${entry.name}/cgroup`),
      );
      if (cgroup.split("\n").some((line) => line.endsWith(wanted))) pids.push(Number(entry.name));
    } catch {
      // process vanished mid-scan; ignore
    }
  }
  return pids;
}

async function commandLine(pid: number, procRoot = "/proc"): Promise<string[]> {
  return new TextDecoder().decode(await Deno.readFile(`${procRoot}/${pid}/cmdline`)).split("\0")
    .filter(Boolean);
}
export async function acquireCgroupHandles(
  command: CommandAdapter,
  unit: string,
  running: { controlGroup: string; invocationId: string },
  cgroupPath: string,
  expected: { dev: number; ino: number },
) {
  let directory: Deno.FsFile | undefined;
  let kill: Deno.FsFile | undefined;
  let procs: Deno.FsFile | undefined;
  try {
    directory = await Deno.open(cgroupPath, { read: true });
    kill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });
    procs = await Deno.open(`${cgroupPath}/cgroup.procs`, { read: true });
    const [directoryInfo, killInfo, procsInfo, pathIdentity, mapped] = await Promise.all([
      directory.stat(),
      kill.stat(),
      procs.stat(),
      cgroupIdentity(cgroupPath),
      showUnit(command, unit),
    ]);
    if (
      numeric(directoryInfo.dev, "cgroup directory dev") !== expected.dev ||
      numeric(directoryInfo.ino, "cgroup directory inode") !== expected.ino ||
      pathIdentity.dev !== expected.dev || pathIdentity.ino !== expected.ino ||
      numeric(killInfo.dev, "cgroup.kill dev") !== expected.dev ||
      numeric(procsInfo.dev, "cgroup.procs dev") !== expected.dev ||
      mapped.ControlGroup !== running.controlGroup ||
      mapped.InvocationID !== running.invocationId ||
      mapped.ActiveState !== "active"
    ) throw new Error("cgroup descriptor acquisition identity changed");
    return { directory, kill, procs };
  } catch (error) {
    for (const handle of [procs, kill, directory]) {
      try {
        handle?.close();
      } catch { /* preserve acquisition error */ }
    }
    throw error;
  }
}
async function cleanupUnit(
  command: CommandAdapter,
  ledger: CgroupLedger,
  removeProfile = true,
): Promise<CleanupResult> {
  let primaryError: unknown;
  let result: CleanupResult | undefined;
  try {
    const mapped = await showUnit(command, ledger.unit).catch(() => ({} as Record<string, string>));
    const exactUnit = mapped.LoadState !== "not-found" &&
      mapped.ControlGroup === ledger.controlGroup && mapped.InvocationID === ledger.invocationId;
    const cgroup = await cgroupIdentity(ledger.cgroupPath);
    if (cgroup.dev !== ledger.cgroupDev || cgroup.ino !== ledger.cgroupIno) {
      throw new Error("owned Chrome cgroup identity changed before cleanup");
    }
    await ledger.cgroupKillHandle.write(new TextEncoder().encode("1"));
    const deadline = Date.now() + 5_000;
    let remaining: number[] = [];
    while (Date.now() < deadline) {
      remaining = await readCgroupMembers(ledger);
      if (!remaining.length) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (remaining.length) throw new Error("owned Chrome cgroup cleanup failed");
    if (exactUnit) {
      const recheck = await showUnit(command, ledger.unit).catch(() => null);
      if (
        recheck?.ControlGroup === ledger.controlGroup &&
        recheck.InvocationID === ledger.invocationId
      ) {
        const stopped = await command("/usr/bin/systemctl", ["--user", "stop", ledger.unit]);
        if (!stopped.success) {
          const afterStop = await showUnit(command, ledger.unit).catch(() => null);
          if (
            afterStop?.ControlGroup === ledger.controlGroup &&
            afterStop.InvocationID === ledger.invocationId
          ) throw new Error(`owned Chrome unit stop failed: ${stopped.stderr.trim()}`);
        }
      }
    }
    const after = await executableSnapshot(ledger.executable.path);
    if (
      after.path !== ledger.executable.path || after.dev !== ledger.executable.dev ||
      after.ino !== ledger.executable.ino || after.sha256 !== ledger.executable.sha256
    ) throw new Error("Chrome executable changed across launch");
    if (removeProfile) await removeOwnedProfile(ledger.profile);
    result = {
      cleaned: true,
      remaining: [],
      identityMismatches: [],
      stoppedAt: new Date().toISOString(),
    };
  } catch (error) {
    primaryError = error;
  }
  let closeError: unknown;
  for (
    const handle of [
      ledger.cgroupProcsHandle,
      ledger.cgroupKillHandle,
      ledger.cgroupDirectoryHandle,
    ]
  ) {
    try {
      handle.close();
    } catch (error) {
      closeError ??= error;
    }
  }
  if (primaryError) throw primaryError;
  if (closeError) throw closeError;
  return result!;
}
export async function launchOwnedChrome(options: {
  stagedChrome: StagedChrome;
  profileRoot: string;
  profileReservation?: ProfileReservation;
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
  runningExecutableSnapshot?: (
    path: string,
  ) => Promise<ReturnType<typeof executableSnapshot> extends Promise<infer T> ? T : never>;
}): Promise<OwnedChrome> {
  const command = options.command ?? realCommand,
    profile = await prepareProfile(options.profileRoot, options.profileReservation);
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
      // Chrome 150+ detects the systemd user session and asks systemd to move
      // its process tree into an org.chromium.Chromium-*.scope, escaping the
      // launch unit's cgroup and breaking the containment ledger. Deny the
      // systemd user bus (empty XDG_RUNTIME_DIR + DBUS address) so all Chrome
      // processes stay in the unit cgroup.
      "--setenv=XDG_RUNTIME_DIR=/tmp/wasm-vs-js-nobuse-",
      "--setenv=DBUS_SESSION_BUS_ADDRESS=/tmp/wasm-vs-js-nobuse-/bus",
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
      procExePath = `${procRoot}/${running.mainPid}/exe`,
      procExe = await Deno.realPath(procExePath);
    if (procExe !== binary.path) throw new Error("systemd Chrome executable mismatch");
    // Chrome 150 (headless) re-execs the browser process shortly after launch
    // with a compressed argv (a single NUL-less blob), so the main process
    // cmdline is unreliable for argument verification. The executable match
    // above is the containment proof; verify the launch arguments via the
    // unit's process tree instead (the zygote/utility children carry them).
    const cgroupMatches = await processesInCgroup(cgroupPath);
    if (cgroupMatches.length === 0) throw new Error("systemd Chrome unit cgroup has no processes");
    for (const arg of launchArguments) {
      const seen = cgroupMatches.some(async (pid) =>
        (await commandLine(pid, procRoot)).includes(arg)
      );
      if (!seen) throw new Error(`systemd Chrome missing launch argument: ${arg}`);
    }
    const handles = await acquireCgroupHandles(command, unit, running, cgroupPath, cgroup);
    ledger = {
      unit,
      controlGroup: running.controlGroup,
      cgroupPath,
      cgroupDev: cgroup.dev,
      cgroupIno: cgroup.ino,
      invocationId: running.invocationId,
      cgroupDirectoryHandle: handles.directory,
      cgroupKillHandle: handles.kill,
      cgroupProcsHandle: handles.procs,
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
    // Hash the image actually mapped as MainPID before navigation or any scored work. This is the
    // last executable hash in a headline launch; no package hashing occurs during measurement.
    const runningBinary = await (options.runningExecutableSnapshot ?? executableSnapshot)(
      procExePath,
    );
    assertRunningExecutable(binary, runningBinary);
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
      try {
        await cleanupUnit(command, ledger);
      } catch (cleanup) {
        throw new ChromeLaunchLifecycleError(
          `Chrome startup containment cleanup failed: ${cleanup}`,
          true,
          false,
          error,
        );
      }
      throw new ChromeLaunchLifecycleError(
        error instanceof Error ? error.message : String(error),
        true,
        true,
        error,
      );
    }
    if (systemdRunSucceeded) {
      // The launch is counted, but without a positively mapped cgroup it is unsafe to target the
      // unit name or remove the live profile. Retain both as immutable containment evidence.
      throw new ChromeLaunchLifecycleError(
        `Chrome startup containment blocked before unit mapping: ${error}`,
        true,
        false,
        error,
      );
    }
    // systemd-run did not create an owned unit, so no process may be targeted.
    try {
      await removeOwnedProfile(profile);
    } catch (cleanup) {
      throw new ChromeLaunchLifecycleError(
        `Chrome pre-launch profile cleanup failed: ${cleanup}`,
        false,
        false,
        error,
      );
    }
    throw new ChromeLaunchLifecycleError(
      error instanceof Error ? error.message : String(error),
      false,
      true,
      error,
    );
  }
}
export function closeOwnedChrome(owned: OwnedChrome): Promise<CleanupResult> {
  if (!owned.cleanupPromise) {
    owned.cleanupPromise = (async () => {
      // Do not ask Chrome to exit before cgroup teardown: --collect could unlink the cgroup path.
      owned.browser.close();
      return await cleanupUnit(owned.command, owned.ledger);
    })();
  }
  return owned.cleanupPromise;
}
