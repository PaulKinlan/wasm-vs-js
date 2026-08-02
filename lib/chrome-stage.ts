import { canonicalize, sha256Hex } from "./canonical.ts";

export type StagedChrome = {
  root: string;
  binary: string;
  binarySha256: string;
  manifestSha256: string;
  files: Record<string, string>;
  rootDev: number;
  rootIno: number;
};

const STAGE_ROOT = "/tmp/wasm-vs-js-staged-chrome";
function safeId(value: string): string {
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(value)) throw new Error("unsafe Chrome stage id");
  return value;
}
async function walkFiles(root: string, relative = ""): Promise<string[]> {
  const output: string[] = [];
  for await (const entry of Deno.readDir(relative ? `${root}/${relative}` : root)) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const path = `${root}/${rel}`;
    const info = await Deno.lstat(path);
    if (info.isSymlink) throw new Error(`Chrome package symlink denied: ${rel}`);
    if (info.isDirectory) output.push(...await walkFiles(root, rel));
    else if (info.isFile) output.push(rel);
    else throw new Error(`unsupported Chrome package entry: ${rel}`);
  }
  return output.sort();
}
async function hashFile(path: string): Promise<string> {
  const before = await Deno.lstat(path);
  if (before.isSymlink || !before.isFile) throw new Error("unsafe staged Chrome file");
  const hash = await sha256Hex(await Deno.readFile(path));
  const after = await Deno.lstat(path);
  if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size) {
    throw new Error("staged Chrome file changed while hashing");
  }
  return hash;
}
function numberIdentity(value: number | bigint | null | undefined, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} unavailable`);
  return number;
}
async function expectedUid(): Promise<number> {
  return numberIdentity((await Deno.lstat(new URL(".", import.meta.url))).uid, "stage uid");
}
async function assertStageDirectory(path: string, writable: boolean) {
  const info = await Deno.lstat(path);
  if (
    info.isSymlink || !info.isDirectory || await Deno.realPath(path) !== path ||
    numberIdentity(info.uid, "stage uid") !== await expectedUid() ||
    (writable ? ((info.mode ?? 0) & 0o777) !== 0o700 : Boolean((info.mode ?? 0) & 0o222))
  ) throw new Error("unsafe staged Chrome directory");
  return {
    dev: numberIdentity(info.dev, "stage dev"),
    ino: numberIdentity(info.ino, "stage inode"),
  };
}
export async function verifyStagedChrome(stage: StagedChrome): Promise<void> {
  const root = await assertStageDirectory(stage.root, false);
  if (root.dev !== stage.rootDev || root.ino !== stage.rootIno) {
    throw new Error("staged Chrome root identity changed");
  }
  const paths = await walkFiles(stage.root);
  if (JSON.stringify(paths) !== JSON.stringify(Object.keys(stage.files).sort())) {
    throw new Error("staged Chrome package file set changed");
  }
  const files: Record<string, string> = {};
  for (const rel of paths) files[rel] = await hashFile(`${stage.root}/${rel}`);
  const digest = await sha256Hex(canonicalize(files));
  const rootAfter = await assertStageDirectory(stage.root, false);
  if (
    rootAfter.dev !== stage.rootDev || rootAfter.ino !== stage.rootIno ||
    digest !== stage.manifestSha256 ||
    files[stage.binary.slice(stage.root.length + 1)] !== stage.binarySha256
  ) {
    throw new Error("staged Chrome package manifest changed");
  }
}
export async function removeStagedChrome(stage: StagedChrome): Promise<void> {
  await verifyStagedChrome(stage);
  const paths = await walkFiles(stage.root);
  const dirs = new Set([stage.root]);
  for (const rel of paths) {
    await Deno.chmod(`${stage.root}/${rel}`, 0o600);
    let at = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    while (at) {
      dirs.add(`${stage.root}/${at}`);
      at = at.slice(0, at.lastIndexOf("/"));
    }
  }
  for (const dir of dirs) await Deno.chmod(dir, 0o700);
  await Deno.remove(stage.root, { recursive: true });
}

export async function inspectChromePackage(
  sourceBinary: string,
  expectedBinarySha256: string,
): Promise<
  {
    binaryRelativePath: string;
    binarySha256: string;
    manifestSha256: string;
    files: Record<string, string>;
  }
> {
  const resolved = await Deno.realPath(sourceBinary),
    sourceRoot = resolved.slice(0, resolved.lastIndexOf("/")),
    binaryRelativePath = resolved.slice(sourceRoot.length + 1),
    paths = await walkFiles(sourceRoot),
    files: Record<string, string> = {};
  for (const rel of paths) files[rel] = await hashFile(`${sourceRoot}/${rel}`);
  if (files[binaryRelativePath] !== expectedBinarySha256) {
    throw new Error("Chrome source binary hash mismatch");
  }
  return {
    binaryRelativePath,
    binarySha256: expectedBinarySha256,
    manifestSha256: await sha256Hex(canonicalize(files)),
    files,
  };
}

export async function stageChromePackage(
  sourceBinary: string,
  expectedBinarySha256: string,
  stageId: string,
): Promise<StagedChrome> {
  const resolved = await Deno.realPath(sourceBinary),
    sourceRoot = resolved.slice(0, resolved.lastIndexOf("/"));
  const sourceInfo = await Deno.lstat(resolved);
  if (sourceInfo.isSymlink || !sourceInfo.isFile) throw new Error("unsafe Chrome source binary");
  const relBinary = resolved.slice(sourceRoot.length + 1);
  const sourceFiles = await walkFiles(sourceRoot);
  const originalHash = await hashFile(resolved);
  if (originalHash !== expectedBinarySha256) throw new Error("Chrome source binary hash mismatch");
  await Deno.mkdir(STAGE_ROOT, { mode: 0o700 }).catch((error) => {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  });
  const stageParent = await assertStageDirectory(STAGE_ROOT, true);
  const root = `${STAGE_ROOT}/${safeId(stageId)}`;
  try {
    await Deno.lstat(root);
    throw new Error("Chrome stage already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await Deno.mkdir(root, { mode: 0o700 });
  try {
    for (const rel of sourceFiles) {
      const from = `${sourceRoot}/${rel}`,
        to = `${root}/${rel}`,
        parent = rel.includes("/") ? `${root}/${rel.slice(0, rel.lastIndexOf("/"))}` : root;
      await Deno.mkdir(parent, { recursive: true, mode: 0o700 });
      await Deno.copyFile(from, to);
    }
    const files: Record<string, string> = {};
    for (const rel of sourceFiles) files[rel] = await hashFile(`${root}/${rel}`);
    if (files[relBinary] !== expectedBinarySha256) throw new Error("staged Chrome binary mismatch");
    for (const rel of [...sourceFiles].sort((a, b) => b.split("/").length - a.split("/").length)) {
      await Deno.chmod(`${root}/${rel}`, rel === relBinary ? 0o500 : 0o400);
    }
    const dirs = new Set([root]);
    for (const rel of sourceFiles) {
      let at = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
      while (at) {
        dirs.add(`${root}/${at}`);
        at = at.slice(0, at.lastIndexOf("/"));
      }
    }
    for (const dir of [...dirs].sort((a, b) => b.length - a.length)) await Deno.chmod(dir, 0o500);
    const rootIdentity = await assertStageDirectory(root, false);
    const parentAfter = await assertStageDirectory(STAGE_ROOT, true);
    if (parentAfter.dev !== stageParent.dev || parentAfter.ino !== stageParent.ino) {
      throw new Error("staged Chrome parent identity changed");
    }
    const stage: StagedChrome = {
      root,
      binary: `${root}/${relBinary}`,
      binarySha256: expectedBinarySha256,
      manifestSha256: await sha256Hex(canonicalize(files)),
      files,
      rootDev: rootIdentity.dev,
      rootIno: rootIdentity.ino,
    };
    await verifyStagedChrome(stage);
    return stage;
  } catch (error) {
    await Deno.chmod(root, 0o700).catch(() => {});
    await Deno.remove(root, { recursive: true }).catch(() => {});
    throw error;
  }
}
