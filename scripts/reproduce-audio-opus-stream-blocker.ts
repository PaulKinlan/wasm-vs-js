interface DownloadRecord {
  url: string;
  sha256: string;
  bytes: number;
}

interface CandidateRecord {
  package: string;
  version: string;
  download: DownloadRecord;
  observedMarkers: string[];
  disposition: string;
}

interface BlockerEvidence {
  schemaVersion: number;
  workloadId: string;
  catalogBinding: { sha256: string; immutability: string };
  status: string;
  coverageClaim: boolean;
  interactiveDemo: null;
  fixtureRecipe: {
    redistribution: string;
    archive: DownloadRecord;
    archiveLayout: {
      entryCountIncludingDirectory: number;
      bitstreams: number;
      referencePcmFiles: number;
    };
    officialInvocation: string;
    comparisonPolicy: {
      sampleRate: number;
      channelRuns: number[];
      vectorIds: string[];
      acceptance: string;
    };
  };
  referenceImplementation: {
    version: string;
    source: DownloadRecord;
    runnerPath: string;
  };
  controlledJavaScriptAudit: {
    requiredIndependence: string;
    searchDisposition: string;
    candidates: CandidateRecord[];
  };
  unavailableEvidence: Record<string, string>;
  reproduction: { denoVersion: string; committedFixtureBytes: boolean };
}

const DEFAULT_EVIDENCE = new URL(
  "../evidence/blockers/audio-opus-stream/independent-js-decoder.v1.json",
  import.meta.url,
);

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyBytes(
  label: string,
  bytes: Uint8Array,
  expected: DownloadRecord,
): Promise<void> {
  if (bytes.byteLength !== expected.bytes) {
    throw new Error(`${label}: byte length ${bytes.byteLength} != ${expected.bytes}`);
  }
  const actualHash = await sha256Hex(bytes);
  if (actualHash !== expected.sha256) {
    throw new Error(`${label}: SHA-256 ${actualHash} != ${expected.sha256}`);
  }
}

export function validateEvidence(evidence: BlockerEvidence): void {
  if (evidence.schemaVersion !== 1 || evidence.workloadId !== "audio.opus-stream.v1") {
    throw new Error("unexpected blocker identity");
  }
  if (
    evidence.catalogBinding.sha256 !==
      "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4" ||
    evidence.catalogBinding.immutability !== "byte-for-byte"
  ) {
    throw new Error("frozen catalog binding changed");
  }
  if (
    evidence.status !== "blocked" || evidence.coverageClaim !== false ||
    evidence.interactiveDemo !== null
  ) {
    throw new Error("blocker must not claim implementation or demo coverage");
  }
  if (
    evidence.fixtureRecipe.redistribution !== "recipe-only" ||
    evidence.reproduction.committedFixtureBytes !== false
  ) {
    throw new Error("official vector bytes must remain recipe-only");
  }
  const layout = evidence.fixtureRecipe.archiveLayout;
  if (
    layout.entryCountIncludingDirectory !== 37 || layout.bitstreams !== 12 ||
    layout.referencePcmFiles !== 24
  ) {
    throw new Error("unexpected official vector archive layout");
  }
  if (evidence.referenceImplementation.version !== "1.5.2") {
    throw new Error("libopus reference version is not pinned to 1.5.2");
  }
  if (
    evidence.controlledJavaScriptAudit.searchDisposition !== "no-qualifying-candidate" ||
    evidence.controlledJavaScriptAudit.candidates.length < 2
  ) {
    throw new Error("controlled JavaScript audit is incomplete");
  }
  for (const candidate of evidence.controlledJavaScriptAudit.candidates) {
    if (candidate.disposition !== "rejected-same-libopus-lineage-or-wasm-facade") {
      throw new Error(`${candidate.package}: candidate disposition is not fail-closed`);
    }
  }
  for (const [name, availability] of Object.entries(evidence.unavailableEvidence)) {
    if (availability !== "unavailable") {
      throw new Error(`${name}: missing evidence must remain unavailable`);
    }
  }
  if (evidence.reproduction.denoVersion !== "2.9.0") {
    throw new Error("reproduction runtime must remain Deno 2.9.0");
  }
}

