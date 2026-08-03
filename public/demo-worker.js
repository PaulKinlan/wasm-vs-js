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
  const constants = await import(
    `/demo-assets/audio/benchmarks/audio-shared/constants.js?run=${token}`
  );

  progress("Generating the frozen fixture and preparing the engine…");
  const prepared = await harness.prepareAudioHarness(slug, target, wasmBytes);

  progress("Running the contract iteration: transfer, compute, validation…");
  // One cold iteration: fixture transfer, compute, complete-output bound
  // against the pinned f64 reference, frozen output hash, structural
  // invariants, and exact work-counter identity all execute inside.
  const iteration = await prepared.runIteration(reference);

  let contractChecks;
  if (mode === "exact-contract") {
    progress("Hashing every served module, manifest, and artifact…");
    contractChecks = [];
    const check = (label, ok, detail) => contractChecks.push([label, ok === true, detail]);

    // Fetch and HASH every served byte the mode depends on. Nothing passes
    // by comparing one manifest's string against another's without hashing
    // the served bytes at least once in the chain.
    const assetsManifest = await fetchJson("/demo-assets/audio/manifest.json");
    const [buildManifest, fixtureManifest, inputManifest, outputManifest, referenceManifest] =
      await Promise.all(entry.manifestPaths.map((path) => fetchJson(path)));

    // 1. Every served engine module: hash the fetched bytes and compare to
    // the provenance manifest, then anchor the manifest's source hashes to
    // the accepted-commit build-manifest fullSourceGraph.
    const graphByPath = new Map(
      buildManifest.fullSourceGraph.map((file) => [file.path, file.sha256]),
    );
    let anchored = 0;
    for (const file of assetsManifest.files) {
      // Manifest output paths are repo-relative ("public/..."); the server
      // allowlist serves them without the "public/" prefix.
      const servedPath = `/${file.output.replace(/^public\//, "")}`;
      const servedBytes = await fetchBytes(servedPath);
      const servedHash = await sha256Hex(servedBytes);
      if (servedHash !== file.outputSha256) {
        check(
          `served module ${file.output}`,
          false,
          `served ${servedHash.slice(0, 16)}… != manifest`,
        );
        continue;
      }
      const graphHash = graphByPath.get(file.source);
      if (graphHash && graphHash === file.sourceSha256) anchored += 1;
      else check(`module source anchor ${file.source}`, false, "not anchored in fullSourceGraph");
    }
    check(
      "served engine modules",
      anchored === assetsManifest.files.length,
      `${anchored}/${assetsManifest.files.length} modules hash-verified and anchored to the accepted-commit source graph`,
    );

    // 2. Reference artifact: hash the fetched bytes; require agreement
    // across reference-manifest, build-manifest, and registry.
    const referenceHash = await sha256Hex(referenceBytes);
    check(
      "reference artifact hash",
      referenceHash === referenceManifest.sha256 &&
        referenceHash === buildManifest.referenceArtifact.sha256 &&
        referenceHash === entry.frozenHashes.referenceSha256 &&
        referenceHash === constants.AUDIO_FROZEN_HASHES[slug].referenceSha256,
      `${
        referenceHash.slice(0, 16)
      }… hashed from served bytes; agreement across reference-manifest, build-manifest, registry, and served constants`,
    );

    // 3. Input and output manifests against the run's own hashes and the
    // registry frozen hashes.
    check(
      "input manifest hash",
      inputManifest.sha256 === iteration.inputSha256 &&
        inputManifest.sha256 === entry.frozenHashes.inputSha256 &&
        inputManifest.sha256 === constants.AUDIO_FROZEN_HASHES[slug].inputSha256,
      `run input ${
        iteration.inputSha256.slice(0, 16)
      }… across input-manifest, registry, and served constants`,
    );
    check(
      "output manifest hash",
      outputManifest.sha256 === iteration.outputSha256 &&
        outputManifest.sha256 === entry.frozenHashes.outputSha256 &&
        outputManifest.sha256 === constants.AUDIO_FROZEN_HASHES[slug].outputSha256,
      `run output ${
        iteration.outputSha256.slice(0, 16)
      }… across output-manifest, registry, and served constants`,
    );
    const variantRecord = outputManifest.variants?.[iteration.variantId];
    check(
      "output variant record",
      variantRecord && variantRecord.status === "passed" &&
        variantRecord.completeOutputSha256 === iteration.outputSha256 &&
        variantRecord.referenceSha256 === referenceHash,
      `output-manifest variant ${iteration.variantId} records the same output and reference hashes`,
    );

    // 4. Engine artifact identity per target, hashed from served bytes.
    if (target === "wasm-linear") {
      const wasmHash = await sha256Hex(wasmBytes);
      check(
        "Wasm artifact hash",
        wasmHash === buildManifest.variants["wasm-linear-controlled"].artifactSha256,
        `${wasmHash.slice(0, 16)}… hashed from served bytes against the build-manifest artifact`,
      );
    } else {
      const workloadModule = assetsManifest.files.find((file) =>
        file.source === `benchmarks/${slug}/workload.ts`
      );
      check(
        "JavaScript engine source hash",
        Boolean(workloadModule) &&
          workloadModule.sourceSha256 === buildManifest.variants["js-controlled"].artifactSha256,
        "served engine module source hash matches the build-manifest recorded engine source",
      );
    }

    // 5. Fixture manifest and commit identity: every manifest and the
    // registry must name the same accepted source commit.
    const commits = new Set([
      buildManifest.sourceCommit,
      fixtureManifest.sourceCommit,
      inputManifest.sourceCommit,
      outputManifest.sourceCommit,
      referenceManifest.sourceCommit,
      registry.sourceCommit,
    ]);
    check(
      "source commit identity",
      commits.size === 1,
      `all five manifests and the registry name ${[...commits][0]?.slice(0, 12)}…`,
    );

    // 6. Fixed-memory relationship: registry pages must equal the served
    // constants module's pinned memory pages.
    check(
      "fixed memory relationship",
      entry.memoryPages === constants.AUDIO_MEMORY_PAGES[slug],
      `registry ${entry.memoryPages} pages == served AUDIO_MEMORY_PAGES ${
        constants.AUDIO_MEMORY_PAGES[slug]
      }`,
    );

    // 7. Fixture generator identity is declared and slug-consistent.
    check(
      "fixture manifest identity",
      fixtureManifest.entryId === entry.entryId &&
        fixtureManifest.benchmarkSlug === slug &&
        inputManifest.entryId === entry.entryId &&
        outputManifest.entryId === entry.entryId &&
        referenceManifest.entryId === entry.entryId &&
        buildManifest.entryId === entry.entryId,
      "all manifests name the same entry ID and slug as the registry",
    );

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
