// scripts/build-reference-snapshot.ts
//
// Deterministically builds public/data/reference-snapshot.v1.json from the
// repository's committed empirical ledgers:
//   - public/data/autoresearch-log.v1.json
//   - public/data/multilang-wasm-benchmark-report.v1.json
//   - public/data/worker-lifecycle.v1.json
//   - public/data/benchmarks.json
//
// Usage:
//   deno run --no-lock --allow-read --allow-write scripts/build-reference-snapshot.ts
//   deno run --no-lock --allow-read scripts/build-reference-snapshot.ts --check

const ROOT = new URL("../", import.meta.url).pathname;

function join(...parts: string[]): string {
  return parts.join("/").replace(/\/+/g, "/");
}

const AUTORESEARCH_PATH = join(ROOT, "public/data/autoresearch-log.v1.json");
const MULTILANG_REPORT_PATH = join(ROOT, "public/data/multilang-wasm-benchmark-report.v1.json");
const WORKER_LIFECYCLE_PATH = join(ROOT, "public/data/worker-lifecycle.v1.json");
const BENCHMARKS_PATH = join(ROOT, "public/data/benchmarks.json");
const OUTPUT_PATH = join(ROOT, "public/data/reference-snapshot.v1.json");

export const NON_BROWSER_DISCLAIMER =
  "Viewing offline reference measurements captured in standalone Deno 2.9 / V8 on Apple M4 Pro — never pooled with browser claims. Switch back to Live Browser Runs or click ▶ Quick Tour to measure your own browser.";

const NON_PLAYGROUND_PAGE_SLUGS = new Set([
  "database-sqlite-notebook-v1",
  "multilang-wasm",
]);

interface AutoResearchProbe {
  id: string;
  name: string;
  baselineLabel: string;
  optLabel: string;
  baselineMs: number;
  optimizedMs: number;
  speedup: number;
  status: string;
  finding: string;
}

interface AutoResearchSimdArtifact {
  engineKey: string;
  lang: string;
  bytes: number;
  sha256: string;
  v128InstructionCount: number;
  topSimdOps: string[];
  oracleVerified: boolean;
  oracleDigest: string | null;
}

interface AutoResearchWorkload {
  manifestSlug: string;
  manifestPath: string;
  workloadId: string;
  kernel: string;
  kernelLabel: string | null;
  oracleDigest: string | null;
  staticTrackBVariants: string[];
  simdArtifact: AutoResearchSimdArtifact | null;
  probes: AutoResearchProbe[];
}

interface AutoResearchLedger {
  capturedOn: string;
  environment: {
    denoVersion: string;
    v8Version: string;
    os: string;
    arch: string;
    toolchainId: string;
  };
  buildInfrastructure: {
    hardware: {
      cpuModel: string;
      arch: string;
      logicalCores: number;
      memoryGiB: number;
    };
    os: {
      productName: string;
      productVersion: string;
      kernelRelease: string;
      uname: string;
    };
    pins: {
      gitBaseCommit: string;
    };
  };
  summary: {
    workloadsEvaluated: number;
    autoVectorizedWithV128Count: number;
    simdSpeedupOver105xCount: number;
    medianArenaReuseSpeedup: number;
  };
  workloads: AutoResearchWorkload[];
}

interface MultilangVariant {
  language: string;
  toolchain: string;
  binarySizeBytes: number;
  coldInstantiateMs: number;
  warmExecutionMs?: number;
}

interface MultilangReportWorkload {
  name: string;
  description: string;
  variants: MultilangVariant[];
}

interface MultilangReportLedger {
  generatedAt: string;
  workloads: MultilangReportWorkload[];
}

interface WorkerLifecycleEntry {
  index: number;
  slug: string;
  pageSlug: string;
  id: string;
  route: string;
  lifecycleClass: string;
  lifecycleBadge: string;
  workerReuse: string;
  perTaskNoStoreFetch: boolean;
  perTaskSha256Digest: boolean;
  perTaskWasmInstantiate: boolean;
}

interface WorkerLifecycleLedger {
  summary: {
    byClass: Record<string, number>;
  };
  entries: WorkerLifecycleEntry[];
}

