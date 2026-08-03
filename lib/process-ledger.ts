import { sha256Hex } from "./canonical.ts";

export type FileIdentity = { path: string; dev: number; ino: number; sha256: string };
export type ProfileReservation = {
  ownershipRoot: string;
  ownershipParentDev: number;
  ownershipParentIno: number;
  ownershipDev: number;
  ownershipIno: number;
};
export type ProfileIdentity = ProfileReservation & {
  removeOwnershipRoot: boolean;
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
  invocationId: string;
  cgroupDirectoryHandle: Deno.FsFile;
  cgroupKillHandle: Deno.FsFile;
  cgroupProcsHandle: Deno.FsFile;
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
export async function attestAndRestrictTemporaryRoot(): Promise<void> {
  const tmp = await Deno.lstat("/tmp");
  if (tmp.isSymlink || !tmp.isDirectory || await Deno.realPath("/tmp") !== "/tmp") {
    throw new Error("unsafe temporary root");
  }
  await Deno.permissions.revoke({ name: "read", path: "/tmp" });
  const status = await Deno.permissions.query({ name: "read", path: "/tmp" });
  if (status.state === "granted") throw new Error("temporary root read permission was not revoked");
}
async function ensureOwnershipParent(): Promise<{ dev: number; ino: number }> {
  await Deno.mkdir(OWNERSHIP_ROOT, { recursive: false, mode: 0o700 }).catch(async (e) => {
    if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
    const info = await Deno.lstat(OWNERSHIP_ROOT);
    if (
      info.isSymlink || !info.isDirectory ||
      numeric(info.uid, "ownership uid") !== await currentUid() ||
      ((info.mode ?? 0) & 0o777) !== 0o700
    ) throw new Error("foreign or unsafe ownership root");
  });
  return await privateDirectoryIdentity(OWNERSHIP_ROOT);
}

export async function reserveProfileNamespace(
  ownershipRoot: string,
  childNames: readonly string[],
): Promise<ProfileReservation> {
  if (!new RegExp(`^${OWNERSHIP_ROOT}/[A-Za-z0-9._-]+$`).test(ownershipRoot)) {
    throw new Error("profile ownership reservation outside ownership root");
  }
  if (
    !childNames.length || new Set(childNames).size !== childNames.length ||
    childNames.some((name) => !/^[A-Za-z0-9._-]+$/.test(name))
  ) throw new Error("unsafe profile reservation child names");
  const parent = await ensureOwnershipParent();
  try {
    await Deno.mkdir(ownershipRoot, { recursive: false, mode: 0o700 });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      throw new Error("profile ownership reservation already exists");
    }
    throw error;
  }
  const ownership = await privateDirectoryIdentity(ownershipRoot);
  for (const name of childNames) {
    try {
      await Deno.lstat(`${ownershipRoot}/${name}`);
      throw new Error(`profile root already exists: ${name}`);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  return {
    ownershipRoot,
    ownershipParentDev: parent.dev,
    ownershipParentIno: parent.ino,
    ownershipDev: ownership.dev,
    ownershipIno: ownership.ino,
  };
}

export async function assertProfileReservation(value: ProfileReservation): Promise<void> {
  const parent = await privateDirectoryIdentity(OWNERSHIP_ROOT),
    ownership = await privateDirectoryIdentity(value.ownershipRoot);
  if (
    parent.dev !== value.ownershipParentDev || parent.ino !== value.ownershipParentIno ||
    ownership.dev !== value.ownershipDev || ownership.ino !== value.ownershipIno
  ) throw new Error("profile reservation identity changed");
}

export async function prepareProfile(
  profileRoot: string,
  reservation?: ProfileReservation,
): Promise<ProfileIdentity> {
  if (!new RegExp(`^${OWNERSHIP_ROOT}/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`).test(profileRoot)) {
    throw new Error("profile root outside ownership root");
  }
  const ownershipParent = await ensureOwnershipParent();
  const ownershipRoot = profileRoot.slice(0, profileRoot.lastIndexOf("/"));
  let ownership: { dev: number; ino: number };
  if (reservation) {
    if (reservation.ownershipRoot !== ownershipRoot) {
      throw new Error("profile reservation root mismatch");
    }
    await assertProfileReservation(reservation);
    ownership = { dev: reservation.ownershipDev, ino: reservation.ownershipIno };
  } else {
    await Deno.mkdir(ownershipRoot, { recursive: false, mode: 0o700 }).catch((e) => {
      if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
    });
    ownership = await privateDirectoryIdentity(ownershipRoot);
  }
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
    ownershipParentDev: ownershipParent.dev,
    ownershipParentIno: ownershipParent.ino,
    ownershipDev: ownership.dev,
    ownershipIno: ownership.ino,
    removeOwnershipRoot: reservation === undefined,
    profileRoot,
    profileDev: profile.dev,
    profileIno: profile.ino,
  };
}
export async function assertProfileIdentity(value: ProfileIdentity): Promise<void> {
  const ownershipParent = await privateDirectoryIdentity(OWNERSHIP_ROOT),
    parent = await privateDirectoryIdentity(value.ownershipRoot),
    profile = await privateDirectoryIdentity(value.profileRoot);
  if (
    ownershipParent.dev !== value.ownershipParentDev ||
    ownershipParent.ino !== value.ownershipParentIno ||
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
async function removeExactOwnedTree(
  parentPath: string,
  parentDev: number,
  parentIno: number,
  childName: string,
  childDev: number,
  childIno: number,
): Promise<void> {
  const helper = await Deno.realPath(new URL("../scripts/remove-owned-tree.py", import.meta.url));
  const result = await new Deno.Command("/usr/bin/python3", {
    args: [
      helper,
      parentPath,
      String(parentDev),
      String(parentIno),
      childName,
      String(childDev),
      String(childIno),
      String(0o700),
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    throw new Error(
      `fd-relative profile removal failed: ${new TextDecoder().decode(result.stderr).trim()}`,
    );
  }
  const proof = JSON.parse(new TextDecoder().decode(result.stdout));
  if (proof.removed !== true || proof.dev !== childDev || proof.ino !== childIno) {
    throw new Error("fd-relative profile removal proof mismatch");
  }
}

export async function releaseProfileReservation(value: ProfileReservation): Promise<void> {
  await assertProfileReservation(value);
  await removeExactOwnedTree(
    OWNERSHIP_ROOT,
    value.ownershipParentDev,
    value.ownershipParentIno,
    value.ownershipRoot.slice(OWNERSHIP_ROOT.length + 1),
    value.ownershipDev,
    value.ownershipIno,
  );
}

export async function removeOwnedProfile(value: ProfileIdentity): Promise<void> {
  await assertProfileIdentity(value);
  await profileRemovalRaceHook?.(value.profileRoot);
  // The helper opens parent and child with O_DIRECTORY|O_NOFOLLOW, renames with dir_fd,
  // walks by retained directory descriptors, and uses unlinkat/rmdirat only.
  await removeExactOwnedTree(
    value.ownershipRoot,
    value.ownershipDev,
    value.ownershipIno,
    value.profileRoot.slice(value.ownershipRoot.length + 1),
    value.profileDev,
    value.profileIno,
  );
  if (value.removeOwnershipRoot) {
    await removeExactOwnedTree(
      OWNERSHIP_ROOT,
      value.ownershipParentDev,
      value.ownershipParentIno,
      value.ownershipRoot.slice(OWNERSHIP_ROOT.length + 1),
      value.ownershipDev,
      value.ownershipIno,
    );
  } else await assertProfileReservation(value);
  for (
    const removed of [
      value.profileRoot,
      ...(value.removeOwnershipRoot ? [value.ownershipRoot] : []),
    ]
  ) {
    try {
      await Deno.lstat(removed);
      throw new Error("owned profile root still exists");
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
}

export async function readCgroupMembers(
  ledger:
    & Pick<CgroupLedger, "cgroupPath" | "cgroupDev" | "cgroupIno">
    & Partial<Pick<CgroupLedger, "cgroupProcsHandle">>,
): Promise<number[]> {
  let text: string;
  if (ledger.cgroupProcsHandle) {
    // The descriptor was opened only after cgroup dev/inode authentication. Continue using the
    // retained kernel object even if systemd unlinks or recycles the pathname during teardown.
    await ledger.cgroupProcsHandle.seek(0, Deno.SeekMode.Start);
    const bytes = new Uint8Array(64 * 1024);
    const count = await ledger.cgroupProcsHandle.read(bytes);
    text = new TextDecoder().decode(bytes.subarray(0, count ?? 0));
  } else {
    const identity = await directoryIdentity(ledger.cgroupPath);
    if (identity.dev !== ledger.cgroupDev || identity.ino !== ledger.cgroupIno) {
      throw new Error("cgroup identity changed");
    }
    text = await Deno.readTextFile(`${ledger.cgroupPath}/cgroup.procs`);
  }
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
