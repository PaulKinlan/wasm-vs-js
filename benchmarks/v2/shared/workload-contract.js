export const FROZEN_V1_REFERENCE = Object.freeze({
  catalogId: "workload-catalog-v1",
  schemaVersion: 1,
  catalogPath: "catalog/workloads.v1.json",
  catalogSha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  schemaPath: "schemas/workload-catalog.schema.json",
  schemaSha256: "7597aad1acd62c1f9a5e9343e8521d1c7906d59fddeec689eec19b50643c4b42",
  entryCount: 38,
  immutability: "byte-for-byte",
});

const PERFORMANCE_CLAIM_PATTERN =
  /\b(?:faster|fastest|slower|slowest|winner|wins|speedups?|outperforms?|regressions?)\b/i;

function duplicateValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function compareReference(actual) {
  return Object.entries(FROZEN_V1_REFERENCE).flatMap(([key, expected]) =>
    actual?.[key] === expected ? [] : [`inheritedV1.${key} does not match frozen v1`]
  );
}

export function validateProposalCatalogSemantics(catalog, v1Entries) {
  const errors = compareReference(catalog?.inheritedV1);
  const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
  const v1Ids = new Set((v1Entries ?? []).map((entry) => entry.id));
  const ids = entries.map((entry) => entry.id);
  const slugs = entries.map((entry) => entry.benchmarkSlug);

  if (catalog?.proposalCount !== entries.length) {
    errors.push("proposalCount does not match entries");
  }
  if (catalog?.prospectiveEntryCount !== FROZEN_V1_REFERENCE.entryCount + entries.length) {
    errors.push("prospectiveEntryCount does not reconcile with inherited v1");
  }
  if (duplicateValues(ids).length > 0) errors.push("duplicate proposal workload id");
  if (duplicateValues(slugs).length > 0) errors.push("duplicate proposal benchmark slug");
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort())) {
    errors.push("proposal workload ids must be deterministically sorted");
  }
  for (const id of ids) {
    if (v1Ids.has(id)) errors.push(`${id} collides with a frozen v1 workload id`);
  }

  if (!Array.isArray(catalog?.performanceClaims) || catalog.performanceClaims.length !== 0) {
    errors.push("proposal catalog must not contain performance claims");
  }
  if (PERFORMANCE_CLAIM_PATTERN.test(JSON.stringify(catalog))) {
    errors.push("proposal catalog contains performance-claim language");
  }

  for (const entry of entries) {
    if (entry.status !== "proposed" || entry.stage !== "contract-draft") {
      errors.push(`${entry.id} is not proposal-only`);
    }
    if (!Array.isArray(entry.performanceClaims) || entry.performanceClaims.length !== 0) {
      errors.push(`${entry.id} must not contain performance claims`);
    }
    for (const reference of entry.v1CoverageReferences ?? []) {
      if (!v1Ids.has(reference)) {
        errors.push(`${entry.id} references unknown frozen v1 workload ${reference}`);
      }
    }

    const parameterNames = (entry.input?.parameters ?? []).map((parameter) => parameter.name);
    if (duplicateValues(parameterNames).length > 0) {
      errors.push(`${entry.id} has duplicate input parameter names`);
    }
    if (entry.input?.manifestSha256 !== null || entry.input?.fixtureState !== "proposed") {
      errors.push(`${entry.id} incorrectly freezes a proposal fixture`);
    }

    const checks = entry.oracle?.checks ?? [];
    if (duplicateValues(checks).length > 0) errors.push(`${entry.id} has duplicate oracle checks`);
    const tolerance = entry.oracle?.tolerance;
    if (
      entry.oracle?.kind === "numeric-tolerance" &&
      (tolerance?.mode !== "absolute-and-relative" || !(tolerance.absolute > 0) ||
        !(tolerance.relative > 0))
    ) {
      errors.push(`${entry.id} numeric oracle lacks positive absolute and relative tolerances`);
    }
    if (
      entry.oracle?.kind !== "numeric-tolerance" &&
      (tolerance?.mode !== "exact" || tolerance.absolute !== null || tolerance.relative !== null)
    ) {
      errors.push(`${entry.id} exact oracle has a non-exact tolerance`);
    }

    const counters = entry.work?.counters ?? [];
    if (duplicateValues(counters).length > 0) {
      errors.push(`${entry.id} has duplicate work counters`);
    }
    if (entry.work?.fixed !== true || entry.work?.timeLimited !== false) {
      errors.push(`${entry.id} does not declare fixed, iteration-based work`);
    }
    if (entry.phases?.compute !== "measured" || entry.phases?.validation !== "separate") {
      errors.push(`${entry.id} must measure compute and keep validation separate`);
    }

    const tracks = new Map((entry.tracks ?? []).map((track) => [track.id, track]));
    const controlled = tracks.get("track-a-controlled");
    const optimized = tracks.get("track-b-optimized");
    if (
      tracks.size !== 2 || controlled?.track !== "controlled" ||
      controlled?.algorithmEquivalence !== "required" ||
      !controlled?.targets.includes("javascript") || !controlled?.targets.includes("wasm-linear")
    ) {
      errors.push(`${entry.id} lacks the controlled JS/linear-Wasm equivalence track`);
    }
    if (optimized?.track !== "optimized" || optimized?.algorithmEquivalence !== "separate-family") {
      errors.push(`${entry.id} lacks the separately reported optimized track`);
    }
    const variantIds = (entry.tracks ?? []).flatMap((track) => track.variantIds ?? []);
    if (duplicateValues(variantIds).length > 0) {
      errors.push(`${entry.id} reuses a variant id across tracks`);
    }
  }

  return { ok: errors.length === 0, errors };
}
