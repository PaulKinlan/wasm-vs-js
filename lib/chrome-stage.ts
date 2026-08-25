import { canonicalize, sha256Hex } from "./canonical.ts";
import { assertChromePackageManifestSchema, assertStageOwnerSchema } from "./corpus-contracts.ts";
import { CleanupLifecycleState } from "./stage-lifecycle.ts";

export type ChromePackageInspection = {
  schemaVersion: 2;
  binaryRelativePath: string;
  binarySha256: string;
  manifestSha256: string;
  files: Record<string, string>;
  sourceFileModes: Record<string, number>;
  stagedFileModes: Record<string, number>;
  sourceDirectoryModes: Record<string, number>;
  stagedDirectoryModes: Record<string, number>;
};

export type StageAuthorization = {
  permitId: string;
  sourceCommit: string;
  chromePackageManifestSha256: string;
};

export type StagedChrome = ChromePackageInspection & {
  stageId: string;
  permitId: string;
  sourceCommit: string;
  root: string;
  binary: string;
  stageParentDev: number;
  stageParentIno: number;
  rootDev: number;
  rootIno: number;
  cleanupLifecycle: CleanupLifecycleState;
  ownerManifestPath: string;
  ownerManifestSha256: string;
  ownerDev: number;
  ownerIno: number;
};

type StageOwnerManifest = {
  schemaVersion: 1;
  stageId: string;
  permitId: string;
  sourceCommit: string;
  root: string;
  stageParentDev: number;
  stageParentIno: number;
  rootDev: number;
  rootIno: number;
  cleanupLifecycle: CleanupLifecycleState;
  package: ChromePackageInspection;
};

const STAGE_ROOT = "/tmp/wasm-vs-js-staged-chrome";
const DIRECTORY_MODE = 0o500;
const EXECUTABLE_MODE = 0o500;
const NON_EXECUTABLE_MODE = 0o400;
const OWNER_MODE = 0o600;

function safeId(value: string): string {
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(value)) throw new Error("unsafe Chrome stage id");
  return value;
}

type PackagePaths = { files: string[]; directories: string[] };

async function walkPackage(root: string): Promise<PackagePaths> {
  const files: string[] = [], directories = ["."];
  async function visit(relative: string): Promise<void> {
    for await (const entry of Deno.readDir(relative ? `${root}/${relative}` : root)) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const info = await Deno.lstat(`${root}/${rel}`);
      if (info.isSymlink) throw new Error(`Chrome package symlink denied: ${rel}`);
      if (info.isDirectory) {
        directories.push(rel);
        await visit(rel);
      } else if (info.isFile) files.push(rel);
      else throw new Error(`unsupported Chrome package entry: ${rel}`);
    }
  }
  await visit("");
  return { files: files.sort(), directories: directories.sort() };
}

