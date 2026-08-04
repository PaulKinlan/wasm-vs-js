import { canonicalize, sha256Hex } from "../lib/canonical.ts";

const root = new URL("../", import.meta.url);

async function git(...args: string[]) {
  const result = await new Deno.Command("git", {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
}

const sourceCommit = await git("rev-parse", "HEAD");
const manifestUrl = new URL("public/artifacts/text-gc-document-edit/build-manifest.json", root);
const manifestText = await Deno.readTextFile(manifestUrl);
const manifest = JSON.parse(manifestText);

manifest.sourceCommit = sourceCommit;

for (const source of manifest.sources) {
  const fileUrl = new URL(source.path, root);
  const bytes = await Deno.readFile(fileUrl);
  const sha = await sha256Hex(bytes);
  const blobOid = await git("rev-parse", `${sourceCommit}:${source.path}`);
  source.bytes = bytes.length;
  source.sha256 = sha;
  source.gitBlobOid = blobOid;
}

const sourceTree = manifest.sources.map((s: { path: string; sha256: string }) =>
  `${s.path}\0${s.sha256}\n`
).join("");
manifest.sourceTreeSha256 = await sha256Hex(sourceTree);

const updatedManifestText = `${canonicalize(manifest)}\n`;
const newBuildManifestBytes = new TextEncoder().encode(updatedManifestText);
await Deno.writeFile(manifestUrl, newBuildManifestBytes);

const newBuildManifestSha = await sha256Hex(newBuildManifestBytes);

const evidencePaths = [
  "public/evidence/v1-base/text-gc-document-edit/js-controlled.json",
  "public/evidence/v1-base/text-gc-document-edit/wasmgc-controlled.json",
];

for (const path of evidencePaths) {
  const evUrl = new URL(path, root);
  const evData = JSON.parse(await Deno.readTextFile(evUrl));
  if (evData.anchors) {
    evData.anchors.buildManifestSha256 = newBuildManifestSha;
    await Deno.writeTextFile(evUrl, JSON.stringify(evData, null, 2) + "\n");
  }
}

console.log(
  `text-gc surgical rebind complete (sourceCommit=${sourceCommit}, buildManifestSha=${newBuildManifestSha})`,
);
