// Records-mode manifest evidence verification for the v2 neural slices.
// Re-attests everything the artifacts build recorded before any result
// record may be marked passed: every catalog oracle check executed, exact
// structural check ID sets (including finite-values) for BOTH variants with
// no omissions or duplicates, exact counter sets and values, every recorded
// bound ratio below 1, and exact phase attestation maps matching the
// catalog's declared phase map for both variants.

import { canonicalize } from "../canonical.ts";
import { gemmWorkCounters, mlpWorkCounters } from "./neural.ts";

// Exact structural invariant IDs per workload, one per component named in
// the catalog's structural-invariants check descriptions:
// ml.gemm.v1: "Tensor shape, finite-value, row checksum, and corner-element
//   invariants hold."
// ml.dense-mlp.v1: "Final logits, ranking, tensor shapes, finite values,
//   and GELU formula invariants hold."
export const EXPECTED_STRUCTURAL_IDS: Record<string, string[]> = {
  "ml-gemm": ["shape", "finite-values", "row-checksums", "corner-elements"],
  "ml-dense-mlp": ["tensor-shapes", "finite-values", "final-logits", "ranking", "gelu-invariants"],
};

type CatalogEntryForEvidence = {
  oracle: { checks: { id: string }[] };
  work: { counters: string[] };
  phases: Record<string, string>;
  tracks: { id: string; variants: { id: string }[] }[];
};

export type OutputManifestForEvidence = {
  oracleChecks?: string[];
  structuralChecks?: Record<string, { id: string; passed: boolean }[]>;
  boundChecks?: Record<string, { maxBoundRatio: number }>;
  layerChecks?: { js: { maxBoundRatio: number }; wasm: { maxBoundRatio: number } }[];
  crossTarget?: { maxBoundRatio: number };
  counters?: Record<string, Record<string, number>>;
  phases?: Record<string, Record<string, string>>;
};