interface BenchmarkCatalogEntry {
  slug: string;
  id: string;
  title: string;
  category: string;
  pageType: string;
  manifest: string;
  kernels: string[];
  pageSlug: string;
  route: string;
  wasmArtifact: string;
  workerLifecycleClass: string;
  workerLifecycleBadge: string;
}

export interface MultilangBatchEngineEntry {
  label: string;
  batchWarmMs: number;
  coldInstantiateMs: number;
  binarySizeBytes: number;
  pairedRatioVsJs: number;
}

export interface ReferenceKernelTimings {
  jsWarmMs: number;
  jsColdMs: number;
  wasmTrackAWarmMs: number;
  wasmTrackAEngine: string;
  wasmTrackALabel: string;
  trackARatioVsJs: number;
  wasmSimdWarmMs: number;
  wasmSimdLabel: string;
}

export interface ReferenceWorkloadRecord {
  slug: string;
  pageSlug: string;
  workloadId: string;
  title: string;
  category: string;
  pageType: string;
  route: string;
  manifestPath: string | null;
  inPlayground: boolean;
  referenceStatus: "measured" | "unavailable";
  unavailableReason: string | null;
  measuredKernel: string | null;
  measuredKernelNote: string | null;
  oracleDigest: string | null;
  primaryWasmBytes: number | null;
  simdArtifactBytes: number | null;
  kernelTimings: ReferenceKernelTimings | null;
  v128InstructionCount: number | null;
  topSimdOps: string[];
  simdSpeedup: number | null;
  arenaReuseSpeedup: number | null;
  perTaskInstantiateMs: number | null;
  reusedArenaMs: number | null;
  jitTierUpSpeedup: number | null;
  workerLifecycleClass: string;
  workerLifecycleBadge: string;
  perTaskWasmInstantiate: boolean;
  multilangBatch: {
    reportWorkload: string;
    jsBatchWarmMs: number;
    engines: Record<string, MultilangBatchEngineEntry>;
  } | null;
}

export interface ReferenceSnapshotV1 {
  schemaVersion: "reference-snapshot.v1";
  generatedBy: "scripts/build-reference-snapshot.ts";
  scope: "standalone-deno-v8-cli-reference";
  cpuModel: string;
  runtime: string;
  nonBrowserDisclaimer: string;
  provenance: {
    scope: "standalone-deno-v8-cli-reference";
    cpuModel: string;
    arch: string;
    logicalCores: number;
    memoryGiB: number;
    os: string;
    runtime: string;
    toolchainId: string;
    capturedOn: string;
    multilangReportGeneratedAt: string;
    gitBaseCommit: string;
    nonBrowserDisclaimer: string;
    sourceLedgers: string[];
  };
  summary: {
    totalBenchmarkSpecs: number;
    playgroundSuites: number;
    measuredPlaygroundWorkloads: number;
    workerOnlyPlaygroundSuites: number;
    distinctManifestsEvaluated: number;
    multilangBatchWorkloads: number;
    autoVectorizedWithV128Count: number;
    simdSpeedupOver105xCount: number;
    medianTrackARatioVsJs: number;
    medianArenaReuseSpeedup: number;
    workerLifecycleByClass: Record<string, number>;
  };
  workloads: ReferenceWorkloadRecord[];
}

function mapReportLanguageKey(language: string): { key: string; label: string } | null {
  if (language === "JavaScript") return { key: "js", label: "JavaScript" };
  if (language.includes("WAT")) return { key: "wat", label: "Raw WAT" };
  if (language === "C / Wasm") return { key: "c", label: "C / Wasm" };
  if (language === "C++ / Wasm") return { key: "cpp", label: "C++ / Wasm" };
  if (language === "Rust / Wasm") return { key: "rs", label: "Rust / Wasm" };
  if (language.startsWith("AssemblyScript")) return { key: "asc", label: "AssemblyScript" };
  if (language.startsWith("Dart")) return { key: "dart", label: "Dart / WasmGC" };
  return null;
}

