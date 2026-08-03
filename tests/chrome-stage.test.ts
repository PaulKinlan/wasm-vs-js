import { assert, assertEquals, assertRejects } from "./assert.ts";
import {
  inspectChromePackage,
  reconcileStaleChromeStage,
  recordStageCleanupLifecycle,
  removeStagedChrome,
  setStageOwnerOpenRaceHookForTest,
  setStageRemovalRaceHookForTest,
  stageChromePackage,
  StagedChrome,
  verifyStagedChrome,
} from "../lib/chrome-stage.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";

function mode(info: Deno.FileInfo): number {
  if (info.mode === null) throw new Error("fixture mode unavailable");
  return info.mode & 0o7777;
}

async function fixturePackage() {
  const source = await Deno.makeTempDir(), binary = `${source}/chrome`;
  await Deno.mkdir(`${source}/helpers/nested`, { recursive: true });
  await Deno.mkdir(`${source}/empty`);
  await Deno.writeTextFile(binary, "original-binary");
  await Deno.writeTextFile(`${source}/chrome_crashpad_handler`, "crashpad");
  await Deno.writeTextFile(`${source}/helpers/nested/chrome_sandbox`, "sandbox");
  await Deno.writeTextFile(`${source}/resource.pak`, "resource");
  await Deno.chmod(binary, 0o755);
  await Deno.chmod(`${source}/chrome_crashpad_handler`, 0o755);
  await Deno.chmod(`${source}/helpers/nested/chrome_sandbox`, 0o711);
  await Deno.chmod(`${source}/resource.pak`, 0o640);
  return { source, binary, hash: await sha256Hex(await Deno.readFile(binary)) };
}

async function forceRemove(path: string): Promise<void> {
  const info = await Deno.lstat(path).catch(() => null);
  if (!info) return;
  if (info.isDirectory && !info.isSymlink) {
    await Deno.chmod(path, 0o700).catch(() => {});
    for await (const entry of Deno.readDir(path)) await forceRemove(`${path}/${entry.name}`);
  } else if (info.isFile && !info.isSymlink) await Deno.chmod(path, 0o600).catch(() => {});
  await Deno.remove(path).catch(() => {});
}

Deno.test("staging preserves executable classification, exact directory modes, and cleanup", async () => {
  const fixture = await fixturePackage();
  let stage: StagedChrome | undefined;
  try {
    const inspected = await inspectChromePackage(fixture.binary, fixture.hash);
    stage = await stageChromePackage(
      fixture.binary,
      fixture.hash,
      {
        permitId: `test-${crypto.randomUUID()}`,
        sourceCommit: "a".repeat(40),
        chromePackageManifestSha256: inspected.manifestSha256,
      },
    );
    assertEquals(stage.schemaVersion, 2);
    assertEquals(stage.manifestSha256, inspected.manifestSha256);
    assertEquals(stage.sourceFileModes, inspected.sourceFileModes);
    assertEquals(stage.stagedFileModes, {
      chrome: 0o500,
      chrome_crashpad_handler: 0o500,
      "helpers/nested/chrome_sandbox": 0o500,
      "resource.pak": 0o400,
    });
    assertEquals(mode(await Deno.lstat(stage.binary)), 0o500);
    assertEquals(mode(await Deno.lstat(`${stage.root}/chrome_crashpad_handler`)), 0o500);
    assertEquals(mode(await Deno.lstat(`${stage.root}/helpers/nested/chrome_sandbox`)), 0o500);
    assertEquals(mode(await Deno.lstat(`${stage.root}/resource.pak`)), 0o400);
    for (const rel of [".", "empty", "helpers", "helpers/nested"]) {
      assertEquals(
        mode(await Deno.lstat(rel === "." ? stage.root : `${stage.root}/${rel}`)),
        0o500,
      );
    }

    await Deno.writeTextFile(fixture.binary, "mutated-original");
    await Deno.chmod(`${fixture.source}/chrome_crashpad_handler`, 0o644);
    await verifyStagedChrome(stage);
    assertEquals(await Deno.readTextFile(stage.binary), "original-binary");

    await removeStagedChrome(stage);
    await assertRejects(() => Deno.lstat(stage!.root), "No such file");
    stage = undefined;
  } finally {
    if (stage) {
      await forceRemove(stage.root);
      await forceRemove(stage.ownerManifestPath);
    }
    await forceRemove(fixture.source);
  }
});

