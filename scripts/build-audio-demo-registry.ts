// Regenerate the closed audio demo registry. The registry pins the served
// byte hashes of the runner, worker, and transpiled-assets manifest so the
// demo worker's exact-contract mode can anchor them, and a test requires
// this file to be byte-reproducible from the committed inputs.

const ROOT = new URL("../", import.meta.url);

// The independent anchor for each build manifest: the accepted run record's
// provenance.manifests.build.sha256 (committed, reviewed, outside the
// replaceable demo serving graph). Regeneration verifies the served bytes
// still match the record.
async function acceptedBuildManifestHash(slug: string): Promise<string> {
  const recordPath = `public/evidence/v2-proposals/${slug}/js-controlled.json`;
  const record = JSON.parse(await Deno.readTextFile(new URL(recordPath, ROOT).pathname));
  const pinned = record?.provenance?.manifests?.build?.sha256;
  if (typeof pinned !== "string" || !/^[a-f0-9]{64}$/.test(pinned)) {
    throw new Error(`accepted record ${recordPath} lacks provenance.manifests.build.sha256`);
  }
  const served = await Deno.readFile(
    new URL(`public/artifacts/${slug}/build-manifest.json`, ROOT).pathname,
  );
  const servedHash = await sha256Hex(served);
  if (servedHash !== pinned) {
    throw new Error(`served build manifest for ${slug} no longer matches the accepted record pin`);
  }
  return pinned;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

async function hashFile(path: string): Promise<string> {
  return await sha256Hex(await Deno.readFile(new URL(path, ROOT)));
}

const existing = JSON.parse(
  new TextDecoder().decode(await Deno.readFile(new URL("public/demo-registry.json", ROOT))),
);

const sourceCommits = await Promise.all(
  existing.demos.map(async (demo: Record<string, unknown>) => {
    const slug = demo.slug as string;
    const manifest = JSON.parse(
      await Deno.readTextFile(
        new URL(`public/artifacts/${slug}/build-manifest.json`, ROOT).pathname,
      ),
    );
    if (
      typeof manifest.sourceCommit !== "string" || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit)
    ) {
      throw new Error(`build manifest for ${slug} lacks a valid sourceCommit`);
    }
    return manifest.sourceCommit as string;
  }),
);
const uniqueSourceCommits = new Set(sourceCommits);
if (uniqueSourceCommits.size !== 1) {
  throw new Error("audio demo build manifests do not share one sourceCommit");
}

const registry = {
  ...existing,
  sourceCommit: sourceCommits[0],
  runnerSha256: await hashFile("public/demo-runner.js"),
  workerSha256: await hashFile("public/demo-worker.js"),
  assetsManifestSha256: await hashFile("public/demo-assets/audio/manifest.json"),
  // Key order is fixed for byte-stable output. Each demo gains the
  // build-manifest byte pin copied from its accepted run record.
  demos: await Promise.all(
    existing.demos.map(async (demo: Record<string, unknown>) => ({
      slug: demo.slug,
      entryId: demo.entryId,
      route: demo.route,
      title: demo.title,
      wasmPath: demo.wasmPath,
      referencePath: demo.referencePath,
      manifestPaths: demo.manifestPaths,
      buildManifestSha256: await acceptedBuildManifestHash(demo.slug as string),
      frozenHashes: demo.frozenHashes,
      memoryPages: demo.memoryPages,
      timeoutMs: demo.timeoutMs,
      modes: demo.modes,
      targets: demo.targets,
    })),
  ),
};
const ordered = {
  schemaVersion: registry.schemaVersion,
  contractId: registry.contractId,
  status: registry.status,
  authoritativePerformanceEvidence: registry.authoritativePerformanceEvidence,
  sourceCommit: registry.sourceCommit,
  runnerSha256: registry.runnerSha256,
  workerSha256: registry.workerSha256,
  assetsManifestSha256: registry.assetsManifestSha256,
  demos: registry.demos,
};
await Deno.writeTextFile(
  new URL("public/demo-registry.json", ROOT).pathname,
  JSON.stringify(ordered, null, 2) + "\n",
);
console.log("audio demo registry regenerated");