function fileSizeOrNull(relPath: string): number | null {
  if (!relPath) return null;
  try {
    return Deno.statSync(join(ROOT, relPath)).size;
  } catch {
    return null;
  }
}

function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildReferenceSnapshotData(): ReferenceSnapshotV1 {
  const autoresearch: AutoResearchLedger = JSON.parse(Deno.readTextFileSync(AUTORESEARCH_PATH));
  const multilangReport: MultilangReportLedger = JSON.parse(
    Deno.readTextFileSync(MULTILANG_REPORT_PATH),
  );
  const workerLifecycle: WorkerLifecycleLedger = JSON.parse(
    Deno.readTextFileSync(WORKER_LIFECYCLE_PATH),
  );
  const benchmarks: BenchmarkCatalogEntry[] = JSON.parse(Deno.readTextFileSync(BENCHMARKS_PATH));

  const arByManifestPath = new Map<string, AutoResearchWorkload>();
  for (const w of autoresearch.workloads) {
    arByManifestPath.set(w.manifestPath, w);
  }

  const mlBySlug = new Map<string, MultilangReportWorkload>();
  for (const w of multilangReport.workloads) {
    mlBySlug.set(w.name, w);
  }

  const wlBySlug = new Map<string, WorkerLifecycleEntry>();
  for (const entry of workerLifecycle.entries) {
    wlBySlug.set(entry.slug, entry);
    if (!wlBySlug.has(entry.pageSlug)) {
      wlBySlug.set(entry.pageSlug, entry);
    }
  }

  const workloads: ReferenceWorkloadRecord[] = [];
  let multilangBatchCount = 0;

  for (const bm of benchmarks) {
    const inPlayground = !NON_PLAYGROUND_PAGE_SLUGS.has(bm.pageSlug);
    const wl = wlBySlug.get(bm.slug) ?? wlBySlug.get(bm.pageSlug);
    const lifecycleClass = wl?.lifecycleClass ?? bm.workerLifecycleClass ?? "unavailable";
    const lifecycleBadge = wl?.lifecycleBadge ?? bm.workerLifecycleBadge ?? "Unavailable";
    const perTaskWasmInstantiate = Boolean(wl?.perTaskWasmInstantiate);
    const primaryWasmBytes = fileSizeOrNull(bm.wasmArtifact);

    const ar = bm.manifest && bm.manifest.endsWith(".manifest.json")
      ? arByManifestPath.get(bm.manifest) ?? null
      : null;

    if (!ar) {
      const reason = bm.pageSlug === "database-sqlite-notebook-v1"
        ? "unlisted-correctness-only-demo"
        : "worker-only-no-multilang-manifest";
      workloads.push({
        slug: bm.slug,
        pageSlug: bm.pageSlug,
        workloadId: bm.id,
        title: bm.title,
        category: bm.category,
        pageType: bm.pageType,
        route: bm.route,
        manifestPath: bm.manifest || null,
        inPlayground,
        referenceStatus: "unavailable",
        unavailableReason: reason,
        measuredKernel: null,
        measuredKernelNote: null,
        oracleDigest: null,
        primaryWasmBytes,
        simdArtifactBytes: null,
        kernelTimings: null,
        v128InstructionCount: null,
        topSimdOps: [],
        simdSpeedup: null,
        arenaReuseSpeedup: null,
        perTaskInstantiateMs: null,
        reusedArenaMs: null,
        jitTierUpSpeedup: null,
        workerLifecycleClass: lifecycleClass,
        workerLifecycleBadge: lifecycleBadge,
        perTaskWasmInstantiate,
        multilangBatch: null,
      });
      continue;
    }

    const simdProbe = ar.probes.find((p) => p.id === "simd") ?? null;
    const reuseProbe = ar.probes.find((p) => p.id === "memoryReuse") ?? null;
    const jitProbe = ar.probes.find((p) => p.id === "jitTierUp") ?? null;

    if (!simdProbe || !jitProbe || simdProbe.baselineMs <= 0 || jitProbe.optimizedMs <= 0) {
      throw new Error(`Missing positive kernel timings in autoresearch ledger for ${bm.slug}`);
    }

    const jsWarmMs = jitProbe.optimizedMs;
    const jsColdMs = jitProbe.baselineMs;
    const wasmTrackAWarmMs = simdProbe.baselineMs;
    const trackARatioVsJs = Number((jsWarmMs / wasmTrackAWarmMs).toFixed(4));

    const primaryKernelExpected = bm.kernels?.[0] ?? null;
    const measuredKernelNote = primaryKernelExpected && primaryKernelExpected !== ar.kernel
      ? `Shared manifest ${ar.manifestSlug}.manifest.json timed kernel "${ar.kernel}".`
      : null;

    const mlEntry = mlBySlug.get(ar.manifestSlug) ?? null;
    let multilangBatch: ReferenceWorkloadRecord["multilangBatch"] = null;
    if (mlEntry) {
      const jsVariant = mlEntry.variants.find((v) => v.language === "JavaScript");
      if (
        jsVariant && typeof jsVariant.warmExecutionMs === "number" && jsVariant.warmExecutionMs > 0
      ) {
        const jsBatchMs = jsVariant.warmExecutionMs;
        const engines: Record<string, MultilangBatchEngineEntry> = {};
        for (const variant of mlEntry.variants) {
          const mapped = mapReportLanguageKey(variant.language);
          if (
            mapped && mapped.key !== "js" && typeof variant.warmExecutionMs === "number" &&
            variant.warmExecutionMs > 0
          ) {
            engines[mapped.key] = {
              label: mapped.label,
              batchWarmMs: variant.warmExecutionMs,
              coldInstantiateMs: variant.coldInstantiateMs,
              binarySizeBytes: variant.binarySizeBytes,
              pairedRatioVsJs: Number((jsBatchMs / variant.warmExecutionMs).toFixed(4)),
            };
          }
        }
        if (Object.keys(engines).length > 0) {
          multilangBatch = {
            reportWorkload: mlEntry.name,
            jsBatchWarmMs: jsBatchMs,
            engines,
          };
          multilangBatchCount++;
        }
      }
    }

    workloads.push({
      slug: bm.slug,
      pageSlug: bm.pageSlug,
      workloadId: bm.id,
      title: bm.title,
      category: bm.category,
      pageType: bm.pageType,
      route: bm.route,
      manifestPath: ar.manifestPath,
      inPlayground,
      referenceStatus: "measured",
      unavailableReason: null,
      measuredKernel: ar.kernel,
      measuredKernelNote,
      oracleDigest: ar.oracleDigest,
      primaryWasmBytes,
      simdArtifactBytes: ar.simdArtifact?.bytes ?? null,
      kernelTimings: {
        jsWarmMs,
        jsColdMs,
        wasmTrackAWarmMs,
        wasmTrackAEngine: ar.simdArtifact?.engineKey ?? "c",
        wasmTrackALabel: simdProbe.baselineLabel,
        trackARatioVsJs,
        wasmSimdWarmMs: simdProbe.optimizedMs,
        wasmSimdLabel: simdProbe.optLabel,
      },
      v128InstructionCount: ar.simdArtifact ? ar.simdArtifact.v128InstructionCount : null,
      topSimdOps: ar.simdArtifact ? ar.simdArtifact.topSimdOps : [],
      simdSpeedup: simdProbe.speedup,
      arenaReuseSpeedup: reuseProbe ? reuseProbe.speedup : null,
      perTaskInstantiateMs: reuseProbe ? reuseProbe.baselineMs : null,
      reusedArenaMs: reuseProbe ? reuseProbe.optimizedMs : null,
      jitTierUpSpeedup: jitProbe.speedup,
      workerLifecycleClass: lifecycleClass,
      workerLifecycleBadge: lifecycleBadge,
      perTaskWasmInstantiate,
      multilangBatch,
    });
  }

  const playgroundRows = workloads.filter((w) => w.inPlayground);
  const measuredPlaygroundRows = playgroundRows.filter((w) => w.referenceStatus === "measured");
  const workerOnlyPlaygroundRows = playgroundRows.filter((w) =>
    w.referenceStatus === "unavailable"
  );
  const trackARatios = measuredPlaygroundRows
    .map((w) => w.kernelTimings?.trackARatioVsJs ?? 0)
    .filter((x) => x > 0)
    .sort((a, b) => a - b);

  const cpuModel = autoresearch.buildInfrastructure.hardware.cpuModel;
  const runtime =
    `Deno ${autoresearch.environment.denoVersion} / V8 ${autoresearch.environment.v8Version}`;
  const osInfo =
    `${autoresearch.buildInfrastructure.os.productName} ${autoresearch.buildInfrastructure.os.productVersion} (${autoresearch.buildInfrastructure.os.uname})`;

  return {
    schemaVersion: "reference-snapshot.v1",
    generatedBy: "scripts/build-reference-snapshot.ts",
    scope: "standalone-deno-v8-cli-reference",
    cpuModel,
    runtime,
    nonBrowserDisclaimer: NON_BROWSER_DISCLAIMER,
    provenance: {
      scope: "standalone-deno-v8-cli-reference",
      cpuModel,
      arch: autoresearch.buildInfrastructure.hardware.arch,
      logicalCores: autoresearch.buildInfrastructure.hardware.logicalCores,
      memoryGiB: autoresearch.buildInfrastructure.hardware.memoryGiB,
      os: osInfo,
      runtime,
      toolchainId: autoresearch.environment.toolchainId,
      capturedOn: autoresearch.capturedOn,
      multilangReportGeneratedAt: multilangReport.generatedAt,
      gitBaseCommit: autoresearch.buildInfrastructure.pins.gitBaseCommit,
      nonBrowserDisclaimer: NON_BROWSER_DISCLAIMER,
      sourceLedgers: [
        "public/data/autoresearch-log.v1.json",
        "public/data/multilang-wasm-benchmark-report.v1.json",
        "public/data/worker-lifecycle.v1.json",
        "public/data/benchmarks.json",
      ],
    },
    summary: {
      totalBenchmarkSpecs: workloads.length,
      playgroundSuites: playgroundRows.length,
      measuredPlaygroundWorkloads: measuredPlaygroundRows.length,
      workerOnlyPlaygroundSuites: workerOnlyPlaygroundRows.length,
      distinctManifestsEvaluated: autoresearch.summary.workloadsEvaluated,
      multilangBatchWorkloads: multilangBatchCount,
      autoVectorizedWithV128Count: autoresearch.summary.autoVectorizedWithV128Count,
      simdSpeedupOver105xCount: autoresearch.summary.simdSpeedupOver105xCount,
      medianTrackARatioVsJs: Number(medianSorted(trackARatios).toFixed(2)),
      medianArenaReuseSpeedup: autoresearch.summary.medianArenaReuseSpeedup,
      workerLifecycleByClass: workerLifecycle.summary.byClass,
    },
    workloads,
  };
}

export function renderReferenceSnapshotJson(): string {
  return JSON.stringify(buildReferenceSnapshotData(), null, 2) + "\n";
}

export function verifyReferenceSnapshot(): { ok: boolean; error?: string } {
  const expected = renderReferenceSnapshotJson();
  let actual = "";
  try {
    actual = Deno.readTextFileSync(OUTPUT_PATH);
  } catch (err) {
    return { ok: false, error: `Cannot read ${OUTPUT_PATH}: ${err}` };
  }
  if (actual !== expected) {
    return {
      ok: false,
      error:
        `${OUTPUT_PATH} is out of sync with committed ledgers; re-run scripts/build-reference-snapshot.ts`,
    };
  }
  return { ok: true };
}

if (import.meta.main) {
  const check = Deno.args.includes("--check");
  if (check) {
    const res = verifyReferenceSnapshot();
    if (!res.ok) {
      console.error(res.error);
      Deno.exit(1);
    }
    console.log("reference-snapshot.v1.json up to date");
  } else {
    const out = renderReferenceSnapshotJson();
    Deno.writeTextFileSync(OUTPUT_PATH, out);
    console.log(`wrote ${OUTPUT_PATH} (${out.length} bytes)`);
  }
}
