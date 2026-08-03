// Demo worker: executes ONE cold contract iteration of an audio workload
// inside a fresh module worker, using the exact repository engines
// (transpiled byte-reproducibly into /demo-assets/audio/ with a recorded
// provenance manifest) and the exact published artifacts (Wasm bytes,
// pinned f64 reference). Reports correctness, oracle, and counter evidence
// only — no timing values leave this worker.

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`fetch ${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`fetch ${path}: HTTP ${response.status}`);
  return await response.json();
}

self.addEventListener("message", (event) => {
  const { token, slug, target, mode } = event.data;
  const progress = (step) => self.postMessage({ token, type: "progress", step });
  run(token, slug, target, mode, progress).catch((error) => {
    self.postMessage({
      token,
      type: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
  });
});

async function run(token, slug, target, mode, progress) {
  progress("Fetching the demo registry…");
  const registry = await fetchJson("/demo-registry.json");
  const entry = registry.demos.find((demo) => demo.slug === slug);
  if (!entry) throw new Error(`slug ${slug} is not in the closed demo registry`);
  if (!entry.targets.includes(target)) throw new Error(`target ${target} denied for ${slug}`);
  if (!entry.modes.includes(mode)) throw new Error(`mode ${mode} denied for ${slug}`);

  progress("Fetching the pinned f64 reference artifact…");
  const referenceBytes = await fetchBytes(entry.referencePath);
  const reference = new Float32Array(
    referenceBytes.buffer,
    referenceBytes.byteOffset,
    referenceBytes.byteLength / 4,
  );

  let wasmBytes;
  if (target === "wasm-linear") {
    progress("Fetching the published Wasm artifact…");
    wasmBytes = await fetchBytes(entry.wasmPath);
  }

  progress("Loading the exact workload engines…");
  // Cache-busted import: this worker's module graph is fresh anyway, and the
  // query documents that every run evaluates its own copy of the engines.
  const harness = await import(`/demo-assets/audio/lib/audio-workloads.js?run=${token}`);

  progress("Generating the frozen fixture and preparing the engine…");
  const prepared = await harness.prepareAudioHarness(slug, target, wasmBytes);

  progress("Running the contract iteration: transfer, compute, validation…");
  // One cold iteration: fixture transfer, compute, complete-output bound
  // against the pinned f64 reference, frozen output hash, structural
  // invariants, and exact work-counter identity all execute inside.
  const iteration = await prepared.runIteration(reference);

  let contractChecks;
  if (mode === "exact-contract") {
    progress("Verifying the full artifact contract…");
    const assetsManifest = await fetchJson("/demo-assets/audio/manifest.json");
    const [buildManifest, referenceManifest] = await Promise.all([
      fetchJson(entry.manifestPaths[0]),
      fetchJson(entry.manifestPaths[4]),
    ]);
    const referenceHash = await sha256Hex(referenceBytes);
    contractChecks = [];
    contractChecks.push([
      "reference artifact hash",
      referenceHash === referenceManifest.sha256 &&
      referenceHash === buildManifest.referenceArtifact.sha256 &&
      referenceHash === entry.frozenHashes.referenceSha256,
      `${referenceHash.slice(0, 16)}… across reference-manifest, build-manifest, and registry`,
    ]);
    if (target === "wasm-linear") {
      const wasmHash = await sha256Hex(wasmBytes);
      const recorded = buildManifest.variants["wasm-linear-controlled"].artifactSha256;
      contractChecks.push([
        "Wasm artifact hash",
        wasmHash === recorded,
        `${wasmHash.slice(0, 16)}… against the build-manifest recorded artifact`,
      ]);
    } else {
      const engineSource = assetsManifest.files.find((file) =>
        file.source === `benchmarks/${slug}/workload.ts`
      );
      const recorded = buildManifest.variants["js-controlled"].artifactSha256;
      contractChecks.push([
        "JavaScript engine source hash",
        Boolean(engineSource) && engineSource.sourceSha256 === recorded,
        `transpiled-from-source hash against the build-manifest recorded engine source`,
      ]);
    }
    contractChecks.push([
      "demo asset provenance",
      assetsManifest.files.every((file) => file.output && file.outputSha256 && file.sourceSha256),
      `${assetsManifest.files.length} transpiled modules carry source and output hashes`,
    ]);
    const failed = contractChecks.filter(([, ok]) => !ok);
    if (failed.length > 0) {
      throw new Error(
        `exact-contract verification failed: ${failed.map(([label]) => label).join(", ")}`,
      );
    }
  }

  self.postMessage({
    token,
    type: "completed",
    mode,
    target,
    variantId: iteration.variantId,
    inputSha256: iteration.inputSha256,
    outputSha256: iteration.outputSha256,
    counters: iteration.counters,
    oracleChecks: iteration.oracleChecks,
    contractChecks,
  });
}