export function verifyManifestEvidence(
  slug: string,
  entry: CatalogEntryForEvidence,
  manifest: OutputManifestForEvidence,
): void {
  const controlled = entry.tracks.find((track) => track.id === "track-a-controlled");
  if (!controlled) throw new Error(`${slug}: catalog controlled track missing`);
  const variantIds = controlled.variants.map((variant) => variant.id);

  // Every catalog oracle check must be recorded as executed, with no
  // omissions or duplicates.
  const declared = entry.oracle.checks.map((check) => check.id);
  const executed = Object.hasOwn(manifest, "oracleChecks") ? manifest.oracleChecks : undefined;
  if (!Array.isArray(executed)) throw new Error(`${slug}: oracleChecks missing or not an array`);
  if (new Set(executed).size !== executed.length) {
    throw new Error(`${slug}: duplicate executed oracle check ids`);
  }
  if (canonicalize([...executed].sort()) !== canonicalize([...declared].sort())) {
    throw new Error(`${slug}: executed oracle checks differ from catalog: ${executed}`);
  }

  // Exact variant-key sets: no missing AND no extra variant maps anywhere.
  const exactVariantKeys = (label: string, map: Record<string, unknown> | undefined): void => {
    if (!Object.hasOwn(manifest, label)) throw new Error(`${slug}: ${label} missing`);
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      throw new Error(`${slug}: ${label} is not an object map`);
    }
    if (canonicalize(Object.keys(map).sort()) !== canonicalize([...variantIds].sort())) {
      throw new Error(`${slug}: ${label} variant keys differ from the controlled variant set`);
    }
  };
  exactVariantKeys("structuralChecks", manifest.structuralChecks);
  exactVariantKeys("phases", manifest.phases);
  exactVariantKeys("counters", manifest.counters);

  // Exact structural ID sets for BOTH variants, including finite-values;
  // omissions and duplicates are rejected before any passed status.
  const expectedStructural = EXPECTED_STRUCTURAL_IDS[slug];
  if (!expectedStructural) throw new Error(`${slug}: no expected structural id set`);
  for (const variantId of variantIds) {
    const checks = manifest.structuralChecks?.[variantId];
    if (!checks) throw new Error(`${slug}: structural checks missing for ${variantId}`);
    const ids = checks.map((check) => check.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`${slug}: duplicate structural check ids for ${variantId}`);
    }
    if (canonicalize([...ids].sort()) !== canonicalize([...expectedStructural].sort())) {
      throw new Error(
        `${slug}: structural check ids for ${variantId} differ from required set: ${ids}`,
      );
    }
    for (const check of checks) {
      if (!check.passed) {
        throw new Error(`${slug}: structural check failed for ${variantId}: ${check.id}`);
      }
    }
  }

  // Complete, CLOSED bound evidence. A bound result is exactly
  // {maxDeviation, maxBoundRatio} (both finite numbers) — no missing or
  // extra fields anywhere. GEMM: boundChecks keys exactly the two variants
  // plus crossTarget, no top-level crossTarget. MLP: exactly 9 layerChecks
  // with exact unique layer ids in order 0..8, each entry exactly
  // {layer, js, wasm} with closed bound results, plus a closed top-level
  // crossTarget. Every ratio must be below 1.
  const BOUND_RESULT_KEYS = ["maxBoundRatio", "maxDeviation"];
  const closedBoundResult = (label: string, result: unknown): number => {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error(`${slug}: bound result is not an object: ${label}`);
    }
    const record = result as Record<string, unknown>;
    if (canonicalize(Object.keys(record).sort()) !== canonicalize(BOUND_RESULT_KEYS)) {
      throw new Error(
        `${slug}: bound result fields are not exactly ${BOUND_RESULT_KEYS}: ${label}`,
      );
    }
    const ratio = record.maxBoundRatio;
    const deviation = record.maxDeviation;
    if (typeof ratio !== "number" || !Number.isFinite(ratio)) {
      throw new Error(`${slug}: bound ratio missing or non-finite: ${label}`);
    }
    if (typeof deviation !== "number" || !Number.isFinite(deviation)) {
      throw new Error(`${slug}: maxDeviation missing or non-finite: ${label}`);
    }
    return ratio;
  };
  const ratios: number[] = [];
  // Presence and type checks only — never truthiness: a falsey wrong-typed
  // property (null, false, 0, "") must be rejected exactly like a truthy
  // one.
  const hasOwn = (key: string): boolean => Object.hasOwn(manifest, key);
  if (slug === "ml-gemm") {
    const expectedKeys = [...variantIds, "crossTarget"].sort();
    const rawBoundChecks = hasOwn("boundChecks") ? manifest.boundChecks : undefined;
    if (!rawBoundChecks || typeof rawBoundChecks !== "object" || Array.isArray(rawBoundChecks)) {
      throw new Error(`${slug}: boundChecks missing or not an object`);
    }
    const boundChecks = rawBoundChecks;
    if (canonicalize(Object.keys(boundChecks).sort()) !== canonicalize(expectedKeys)) {
      throw new Error(`${slug}: boundChecks keys differ from the required per-variant set`);
    }
    for (const [key, result] of Object.entries(boundChecks)) {
      ratios.push(closedBoundResult(`boundChecks.${key}`, result));
    }
    if (hasOwn("crossTarget")) throw new Error(`${slug}: unexpected top-level crossTarget`);
  } else {
    if (hasOwn("boundChecks")) throw new Error(`${slug}: unexpected boundChecks map`);
    const rawLayers = hasOwn("layerChecks") ? manifest.layerChecks : undefined;
    if (!Array.isArray(rawLayers)) {
      throw new Error(`${slug}: layerChecks missing or not an array`);
    }
    const layers = rawLayers;
    if (layers.length !== 9) {
      throw new Error(`${slug}: layerChecks must cover exactly 9 layers, found ${layers.length}`);
    }
    const seenLayers = new Set<number>();
    for (const [index, entry] of layers.entries()) {
      const record = entry as unknown as Record<string, unknown>;
      if (canonicalize(Object.keys(record).sort()) !== canonicalize(["js", "layer", "wasm"])) {
        throw new Error(`${slug}: layerChecks[${index}] fields are not exactly {layer, js, wasm}`);
      }
      if (record.layer !== index) {
        throw new Error(
          `${slug}: layerChecks[${index}] has wrong/out-of-order layer id ${record.layer}`,
        );
      }
      if (seenLayers.has(record.layer as number)) {
        throw new Error(`${slug}: duplicate layer id ${record.layer}`);
      }
      seenLayers.add(record.layer as number);
      ratios.push(closedBoundResult(`layerChecks[${index}].js`, record.js));
      ratios.push(closedBoundResult(`layerChecks[${index}].wasm`, record.wasm));
    }
    if (!hasOwn("crossTarget")) throw new Error(`${slug}: crossTarget evidence missing`);
    ratios.push(closedBoundResult("crossTarget", manifest.crossTarget));
  }
  if (ratios.length === 0) throw new Error(`${slug}: no bound evidence recorded`);
  for (const ratio of ratios) {
    if (!(ratio < 1)) throw new Error(`${slug}: recorded bound ratio ${ratio} >= 1`);
  }

  // Exact phase attestation maps for BOTH variants: identical key set and
  // values to the catalog's declared phase map.
  for (const variantId of variantIds) {
    const attested = manifest.phases?.[variantId];
    if (!attested) throw new Error(`${slug}: no phase attestation for ${variantId}`);
    if (canonicalize(attested) !== canonicalize(entry.phases)) {
      throw new Error(`${slug}: phase attestation mismatch for ${variantId}`);
    }
  }

  // Recorded counters must cover exactly the catalog counter set and equal
  // the analytic counters for both targets.
  const expectedCounters = slug === "ml-gemm"
    ? {
      "js-controlled": gemmWorkCounters("javascript"),
      "wasm-linear-controlled": gemmWorkCounters("wasm-linear"),
    }
    : {
      "js-controlled": mlpWorkCounters("javascript"),
      "wasm-linear-controlled": mlpWorkCounters("wasm-linear"),
    };
  const declaredCounterIds = [...entry.work.counters].sort();
  for (const [variantId, expected] of Object.entries(expectedCounters)) {
    const recorded = manifest.counters?.[variantId];
    if (!recorded) throw new Error(`${slug}: counters missing for ${variantId}`);
    if (canonicalize(Object.keys(recorded).sort()) !== canonicalize(declaredCounterIds)) {
      throw new Error(`${slug}: counter set mismatch for ${variantId}`);
    }
    if (canonicalize(recorded) !== canonicalize(expected)) {
      throw new Error(`${slug}: recorded counters diverge from analytic counters for ${variantId}`);
    }
  }
}
