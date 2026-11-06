// scripts/audit-worker-lifecycle.ts
//
// Source-grounded audit of Web Worker task-pipeline lifecycles across all 50
// benchmark tests (49 worker-backed benchmarks in WORKLOAD_CONFIGS plus the
// in-page multilang-wasm panel).
//
// Generates:
//   1. public/data/worker-lifecycle.v1.json  (served at /data/worker-lifecycle.v1.json)
//   2. docs/worker-lifecycle-audit.md        (served at /docs/worker-lifecycle-audit.md)
//
// Usage:
//   deno run --allow-read --allow-write --allow-run scripts/audit-worker-lifecycle.ts
//   deno run --allow-read --allow-run scripts/audit-worker-lifecycle.ts --check

import { WORKLOAD_CONFIGS } from "../public/unified-runner.js";
import { formatMarkdown } from "./build-all-wasm.ts";
import {
  BENCHMARK_BUILD_SPECS,
  type BenchmarkBuildSpec,
  toGitHubBlobUrl,
} from "./wasm-build-registry.ts";

export type WorkerLifecycleClass =
  | "symmetric-warm"
  | "asymmetric-wasm-cold-per-task"
  | "per-task-verified-bundle"
  | "symmetric-cold-isolate"
  | "in-page-kernel-only";

export type WorkerReuseMode =
  | "reused"
  | "batched-in-worker"
  | "respawned-per-iteration"
  | "none";

export interface WorkerLifecycleEntry {
  index: number;
  slug: string;
  pageSlug: string;
  id: string;
  route: string;
  workerScript: string | null;
  workerRepoPath: string | null;
  workerGitHubUrl: string | null;
  workerSha256: string | null;
  importedModuleCount: number;
  lifecycleClass: WorkerLifecycleClass;
  lifecycleBadge: string;
  workerReuse: WorkerReuseMode;
  jsSteadyStateBehavior: string;
  wasmSteadyStateBehavior: string;
  perTaskNoStoreFetch: boolean;
  perTaskSha256Digest: boolean;
  perTaskWasmInstantiate: boolean;
  perTaskDynamicJsImport: boolean;
  perTaskCrossChecksJsInsideWasm: boolean;
  summaryNote: string;
}

export interface WorkerLifecycleSummary {
  totalBenchmarks: number;
  workerBackedBenchmarks: number;
  inPageKernelOnlyBenchmarks: number;
  byClass: Record<WorkerLifecycleClass, number>;
  perTaskWasmInstantiateCount: number;
  warmCachedWasmCount: number;
  perTaskNoStoreFetchCount: number;
  perTaskSha256DigestCount: number;
  singleUseRespawnCount: number;
}

export interface WorkerLifecycleLedger {
  schemaVersion: "worker-lifecycle.v1";
  auditScript: "scripts/audit-worker-lifecycle.ts";
  companionDocUrl: "/docs/worker-lifecycle-audit.md";
  methodologyUrl: "/methodology/#worker-wasm-explained";
  summary: WorkerLifecycleSummary;
  entries: WorkerLifecycleEntry[];
}

export const WORKER_LIFECYCLE_JSON_PATH = "public/data/worker-lifecycle.v1.json";
export const WORKER_LIFECYCLE_DOC_PATH = "docs/worker-lifecycle-audit.md";

const DYNAMIC_WORKER_IMPORTS: Record<string, ReadonlyArray<string>> = {
  "/demo-worker.js": ["/demo-assets/audio/lib/audio-workloads.js"],
  "/benchmarks/base-dom-todomvc-journey/worker.js": [
    "/artifacts/base-dom-todomvc-journey/runtime.js",
  ],
  "/telemetry-worker.js": [
    "/benchmarks/v1/serialization-json-telemetry/workload.js",
  ],
};

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch {
    return false;
  }
}

async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveRouteToDiskPath(route: string): Promise<string | null> {
  const clean = route.split("?")[0];
  const rel = clean.replace(/^\/+/, "");
  const publicCandidate = `public/${rel}`;
  if (await fileExists(publicCandidate)) return publicCandidate;
  if (await fileExists(rel)) return rel;
  return null;
}

