// scripts/build-track-b-registry.ts
//
// Generates public/data/track-b.v1.json — which multi-language engines are
// Track A baselines and which are independently optimized Track B variants.
//
// PLAN.md has defined Track B since M0, but no manifest carried a Track B
// engine and /benchmarks/track-b/ imported a module that was never written.
// This registry is the truth source for that page: it reports the real count
// (zero variants today) instead of an authored placeholder, and it enforces
// the documented Track B fields so an undocumented variant cannot land.
//
// Spec: docs/track-b-optimizations.md
//
// Usage:
//   deno run --allow-read --allow-write scripts/build-track-b-registry.ts
//   deno run --allow-read scripts/build-track-b-registry.ts --check

const ROOT = new URL("../", import.meta.url).pathname;
const MANIFEST_DIR = `${ROOT}public/benchmarks/multilang-wasm`;
const COVERAGE = `${ROOT}public/data/coverage.v1.json`;
const OUT = `${ROOT}public/data/track-b.v1.json`;

/** Equivalence classes a Track B variant may claim (docs/track-b-optimizations.md). */
export const EQUIVALENCE_CLASSES = ["bit-identical", "reassociated"] as const;
type EquivalenceClass = typeof EQUIVALENCE_CLASSES[number];

/** Deviation fields a `reassociated` variant must record against the pinned oracle. */
const REASSOCIATED_REQUIRED = [
  "maxUlpDeviation",
  "maxRelativeDeviation",
  "declaredTolerance",
] as const;

interface ManifestEngine {
  key?: string;
  kind?: string;
  file?: string;
  track?: string;
  baseline?: string;
  equivalence?: string;
  optimizationLog?: string;
  maxUlpDeviation?: number;
  maxRelativeDeviation?: number;
  declaredTolerance?: number;
}

interface Manifest {
  workloadId?: string;
  engines?: ManifestEngine[];
}

interface CoveragePage {
  route: string;
  title: string;
  manifestPath: string | null;
}

export interface TrackBVariant {
  key: string;
  baseline: string;
  equivalence: EquivalenceClass;
  optimizationLog: string;
  /** Present only for `reassociated` variants. */
  maxUlpDeviation: number | null;
  maxRelativeDeviation: number | null;
  declaredTolerance: number | null;
}

export interface TrackBWorkload {
  workloadId: string;
  manifest: string;
  /** Page route from coverage.v1.json, or null when no page references it. */
  route: string | null;
  title: string | null;
  /** Track A engine keys — the baselines a Track B variant can attach to. */
  baselineEngines: string[];
  variants: TrackBVariant[];
}

function readJson(path: string): unknown {
  return JSON.parse(Deno.readTextFileSync(path));
}

/**
 * Titles in coverage.v1.json are lifted straight out of page markup, so they
 * still carry HTML entities ("3D Mesh Quantization &amp; Repair"). The renderer
 * escapes again at output time, so decode here or the page shows "&amp;".
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** manifestPath (e.g. /benchmarks/multilang-wasm/ml-gemm.manifest.json) -> page. */
function coverageByManifest(): Map<string, CoveragePage> {
  const map = new Map<string, CoveragePage>();
  const data = readJson(COVERAGE) as { pages?: CoveragePage[] };
  for (const page of data.pages ?? []) {
    if (!page.manifestPath) continue;
    // First page wins: coverage is route-sorted, so the join is deterministic.
    if (!map.has(page.manifestPath)) map.set(page.manifestPath, page);
  }
  return map;
}

function manifestFiles(): string[] {
  return [...Deno.readDirSync(MANIFEST_DIR)]
    .filter((e) => e.isFile && e.name.endsWith(".manifest.json"))
    .map((e) => e.name)
    .sort();
}

