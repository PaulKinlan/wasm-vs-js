// Regenerate the closed audio demo registry. The registry pins the served
// byte hashes of the runner, worker, and transpiled-assets manifest so the
// demo worker's exact-contract mode can anchor them, and a test requires
// this file to be byte-reproducible from the committed inputs.

const ROOT = new URL("../", import.meta.url);

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

const registry = {
  ...existing,
  runnerSha256: await hashFile("public/demo-runner.js"),
  workerSha256: await hashFile("public/demo-worker.js"),
  assetsManifestSha256: await hashFile("public/demo-assets/audio/manifest.json"),
  // Key order is fixed for byte-stable output.
  demos: existing.demos,
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