function numberIdentity(value: number | bigint | null | undefined, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} unavailable`);
  return number;
}

function permissionMode(info: Deno.FileInfo, label: string): number {
  return numberIdentity(info.mode, `${label} mode`) & 0o7777;
}

function assertOrdinaryMode(mode: number, label: string): void {
  if ((mode & 0o7000) !== 0) throw new Error(`${label} has special permission bits`);
}

function stagedFileMode(sourceMode: number): number {
  return (sourceMode & 0o111) !== 0 ? EXECUTABLE_MODE : NON_EXECUTABLE_MODE;
}

async function hashFile(path: string): Promise<{ sha256: string; mode: number }> {
  const before = await Deno.lstat(path);
  if (before.isSymlink || !before.isFile) throw new Error("unsafe staged Chrome file");
  const beforeMode = permissionMode(before, "Chrome package file");
  const sha256 = await sha256Hex(await Deno.readFile(path));
  const after = await Deno.lstat(path);
  if (
    after.isSymlink || !after.isFile || after.dev !== before.dev || after.ino !== before.ino ||
    after.size !== before.size || permissionMode(after, "Chrome package file") !== beforeMode
  ) throw new Error("staged Chrome file changed while hashing");
  return { sha256, mode: beforeMode };
}

async function expectedUid(): Promise<number> {
  return numberIdentity((await Deno.lstat(new URL(".", import.meta.url))).uid, "stage uid");
}

function packageManifest(stage: ChromePackageInspection): ChromePackageInspection {
  return {
    schemaVersion: stage.schemaVersion,
    binaryRelativePath: stage.binaryRelativePath,
    binarySha256: stage.binarySha256,
    manifestSha256: stage.manifestSha256,
    files: stage.files,
    sourceFileModes: stage.sourceFileModes,
    stagedFileModes: stage.stagedFileModes,
    sourceDirectoryModes: stage.sourceDirectoryModes,
    stagedDirectoryModes: stage.stagedDirectoryModes,
  };
}

function ownerManifest(stage: StagedChrome): StageOwnerManifest {
  return {
    schemaVersion: 1,
    stageId: stage.stageId,
    permitId: stage.permitId,
    sourceCommit: stage.sourceCommit,
    root: stage.root,
    stageParentDev: stage.stageParentDev,
    stageParentIno: stage.stageParentIno,
    rootDev: stage.rootDev,
    rootIno: stage.rootIno,
    cleanupLifecycle: stage.cleanupLifecycle,
    package: packageManifest(stage),
  };
}

async function ownerSnapshot(path: string): Promise<{
  manifest: StageOwnerManifest;
  sha256: string;
  dev: number;
  ino: number;
}> {
  const before = await Deno.lstat(path);
  if (before.isSymlink || !before.isFile) throw new Error("unsafe Chrome stage owner manifest");
  const handle = await Deno.open(path, { read: true });
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile || opened.dev !== before.dev || opened.ino !== before.ino ||
      numberIdentity(opened.uid, "stage owner uid") !== await expectedUid() ||
      permissionMode(opened, "stage owner") !== OWNER_MODE
    ) throw new Error("unsafe Chrome stage owner manifest");
    const bytes = new Uint8Array(numberIdentity(opened.size, "stage owner size"));
    let offset = 0;
    while (offset < bytes.length) {
      const count = await handle.read(bytes.subarray(offset));
      if (count === null) throw new Error("short Chrome stage owner manifest");
      offset += count;
    }
    const manifest = JSON.parse(new TextDecoder().decode(bytes));
    assertStageOwnerSchema(manifest);
    const after = await Deno.lstat(path);
    if (
      after.isSymlink || !after.isFile || after.dev !== opened.dev || after.ino !== opened.ino ||
      after.size !== opened.size || permissionMode(after, "stage owner") !== OWNER_MODE
    ) throw new Error("Chrome stage owner manifest changed while reading");
    return {
      manifest: manifest as StageOwnerManifest,
      sha256: await sha256Hex(bytes),
      dev: numberIdentity(opened.dev, "stage owner dev"),
      ino: numberIdentity(opened.ino, "stage owner inode"),
    };
  } finally {
    handle.close();
  }
}

async function assertStageDirectory(path: string, expectedMode: number) {
  const info = await Deno.lstat(path);
  const resolved = await Deno.realPath(path);
  const matches = resolved === path ||
    (Deno.build.os === "darwin" &&
      (resolved === `/private${path}` || path === `/private${resolved}`));
  if (
    info.isSymlink || !info.isDirectory || !matches ||
    numberIdentity(info.uid, "stage uid") !== await expectedUid() ||
    permissionMode(info, "staged Chrome directory") !== expectedMode
  ) throw new Error("unsafe staged Chrome directory");
  return {
    dev: numberIdentity(info.dev, "stage dev"),
    ino: numberIdentity(info.ino, "stage inode"),
  };
}

function sameKeys(actual: Record<string, unknown>, expected: string[]): boolean {
  return JSON.stringify(Object.keys(actual).sort()) === JSON.stringify([...expected].sort());
}

function manifestIdentity(
  inspection: Omit<ChromePackageInspection, "manifestSha256">,
): Omit<ChromePackageInspection, "manifestSha256"> {
  return inspection;
}

async function manifestDigest(
  inspection: Omit<ChromePackageInspection, "manifestSha256">,
): Promise<string> {
  return await sha256Hex(canonicalize(manifestIdentity(inspection)));
}

function validateModeMetadata(inspection: ChromePackageInspection): void {
  if (inspection.schemaVersion !== 2) {
    throw new Error("unsupported Chrome package manifest version");
  }
  const filePaths = Object.keys(inspection.files).sort();
  const directoryPaths = Object.keys(inspection.sourceDirectoryModes).sort();
  if (
    !filePaths.length || !sameKeys(inspection.sourceFileModes, filePaths) ||
    !sameKeys(inspection.stagedFileModes, filePaths) ||
    !sameKeys(inspection.stagedDirectoryModes, directoryPaths) ||
    !directoryPaths.includes(".")
  ) throw new Error("Chrome package mode metadata file set mismatch");
  if (!filePaths.includes(inspection.binaryRelativePath)) {
    throw new Error("Chrome package main binary missing");
  }
  for (const rel of filePaths) {
    const sourceMode = inspection.sourceFileModes[rel];
    assertOrdinaryMode(sourceMode, `Chrome source file ${rel}`);
    if (inspection.stagedFileModes[rel] !== stagedFileMode(sourceMode)) {
      throw new Error(`staged Chrome file mode classification changed: ${rel}`);
    }
  }
  if ((inspection.sourceFileModes[inspection.binaryRelativePath] & 0o111) === 0) {
    throw new Error("Chrome source main binary is not executable");
  }
  for (const rel of directoryPaths) {
    assertOrdinaryMode(inspection.sourceDirectoryModes[rel], `Chrome source directory ${rel}`);
    if (inspection.stagedDirectoryModes[rel] !== DIRECTORY_MODE) {
      throw new Error(`staged Chrome directory mode classification changed: ${rel}`);
    }
  }
}

async function inspectResolvedChromePackage(
  resolvedBinary: string,
  expectedBinarySha256: string,
): Promise<ChromePackageInspection> {
  const sourceRoot = resolvedBinary.slice(0, resolvedBinary.lastIndexOf("/"));
  const sourceInfo = await Deno.lstat(resolvedBinary);
  if (sourceInfo.isSymlink || !sourceInfo.isFile) throw new Error("unsafe Chrome source binary");
  const binaryRelativePath = resolvedBinary.slice(sourceRoot.length + 1);
  const paths = await walkPackage(sourceRoot);
  const files: Record<string, string> = {}, sourceFileModes: Record<string, number> = {};
  const sourceDirectoryModes: Record<string, number> = {};
  for (const rel of paths.files) {
    const snapshot = await hashFile(`${sourceRoot}/${rel}`);
    assertOrdinaryMode(snapshot.mode, `Chrome source file ${rel}`);
    files[rel] = snapshot.sha256;
    sourceFileModes[rel] = snapshot.mode;
  }
  for (const rel of paths.directories) {
    const info = await Deno.lstat(rel === "." ? sourceRoot : `${sourceRoot}/${rel}`);
    if (info.isSymlink || !info.isDirectory) {
      throw new Error(`unsafe Chrome source directory: ${rel}`);
    }
    const mode = permissionMode(info, `Chrome source directory ${rel}`);
    assertOrdinaryMode(mode, `Chrome source directory ${rel}`);
    sourceDirectoryModes[rel] = mode;
  }
  if (files[binaryRelativePath] !== expectedBinarySha256) {
    throw new Error("Chrome source binary hash mismatch");
  }
  const stagedFileModes = Object.fromEntries(
    paths.files.map((rel) => [rel, stagedFileMode(sourceFileModes[rel])]),
  );
  const stagedDirectoryModes = Object.fromEntries(
    paths.directories.map((rel) => [rel, DIRECTORY_MODE]),
  );
  const identity = {
    schemaVersion: 2 as const,
    binaryRelativePath,
    binarySha256: expectedBinarySha256,
    files,
    sourceFileModes,
    stagedFileModes,
    sourceDirectoryModes,
    stagedDirectoryModes,
  };
  const inspection = { ...identity, manifestSha256: await manifestDigest(identity) };
  validateModeMetadata(inspection);
  return inspection;
}

export let stageOwnerOpenRaceHook: ((stage: StagedChrome) => void) | undefined;
export function setStageOwnerOpenRaceHookForTest(hook?: (stage: StagedChrome) => void): void {
  stageOwnerOpenRaceHook = hook;
}

export function recordStageCleanupLifecycle(
  stage: StagedChrome,
  cleanupLifecycle: CleanupLifecycleState,
): void {
  if (!/^[a-f0-9]{64}$/.test(stage.ownerManifestSha256)) {
    throw new Error("stage owner digest unavailable for lifecycle update");
  }
  stageOwnerOpenRaceHook?.(stage);
  // Python supplies O_NOFOLLOW, dir_fd lookup, descriptor identity checks, and descriptor-only
  // truncation. Deno.open has no no-follow option and must not be used for this mutation.
  const helper = Deno.realPathSync(new URL("../scripts/write-stage-owner.py", import.meta.url));
  const result = new Deno.Command("/usr/bin/python3", {
    args: [
      helper,
      STAGE_ROOT,
      String(stage.stageParentDev),
      String(stage.stageParentIno),
      `${safeId(stage.stageId)}.owner.json`,
      String(stage.ownerDev),
      String(stage.ownerIno),
      stage.ownerManifestSha256,
      stage.cleanupLifecycle,
      cleanupLifecycle,
    ],
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  if (!result.success) {
    throw new Error(
      `fd-relative stage lifecycle update failed: ${
        new TextDecoder().decode(result.stderr).trim()
      }`,
    );
  }
  const proof = JSON.parse(new TextDecoder().decode(result.stdout));
  if (
    proof.updated !== true || proof.dev !== stage.ownerDev || proof.ino !== stage.ownerIno ||
    proof.cleanupLifecycle !== cleanupLifecycle || !/^[a-f0-9]{64}$/.test(proof.sha256)
  ) throw new Error("fd-relative stage lifecycle update proof mismatch");
  stage.cleanupLifecycle = cleanupLifecycle;
  stage.ownerManifestSha256 = proof.sha256;
}

export async function verifyStageOwnership(stage: StagedChrome): Promise<void> {
  if (
    stage.stageId !== safeId(stage.permitId) ||
    stage.root !== `${STAGE_ROOT}/${stage.stageId}` ||
    stage.ownerManifestPath !== `${STAGE_ROOT}/${stage.stageId}.owner.json` ||
    !/^[a-f0-9]{40}$/.test(stage.sourceCommit)
  ) throw new Error("staged Chrome ownership identity changed");
  const parent = await assertStageDirectory(STAGE_ROOT, 0o700);
  if (parent.dev !== stage.stageParentDev || parent.ino !== stage.stageParentIno) {
    throw new Error("staged Chrome parent identity changed");
  }
  const owner = await ownerSnapshot(stage.ownerManifestPath);
  if (
    (stage.ownerManifestSha256 && owner.sha256 !== stage.ownerManifestSha256) ||
    owner.dev !== stage.ownerDev || owner.ino !== stage.ownerIno ||
    canonicalize(owner.manifest) !== canonicalize(ownerManifest(stage))
  ) throw new Error("staged Chrome owner manifest identity changed");
  stage.ownerManifestSha256 = owner.sha256;
  stage.ownerDev = owner.dev;
  stage.ownerIno = owner.ino;
}

export async function verifyStagedChrome(stage: StagedChrome): Promise<void> {
  validateModeMetadata(stage);
  assertChromePackageManifestSchema(packageManifest(stage));
  await verifyStageOwnership(stage);
  if (stage.binary !== `${stage.root}/${stage.binaryRelativePath}`) {
    throw new Error("staged Chrome binary path changed");
  }
  const root = await assertStageDirectory(stage.root, DIRECTORY_MODE);
  if (root.dev !== stage.rootDev || root.ino !== stage.rootIno) {
    throw new Error("staged Chrome root identity changed");
  }
  const paths = await walkPackage(stage.root);
  if (
    !sameKeys(stage.files, paths.files) || !sameKeys(stage.sourceFileModes, paths.files) ||
    !sameKeys(stage.stagedFileModes, paths.files) ||
    !sameKeys(stage.sourceDirectoryModes, paths.directories) ||
    !sameKeys(stage.stagedDirectoryModes, paths.directories)
  ) throw new Error("staged Chrome package file set changed");

  const files: Record<string, string> = {}, stagedFileModes: Record<string, number> = {};
  const stagedDirectoryModes: Record<string, number> = {};
  for (const rel of paths.files) {
    const snapshot = await hashFile(`${stage.root}/${rel}`);
    if (snapshot.mode !== stage.stagedFileModes[rel]) {
      throw new Error(`staged Chrome file mode changed: ${rel}`);
    }
    files[rel] = snapshot.sha256;
    stagedFileModes[rel] = snapshot.mode;
  }
  for (const rel of paths.directories) {
    const path = rel === "." ? stage.root : `${stage.root}/${rel}`;
    const info = await Deno.lstat(path);
    if (info.isSymlink || !info.isDirectory) {
      throw new Error(`unsafe staged Chrome directory: ${rel}`);
    }
    const mode = permissionMode(info, `staged Chrome directory ${rel}`);
    if (mode !== stage.stagedDirectoryModes[rel]) {
      throw new Error(`staged Chrome directory mode changed: ${rel}`);
    }
    stagedDirectoryModes[rel] = mode;
  }
  const digest = await manifestDigest({
    schemaVersion: 2,
    binaryRelativePath: stage.binaryRelativePath,
    binarySha256: stage.binarySha256,
    files,
    sourceFileModes: stage.sourceFileModes,
    stagedFileModes,
    sourceDirectoryModes: stage.sourceDirectoryModes,
    stagedDirectoryModes,
  });
  const rootAfter = await assertStageDirectory(stage.root, DIRECTORY_MODE);
  if (
    rootAfter.dev !== stage.rootDev || rootAfter.ino !== stage.rootIno ||
    digest !== stage.manifestSha256 || files[stage.binaryRelativePath] !== stage.binarySha256
  ) throw new Error("staged Chrome package manifest changed");
}

async function runRemovalHelper(script: string, args: string[]): Promise<Record<string, unknown>> {
  const helper = await Deno.realPath(new URL(`../scripts/${script}`, import.meta.url));
  const result = await new Deno.Command("/usr/bin/python3", {
    args: [helper, ...args],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    throw new Error(
      `fd-relative Chrome stage removal failed: ${new TextDecoder().decode(result.stderr).trim()}`,
    );
  }
  return JSON.parse(new TextDecoder().decode(result.stdout));
}

async function removeExactStageTree(
  stageParentDev: number,
  stageParentIno: number,
  stageId: string,
  rootDev: number,
  rootIno: number,
  mode: number,
): Promise<void> {
  const proof = await runRemovalHelper("remove-owned-tree.py", [
    STAGE_ROOT,
    String(stageParentDev),
    String(stageParentIno),
    safeId(stageId),
    String(rootDev),
    String(rootIno),
    String(mode),
  ]);
  if (proof.removed !== true || proof.dev !== rootDev || proof.ino !== rootIno) {
    throw new Error("fd-relative Chrome stage removal proof mismatch");
  }
}

async function removeExactOwnerFile(
  stageParentDev: number,
  stageParentIno: number,
  stageId: string,
  ownerDev: number,
  ownerIno: number,
): Promise<void> {
  const proof = await runRemovalHelper("remove-owned-file.py", [
    STAGE_ROOT,
    String(stageParentDev),
    String(stageParentIno),
    `${safeId(stageId)}.owner.json`,
    String(ownerDev),
    String(ownerIno),
  ]);
  if (proof.removed !== true || proof.dev !== ownerDev || proof.ino !== ownerIno) {
    throw new Error("fd-relative Chrome stage owner removal proof mismatch");
  }
}

export let stageRemovalRaceHook: ((stage: StagedChrome) => void | Promise<void>) | undefined;
export function setStageRemovalRaceHookForTest(
  hook?: (stage: StagedChrome) => void | Promise<void>,
): void {
  stageRemovalRaceHook = hook;
}

export async function removeStagedChrome(stage: StagedChrome): Promise<void> {
  await verifyStagedChrome(stage);
  await stageRemovalRaceHook?.(stage);
  await removeExactStageTree(
    stage.stageParentDev,
    stage.stageParentIno,
    stage.stageId,
    stage.rootDev,
    stage.rootIno,
    DIRECTORY_MODE,
  );
  const owner = await ownerSnapshot(stage.ownerManifestPath);
  if (
    owner.sha256 !== stage.ownerManifestSha256 || owner.dev !== stage.ownerDev ||
    owner.ino !== stage.ownerIno
  ) throw new Error("Chrome stage owner changed during cleanup");
  await removeExactOwnerFile(
    stage.stageParentDev,
    stage.stageParentIno,
    stage.stageId,
    stage.ownerDev,
    stage.ownerIno,
  );
}

export async function inspectChromePackage(
  sourceBinary: string,
  expectedBinarySha256: string,
): Promise<ChromePackageInspection> {
  return await inspectResolvedChromePackage(
    await Deno.realPath(sourceBinary),
    expectedBinarySha256,
  );
}

function validateAuthorization(authorization: StageAuthorization): StageAuthorization {
  if (
    safeId(authorization.permitId) !== authorization.permitId ||
    !/^[a-f0-9]{40}$/.test(authorization.sourceCommit) ||
    !/^[a-f0-9]{64}$/.test(authorization.chromePackageManifestSha256)
  ) throw new Error("unsafe Chrome stage authorization");
  return authorization;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

export async function reconcileStaleChromeStage(
  value: StageAuthorization,
): Promise<"absent" | "removed"> {
  const authorization = validateAuthorization(value), stageId = authorization.permitId;
  const root = `${STAGE_ROOT}/${stageId}`,
    ownerManifestPath = `${STAGE_ROOT}/${stageId}.owner.json`;
  const rootExists = await pathExists(root), ownerExists = await pathExists(ownerManifestPath);
  if (!rootExists && !ownerExists) return "absent";
  const stageParent = await assertStageDirectory(STAGE_ROOT, 0o700);
  if (!ownerExists) throw new Error("stale Chrome stage has no exact owner manifest");
  const owner = await ownerSnapshot(ownerManifestPath), manifest = owner.manifest;
  if (
    manifest.stageId !== stageId || manifest.permitId !== authorization.permitId ||
    manifest.sourceCommit !== authorization.sourceCommit || manifest.root !== root ||
    manifest.stageParentDev !== stageParent.dev || manifest.stageParentIno !== stageParent.ino ||
    manifest.package.manifestSha256 !== authorization.chromePackageManifestSha256
  ) throw new Error("stale Chrome stage identity does not match permit");
  if (["owned-launch-active", "cleanup-unresolved"].includes(manifest.cleanupLifecycle)) {
    throw new Error("stale Chrome stage retained for unresolved cleanup");
  }
  if (!rootExists) {
    const current = await ownerSnapshot(ownerManifestPath);
    if (current.dev !== owner.dev || current.ino !== owner.ino || current.sha256 !== owner.sha256) {
      throw new Error("stale Chrome stage owner changed during reconciliation");
    }
    await removeExactOwnerFile(
      stageParent.dev,
      stageParent.ino,
      stageId,
      owner.dev,
      owner.ino,
    );
    return "removed";
  }
  const stage: StagedChrome = {
    ...manifest.package,
    stageId,
    permitId: manifest.permitId,
    sourceCommit: manifest.sourceCommit,
    cleanupLifecycle: manifest.cleanupLifecycle,
    root,
    binary: `${root}/${manifest.package.binaryRelativePath}`,
    stageParentDev: manifest.stageParentDev,
    stageParentIno: manifest.stageParentIno,
    rootDev: manifest.rootDev,
    rootIno: manifest.rootIno,
    ownerManifestPath,
    ownerManifestSha256: owner.sha256,
    ownerDev: owner.dev,
    ownerIno: owner.ino,
  };
  await removeStagedChrome(stage);
  return "removed";
}

export async function stageChromePackage(
  sourceBinary: string,
  expectedBinarySha256: string,
  value: StageAuthorization,
): Promise<StagedChrome> {
  const authorization = validateAuthorization(value), stageId = authorization.permitId;
  const resolved = await Deno.realPath(sourceBinary);
  const inspected = await inspectResolvedChromePackage(resolved, expectedBinarySha256);
  if (inspected.manifestSha256 !== authorization.chromePackageManifestSha256) {
    throw new Error("Chrome package manifest differs from authorized permit");
  }
  const sourceRoot = resolved.slice(0, resolved.lastIndexOf("/"));
  await Deno.mkdir(STAGE_ROOT, { mode: 0o700 }).catch((error) => {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  });
  const stageParent = await assertStageDirectory(STAGE_ROOT, 0o700);
  await reconcileStaleChromeStage(authorization);
  const root = `${STAGE_ROOT}/${stageId}`,
    ownerManifestPath = `${STAGE_ROOT}/${stageId}.owner.json`;
  await Deno.mkdir(root, { mode: 0o700 });
  const createdRoot = await assertStageDirectory(root, 0o700);
  let ownerCreated = false;
  let stagedForFailure: StagedChrome | null = null;
  try {
    const directories = Object.keys(inspected.sourceDirectoryModes).filter((rel) => rel !== ".")
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
    for (const rel of directories) await Deno.mkdir(`${root}/${rel}`, { mode: 0o700 });
    for (const rel of Object.keys(inspected.files).sort()) {
      await Deno.copyFile(`${sourceRoot}/${rel}`, `${root}/${rel}`);
    }
    const sourceAfter = await inspectResolvedChromePackage(resolved, expectedBinarySha256);
    if (sourceAfter.manifestSha256 !== inspected.manifestSha256) {
      throw new Error("Chrome source package changed while staging");
    }
    for (const rel of Object.keys(inspected.files)) {
      const copied = await hashFile(`${root}/${rel}`);
      if (copied.sha256 !== inspected.files[rel]) {
        throw new Error("staged Chrome package copy mismatch");
      }
      await Deno.chmod(`${root}/${rel}`, inspected.stagedFileModes[rel]);
    }
    for (
      const rel of Object.keys(inspected.stagedDirectoryModes).sort((a, b) =>
        b.split("/").length - a.split("/").length || b.localeCompare(a)
      )
    ) {
      await Deno.chmod(rel === "." ? root : `${root}/${rel}`, inspected.stagedDirectoryModes[rel]);
    }
    const rootIdentity = await assertStageDirectory(root, DIRECTORY_MODE);
    const parentAfter = await assertStageDirectory(STAGE_ROOT, 0o700);
    if (parentAfter.dev !== stageParent.dev || parentAfter.ino !== stageParent.ino) {
      throw new Error("staged Chrome parent identity changed");
    }
    const incomplete = {
      ...inspected,
      stageId,
      permitId: authorization.permitId,
      sourceCommit: authorization.sourceCommit,
      cleanupLifecycle: "ready-no-owned-launch",
      root,
      binary: `${root}/${inspected.binaryRelativePath}`,
      stageParentDev: stageParent.dev,
      stageParentIno: stageParent.ino,
      rootDev: rootIdentity.dev,
      rootIno: rootIdentity.ino,
      ownerManifestPath,
      ownerManifestSha256: "",
      ownerDev: 0,
      ownerIno: 0,
    } satisfies StagedChrome;
    const ownerBody = canonicalize(ownerManifest(incomplete)) + "\n";
    const ownerHandle = await Deno.open(ownerManifestPath, {
      write: true,
      createNew: true,
      mode: OWNER_MODE,
    });
    try {
      await ownerHandle.write(new TextEncoder().encode(ownerBody));
      ownerHandle.sync();
    } finally {
      ownerHandle.close();
    }
    ownerCreated = true;
    const owner = await ownerSnapshot(ownerManifestPath);
    const stage: StagedChrome = {
      ...incomplete,
      ownerManifestSha256: owner.sha256,
      ownerDev: owner.dev,
      ownerIno: owner.ino,
    };
    stagedForFailure = stage;
    await verifyStagedChrome(stage);
    return stage;
  } catch (error) {
    const cleanupErrors: Error[] = [];
    let currentRoot: Deno.FileInfo | null = null;
    try {
      currentRoot = await Deno.lstat(root);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Deno.errors.NotFound)) {
        cleanupErrors.push(
          new Error("failed to inspect incomplete Chrome stage root", { cause: cleanupError }),
        );
      }
    }
    if (
      currentRoot && !currentRoot.isSymlink && currentRoot.isDirectory &&
      Number(currentRoot.dev) === createdRoot.dev && Number(currentRoot.ino) === createdRoot.ino
    ) {
      const mode = permissionMode(currentRoot, "failed Chrome stage root");
      if (mode === 0o700 || mode === DIRECTORY_MODE) {
        try {
          await removeExactStageTree(
            stageParent.dev,
            stageParent.ino,
            stageId,
            createdRoot.dev,
            createdRoot.ino,
            mode,
          );
        } catch (cleanupError) {
          cleanupErrors.push(
            new Error("incomplete Chrome stage tree removal unresolved", { cause: cleanupError }),
          );
        }
      }
    }
    if (cleanupErrors.length && stagedForFailure) {
      try {
        recordStageCleanupLifecycle(stagedForFailure, "cleanup-unresolved");
      } catch (cleanupError) {
        cleanupErrors.push(
          new Error("failed to record incomplete Chrome stage cleanup as unresolved", {
            cause: cleanupError,
          }),
        );
      }
    }
    if (ownerCreated && cleanupErrors.length === 0) {
      let owner: Awaited<ReturnType<typeof ownerSnapshot>> | null = null;
      try {
        owner = await ownerSnapshot(ownerManifestPath);
      } catch (cleanupError) {
        if (!(cleanupError instanceof Deno.errors.NotFound)) {
          cleanupErrors.push(
            new Error("failed to inspect incomplete Chrome stage owner", { cause: cleanupError }),
          );
        }
      }
      if (owner) {
        try {
          await removeExactOwnerFile(
            stageParent.dev,
            stageParent.ino,
            stageId,
            owner.dev,
            owner.ino,
          );
        } catch (cleanupError) {
          cleanupErrors.push(
            new Error("incomplete Chrome stage owner removal unresolved", { cause: cleanupError }),
          );
        }
      }
    }
    if (
      cleanupErrors.length && stagedForFailure &&
      stagedForFailure.cleanupLifecycle !== "cleanup-unresolved"
    ) {
      try {
        recordStageCleanupLifecycle(stagedForFailure, "cleanup-unresolved");
      } catch (cleanupError) {
        cleanupErrors.push(
          new Error("failed to record incomplete Chrome stage cleanup as unresolved", {
            cause: cleanupError,
          }),
        );
      }
    }
    if (cleanupErrors.length) {
      throw new AggregateError(
        [error instanceof Error ? error : new Error(String(error)), ...cleanupErrors],
        "Chrome staging failed with unresolved cleanup",
      );
    }
    throw error;
  }
}
