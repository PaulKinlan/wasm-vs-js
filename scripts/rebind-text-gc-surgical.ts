// scripts/rebind-text-gc-surgical.ts
//
// Manifest redesign, slice 3 (docs/manifest-redesign.md): the text-gc
// build-manifest can NOT be rebuilt (the Kotlin WasmGC toolchain is absent),
// so when one of its pinned sources changes (deno.json, a workload script),
// the manifest needs a SURGICAL rebind. This replaces the oral-tradition
// procedure (see .auto/ideas.md "Rebind-script gap discovered", 2026-08-04):
//
//   1. Refresh every stale sources[] entry (bytes + sha256 from disk).
//   2. Set sourceCommit = HEAD.
//   3. Refresh every gitBlobOid = git rev-parse HEAD:<path>.
//   4. Recompute sourceTreeSha256.
//   5. Preserve the canonical byte format (sorted-compact single-line JSON).
//   6. Update evidence buildManifestSha256 anchors in evidence records.
//   7. Regenerate worker anchors (scripts/build-worker-anchors.ts) — the
//      build-manifest hash change cascades there automatically now.
//
// Fails closed: only entries whose pinned bytes/sha256 differ from disk are
// touched, and the run prints exactly what moved. If the WasmGC toolchain is
// ever present, DELETE this and rebuild the manifest properly.
//
// Usage: deno run --allow-read --allow-write=public --allow-run=git \
//          scripts/rebind-text-gc-surgical.ts

import { canonicalize, sha256Hex } from "../lib/canonical.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const MANIFEST = `${ROOT}public/artifacts/text-gc-document-edit/build-manifest.json`;

async function git(...args: string[]): Promise<string> {
  const out = await new Deno.Command("git", { args, stdout: "piped", stderr: "piped" })
    .output();
  if (!out.success) {
    throw new Error(`git ${args.join(" ")}: ${new TextDecoder().decode(out.stderr)}`);
  }
  return new TextDecoder().decode(out.stdout).trim();
}

const raw = await Deno.readTextFile(MANIFEST);
const manifest = JSON.parse(raw);
const head = await git("rev-parse", "HEAD");

const touched: string[] = [];
for (const source of manifest.sources) {
  const disk = await Deno.readFile(`${ROOT}${source.path}`);
  const sha = await sha256Hex(disk);
  if (sha !== source.sha256 || disk.byteLength !== source.bytes) {
    touched.push(
      `${source.path}: bytes ${source.bytes}→${disk.byteLength}, sha ${
        source.sha256.slice(0, 12)
      }…→${sha.slice(0, 12)}…`,
    );
    source.bytes = disk.byteLength;
    source.sha256 = sha;
  }
  source.gitBlobOid = await git("rev-parse", `HEAD:${source.path}`);
}
manifest.sourceCommit = head;

const sourceTree = manifest.sources.map((s: { path: string; sha256: string }) =>
  `${s.path}\0${s.sha256}\n`
).join("");
manifest.sourceTreeSha256 = await sha256Hex(sourceTree);

const canonical = `${canonicalize(manifest)}\n`;

await Deno.writeTextFile(MANIFEST, canonical);
const newBuildManifestBytes = new TextEncoder().encode(canonical);
const newBuildManifestSha = await sha256Hex(newBuildManifestBytes);

const evidencePaths = [
  "public/evidence/v1-base/text-gc-document-edit/js-controlled.json",
  "public/evidence/v1-base/text-gc-document-edit/wasmgc-controlled.json",
];

for (const path of evidencePaths) {
  const evUrl = `${ROOT}${path}`;
  const evData = JSON.parse(await Deno.readTextFile(evUrl));
  if (evData.anchors) {
    evData.anchors.buildManifestSha256 = newBuildManifestSha;
    await Deno.writeTextFile(evUrl, JSON.stringify(evData, null, 2) + "\n");
  }
}

console.log(`rebound ${touched.length} source entries (sourceCommit → ${head.slice(0, 8)}):`);
for (const line of touched) console.log(`  ${line}`);

// Cascade: the manifest hash changed → regenerate worker anchors.
const anchors = await new Deno.Command(Deno.execPath(), {
  args: ["run", "--allow-read", "--allow-write=public", "scripts/build-worker-anchors.ts"],
  stdout: "piped",
  stderr: "piped",
}).output();
console.log(new TextDecoder().decode(anchors.stdout).trim());
if (!anchors.success) {
  throw new Error(new TextDecoder().decode(anchors.stderr));
}
