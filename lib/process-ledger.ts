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
async function fileIdentity(path: string): Promise<FileIdentity> {
  const resolved = await Deno.realPath(path);
  const before = await Deno.stat(resolved);
  if (!before.isFile) throw new Error("executable is not a file");
  const bytes = await Deno.readFile(resolved);
  const after = await Deno.stat(resolved);
  const dev = numeric(after.dev, "executable dev"), ino = numeric(after.ino, "executable inode");
  if (
    numeric(before.dev, "executable dev") !== dev || numeric(before.ino, "executable inode") !== ino
  ) {
    throw new Error("executable changed while hashing");
  }
  return { path: resolved, dev, ino, sha256: await sha256Hex(bytes) };
}
export async function readProcessIdentity(
  pid: number,
  profileRoot: string,
  procRoot = "/proc",
  requireProfile = true,
): Promise<ProcessIdentity> {
  if (!validPid(pid)) throw new Error("invalid pid");
  const base = `${procRoot}/${pid}`;
  const stat = statFields(await Deno.readTextFile(`${base}/stat`));
  const commandLine = (await Deno.readFile(`${base}/cmdline`)).length
    ? new TextDecoder().decode(await Deno.readFile(`${base}/cmdline`)).split("\0").filter(Boolean)
    : [];
  if (requireProfile && !commandLine.includes(`--user-data-dir=${profileRoot}`)) {
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
  const parent = await scanProc(procRoot);
  if (!parent.has(rootPid)) return [];
  const result = new Set<number>([rootPid]);
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
      // Proven ancestry, not inherited flags/groups, establishes ownership for descendants.
      processes.push(
        await readProcessIdentity(pid, identity.profileRoot, procRoot, pid === rootPid),
      );
    } catch (error) {
      if (pid === rootPid) throw error;
      throw new Error(`owned descendant identity unavailable: ${pid}`, { cause: error });
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
  const all = new Map<number, ProcessIdentity>();
  for (const candidate of candidates) all.set(candidate.pid, candidate);
  for (const pid of await descendants(root.pid, procRoot)) {
    all.set(pid, await readProcessIdentity(pid, profile.profileRoot, procRoot, pid === root.pid));
  }
  const processes = [...all.values()];
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
export async function refreshLedger(
  ledger: ProcessLedger,
  procRoot = "/proc",
): Promise<ProcessLedger> {
  await assertProfileIdentity(ledger.profile);
  const known = new Map(ledger.processes.map((p) => [p.pid, p]));
  const ancestry = await descendants(ledger.rootPid, procRoot).catch(() => []);
  for (const pid of ancestry) {
    const current = await readProcessIdentity(
      pid,
      ledger.profileRoot,
      procRoot,
      pid === ledger.rootPid,
    );
    const prior = known.get(pid);
    if (prior && !sameProcess(prior, current)) {
      throw new Error(`owned PID identity changed: ${pid}`);
    }
    known.set(pid, current);
  }
  // Preserve detached/reparented descendants only while their full identity still matches.
  for (const [pid, prior] of [...known]) {
    const state = await identityState(prior, procRoot);
    if (state === "absent") continue;
    if (state === "mismatch") throw new Error(`owned PID identity changed: ${pid}`);
  }
  const processes = [...known.values()];
  return {
    ...ledger,
    processes,
    ownedPids: processes.map((p) => p.pid).sort((a, b) => a - b),
    recordedAt: new Date().toISOString(),
  };
}
export async function assertLedgerProcessesCurrent(
  ledger: ProcessLedger,
  procRoot = "/proc",
): Promise<void> {
  for (const identity of ledger.processes) {
    if (await identityState(identity, procRoot) !== "match") {
      throw new Error(`owned process identity is not current: ${identity.pid}`);
    }
  }
}

async function identityState(
  identity: ProcessIdentity,
  procRoot = "/proc",
): Promise<"match" | "absent" | "mismatch"> {
  try {
    return sameProcess(
        identity,
        await readProcessIdentity(
          identity.pid,
          identity.profileRoot,
          procRoot,
          identity.commandLine.includes(`--user-data-dir=${identity.profileRoot}`),
        ),
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
export async function removeOwnedProfile(identity: ProfileIdentity): Promise<void> {
  await assertProfileIdentity(identity);
  const parentBefore = await verifiedDirectory(identity.ownershipRoot);
  const tombstone = `${identity.ownershipRoot}/.removed-${crypto.randomUUID()}`;
  await Deno.rename(identity.profileRoot, tombstone);
  const parentAfter = await verifiedDirectory(identity.ownershipRoot);
  if (
    parentBefore.dev !== parentAfter.dev || parentBefore.ino !== parentAfter.ino ||
    parentAfter.dev !== identity.ownershipDev || parentAfter.ino !== identity.ownershipIno
  ) throw new Error("profile ownership parent changed during removal");
  const tomb = await verifiedDirectory(tombstone);
  if (
    tomb.dev !== identity.profileDev || tomb.ino !== identity.profileIno ||
    await Deno.realPath(tombstone) !== tombstone
  ) throw new Error("profile tombstone identity changed");
  await Deno.remove(tombstone, { recursive: true });
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
  const safeRefresh = async () => {
    try {
      ledger = await refreshLedger(ledger, procRoot);
      return true;
    } catch {
      for (const process of ledger.processes) {
        if (await identityState(process, procRoot) === "mismatch") mismatches.add(process.pid);
      }
      return false;
    }
  };
  const signalPass = async (signal: Deno.Signal) => {
    if (!await safeRefresh()) return;
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
    await safeRefresh();
    remaining = [];
    for (const process of ledger.processes) {
      if (await identityState(process, procRoot) === "match") remaining.push(process.pid);
    }
    if (!remaining.length) break;
  }
  if (remaining.length) await signalPass("SIGKILL");
  await safeRefresh();
  remaining = [];
  for (const process of ledger.processes) {
    if (await identityState(process, procRoot) === "match") remaining.push(process.pid);
  }
  if (options.removeProfile !== false && !remaining.length && !mismatches.size) {
    await removeOwnedProfile(ledger.profile);
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