async function fetchVerified(label: string, expected: DownloadRecord): Promise<Uint8Array> {
  const response = await fetch(expected.url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await verifyBytes(label, bytes, expected);
  return bytes;
}

async function writeArchive(root: string, name: string, bytes: Uint8Array): Promise<string> {
  const path = `${root}/${name}`;
  await Deno.writeFile(path, bytes, { create: true, mode: 0o600 });
  return path;
}

async function extractTar(archive: string, output: string): Promise<void> {
  await Deno.mkdir(output, { recursive: true, mode: 0o700 });
  const result = await new Deno.Command("tar", {
    args: ["-xzf", archive, "-C", output],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    throw new Error(`tar failed: ${new TextDecoder().decode(result.stderr)}`);
  }
}

async function collectRelativeFiles(root: string, current = root): Promise<string[]> {
  const paths: string[] = [];
  for await (const entry of Deno.readDir(current)) {
    const path = `${current}/${entry.name}`;
    if (entry.isDirectory) paths.push(...await collectRelativeFiles(root, path));
    else if (entry.isFile) paths.push(path.slice(root.length + 1));
  }
  return paths.sort();
}

async function verifyVectorArchive(root: string, evidence: BlockerEvidence): Promise<void> {
  const files = await collectRelativeFiles(root);
  const bitstreams = files.filter((path) => /^opus_newvectors\/testvector\d{2}\.bit$/.test(path));
  const references = files.filter((path) => /^opus_newvectors\/testvector\d{2}m?\.dec$/.test(path));
  if (bitstreams.length !== evidence.fixtureRecipe.archiveLayout.bitstreams) {
    throw new Error(`vector archive: expected 12 bitstreams, found ${bitstreams.length}`);
  }
  if (references.length !== evidence.fixtureRecipe.archiveLayout.referencePcmFiles) {
    throw new Error(`vector archive: expected 24 PCM references, found ${references.length}`);
  }
  for (const id of evidence.fixtureRecipe.comparisonPolicy.vectorIds) {
    for (const suffix of [".bit", ".dec", "m.dec"]) {
      const path = `opus_newvectors/testvector${id}${suffix}`;
      if (!files.includes(path)) throw new Error(`vector archive: missing ${path}`);
    }
  }
}

async function verifyLibopusSource(root: string): Promise<void> {
  const readme = await Deno.readTextFile(`${root}/opus-1.5.2/README`);
  const runner = await Deno.readTextFile(`${root}/opus-1.5.2/tests/run_vectors.sh`);
  const copying = await Deno.readTextFile(`${root}/opus-1.5.2/COPYING`);
  for (
    const marker of [
      "https://opus-codec.org/docs/opus_testvectors-rfc8251.tar.gz",
      "./tests/run_vectors.sh ./ opus_newvectors 48000",
    ]
  ) {
    if (!readme.includes(marker)) throw new Error(`libopus README missing ${marker}`);
  }
  for (
    const marker of [
      "for file in 01 02 03 04 05 06 07 08 09 10 11 12",
      '"$OPUS_COMPARE" -r "$RATE"',
      '"$OPUS_COMPARE" -s -r "$RATE"',
    ]
  ) {
    if (!runner.includes(marker)) throw new Error(`official runner missing ${marker}`);
  }
  if (!copying.includes("Redistribution and use in source and binary forms")) {
    throw new Error("libopus source license marker missing");
  }
}

async function verifyCandidate(root: string, candidate: CandidateRecord): Promise<void> {
  const packageRoot = `${root}/package`;
  const readme = await Deno.readTextFile(`${packageRoot}/README.md`);
  const packageJson = await Deno.readTextFile(`${packageRoot}/package.json`);
  if (candidate.package === "opusscript") {
    if (!readme.includes("JS bindings for libopus 1.4, ported with Emscripten")) {
      throw new Error("opusscript no longer identifies its libopus/Emscripten lineage");
    }
    const wasm = await Deno.stat(`${packageRoot}/build/opusscript_native_wasm.wasm`);
    if (!wasm.isFile) throw new Error("opusscript compiled Wasm payload missing");
  } else if (candidate.package === "opus-decoder") {
    if (!readme.includes("Based on [`libopus`") || !readme.includes("WASM")) {
      throw new Error("opus-decoder no longer identifies its libopus/Wasm lineage");
    }
    if (!packageJson.includes('"libopus"') || !packageJson.includes('"Wasm"')) {
      throw new Error("opus-decoder package markers changed");
    }
  } else {
    throw new Error(`unrecognized audited candidate ${candidate.package}`);
  }
}

async function fetchAudit(evidence: BlockerEvidence): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "opus-stream-blocker-" });
  try {
    const vectorBytes = await fetchVerified(
      "RFC 8251 vector archive",
      evidence.fixtureRecipe.archive,
    );
    const vectorArchive = await writeArchive(root, "vectors.tar.gz", vectorBytes);
    const vectorRoot = `${root}/vectors`;
    await extractTar(vectorArchive, vectorRoot);
    await verifyVectorArchive(vectorRoot, evidence);

    const sourceBytes = await fetchVerified(
      "libopus 1.5.2 source",
      evidence.referenceImplementation.source,
    );
    const sourceArchive = await writeArchive(root, "libopus.tar.gz", sourceBytes);
    const sourceRoot = `${root}/libopus`;
    await extractTar(sourceArchive, sourceRoot);
    await verifyLibopusSource(sourceRoot);

    for (const candidate of evidence.controlledJavaScriptAudit.candidates) {
      const bytes = await fetchVerified(
        `${candidate.package}@${candidate.version}`,
        candidate.download,
      );
      const archive = await writeArchive(root, `${candidate.package}.tgz`, bytes);
      const output = `${root}/${candidate.package}`;
      await extractTar(archive, output);
      await verifyCandidate(output, candidate);
    }
  } finally {
    await Deno.remove(root, { recursive: true }).catch(() => undefined);
  }
}

async function loadEvidence(path: string | URL): Promise<BlockerEvidence> {
  return JSON.parse(await Deno.readTextFile(path)) as BlockerEvidence;
}

if (import.meta.main) {
  const evidence = await loadEvidence(DEFAULT_EVIDENCE);
  validateEvidence(evidence);
  if (Deno.args.includes("--fetch")) await fetchAudit(evidence);
  console.log(
    JSON.stringify({
      workloadId: evidence.workloadId,
      status: evidence.status,
      coverageClaim: evidence.coverageClaim,
      fixtureRecipeVerified: Deno.args.includes("--fetch"),
      controlledJavaScriptDisposition: evidence.controlledJavaScriptAudit.searchDisposition,
    }),
  );
}
