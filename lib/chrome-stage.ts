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
  if (
    before.isSymlink || !before.isFile || await Deno.realPath(path) !== path ||
    numberIdentity(before.uid, "stage owner uid") !== await expectedUid() ||
    permissionMode(before, "stage owner") !== OWNER_MODE
  ) throw new Error("unsafe Chrome stage owner manifest");
  const bytes = await Deno.readFile(path), sha256 = await sha256Hex(bytes);
  const manifest = JSON.parse(new TextDecoder().decode(bytes));
  assertStageOwnerSchema(manifest);
  const after = await Deno.lstat(path);
  if (
    after.isSymlink || !after.isFile || after.dev !== before.dev || after.ino !== before.ino ||
    after.size !== before.size || permissionMode(after, "stage owner") !== OWNER_MODE
  ) throw new Error("Chrome stage owner manifest changed while reading");
  return {
    manifest: manifest as StageOwnerManifest,
    sha256,
    dev: numberIdentity(before.dev, "stage owner dev"),
    ino: numberIdentity(before.ino, "stage owner inode"),
  };
}

async function assertStageDirectory(path: string, expectedMode: number) {
  const info = await Deno.lstat(path);
  if (
    info.isSymlink || !info.isDirectory || await Deno.realPath(path) !== path ||
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

export function recordStageCleanupLifecycle(
  stage: StagedChrome,
  cleanupLifecycle: CleanupLifecycleState,
): void {
  const before = Deno.lstatSync(stage.ownerManifestPath);
  if (
    before.isSymlink || !before.isFile ||
    numberIdentity(before.dev, "stage owner dev") !== stage.ownerDev ||
    numberIdentity(before.ino, "stage owner inode") !== stage.ownerIno ||
    permissionMode(before, "stage owner") !== OWNER_MODE
  ) throw new Error("unsafe Chrome stage lifecycle owner");
  const current = JSON.parse(Deno.readTextFileSync(stage.ownerManifestPath));
  assertStageOwnerSchema(current);
  if (canonicalize(current) !== canonicalize(ownerManifest(stage))) {
    throw new Error("Chrome stage lifecycle identity changed");
  }
  const next = { ...current, cleanupLifecycle };
  assertStageOwnerSchema(next);
  const handle = Deno.openSync(stage.ownerManifestPath, { write: true, truncate: true });
  try {
    handle.writeSync(new TextEncoder().encode(canonicalize(next) + "\n"));
    handle.syncSync();
  } finally {
    handle.close();
  }
  const after = Deno.lstatSync(stage.ownerManifestPath);
  if (after.isSymlink || after.dev !== before.dev || after.ino !== before.ino) {
    throw new Error("Chrome stage lifecycle owner replaced while recording");
  }
  stage.cleanupLifecycle = cleanupLifecycle;
  stage.ownerManifestSha256 = "";
}

export async function verifyStageOwnership(stage: StagedChrome): Promise<void> {
  if (
    stage.stageId !== safeId(stage.permitId) ||
    stage.root !== `${STAGE_ROOT}/${stage.stageId}` ||
    stage.ownerManifestPath !== `${STAGE_ROOT}/${stage.stageId}.owner.json` ||
    !/^[a-f0-9]{40}$/.test(stage.sourceCommit)
  ) throw new Error("staged Chrome ownership identity changed");
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

async function makeTreeRemovable(root: string): Promise<void> {
  const info = await Deno.lstat(root);
  if (info.isSymlink || !info.isDirectory) throw new Error("unsafe Chrome stage cleanup root");
  await Deno.chmod(root, 0o700);
  for await (const entry of Deno.readDir(root)) {
    const path = `${root}/${entry.name}`;
    const child = await Deno.lstat(path);
    if (child.isDirectory && !child.isSymlink) await makeTreeRemovable(path);
    else if (child.isFile && !child.isSymlink) await Deno.chmod(path, 0o600);
  }
}

export async function removeStagedChrome(stage: StagedChrome): Promise<void> {
  await verifyStagedChrome(stage);
  await makeTreeRemovable(stage.root);
  await Deno.remove(stage.root, { recursive: true });
  const owner = await ownerSnapshot(stage.ownerManifestPath);
  if (
    owner.sha256 !== stage.ownerManifestSha256 || owner.dev !== stage.ownerDev ||
    owner.ino !== stage.ownerIno
  ) throw new Error("Chrome stage owner changed during cleanup");
  await Deno.remove(stage.ownerManifestPath);
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
  if (!ownerExists) throw new Error("stale Chrome stage has no exact owner manifest");
  const owner = await ownerSnapshot(ownerManifestPath), manifest = owner.manifest;
  if (
    manifest.stageId !== stageId || manifest.permitId !== authorization.permitId ||
    manifest.sourceCommit !== authorization.sourceCommit || manifest.root !== root ||
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
    await Deno.remove(ownerManifestPath);
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
  let ownerCreated = false;
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
    await verifyStagedChrome(stage);
    return stage;
  } catch (error) {
    await makeTreeRemovable(root).catch(() => {});
    await Deno.remove(root, { recursive: true }).catch(() => {});
    if (ownerCreated) await Deno.remove(ownerManifestPath).catch(() => {});
    throw error;
  }
}
