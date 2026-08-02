import { sha256Hex } from "./canonical.ts";

export type FileIdentity = { path: string; dev: number; ino: number; sha256: string };
export type ProfileIdentity = {
  ownershipRoot: string;
  ownershipDev: number;
  ownershipIno: number;
  profileRoot: string;
  profileDev: number;
  profileIno: number;
};
export type CgroupLedger = {
  unit: string;
  controlGroup: string;
  cgroupPath: string;
  cgroupDev: number;
  cgroupIno: number;
  mainPid: number;
  members: number[];
  membershipSnapshots: Array<{ collectedAt: string; members: number[] }>;
  executable: FileIdentity;
  commandLine: string[];
  profile: ProfileIdentity;
  profileRoot: string;
  launchedAt: string;
  recordedAt: string;
};
export type ProcessLedger = CgroupLedger;

const OWNERSHIP_ROOT = "/tmp/wasm-vs-js-owned-profiles";
function numeric(value: number | bigint | null | undefined, label: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} unavailable`);
  return n;
}
async function currentUid(): Promise<number> {
  const uid = (await Deno.lstat(new URL(".", import.meta.url))).uid;
  if (uid === null || !Number.isSafeInteger(uid) || uid < 0) {
    throw new Error("current uid unavailable");
  }
  return uid;
}
async function directoryIdentity(path: string): Promise<{ dev: number; ino: number }> {
  const info = await Deno.lstat(path);
  if (info.isSymlink || !info.isDirectory) throw new Error(`unsafe directory: ${path}`);
  if (await Deno.realPath(path) !== path) {
    throw new Error(`directory containment mismatch: ${path}`);
  }
  return { dev: numeric(info.dev, "directory dev"), ino: numeric(info.ino, "directory inode") };
}
async function privateDirectoryIdentity(path: string): Promise<{ dev: number; ino: number }> {
  const identity = await directoryIdentity(path), info = await Deno.lstat(path);
  if (
    numeric(info.uid, "directory uid") !== await currentUid() ||
    ((info.mode ?? 0) & 0o777) !== 0o700
  ) {
    throw new Error(`directory ownership/mode mismatch: ${path}`);
  }
  return identity;
}
async function basicDirectoryIdentity(path: string): Promise<{ dev: number; ino: number }> {
  const info = await Deno.lstat(path);
  if (info.isSymlink || !info.isDirectory) throw new Error(`unsafe directory: ${path}`);
  return { dev: numeric(info.dev, "directory dev"), ino: numeric(info.ino, "directory inode") };
}
export async function executableSnapshot(path: string): Promise<FileIdentity> {
  const resolved = await Deno.realPath(path), before = await Deno.stat(resolved);
  if (!before.isFile) throw new Error("Chrome executable is not a file");
  const bytes = await Deno.readFile(resolved), after = await Deno.stat(resolved);
  const identity = {
    dev: numeric(after.dev, "Chrome dev"),
    ino: numeric(after.ino, "Chrome inode"),
  };
  if (
    numeric(before.dev, "Chrome dev") !== identity.dev ||
    numeric(before.ino, "Chrome inode") !== identity.ino
  ) {
    throw new Error("Chrome executable changed while hashing");
  }
  return { path: resolved, ...identity, sha256: await sha256Hex(bytes) };
}
export async function prepareProfile(profileRoot: string): Promise<ProfileIdentity> {
  if (!new RegExp(`^${OWNERSHIP_ROOT}/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`).test(profileRoot)) {
    throw new Error("profile root outside ownership root");
  }
  const tmp = await Deno.lstat("/tmp");
  if (tmp.isSymlink || !tmp.isDirectory || await Deno.realPath("/tmp") !== "/tmp") {
    throw new Error("unsafe temporary root");
  }
  await Deno.mkdir(OWNERSHIP_ROOT, { recursive: false, mode: 0o700 }).catch(async (e) => {
    if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
    const info = await Deno.lstat(OWNERSHIP_ROOT);
    if (numeric(info.uid, "ownership uid") !== await currentUid()) {
      throw new Error("foreign ownership root");
    }
    await Deno.chmod(OWNERSHIP_ROOT, 0o700);
  });
  await privateDirectoryIdentity(OWNERSHIP_ROOT);
  const ownershipRoot = profileRoot.slice(0, profileRoot.lastIndexOf("/"));
  await Deno.mkdir(ownershipRoot, { recursive: false, mode: 0o700 }).catch((e) => {
    if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
  });
  const ownership = await privateDirectoryIdentity(ownershipRoot);
  try {
    await Deno.lstat(profileRoot);
    throw new Error("profile root already exists");
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(profileRoot, { mode: 0o700 });
  const profile = await privateDirectoryIdentity(profileRoot);
  return {
    ownershipRoot,
    ownershipDev: ownership.dev,
    ownershipIno: ownership.ino,
    profileRoot,
    profileDev: profile.dev,
    profileIno: profile.ino,
  };
}
export async function assertProfileIdentity(value: ProfileIdentity): Promise<void> {
  const parent = await privateDirectoryIdentity(value.ownershipRoot),
    profile = await privateDirectoryIdentity(value.profileRoot);
  if (
    parent.dev !== value.ownershipDev || parent.ino !== value.ownershipIno ||
    profile.dev !== value.profileDev || profile.ino !== value.profileIno
  ) {
    throw new Error("profile directory identity changed");
  }
}
export let profileRemovalRaceHook: ((path: string) => void | Promise<void>) | undefined;
export function setProfileRemovalRaceHookForTest(hook?: (path: string) => void | Promise<void>) {
  profileRemovalRaceHook = hook;
}
async function removeTreeNoFollow(
  path: string,
  parent?: { path: string; dev: number; ino: number },
  expected?: { dev: number; ino: number; isDirectory: boolean; isSymlink: boolean },
): Promise<void> {
  if (parent) {
    const parentNow = await basicDirectoryIdentity(parent.path);
    if (parentNow.dev !== parent.dev || parentNow.ino !== parent.ino) {
      throw new Error("profile parent replaced");
    }
  }
  const info = await Deno.lstat(path);
  if (
    expected && (
      numeric(info.dev, "entry dev") !== expected.dev ||
      numeric(info.ino, "entry inode") !== expected.ino ||
      info.isDirectory !== expected.isDirectory || info.isSymlink !== expected.isSymlink
    )
  ) throw new Error("profile entry replaced before descent");
  if (info.isSymlink || !info.isDirectory) {
    await profileRemovalRaceHook?.(path);
    const again = await Deno.lstat(path);
    if (
      again.dev !== info.dev || again.ino !== info.ino || again.isDirectory !== info.isDirectory ||
      again.isSymlink !== info.isSymlink
    ) {
      throw new Error("profile entry replaced before unlink");
    }
    await Deno.remove(path);
    return;
  }
  const identity = {
    path,
    dev: numeric(info.dev, "remove dev"),
    ino: numeric(info.ino, "remove inode"),
  };
  const entries: Array<
    { name: string; dev: number; ino: number; isDirectory: boolean; isSymlink: boolean }
  > = [];
  for await (const entry of Deno.readDir(path)) {
    const child = await Deno.lstat(`${path}/${entry.name}`);
    entries.push({
      name: entry.name,
      dev: numeric(child.dev, "entry dev"),
      ino: numeric(child.ino, "entry inode"),
      isDirectory: child.isDirectory,
      isSymlink: child.isSymlink,
    });
  }
  await profileRemovalRaceHook?.(path);
  const beforeDescent = await basicDirectoryIdentity(path);
  if (beforeDescent.dev !== identity.dev || beforeDescent.ino !== identity.ino) {
    throw new Error("profile directory replaced before descent");
  }
  for (const entry of entries) await removeTreeNoFollow(`${path}/${entry.name}`, identity, entry);
  const again = await Deno.lstat(path);
  if (
    again.isSymlink || numeric(again.dev, "remove dev") !== numeric(info.dev, "remove dev") ||
    numeric(again.ino, "remove inode") !== numeric(info.ino, "remove inode")
  ) {
    throw new Error("profile entry replaced during removal");
  }
  await Deno.remove(path);
}
export async function removeOwnedProfile(value: ProfileIdentity): Promise<void> {
  await assertProfileIdentity(value);
  const parent = await privateDirectoryIdentity(value.ownershipRoot);
  const tombstone = `${value.ownershipRoot}/.removed-${crypto.randomUUID()}`;
  await Deno.rename(value.profileRoot, tombstone);
  const parentAfter = await privateDirectoryIdentity(value.ownershipRoot),
    tomb = await privateDirectoryIdentity(tombstone);
  if (
    parent.dev !== parentAfter.dev || parent.ino !== parentAfter.ino ||
    tomb.dev !== value.profileDev || tomb.ino !== value.profileIno
  ) {
    throw new Error("profile tombstone identity changed");
  }
  await removeTreeNoFollow(tombstone, {
    path: value.ownershipRoot,
    dev: parent.dev,
    ino: parent.ino,
  });
  await Deno.remove(value.ownershipRoot);
  for (const removed of [value.profileRoot, value.ownershipRoot]) {
    try {
      await Deno.lstat(removed);
      throw new Error("owned profile root still exists");
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
}

export async function readCgroupMembers(
  ledger: Pick<CgroupLedger, "cgroupPath" | "cgroupDev" | "cgroupIno">,
): Promise<number[]> {
  const identity = await directoryIdentity(ledger.cgroupPath);
  if (identity.dev !== ledger.cgroupDev || identity.ino !== ledger.cgroupIno) {
    throw new Error("cgroup identity changed");
  }
  const text = await Deno.readTextFile(`${ledger.cgroupPath}/cgroup.procs`);
  return text.split(/\s+/).filter(Boolean).map(Number).filter((pid) =>
    Number.isSafeInteger(pid) && pid > 1
  ).sort((a, b) => a - b);
}
export async function refreshLedger(ledger: CgroupLedger): Promise<CgroupLedger> {
  const collectedAt = new Date().toISOString(), members = await readCgroupMembers(ledger);
  return {
    ...ledger,
    members,
    membershipSnapshots: [...ledger.membershipSnapshots, { collectedAt, members }],
    recordedAt: collectedAt,
  };
}
export function assertOnlyOwned(targets: number[], ledger: CgroupLedger): void {
  const members = new Set(ledger.members);
  if (!targets.every((pid) => members.has(pid))) throw new Error("foreign pid denied");
}