/** Validates a Track B engine and returns it, or throws with the exact gap. */
function toVariant(manifestName: string, engine: ManifestEngine): TrackBVariant {
  const key = engine.key ?? "(unnamed)";
  const where = `${manifestName} engine "${key}"`;
  const missing = (["baseline", "equivalence", "optimizationLog"] as const)
    .filter((field) => {
      const value = engine[field];
      return typeof value !== "string" || value.trim() === "";
    });
  if (missing.length > 0) {
    throw new Error(
      `${where}: track "B" requires ${missing.join(", ")} — see docs/track-b-optimizations.md`,
    );
  }
  const equivalence = engine.equivalence as EquivalenceClass;
  if (!EQUIVALENCE_CLASSES.includes(equivalence)) {
    throw new Error(
      `${where}: equivalence "${engine.equivalence}" is not one of ${
        EQUIVALENCE_CLASSES.join(", ")
      }`,
    );
  }
  if (equivalence === "reassociated") {
    const absent = REASSOCIATED_REQUIRED.filter((f) => typeof engine[f] !== "number");
    if (absent.length > 0) {
      throw new Error(
        `${where}: equivalence "reassociated" requires numeric ${absent.join(", ")}`,
      );
    }
  }
  return {
    key,
    baseline: engine.baseline as string,
    equivalence,
    optimizationLog: engine.optimizationLog as string,
    maxUlpDeviation: engine.maxUlpDeviation ?? null,
    maxRelativeDeviation: engine.maxRelativeDeviation ?? null,
    declaredTolerance: engine.declaredTolerance ?? null,
  };
}

export function buildRegistry() {
  const pages = coverageByManifest();
  const workloads: TrackBWorkload[] = [];

  for (const name of manifestFiles()) {
    const manifest = readJson(`${MANIFEST_DIR}/${name}`) as Manifest;
    const engines = manifest.engines ?? [];
    const baselineEngines: string[] = [];
    const variants: TrackBVariant[] = [];

    for (const engine of engines) {
      if (!engine.key) continue;
      // Absent `track` means Track A: every engine predating this registry is
      // a controlled baseline, which is what they are.
      if ((engine.track ?? "A") === "B") variants.push(toVariant(name, engine));
      else baselineEngines.push(engine.key);
    }

    for (const variant of variants) {
      if (!baselineEngines.includes(variant.baseline)) {
        throw new Error(
          `${name} engine "${variant.key}": baseline "${variant.baseline}" is not a Track A engine in the same manifest`,
        );
      }
    }

    const manifestPath = `/benchmarks/multilang-wasm/${name}`;
    const page = pages.get(manifestPath);
    workloads.push({
      workloadId: manifest.workloadId ?? name.replace(/\.manifest\.json$/, ""),
      manifest: manifestPath,
      route: page?.route ?? null,
      title: page?.title ? decodeEntities(page.title) : null,
      baselineEngines,
      variants,
    });
  }

  workloads.sort((a, b) => a.workloadId.localeCompare(b.workloadId));

  const withVariants = workloads.filter((w) => w.variants.length > 0);
  const summary = {
    workloads: workloads.length,
    baselineEngineRows: workloads.reduce((n, w) => n + w.baselineEngines.length, 0),
    variantRows: workloads.reduce((n, w) => n + w.variants.length, 0),
    workloadsWithVariants: withVariants.length,
    workloadsWithoutVariants: workloads.length - withVariants.length,
    bitIdenticalVariants: workloads.reduce(
      (n, w) => n + w.variants.filter((v) => v.equivalence === "bit-identical").length,
      0,
    ),
    reassociatedVariants: workloads.reduce(
      (n, w) => n + w.variants.filter((v) => v.equivalence === "reassociated").length,
      0,
    ),
    workloadsWithoutRoute: workloads.filter((w) => !w.route).length,
  };

  // `generatedAt` is null for the same reason as coverage.v1.json: a timestamp
  // would change the file on every build and defeat --check.
  return {
    generatedAt: null,
    schemaVersion: 1,
    spec: "docs/track-b-optimizations.md",
    equivalenceClasses: [...EQUIVALENCE_CLASSES],
    workloads,
    summary,
  };
}

if (import.meta.main) {
  const registry = buildRegistry();
  const json = JSON.stringify(registry, null, 2) + "\n";
  if (Deno.args.includes("--check")) {
    let existing: string | null = null;
    try {
      existing = Deno.readTextFileSync(OUT);
    } catch {
      existing = null;
    }
    if (existing !== json) {
      console.error(
        "public/data/track-b.v1.json is stale — run scripts/build-track-b-registry.ts",
      );
      Deno.exit(1);
    }
    console.log(
      `track-b registry up to date (${registry.summary.workloads} workloads, ` +
        `${registry.summary.variantRows} Track B variants)`,
    );
  } else {
    Deno.writeTextFileSync(OUT, json);
    console.log(
      `wrote track-b.v1.json — ${registry.summary.workloads} workloads, ` +
        `${registry.summary.baselineEngineRows} Track A engine rows, ` +
        `${registry.summary.variantRows} Track B variants ` +
        `(${registry.summary.bitIdenticalVariants} bit-identical, ` +
        `${registry.summary.reassociatedVariants} reassociated)`,
    );
  }
}
