import { sha256Hex } from "./canonical.ts";

export type FileIdentity = { path: string; dev: number; ino: number; sha256: string };
export type ProcessIdentity = {
  pid: number;
  ppid: number;
  processGroup: number;
  session: number;
  startTimeTicks: string;
  executable: FileIdentity;
  commandLine: string[];
  profileRoot: string;
};
export type ProfileIdentity = {
  ownershipRoot: string;
  ownershipDev: number;
  ownershipIno: number;
  profileRoot: string;
  profileDev: number;
  profileIno: number;
};
export type ProcessLedger = {
  rootPid: number;
  rootStartTimeTicks: string;
  session: number;
  processGroup: number;
  processes: ProcessIdentity[];
  ownedPids: number[];
  profile: ProfileIdentity;
  profileRoot: string;
  recordedAt: string;
};

const OWNERSHIP_ROOT = "/tmp/wasm-vs-js-owned-profiles";
const hashCache = new Map<string, string>();
function validPid(pid: number): boolean {
  return Number.isSafeInteger(pid) && pid > 1;
}
function numeric(value: number | bigint | null | undefined, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} identity unavailable`);
  return number;
}
function statFields(text: string) {
  const close = text.lastIndexOf(")");
  if (close < 0) throw new Error("invalid proc stat");
  const fields = text.slice(close + 2).trim().split(/\s+/);
  if (fields.length < 20) throw new Error("short proc stat");
  return {
    ppid: Number(fields[1]),
    processGroup: Number(fields[2]),
    session: Number(fields[3]),
    startTimeTicks: fields[19],
  };
}
async function hashFile(path: string, dev: number, ino: number): Promise<string> {
  const key = `${dev}:${ino}`;
  let hash = hashCache.get(key);
  if (!hash) {
    hash = await sha256Hex(await Deno.readFile(path));
    hashCache.set(key, hash);
  }
  return hash;
}
async function fileIdentity(path: string): Promise<FileIdentity> {
  const resolved = await Deno.realPath(path);
  const info = await Deno.stat(resolved);
  if (!info.isFile) throw new Error("executable is not a file");
  const dev = numeric(info.dev, "executable dev"), ino = numeric(info.ino, "executable inode");
  return { path: resolved, dev, ino, sha256: await hashFile(resolved, dev, ino) };
}
export async function readProcessIdentity(
  pid: number,
  profileRoot: string,
  procRoot = "/proc",
): Promise<ProcessIdentity> {
  if (!validPid(pid)) throw new Error("invalid pid");
  const base = `${procRoot}/${pid}`;
  const stat = statFields(await Deno.readTextFile(`${base}/stat`));
  const commandLine = (await Deno.readFile(`${base}/cmdline`)).length
    ? new TextDecoder().decode(await Deno.readFile(`${base}/cmdline`)).split("\0").filter(Boolean)
    : [];
  if (!commandLine.includes(`--user-data-dir=${profileRoot}`)) {
    throw new Error("process profile identity mismatch");
  }
  const exeLink = await Deno.readLink(`${base}/exe`);
  const exePath = exeLink.startsWith("/") ? exeLink : `${base}/${exeLink}`;
  return { pid, ...stat, executable: await fileIdentity(exePath), commandLine, profileRoot };
}
function sameProcess(a: ProcessIdentity, b: ProcessIdentity): boolean {
  return a.pid === b.pid && a.startTimeTicks === b.startTimeTicks &&
    a.processGroup === b.processGroup && a.session === b.session &&
    a.executable.dev === b.executable.dev && a.executable.ino === b.executable.ino &&
    a.executable.sha256 === b.executable.sha256 &&
    JSON.stringify(a.commandLine) === JSON.stringify(b.commandLine) &&
    a.profileRoot === b.profileRoot;
}
async function verifiedDirectory(path: string): Promise<{ dev: number; ino: number }> {
  const info = await Deno.lstat(path);
  if (info.isSymlink || !info.isDirectory) throw new Error(`unsafe directory: ${path}`);
  if (await Deno.realPath(path) !== path) {
    throw new Error(`directory containment mismatch: ${path}`);
  }
  return { dev: numeric(info.dev, "directory dev"), ino: numeric(info.ino, "directory inode") };
}
export async function prepareProfile(profileRoot: string): Promise<ProfileIdentity> {
  if (!new RegExp(`^${OWNERSHIP_ROOT}/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`).test(profileRoot)) {
    throw new Error("profile root outside ownership root");
  }
  await verifiedDirectory("/tmp");
  try {
    await Deno.mkdir(OWNERSHIP_ROOT, { mode: 0o700 });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  }
  const permitRoot = profileRoot.slice(0, profileRoot.lastIndexOf("/"));
  await verifiedDirectory(OWNERSHIP_ROOT);
  try {
    await Deno.mkdir(permitRoot, { mode: 0o700 });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  }
  const ownership = await verifiedDirectory(permitRoot);
  try {
    await Deno.lstat(profileRoot);
    throw new Error("profile root already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await Deno.mkdir(profileRoot, { mode: 0o700 });
  const profile = await verifiedDirectory(profileRoot);
  return {
    ownershipRoot: permitRoot,
    ownershipDev: ownership.dev,
    ownershipIno: ownership.ino,
    profileRoot,
    profileDev: profile.dev,
    profileIno: profile.ino,
  };
}
export async function assertProfileIdentity(identity: ProfileIdentity): Promise<void> {
  const ownership = await verifiedDirectory(identity.ownershipRoot);
  const profile = await verifiedDirectory(identity.profileRoot);
  if (
    ownership.dev !== identity.ownershipDev || ownership.ino !== identity.ownershipIno ||
    profile.dev !== identity.profileDev || profile.ino !== identity.profileIno
  ) {
    throw new Error("profile directory identity changed");
  }
}
async function scanProc(procRoot: string): Promise<Map<number, { ppid: number }>> {
  const found = new Map<number, { ppid: number }>();
  for await (const entry of Deno.readDir(procRoot)) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    try {
      const fields = statFields(await Deno.readTextFile(`${procRoot}/${entry.name}/stat`));
      found.set(Number(entry.name), { ppid: fields.ppid });
    } catch { /* process raced */ }
  }
  return found;
}
export async function descendants(rootPid: number, procRoot = "/proc"): Promise<number[]> {
  if (!validPid(rootPid)) throw new Error("invalid root pid");
  const parent = await scanProc(procRoot), result = new Set<number>([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, value] of parent) {
      if (result.has(value.ppid) && !result.has(pid)) {
        result.add(pid);
        changed = true;
      }
    }
  }
  return [...result].sort((a, b) => a - b);
}
export async function createLedger(
  rootPid: number,
  profile: ProfileIdentity | string,
  procRoot = "/proc",
): Promise<ProcessLedger> {
  const identity = typeof profile === "string"
    ? await profileIdentityFromExisting(profile)
    : profile;
  await assertProfileIdentity(identity);
  const root = await readProcessIdentity(rootPid, identity.profileRoot, procRoot);
  const processes: ProcessIdentity[] = [];
  for (const pid of await descendants(rootPid, procRoot)) {
    try {
      const process = await readProcessIdentity(pid, identity.profileRoot, procRoot);
      if (process.session !== root.session || process.processGroup !== root.processGroup) {
        throw new Error("descendant process group/session mismatch");
      }
      processes.push(process);
    } catch (error) {
      if (pid === rootPid) throw error;
    }
  }
  return {
    rootPid,
    rootStartTimeTicks: root.startTimeTicks,
    session: root.session,
    processGroup: root.processGroup,
    processes,
    ownedPids: processes.map((p) => p.pid).sort((a, b) => a - b),
    profile: identity,
    profileRoot: identity.profileRoot,
    recordedAt: new Date().toISOString(),
  };
}
async function profileIdentityFromExisting(profileRoot: string): Promise<ProfileIdentity> {
  if (!new RegExp(`^${OWNERSHIP_ROOT}/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`).test(profileRoot)) {
    throw new Error("profile root outside ownership root");
  }
  const ownershipRoot = profileRoot.slice(0, profileRoot.lastIndexOf("/"));
  const ownership = await verifiedDirectory(ownershipRoot),
    profile = await verifiedDirectory(profileRoot);
  return {
    ownershipRoot,
    ownershipDev: ownership.dev,
    ownershipIno: ownership.ino,
    profileRoot,
    profileDev: profile.dev,
    profileIno: profile.ino,
  };
}
export async function recoverLedger(
  profile: ProfileIdentity,
  preferredRootPid: number,
  procRoot = "/proc",
): Promise<ProcessLedger> {
  await assertProfileIdentity(profile);
  const candidates: ProcessIdentity[] = [];
  for await (const entry of Deno.readDir(procRoot)) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    try {
      candidates.push(await readProcessIdentity(Number(entry.name), profile.profileRoot, procRoot));
    } catch { /* not this profile */ }
  }
  if (!candidates.length) throw new Error("no recoverable profile-bound Chrome process");
  const root = candidates.find((p) => p.pid === preferredRootPid) ?? candidates[0];
  const processes = candidates.filter((p) =>
    p.session === root.session && p.processGroup === root.processGroup
  );
  return {
    rootPid: root.pid,
    rootStartTimeTicks: root.startTimeTicks,
    session: root.session,
    processGroup: root.processGroup,
    processes,
    ownedPids: processes.map((p) => p.pid).sort((a, b) => a - b),
    profile,
    profileRoot: profile.profileRoot,
    recordedAt: new Date().toISOString(),
  };
}

export function assertOnlyOwned(targets: number[], ledger: ProcessLedger): void {
  const owned = new Set(ledger.processes.map((p) => p.pid));
  if (!targets.every((pid) => validPid(pid) && owned.has(pid))) {
    throw new Error("foreign pid denied");
  }
}
async function refreshLedger(ledger: ProcessLedger, procRoot = "/proc"): Promise<ProcessLedger> {
  await assertProfileIdentity(ledger.profile);
  const known = new Map(ledger.processes.map((p) => [p.pid, p]));
  for await (const entry of Deno.readDir(procRoot)) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    const pid = Number(entry.name);
    try {
      const current = await readProcessIdentity(pid, ledger.profileRoot, procRoot);
      const prior = known.get(pid);
      if (prior && !sameProcess(prior, current)) throw new Error("PID reuse detected");
      if (current.session === ledger.session && current.processGroup === ledger.processGroup) {
        known.set(pid, current);
      }
    } catch { /* non-owned, exited, or raced */ }
  }
  const processes = [...known.values()];
  return {
    ...ledger,
    processes,
    ownedPids: processes.map((p) => p.pid).sort((a, b) => a - b),
    recordedAt: new Date().toISOString(),
  };
}
async function identityState(
  identity: ProcessIdentity,
  procRoot = "/proc",
): Promise<"match" | "absent" | "mismatch"> {
  try {
    return sameProcess(
        identity,
        await readProcessIdentity(identity.pid, identity.profileRoot, procRoot),
      )
      ? "match"
      : "mismatch";
  } catch {
    try {
      await Deno.lstat(`${procRoot}/${identity.pid}`);
      return "mismatch";
    } catch {
      return "absent";
    }
  }
}
export async function teardownLedger(
  initial: ProcessLedger,
  options: {
    signal?: Deno.Signal;
    kill?: (pid: number, signal: Deno.Signal) => void;
    removeProfile?: boolean;
    procRoot?: string;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<{ cleaned: boolean; remaining: number[]; identityMismatches: number[] }> {
  const kill = options.kill ?? Deno.kill, procRoot = options.procRoot ?? "/proc";
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let ledger = initial;
  const mismatches = new Set<number>();
  const signalPass = async (signal: Deno.Signal) => {
    ledger = await refreshLedger(ledger, procRoot);
    for (const process of [...ledger.processes].sort((a, b) => b.pid - a.pid)) {
      const state = await identityState(process, procRoot);
      if (state === "mismatch") mismatches.add(process.pid);
      if (state !== "match") continue;
      try {
        kill(process.pid, signal);
      } catch { /* verify next pass */ }
    }
  };
  await signalPass(options.signal ?? "SIGTERM");
  const deadline = Date.now() + 2_000;
  let remaining: number[] = [];
  while (Date.now() < deadline) {
    await sleep(25);
    ledger = await refreshLedger(ledger, procRoot);
    remaining = [];
    for (const process of ledger.processes) {
      if (await identityState(process, procRoot) === "match") remaining.push(process.pid);
    }
    if (!remaining.length) break;
  }
  if (remaining.length) await signalPass("SIGKILL");
  ledger = await refreshLedger(ledger, procRoot);
  remaining = [];
  for (const process of ledger.processes) {
    if (await identityState(process, procRoot) === "match") remaining.push(process.pid);
  }
  if (options.removeProfile !== false && !remaining.length && !mismatches.size) {
    await assertProfileIdentity(ledger.profile);
    await Deno.remove(ledger.profileRoot, { recursive: true });
  }
  let profileExists = true;
  try {
    await Deno.lstat(ledger.profileRoot);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) profileExists = false;
    else throw error;
  }
  return {
    cleaned: !remaining.length && !profileExists && !mismatches.size,
    remaining,
    identityMismatches: [...mismatches],
  };
}