Deno.test("mode metadata changes the package digest and staged mode-only mutations fail closed", async () => {
  const fixture = await fixturePackage();
  let stage: StagedChrome | undefined;
  try {
    const executable = await inspectChromePackage(fixture.binary, fixture.hash);
    await Deno.chmod(`${fixture.source}/chrome_crashpad_handler`, 0o644);
    const nonExecutable = await inspectChromePackage(fixture.binary, fixture.hash);
    assert(executable.manifestSha256 !== nonExecutable.manifestSha256);
    assertEquals(nonExecutable.stagedFileModes.chrome_crashpad_handler, 0o400);
    await Deno.chmod(`${fixture.source}/chrome_crashpad_handler`, 0o755);

    stage = await stageChromePackage(
      fixture.binary,
      fixture.hash,
      {
        permitId: `test-${crypto.randomUUID()}`,
        sourceCommit: "a".repeat(40),
        chromePackageManifestSha256: executable.manifestSha256,
      },
    );
    await Deno.chmod(`${stage.root}/chrome_crashpad_handler`, 0o400);
    await assertRejects(() => verifyStagedChrome(stage!), "file mode changed");
    await Deno.chmod(`${stage.root}/chrome_crashpad_handler`, 0o500);

    await Deno.chmod(`${stage.root}/resource.pak`, 0o500);
    await assertRejects(() => verifyStagedChrome(stage!), "file mode changed");
    await Deno.chmod(`${stage.root}/resource.pak`, 0o400);

    await Deno.chmod(`${stage.root}/helpers/nested`, 0o700);
    await assertRejects(() => verifyStagedChrome(stage!), "directory mode changed");
    await Deno.chmod(`${stage.root}/helpers/nested`, 0o500);
    await verifyStagedChrome(stage);
    await removeStagedChrome(stage);
    stage = undefined;
  } finally {
    if (stage) {
      await forceRemove(stage.root);
      await forceRemove(stage.ownerManifestPath);
    }
    await forceRemove(fixture.source);
  }
});

Deno.test("source special bits and a nonexecutable main binary are rejected before staging", async () => {
  const fixture = await fixturePackage();
  try {
    await Deno.chmod(fixture.binary, 0o644);
    await assertRejects(
      () => inspectChromePackage(fixture.binary, fixture.hash),
      "main binary is not executable",
    );
    await Deno.chmod(fixture.binary, 0o755);

    await Deno.chmod(`${fixture.source}/chrome_crashpad_handler`, 0o4755);
    await assertRejects(
      () => inspectChromePackage(fixture.binary, fixture.hash),
      "special permission bits",
    );
    await Deno.chmod(`${fixture.source}/chrome_crashpad_handler`, 0o755);

    await Deno.chmod(`${fixture.source}/helpers`, 0o2755);
    await assertRejects(
      () => inspectChromePackage(fixture.binary, fixture.hash),
      "special permission bits",
    );
  } finally {
    await forceRemove(fixture.source);
  }
});

Deno.test("stale stages reconcile only for the exact permit, package, and owner identity", async () => {
  const fixture = await fixturePackage();
  const inspected = await inspectChromePackage(fixture.binary, fixture.hash);
  const authorization = {
    permitId: `test-${crypto.randomUUID()}`,
    sourceCommit: "b".repeat(40),
    chromePackageManifestSha256: inspected.manifestSha256,
  };
  let stage: StagedChrome | undefined;
  try {
    const first = await stageChromePackage(fixture.binary, fixture.hash, authorization);
    stage = await stageChromePackage(fixture.binary, fixture.hash, authorization);
    assert(first.rootIno !== stage.rootIno);

    recordStageCleanupLifecycle(stage, "cleanup-unresolved");
    await assertRejects(
      () => reconcileStaleChromeStage(authorization),
      "retained for unresolved cleanup",
    );
    assertEquals((await Deno.lstat(stage.root)).isDirectory, true);
    recordStageCleanupLifecycle(stage, "cleanup-verified");
    await verifyStagedChrome(stage);

    const originalOwner = await Deno.readTextFile(stage.ownerManifestPath);
    const wrongOwner = JSON.parse(originalOwner);
    wrongOwner.permitId = `wrong-${crypto.randomUUID()}`;
    await Deno.writeTextFile(stage.ownerManifestPath, canonicalize(wrongOwner) + "\n");
    await Deno.chmod(stage.ownerManifestPath, 0o600);
    await assertRejects(
      () => reconcileStaleChromeStage(authorization),
      "identity does not match permit",
    );
    assertEquals((await Deno.lstat(stage.root)).isDirectory, true);

    await Deno.writeTextFile(stage.ownerManifestPath, originalOwner);
    await Deno.chmod(stage.ownerManifestPath, 0o600);
    await reconcileStaleChromeStage(authorization);
    await assertRejects(() => Deno.lstat(stage!.root), "No such file");
    stage = undefined;
  } finally {
    if (stage) {
      await forceRemove(stage.root);
      await forceRemove(stage.ownerManifestPath);
    }
    await forceRemove(fixture.source);
  }
});

