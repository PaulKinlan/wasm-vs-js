const REQUIRED_SOURCE_ROLES = ["javascript-authored", "wasm-authored"];

function duplicateValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function sameMembers(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function allFileReferences(record) {
  const provenance = record.provenance ?? {};
  const build = provenance.build ?? {};
  return [
    record.workloadCatalog?.file,
    record.workloadContract?.file,
    record.resultContract?.file,
    ...(provenance.sources ?? []),
    provenance.generator,
    provenance.reference,
    provenance.oracle,
    ...Object.values(provenance.manifests ?? {}),
    build.recipe,
    ...(build.locks ?? []),
    ...(provenance.artifacts ?? []),
  ].filter(Boolean);
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function validateProposalProvenanceSemantics(record, catalog, options = {}) {
  const errors = [];
  const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
  const entry = entries.find((candidate) => candidate.id === record.workload?.entryId);
  const variants = (entry?.tracks ?? []).flatMap((track) =>
    (track.variants ?? []).map((variant) => ({ ...variant, track: track.track }))
  );
  const variant = variants.find((candidate) => candidate.id === record.workload?.variant?.id);

  if (!entry) {
    errors.push(`unknown proposal workload ${record.workload?.entryId}`);
  } else if (record.workload?.benchmarkSlug !== entry.benchmarkSlug) {
    errors.push("benchmark slug does not match the proposal catalog");
  }
  if (!variant) {
    errors.push(`unknown proposal variant ${record.workload?.variant?.id}`);
  } else {
    for (const field of ["target", "track", "algorithmFamilyId"]) {
      if (record.workload.variant[field] !== variant[field]) {
        errors.push(`variant ${field} does not match the proposal catalog`);
      }
    }
  }

  const sourceRoles = (record.provenance?.sources ?? []).map((source) => source.role);
  for (const role of REQUIRED_SOURCE_ROLES) {
    if (!sourceRoles.includes(role)) errors.push(`missing required source role ${role}`);
  }
  const artifactIds = (record.provenance?.artifacts ?? []).map((artifact) => artifact.id);
  if (duplicateValues(artifactIds).length > 0) errors.push("duplicate artifact id");
  const toolNames = (record.provenance?.build?.toolchain ?? []).map((tool) => tool.name);
  if (duplicateValues(toolNames).length > 0) errors.push("duplicate toolchain name");
  const environmentNames = (record.provenance?.build?.environment ?? []).map((item) => item.name);
  if (duplicateValues(environmentNames).length > 0) errors.push("duplicate environment name");

  if (entry) {
    const expectedCoverage = {
      inputParameterIds: entry.input.parameters.map((parameter) => parameter.name),
      oracleCheckIds: entry.oracle.checks.map((check) => check.id),
      workCounterIds: entry.work.counters,
      phaseIds: Object.keys(entry.phases),
      missingCellIds: entry.missingCells.map((cell) => cell.cell),
    };
    for (const [field, expected] of Object.entries(expectedCoverage)) {
      if (!sameMembers(record.semanticCoverage?.[field] ?? [], expected)) {
        errors.push(`semantic coverage ${field} does not match the proposal catalog`);
      }
    }
    if (!sameMembers(record.correctness?.oracleCheckIds ?? [], expectedCoverage.oracleCheckIds)) {
      errors.push("correctness oracle checks do not cover the proposal contract");
    }
  }

  const outputManifest = record.provenance?.manifests?.output;
  const isAudio = /^audio\.(?:fft|fir|stft)\.v1$/.test(record.workload?.entryId ?? "");
  if (isAudio) {
    if (!record.provenance?.manifests?.reference) {
      errors.push("audio provenance requires the pinned reference manifest");
    }
    if (!record.provenance?.manifests?.build) {
      errors.push("audio provenance requires the immutable build manifest");
    }
    const expectedReferencePath =
      `public/artifacts/${record.workload?.benchmarkSlug}/reference-output.f32le`;
    if (
      !(record.provenance?.artifacts ?? []).some((artifact) =>
        artifact.path === expectedReferencePath
      )
    ) {
      errors.push("audio provenance requires the pinned reference artifact");
    }
  }
  if (!outputManifest?.sha256) errors.push("output manifest hash is required");
  if (record.correctness?.outputManifestSha256 !== outputManifest?.sha256) {
    errors.push("correctness output manifest hash does not match provenance");
  }

  const refs = allFileReferences(record);
  const expectedPrefix = `${record.source?.repository}/blob/${record.source?.commit}/`;
  const pathIdentities = new Map();
  for (const ref of refs) {
    const expectedUrl = `${expectedPrefix}${ref.path}`;
    if (ref.immutableUrl !== expectedUrl) {
      errors.push(`immutable link does not match commit and path: ${ref.path}`);
    }
    const prior = pathIdentities.get(ref.path);
    const identity = `${ref.sha256}|${ref.immutableUrl}`;
    if (prior !== undefined && prior !== identity) {
      errors.push(`resource path has conflicting hash or link: ${ref.path}`);
    } else {
      pathIdentities.set(ref.path, identity);
    }
  }

  if (record.workloadCatalog?.catalogId !== catalog?.catalogId) {
    errors.push("catalog identity does not match the proposal catalog");
  }
  if (record.workloadCatalog?.file?.path !== "catalog/workloads.v2.proposed.json") {
    errors.push("catalog path does not identify the proposal catalog");
  }
  if (
    record.workloadContract?.contractId !== catalog?.workloadContract?.contractId ||
    record.workloadContract?.file?.path !== catalog?.workloadContract?.contractPath
  ) {
    errors.push("workload contract identity does not match the proposal catalog");
  }
  if (
    record.resultContract?.contractId !== catalog?.resultContract?.contractId ||
    record.resultContract?.file?.path !== catalog?.resultContract?.schemaPath
  ) {
    errors.push("result contract identity does not match the proposal catalog");
  }
  if (options.requireLocalFiles && !options.expectedSourceCommit) {
    errors.push("local inspection requires the exact inspected source commit");
  } else if (
    options.expectedSourceCommit && record.source?.commit !== options.expectedSourceCommit
  ) {
    errors.push("source commit does not match the inspected commit");
  }

  const expectedVariantKey = `${record.workload?.entryId}/${record.workload?.variant?.id}`;
  if (record.collisionGuards?.workloadVariantKey !== expectedVariantKey) {
    errors.push("workload variant collision guard is inconsistent");
  }
  if (
    record.collisionGuards?.algorithmIdentityKey !== record.workload?.variant?.algorithmFamilyId
  ) {
    errors.push("algorithm identity collision guard is inconsistent");
  }
  if (!sameMembers(record.collisionGuards?.resourcePaths ?? [], [...pathIdentities.keys()])) {
    errors.push("resource path collision guard is incomplete");
  }
  if (!sameMembers(record.collisionGuards?.artifactIds ?? [], artifactIds)) {
    errors.push("artifact id collision guard is incomplete");
  }

  const readFile = options.readFile ?? ((path) => Deno.readFile(path));
  const repoRoot = String(options.repoRoot ?? ".").replace(/\/$/, "");
  const localBytes = new Map();
  for (const [path] of pathIdentities) {
    try {
      const bytes = await readFile(`${repoRoot}/${path}`);
      localBytes.set(path, bytes);
      const actualHash = await sha256(bytes);
      const refsForPath = refs.filter((ref) => ref.path === path);
      if (refsForPath.some((ref) => ref.sha256 !== actualHash)) {
        errors.push(`local hash does not match provenance: ${path}`);
      }
    } catch (error) {
      if (options.requireLocalFiles || !(error instanceof Deno.errors.NotFound)) {
        errors.push(`local provenance file is not resolvable: ${path}`);
      }
    }
  }

  if (isAudio && localBytes.size > 0) {
    try {
      const decodeJson = (path) => JSON.parse(new TextDecoder().decode(localBytes.get(path)));
      const output = decodeJson(record.provenance.manifests.output.path);
      const buildManifest = decodeJson(record.provenance.manifests.build.path);
      const variantEvidence = output.variants?.[record.workload.variant.id];
      const executed = Object.entries(variantEvidence?.oracleChecks ?? {})
        .filter(([, value]) => value?.status === "passed")
        .map(([id]) => id);
      if (!sameMembers(executed, record.correctness?.oracleCheckIds ?? [])) {
        errors.push("audio correctness does not match executed output-manifest checks");
      }
      if (variantEvidence?.referenceSha256 !== buildManifest.referenceArtifact?.sha256) {
        errors.push("audio output and build manifests disagree on the pinned reference");
      }
      if (!/^[a-f0-9]{40}$/.test(buildManifest.sourceCommit ?? "")) {
        errors.push("audio build manifest lacks a typed implementation commit");
      }
      const wasmFeatures = buildManifest.variants?.["wasm-linear-controlled"]?.features;
      if (
        wasmFeatures?.initialPages !== wasmFeatures?.maximumPages ||
        wasmFeatures?.memoryGrowth !== false
      ) {
        errors.push("audio build manifest does not prove fixed non-growing memory");
      }
    } catch {
      errors.push("audio manifest semantic evidence is not readable");
    }
  }

  return { ok: errors.length === 0, errors };
}
