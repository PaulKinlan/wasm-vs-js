// Regenerate the audio build-manifest keys in public/inspectability.js's
// LOCAL_DOWNLOADS allowlist from the artifacts on disk.
//
// Why: the LOCAL_DOWNLOADS map gates localDownloadRoute derivation for the
// inspectability manifests. The three audio build-manifest entries pin the
// audio re-record artifacts — after any rebind that re-records the audio
// manifests (new lineage commit embedded -> new sha256), these keys go stale
// and the inspectability gate fails with
//   not equal: undefined != "/artifacts/audio-fft/build-manifest.json"
// Historically this was hand-keyed (and missed once, costing a gate cycle).
// This script makes the re-key mechanical: hash the on-disk artifacts and
// rewrite the three entries, preserving routes and formatting.
//
// The sum-u32 entries are deliberately NOT touched: they pin the frozen
// accepted-implementation artifacts (build-manifest.9c309c49.json, stamped
// by server.ts's acceptedImplementationCommit), not the rebuildable files.
//
// Usage:
//   deno run --allow-read=public/artifacts,public/inspectability.js \
//     --allow-write=public/inspectability.js scripts/rebind-local-downloads.ts
//   deno run --allow-read=public/artifacts,public/inspectability.js \
//     scripts/rebind-local-downloads.ts --check   # exit 1 if stale
//
// Wire into rebind-server-ts.sh AFTER the audio re-record steps (the map must
// be re-keyed last, since the re-record re-stamps the manifests internally).

const SLUGS = ["audio-fft", "audio-fir", "audio-stft"];
const TARGET = "public/inspectability.js";

async function sha256Hex(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const entries = new Map<string, string>();
for (const slug of SLUGS) {
  const path = `public/artifacts/${slug}/build-manifest.json`;
  const hash = await sha256Hex(path);
  entries.set(slug, `${path}|${hash}`);
}

const source = await Deno.readTextFile(TARGET);
let updated = source;
let changed = false;
for (const slug of SLUGS) {
  const key = entries.get(slug)!;
  const pattern = new RegExp(
    `(public/artifacts/${slug}/build-manifest\\.json\\|)[0-9a-f]{64}`,
  );
  if (!pattern.test(updated)) {
    throw new Error(`LOCAL_DOWNLOADS missing ${slug} build-manifest entry`);
  }
  const replaced = updated.replace(pattern, `$1${key.split("|")[1]}`);
  if (replaced !== updated) changed = true;
  updated = replaced;
}

const check = Deno.args.includes("--check");
if (check) {
  if (changed) {
    console.error(`rebind-local-downloads: STALE — audio build-manifest keys need re-keying`);
    Deno.exit(1);
  }
  console.error(`rebind-local-downloads: ok — all audio keys match disk`);
  Deno.exit(0);
}

if (changed) {
  await Deno.writeTextFile(TARGET, updated);
  console.error(`rebind-local-downloads: re-keyed audio build-manifest entries`);
} else {
  console.error(`rebind-local-downloads: ok — no changes needed`);
}