Deno.test("stage reconciliation rejects owner symlinks and source inspection rejects package symlinks", async () => {
  const fixture = await fixturePackage();
  const inspected = await inspectChromePackage(fixture.binary, fixture.hash);
  const authorization = {
    permitId: `test-${crypto.randomUUID()}`,
    sourceCommit: "c".repeat(40),
    chromePackageManifestSha256: inspected.manifestSha256,
  };
  let stage: StagedChrome | undefined;
  const externalOwner = await Deno.makeTempFile();
  try {
    stage = await stageChromePackage(fixture.binary, fixture.hash, authorization);
    const ownerBytes = await Deno.readFile(stage.ownerManifestPath);
    await Deno.writeFile(externalOwner, ownerBytes);
    await Deno.remove(stage.ownerManifestPath);
    await Deno.symlink(externalOwner, stage.ownerManifestPath);
    await assertRejects(
      () => reconcileStaleChromeStage(authorization),
      "unsafe Chrome stage owner manifest",
    );
    assertEquals((await Deno.lstat(stage.root)).isDirectory, true);
    await Deno.remove(stage.ownerManifestPath);
    await forceRemove(stage.root);
    stage = undefined;

    await Deno.symlink(externalOwner, `${fixture.source}/linked-resource`);
    await assertRejects(
      () => inspectChromePackage(fixture.binary, fixture.hash),
      "package symlink denied",
    );
  } finally {
    if (stage) {
      await forceRemove(stage.root);
      await forceRemove(stage.ownerManifestPath);
    }
    await forceRemove(fixture.source);
    await forceRemove(externalOwner);
  }
});

Deno.test("descriptor-bound lifecycle writes and stage cleanup reject pathname replacement", async () => {
  const fixture = await fixturePackage(), outside = await Deno.makeTempDir();
  const inspected = await inspectChromePackage(fixture.binary, fixture.hash);
  const authorization = {
    permitId: `test-${crypto.randomUUID()}`,
    sourceCommit: "d".repeat(40),
    chromePackageManifestSha256: inspected.manifestSha256,
  };
  let stage: StagedChrome | undefined;
  const foreignFile = `${outside}/foreign-owner`, foreignTree = `${outside}/foreign-tree`;
  await Deno.writeTextFile(foreignFile, "do-not-truncate");
  await Deno.mkdir(foreignTree);
  await Deno.writeTextFile(`${foreignTree}/keep`, "keep");
  try {
    stage = await stageChromePackage(fixture.binary, fixture.hash, authorization);
    const savedOwner = `${stage.ownerManifestPath}.saved`;
    setStageOwnerOpenRaceHookForTest((current) => {
      Deno.renameSync(current.ownerManifestPath, savedOwner);
      Deno.symlinkSync(foreignFile, current.ownerManifestPath);
    });
    await assertRejects(
      () => Promise.resolve().then(() => recordStageCleanupLifecycle(stage!, "cleanup-unresolved")),
      "unsafe Chrome stage lifecycle owner",
    );
    assertEquals(await Deno.readTextFile(foreignFile), "do-not-truncate");
    setStageOwnerOpenRaceHookForTest();
    await Deno.remove(stage.ownerManifestPath);
    await Deno.rename(savedOwner, stage.ownerManifestPath);

    const savedRoot = `${stage.root}.saved`;
    setStageRemovalRaceHookForTest(async (current) => {
      await Deno.rename(current.root, savedRoot);
      await Deno.symlink(foreignTree, current.root);
    });
    await assertRejects(
      () => removeStagedChrome(stage!),
      "fd-relative Chrome stage removal failed",
    );
    assertEquals(await Deno.readTextFile(`${foreignTree}/keep`), "keep");
    setStageRemovalRaceHookForTest();
    await Deno.remove(stage.root);
    await Deno.rename(savedRoot, stage.root);
    await removeStagedChrome(stage);
    stage = undefined;
  } finally {
    setStageOwnerOpenRaceHookForTest();
    setStageRemovalRaceHookForTest();
    if (stage) {
      await forceRemove(stage.root);
      await forceRemove(`${stage.root}.saved`);
      await forceRemove(stage.ownerManifestPath);
      await forceRemove(`${stage.ownerManifestPath}.saved`);
    }
    await forceRemove(fixture.source);
    await forceRemove(outside);
  }
});