function resolveModuleSpecifier(currentDiskPath: string, spec: string): string | null {
  if (spec.startsWith("/")) return spec;
  if (spec.startsWith("./") || spec.startsWith("../")) {
    const baseUrl = new URL(currentDiskPath, "file:///repo/");
    const resolved = new URL(spec, baseUrl).pathname.replace(/^\/repo\//, "");
    return resolved.startsWith("public/") ? `/${resolved.slice("public/".length)}` : `/${resolved}`;
  }
  return null;
}

async function loadWorkerModuleGraph(workerScript: string): Promise<{
  entryRepoPath: string;
  entrySha256: string;
  files: Array<{ route: string; repoPath: string; text: string }>;
}> {
  const entryRepoPath = await resolveRouteToDiskPath(workerScript);
  if (!entryRepoPath) {
    throw new Error(`Worker script missing on disk for route: ${workerScript}`);
  }
  const entryBytes = await Deno.readFile(entryRepoPath);
  const entrySha256 = await sha256HexBytes(entryBytes);

  const visited = new Set<string>();
  const queue: string[] = [
    workerScript,
    ...(DYNAMIC_WORKER_IMPORTS[workerScript] ?? []),
  ];
  const files: Array<{ route: string; repoPath: string; text: string }> = [];

  while (queue.length > 0) {
    const route = queue.shift()!;
    const cleanRoute = route.split("?")[0];
    if (visited.has(cleanRoute)) continue;
    visited.add(cleanRoute);

    const diskPath = await resolveRouteToDiskPath(cleanRoute);
    if (!diskPath) continue;
    const text = await Deno.readTextFile(diskPath);
    files.push({ route: cleanRoute, repoPath: diskPath, text });

    const importRe = /(?:from|import)\s*\(?["']([^"'$]+)["']\)?/g;
    for (const match of text.matchAll(importRe)) {
      const next = resolveModuleSpecifier(diskPath, match[1]);
      if (next && !visited.has(next.split("?")[0])) {
        queue.push(next);
      }
    }
  }

  return { entryRepoPath, entrySha256, files };
}

export function badgeForWorkerLifecycleClass(cls: WorkerLifecycleClass): string {
  switch (cls) {
    case "symmetric-warm":
      return "Symmetric Warm Worker (Cached Wasm Instance)";
    case "asymmetric-wasm-cold-per-task":
      return "Asymmetric Worker (JS Warm Module vs Wasm Per-Task Instantiate)";
    case "per-task-verified-bundle":
      return "Per-Task Verified Bundle (JS Dynamic Import + Wasm Re-Instantiate)";
    case "symmetric-cold-isolate":
      return "Single-Use Contract Worker (Fresh Thread + Isolate Per Sample)";
    case "in-page-kernel-only":
      return "In-Page Kernel Only (No Worker Task Pipeline)";
  }
}

async function auditSpec(spec: BenchmarkBuildSpec): Promise<WorkerLifecycleEntry> {
  const cfg = (WORKLOAD_CONFIGS as Record<string, { workerScript?: string }>)[spec.pageSlug] ??
    (WORKLOAD_CONFIGS as Record<string, { workerScript?: string }>)[spec.slug];

  if (!cfg?.workerScript) {
    return {
      index: spec.index,
      slug: spec.slug,
      pageSlug: spec.pageSlug,
      id: spec.id,
      route: spec.route,
      workerScript: null,
      workerRepoPath: null,
      workerGitHubUrl: null,
      workerSha256: null,
      importedModuleCount: 0,
      lifecycleClass: "in-page-kernel-only",
      lifecycleBadge: badgeForWorkerLifecycleClass("in-page-kernel-only"),
      workerReuse: "none",
      jsSteadyStateBehavior: "Pre-imported ES module timed directly in-page via multilang-runner",
      wasmSteadyStateBehavior: "Pre-instantiated WebAssembly.Instance timed directly in-page",
      perTaskNoStoreFetch: false,
      perTaskSha256Digest: false,
      perTaskWasmInstantiate: false,
      perTaskDynamicJsImport: false,
      perTaskCrossChecksJsInsideWasm: false,
      summaryNote:
        "Runs exclusively in Kernel Compute scope via /multilang-runner.js with pre-instantiated engines and zero worker IPC.",
    };
  }

  const workerScript = cfg.workerScript;
  const graph = await loadWorkerModuleGraph(workerScript);
  const entryText = graph.files[0]?.text ?? "";
  const combinedText = graph.files.map((f) => f.text).join("\n");

  const batchedInWorker = spec.pageSlug === "sum-u32";
  const cachesWasmInstance = /let\s+wasm\b[\s\S]*?wasm\s*\?\?=/.test(entryText);
  const singleShotRespawn = !batchedInWorker &&
    (/let\s+(?:accepted|started)\s*=\s*false/.test(entryText) ||
      /self\.close\s*\(/.test(entryText));
  const perTaskDynamicJsImport = !batchedInWorker &&
    (/createObjectURL\s*\(\s*new\s+Blob/.test(combinedText) || /\?run=\$\{/.test(entryText));
  const hasNoStoreInGraph = /cache:\s*["']no-store["']/.test(combinedText);
  const hasSha256InGraph = /crypto\.subtle\.digest\s*\(\s*["']SHA-256["']/.test(combinedText);
  const hasWasmInstantiate =
    /WebAssembly\.(?:instantiate|instantiateStreaming|compile|Instance)\b/.test(combinedText) ||
    /sqlite3InitModule/.test(combinedText);
  const crossChecksJsInsideWasm = /assertEquivalent\s*\(\s*runtime\.runJavaScript/.test(entryText);

  if (!hasWasmInstantiate) {
    throw new Error(`Expected WebAssembly instantiation in worker graph for ${spec.pageSlug}`);
  }

  let lifecycleClass: WorkerLifecycleClass;
  let workerReuse: WorkerReuseMode;
  let jsSteadyStateBehavior: string;
  let wasmSteadyStateBehavior: string;
  let perTaskNoStoreFetch: boolean;
  let perTaskSha256Digest: boolean;
  let perTaskWasmInstantiate: boolean;
  let summaryNote: string;

  if (batchedInWorker) {
    lifecycleClass = "symmetric-warm";
    workerReuse = "batched-in-worker";
    perTaskNoStoreFetch = false;
    perTaskSha256Digest = false;
    perTaskWasmInstantiate = false;
    jsSteadyStateBehavior =
      "Verified JS Blob module imported once up front; warm function timed across batched loop";
    wasmSteadyStateBehavior =
      "Wasm binary compiled & instantiated once up front; warm exports.sum_u32 timed across batched loop";
    summaryNote =
      "hosted-runner-worker.js verifies and instantiates both JS and Wasm once before calibration, then records warm paired batches inside one worker.";
  } else if (cachesWasmInstance) {
    lifecycleClass = "symmetric-warm";
    workerReuse = "reused";
    perTaskNoStoreFetch = false;
    perTaskSha256Digest = false;
    perTaskWasmInstantiate = false;
    jsSteadyStateBehavior =
      "Static top-level ES module import stays V8-JIT warm across reused worker messages";
    wasmSteadyStateBehavior =
      "Caches module-scope WebAssembly.Instance (wasm ??= instantiateGameWasm(...)) across messages";
    summaryNote =
      "Reused worker caches WebAssembly.Instance after warm-up; steady-state Task Pipeline measures warm dispatch + execution + result postMessage without re-instantiation.";
  } else if (singleShotRespawn) {
    lifecycleClass = "symmetric-cold-isolate";
    workerReuse = "respawned-per-iteration";
    perTaskNoStoreFetch = hasNoStoreInGraph;
    perTaskSha256Digest = hasSha256InGraph;
    perTaskWasmInstantiate = true;
    jsSteadyStateBehavior =
      "Single-use worker (accepted = true); spawns fresh OS thread + V8 isolate + module parse per sample";
    wasmSteadyStateBehavior =
      "Spawns fresh worker thread + V8 isolate + no-store .wasm fetch + WebAssembly.compile/instantiate per sample";
    summaryNote =
      "Single-use contract worker accepts one message and ignores subsequent tasks; unified-runner respawns a new Worker per iteration for both JS and Wasm, and Wasm also compiles/instantiates its .wasm binary each sample.";
  } else if (perTaskDynamicJsImport) {
    lifecycleClass = "per-task-verified-bundle";
    workerReuse = "reused";
    perTaskNoStoreFetch = hasNoStoreInGraph;
    perTaskSha256Digest = hasSha256InGraph;
    perTaskWasmInstantiate = true;
    jsSteadyStateBehavior =
      "Re-fetches, hashes, and dynamically imports a fresh Blob / cache-busted JS module on each message";
    wasmSteadyStateBehavior = crossChecksJsInsideWasm
      ? "Re-fetches & hashes bundle, instantiates Wasm per message, and re-runs JS inside onmessage to assert equivalence"
      : "Re-fetches & hashes runtime bundle and calls WebAssembly.compile/instantiate (plus glue init) on each message";
    summaryNote = crossChecksJsInsideWasm
      ? "Reused worker fetches and SHA-256-verifies all 8 package routes per message, instantiates todomvc.wasm, and executes runtime.runJavaScript(encoded) a second time inside the Wasm branch to assert output equivalence."
      : "Reused worker re-fetches and hash-verifies runtime sources per message (evaluating fresh JS Blob/query modules for JS and compiling/instantiating fresh Wasm + glue per Wasm message).";
  } else {
    lifecycleClass = "asymmetric-wasm-cold-per-task";
    workerReuse = "reused";
    perTaskNoStoreFetch = hasNoStoreInGraph;
    perTaskSha256Digest = hasSha256InGraph;
    perTaskWasmInstantiate = true;
    jsSteadyStateBehavior =
      "Top-level ES module import parsed once at worker boot; stays V8-JIT warm across all steady-state tasks (0 JS module re-fetches)";
    wasmSteadyStateBehavior = `Re-fetches .wasm${hasNoStoreInGraph ? ' (cache: "no-store")' : ""}${
      hasSha256InGraph ? ", computes SHA-256," : ""
    } and calls WebAssembly.instantiate() inside onmessage on every task`;
    summaryNote =
      `Asymmetric worker lifecycle: JS stays warm via top-level ES import across reused messages, whereas every Wasm task ${
        hasNoStoreInGraph ? 'fetches .wasm with cache: "no-store", ' : "fetches .wasm, "
      }${
        hasSha256InGraph ? "verifies SHA-256 digests, and " : ""
      }allocates/compiles a fresh WebAssembly.Instance inside onmessage before running the kernel.`;
  }

  return {
    index: spec.index,
    slug: spec.slug,
    pageSlug: spec.pageSlug,
    id: spec.id,
    route: spec.route,
    workerScript,
    workerRepoPath: graph.entryRepoPath,
    workerGitHubUrl: toGitHubBlobUrl(graph.entryRepoPath),
    workerSha256: graph.entrySha256,
    importedModuleCount: graph.files.length,
    lifecycleClass,
    lifecycleBadge: badgeForWorkerLifecycleClass(lifecycleClass),
    workerReuse,
    jsSteadyStateBehavior,
    wasmSteadyStateBehavior,
    perTaskNoStoreFetch,
    perTaskSha256Digest,
    perTaskWasmInstantiate,
    perTaskDynamicJsImport,
    perTaskCrossChecksJsInsideWasm: crossChecksJsInsideWasm,
    summaryNote,
  };
}

export async function buildWorkerLifecycleLedger(): Promise<WorkerLifecycleLedger> {
  const entries: WorkerLifecycleEntry[] = [];
  for (const spec of BENCHMARK_BUILD_SPECS) {
    entries.push(await auditSpec(spec));
  }

  const byClass: Record<WorkerLifecycleClass, number> = {
    "symmetric-warm": 0,
    "asymmetric-wasm-cold-per-task": 0,
    "per-task-verified-bundle": 0,
    "symmetric-cold-isolate": 0,
    "in-page-kernel-only": 0,
  };
  for (const e of entries) {
    byClass[e.lifecycleClass] += 1;
  }

  const workerEntries = entries.filter((e) => e.workerScript !== null);
  const summary: WorkerLifecycleSummary = {
    totalBenchmarks: entries.length,
    workerBackedBenchmarks: workerEntries.length,
    inPageKernelOnlyBenchmarks: byClass["in-page-kernel-only"],
    byClass,
    perTaskWasmInstantiateCount: workerEntries.filter((e) => e.perTaskWasmInstantiate).length,
    warmCachedWasmCount: byClass["symmetric-warm"],
    perTaskNoStoreFetchCount: workerEntries.filter((e) => e.perTaskNoStoreFetch).length,
    perTaskSha256DigestCount: workerEntries.filter((e) => e.perTaskSha256Digest).length,
    singleUseRespawnCount: byClass["symmetric-cold-isolate"],
  };

  return {
    schemaVersion: "worker-lifecycle.v1",
    auditScript: "scripts/audit-worker-lifecycle.ts",
    companionDocUrl: "/docs/worker-lifecycle-audit.md",
    methodologyUrl: "/methodology/#worker-wasm-explained",
    summary,
    entries,
  };
}

export function renderWorkerLifecycleMarkdown(ledger: WorkerLifecycleLedger): string {
  const s = ledger.summary;
  const lines: string[] = [];
  lines.push("# Worker Task Pipeline Lifecycle Audit (All 50 Benchmarks)");
  lines.push("");
  lines.push(
    `This audit inspects the exact Web Worker module graph for all **${s.totalBenchmarks}** benchmark tests (**${s.workerBackedBenchmarks}** worker-backed benchmarks in \`public/unified-runner.js\` plus **${s.inPageKernelOnlyBenchmarks}** in-page kernel panel) and records how JavaScript and WebAssembly are loaded, verified, and instantiated on each timed \`Task Pipeline\` iteration.`,
  );
  lines.push("");
  lines.push(
    "- **Machine-readable ledger**: [`/data/worker-lifecycle.v1.json`](/data/worker-lifecycle.v1.json)",
  );
  lines.push(
    "- **Methodology overview**: [`/methodology/#worker-wasm-explained`](/methodology/#worker-wasm-explained)",
  );
  lines.push(
    "- **Verification command**: `deno run --allow-read --allow-run scripts/audit-worker-lifecycle.ts --check`",
  );
  lines.push("");
  lines.push("## 1. Executive Summary & Audited Counts");
  lines.push("");
  lines.push(
    `Across the **${s.workerBackedBenchmarks}** worker-backed benchmarks, **${s.warmCachedWasmCount} / ${s.workerBackedBenchmarks}** keep a warm \`WebAssembly.Instance\` across timed iterations, whereas **${s.perTaskWasmInstantiateCount} / ${s.workerBackedBenchmarks}** compile and instantiate a fresh \`WebAssembly.Instance\` on every timed Wasm task (**${
      s.byClass["asymmetric-wasm-cold-per-task"]
    }** where JavaScript stays warm via a static top-level ES module import, **${
      s.byClass["per-task-verified-bundle"]
    }** where each message re-verifies and dynamically imports runtime bundles, and **${s.singleUseRespawnCount}** single-use workers that respawn a fresh OS thread and V8 isolate per sample).`,
  );
  lines.push("");
  lines.push(
    "| Lifecycle Class | Count | Worker Reuse | Steady-State JS Behavior | Steady-State Wasm Behavior |",
  );
  lines.push("| --- | --- | --- | --- | --- |");
  lines.push(
    `| \`asymmetric-wasm-cold-per-task\` | **${
      s.byClass["asymmetric-wasm-cold-per-task"]
    } / ${s.workerBackedBenchmarks}** | \`reused\` | Static top-level ES \`import\` stays V8-JIT warm (0 JS re-fetches) | Fetches \`.wasm\` (usually \`cache: "no-store"\`), hashes bytes, and calls \`WebAssembly.instantiate()\` inside \`onmessage\` per task |`,
  );
  lines.push(
    `| \`per-task-verified-bundle\` | **${
      s.byClass["per-task-verified-bundle"]
    } / ${s.workerBackedBenchmarks}** | \`reused\` | Dynamically imports fresh \`Blob\` / \`?run=\` JS module per message | Fetches & SHA-256-verifies \`.wasm\` + glue and compiles/instantiates fresh Wasm per message |`,
  );
  lines.push(
    `| \`symmetric-warm\` | **${
      s.byClass["symmetric-warm"]
    } / ${s.workerBackedBenchmarks}** | \`reused\` / \`batched-in-worker\` | Warm JS module across timed samples | Warm \`WebAssembly.Instance\` cached across timed samples (\`sum-u32\`, \`game-canvas-arcade\`, \`game-canvas-entity-pathfinding\`, \`game-dom-tactics-grid\`) |`,
  );
  lines.push(
    `| \`symmetric-cold-isolate\` | **${
      s.byClass["symmetric-cold-isolate"]
    } / ${s.workerBackedBenchmarks}** | \`respawned-per-iteration\` | Spawns fresh Worker thread + V8 isolate per sample (\`accepted = true\`) | Spawns fresh Worker thread + V8 isolate + \`no-store\` fetch + \`WebAssembly.compile/instantiate\` per sample |`,
  );
  lines.push(
    `| \`in-page-kernel-only\` | **${
      s.byClass["in-page-kernel-only"]
    } / ${s.totalBenchmarks}** | \`none\` | In-page pre-imported JS (\`Kernel Compute\` only) | In-page pre-instantiated Wasm (\`Kernel Compute\` only) |`,
  );
  lines.push("");
  lines.push("### Per-Task Cost Operations Across the 49 Worker Benchmarks");
  lines.push("");
  lines.push("| Audited Worker Operation Inside Timed Task | Benchmarks | Measured Consequence |");
  lines.push("| --- | --- | --- |");
  lines.push(
    `| Keeps \`WebAssembly.Instance\` warm across timed samples | **${s.warmCachedWasmCount} / ${s.workerBackedBenchmarks}** | Measures warm worker dispatch + compute + verification without recompiling Wasm |`,
  );
  lines.push(
    `| Calls \`WebAssembly.compile\` / \`instantiate\` on every timed Wasm task | **${s.perTaskWasmInstantiateCount} / ${s.workerBackedBenchmarks}** | Adds Liftoff baseline compilation, fresh linear-memory page allocation/zeroing, and cold first-call execution to every sample |`,
  );
  lines.push(
    `| Executes \`fetch(..., { cache: "no-store" })\` per task | **${s.perTaskNoStoreFetchCount} / ${s.workerBackedBenchmarks}** | Bypasses HTTP cache and retrieves \`.wasm\` / manifest / fixture bytes over loopback HTTP during steady-state tasks |`,
  );
  lines.push(
    `| Computes \`crypto.subtle.digest("SHA-256", ...)\` inside task | **${s.perTaskSha256DigestCount} / ${s.workerBackedBenchmarks}** | Hashes \`.wasm\`, fixture, or output bytes inside the timed worker message boundary |`,
  );
  lines.push(
    `| Terminates / refuses second message (\`respawned-per-iteration\`) | **${s.singleUseRespawnCount} / ${s.workerBackedBenchmarks}** | Adds ~15–40 ms OS thread creation and V8 isolate bootstrap to both JS and Wasm samples |`,
  );
  lines.push("");
  lines.push("## 2. Why Contract Workers Were Written This Way — And How to Read the Two Tables");
  lines.push("");
  lines.push(
    "Contract workers in this repository double as self-attesting provenance runners: each task verifies raw served artifact hashes against `build-manifest.json` and checks complete outputs against pinned reference fixtures before posting completion, and worker source files are hash-anchored by committed provenance manifests (`AGENTS.md`).",
  );
  lines.push("");
  lines.push(
    "Because modifying hash-pinned contract workers would invalidate frozen evidence records, every benchmark page separates measurements into explicit, non-mixed scopes:",
  );
  lines.push("");
  lines.push(
    "1. **To compare pure algorithm & compiler speed (pre-instantiated warm Wasm vs warm JS)**: read the **Kernel Compute** table (Stages 1–3, powered by `/multilang-runner.js`), where every JS and Wasm engine is fetched once, instantiated once, verified for bit-identical/declared-tolerance output agreement, warmed up, and timed in memory.",
  );
  lines.push(
    "2. **To inspect end-to-end contract worker task cost**: read the **Task Pipeline** table alongside each test's **Worker Pipeline Lifecycle** badge below (and on every benchmark page), which states whether that specific test's worker caches `WebAssembly.Instance` (`symmetric-warm`) or re-fetches/re-instantiates `.wasm` per message (`asymmetric-wasm-cold-per-task`, `per-task-verified-bundle`, `symmetric-cold-isolate`).",
  );
  lines.push("");
  lines.push("## 3. Per-Test Worker Lifecycle Classification (All 50 Tests)");
  lines.push("");
  lines.push(
    "| # | Workload & Route | Worker Source | Lifecycle Class | Reuse | Per-Task Ops (`no-store` / `SHA-256` / `instantiate`) | Steady-State JS vs Wasm Behavior |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");

  for (const e of ledger.entries) {
    const workerCell = e.workerScript
      ? `[\`${e.workerScript}\`](${e.workerScript}) ([GitHub](${e.workerGitHubUrl}))`
      : "— (in-page)";
    const opsCell = e.workerScript
      ? `\`no-store\`: ${e.perTaskNoStoreFetch ? "yes" : "no"}<br>\`SHA-256\`: ${
        e.perTaskSha256Digest ? "yes" : "no"
      }<br>\`instantiate\`: ${e.perTaskWasmInstantiate ? "per-task" : "once"}`
      : "none";
    lines.push(
      `| ${e.index} | \`${e.id}\`<br>[${e.route}](${e.route}) | ${workerCell} | \`${e.lifecycleClass}\` | \`${e.workerReuse}\` | ${opsCell} | **JS:** ${e.jsSteadyStateBehavior}<br>**Wasm:** ${e.wasmSteadyStateBehavior} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export async function verifyWorkerLifecycleAudit(): Promise<{
  ok: boolean;
  entryCount: number;
  workerCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const expectedLedger = await buildWorkerLifecycleLedger();
  const expectedJson = JSON.stringify(expectedLedger, null, 2) + "\n";
  const expectedDoc = await formatMarkdown(renderWorkerLifecycleMarkdown(expectedLedger));

  if (!(await fileExists(WORKER_LIFECYCLE_JSON_PATH))) {
    errors.push(`Missing ${WORKER_LIFECYCLE_JSON_PATH}`);
  } else {
    const actualJson = await Deno.readTextFile(WORKER_LIFECYCLE_JSON_PATH);
    if (actualJson !== expectedJson) {
      errors.push(
        `${WORKER_LIFECYCLE_JSON_PATH} is out of sync with live worker sources; re-run scripts/audit-worker-lifecycle.ts`,
      );
    }
  }

  if (!(await fileExists(WORKER_LIFECYCLE_DOC_PATH))) {
    errors.push(`Missing ${WORKER_LIFECYCLE_DOC_PATH}`);
  } else {
    const actualDoc = await Deno.readTextFile(WORKER_LIFECYCLE_DOC_PATH);
    if (actualDoc !== expectedDoc) {
      errors.push(
        `${WORKER_LIFECYCLE_DOC_PATH} is out of sync with live worker sources; re-run scripts/audit-worker-lifecycle.ts`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    entryCount: expectedLedger.entries.length,
    workerCount: expectedLedger.summary.workerBackedBenchmarks,
    errors,
  };
}

if (import.meta.main) {
  if (Deno.args.includes("--check")) {
    const result = await verifyWorkerLifecycleAudit();
    if (!result.ok) {
      for (const err of result.errors) console.error(`ERROR: ${err}`);
      Deno.exit(1);
    }
    console.log(
      `OK: worker lifecycle audit verified (${result.entryCount} tests, ${result.workerCount} workers).`,
    );
    Deno.exit(0);
  }

  const ledger = await buildWorkerLifecycleLedger();
  await Deno.writeTextFile(
    WORKER_LIFECYCLE_JSON_PATH,
    JSON.stringify(ledger, null, 2) + "\n",
  );
  const md = await formatMarkdown(renderWorkerLifecycleMarkdown(ledger));
  await Deno.writeTextFile(WORKER_LIFECYCLE_DOC_PATH, md);
  console.log(
    `Wrote ${WORKER_LIFECYCLE_JSON_PATH} and ${WORKER_LIFECYCLE_DOC_PATH} (${ledger.entries.length} tests; summary=${
      JSON.stringify(ledger.summary.byClass)
    }).`,
  );
}
