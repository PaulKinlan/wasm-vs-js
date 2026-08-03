// Clean-cache reproduction proof for the audio demo assets: rebuilds the
// demo assets with a FRESH temporary DENO_DIR (no npm cache) against the
// committed dedicated lockfile, then compares every emitted byte against
// the committed outputs. Requires network access to registry.npmjs.org; it
// is a validation script, not an in-gate test, because the gate's network
// permission is 127.0.0.1-only. Evidence is written to
// evidence/build/audio-demo-clean-cache.json.

const ROOT = new URL("../", import.meta.url);
const MODULE_OUTPUTS = [
  "benchmarks/audio-fft/workload.js",
  "benchmarks/audio-fir/workload.js",
  "benchmarks/audio-stft/workload.js",
  "benchmarks/audio-shared/canonical.js",
  "benchmarks/audio-shared/constants.js",
  "benchmarks/audio-shared/oracle.js",
  "lib/audio-workloads.js",
];

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const denoDir = await Deno.makeTempDir();
try {
  const started = new Date().toISOString();
  const build = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/demo-assets",
      "--allow-env",
      "--allow-run",
      "--allow-net",
      "--lock=scripts/audio-demo-assets.lock",
      "scripts/build-audio-demo-assets.ts",
    ],
    cwd: new URL(".", ROOT).pathname,
    env: { DENO_DIR: denoDir },
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!build.success) {
    throw new Error(`clean-cache build failed: ${new TextDecoder().decode(build.stderr)}`);
  }
  const files = [];
  let identical = true;
  for (const output of MODULE_OUTPUTS) {
    const path = `public/demo-assets/audio/${output}`;
    const bytes = await Deno.readFile(new URL(path, ROOT));
    const hash = await sha256Hex(bytes);
    files.push({ output: path, sha256: hash, bytes: bytes.byteLength });
  }
  const manifest = JSON.parse(
    new TextDecoder().decode(
      await Deno.readFile(new URL("public/demo-assets/audio/manifest.json", ROOT)),
    ),
  );
  for (const file of manifest.files) {
    const match = files.find((entry) => entry.output === file.output);
    if (!match || match.sha256 !== file.outputSha256) identical = false;
  }
  const evidence = {
    schemaVersion: 1,
    contractId: "audio-demo-clean-cache-reproduction-v1",
    started,
    finished: new Date().toISOString(),
    denoVersion: Deno.version.deno,
    cacheDirectory: "fresh temporary DENO_DIR (created and removed by this script)",
    lockfile: "scripts/audio-demo-assets.lock",
    typescript: "5.9.2 (integrity-pinned in the dedicated lockfile)",
    outputsByteIdenticalToCommittedManifest: identical,
    files,
  };
  await Deno.mkdir(new URL("evidence/build", ROOT).pathname, { recursive: true });
  await Deno.writeTextFile(
    new URL("evidence/build/audio-demo-clean-cache.json", ROOT).pathname,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  if (!identical) throw new Error("clean-cache outputs differ from the committed manifest");
  console.log("clean-cache reproduction: byte-identical outputs");
} finally {
  await Deno.remove(denoDir, { recursive: true }).catch(() => {});
}
