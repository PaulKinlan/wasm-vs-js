import { LocalRunStore } from "./lib/run-store.ts";
import { generateSummary } from "./lib/summary.ts";
import { CorpusCoordinator } from "./lib/corpus-store.ts";
import { KvRunStore } from "./lib/kv-store.ts";
import { handleReportingRoute, type ReportingConfig } from "./lib/reporting-api.ts";
import { collectorRouteHashes } from "./lib/source-identity.ts";
import { IMAGE_DEMO_ROUTES } from "./lib/image-demo-registry.ts";
import { TRADITIONAL_DEMO_ROUTES } from "./lib/traditional-demo-registry.ts";
import { GENERATED_ROUTES } from "./routes.generated.ts";

type ServerMode = "local" | "public";

const root = new URL("./", import.meta.url);
const configuredMode = Deno.env.get("SERVER_MODE") ?? "local";
if (configuredMode !== "local" && configuredMode !== "public") {
  throw new Error("SERVER_MODE must be local or public");
}
const mode: ServerMode = configuredMode;
const acceptedImplementationCommit = "9c309c4941d1b8550c15f8549f95a5636a634ef6";
const localCheckoutCommit = mode === "local" ? Deno.env.get("WASM_VS_JS_COMMIT") ?? "" : "";
if (mode === "local" && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(localCheckoutCommit)) {
  throw new Error("WASM_VS_JS_COMMIT must identify the local Git checkout");
}
const defaultStore = mode === "local"
  ? new LocalRunStore(new URL("raw/runs/", root).pathname)
  : null;
if (defaultStore) await defaultStore.initialize();
const defaultCorpus = mode === "local"
  ? new CorpusCoordinator(new URL("raw/corpora/", root).pathname)
  : null;

// Initialize KV store for M3 reporting API if available
// Deno Deploy provides Deno.openKv(); local mode may not unless --unstable-kv
let reportingKv: Deno.Kv | null = null;
let reportingStore: KvRunStore | null = null;
try {
  if (typeof Deno.openKv === "function") {
    reportingKv = await Deno.openKv();
    reportingStore = new KvRunStore(reportingKv);
  }
} catch {
  // KV not available (local mode without --unstable-kv flag)
}
const reportingConfig: ReportingConfig = {
  kvStore: reportingStore,
  reporterToken: Deno.env.get("WASM_VS_JS_REPORTER_TOKEN") ?? null,
};
const port = Number(Deno.env.get("PORT") ?? "8787");
const host = Deno.env.get("HOST") ?? (mode === "public" ? "0.0.0.0" : "127.0.0.1");
const MAX_BODY = 512 * 1024;
const collectorAssets = await collectorRouteHashes();

// This server-held digest is outside the browser runtime graph. The runtime-manifest builder
// updates it only after hashing the page, runner, worker, and every runtime dependency.
const SQLITE_NOTEBOOK_RUNTIME_MANIFEST_SHA256 =
  "fbfeffdc170d942890bcb6ec36394accc293504a2fac4cd3b96c1bc6c4daa60e";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

const sqliteNotebookManifestPath = "/assets/sqlite-notebook/runtime-manifest.json";
const sqliteNotebookManifestBytes = await Deno.readFile(
  new URL("public/artifacts/sqlite-notebook/runtime-manifest.json", root),
);
const sqliteNotebookManifestHash = await sha256Hex(sqliteNotebookManifestBytes);
if (sqliteNotebookManifestHash !== SQLITE_NOTEBOOK_RUNTIME_MANIFEST_SHA256) {
  throw new Error(
    `SQLite notebook runtime manifest trust-root mismatch: ${sqliteNotebookManifestHash}`,
  );
}
const sqliteNotebookManifest = JSON.parse(
  new TextDecoder().decode(sqliteNotebookManifestBytes),
) as {
  files: Array<{ id: string; source: string; path: string; sha256: string }>;
};
const sqliteNotebookRuntimeBytes = new Map<string, Uint8Array>([
  [sqliteNotebookManifestPath, sqliteNotebookManifestBytes],
]);
for (const entry of sqliteNotebookManifest.files) {
  const bytes = await Deno.readFile(new URL(entry.source, root));
  const actual = await sha256Hex(bytes);
  if (actual !== entry.sha256) {
    throw new Error(`SQLite notebook runtime file mismatch: ${entry.source}`);
  }
  sqliteNotebookRuntimeBytes.set(entry.path, bytes);
}
const sqliteNotebookRuntimeEntries = new Map(
  sqliteNotebookManifest.files.map((entry) => [entry.id, entry]),
);
for (const id of ["page", "runner", "worker"]) {
  if (!sqliteNotebookRuntimeEntries.has(id)) {
    throw new Error(`SQLite notebook runtime manifest is missing ${id}`);
  }
}
const sqliteNotebookTrustRoot = Object.freeze({
  schemaVersion: 1,
  runtimeManifestSha256: SQLITE_NOTEBOOK_RUNTIME_MANIFEST_SHA256,
  pageSha256: sqliteNotebookRuntimeEntries.get("page")!.sha256,
  runnerSha256: sqliteNotebookRuntimeEntries.get("runner")!.sha256,
});

const securityHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob: 'unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'",
};

function response(body: BodyInit | null, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  return new Response(body, { ...init, headers });
}

function json(value: unknown, status = 200): Response {
  return response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function boundedJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    throw new Error("content type denied");
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY) throw new Error("body too large");
  if (!request.body) throw new Error("body required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY) {
      await reader.cancel();
      throw new Error("body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

const routes = new Map<string, [string, string, boolean?]>([
  ["/", ["public/index.html", "text/html; charset=utf-8"]],
  ["/evidence", ["public/evidence/index.html", "text/html; charset=utf-8"]],
  ["/evidence/", ["public/evidence/index.html", "text/html; charset=utf-8"]],
  ["/evidence/v1", ["public/evidence/index.html", "text/html; charset=utf-8"]],
  ["/evidence/v1/", ["public/evidence/index.html", "text/html; charset=utf-8"]],
  ["/evidence/v1/acceptance.json", [
    "public/evidence/v1/acceptance.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-v1-blockers/ml.quantized-image-inference.v1.json", [
    "public/evidence/base-v1-blockers/ml.quantized-image-inference.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/v2-proposals", [
    "public/evidence/v2-proposals/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/evidence/v2-proposals/", [
    "public/evidence/v2-proposals/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/styles.css", ["public/styles.css", "text/css; charset=utf-8"]],
  ["/favicon.ico", ["public/favicon.svg", "image/svg+xml"]],
  ["/favicon.svg", ["public/favicon.svg", "image/svg+xml"]],
  ["/app.js", ["public/app.js", "text/javascript; charset=utf-8"]],
  ["/playground.js", ["public/playground.js", "text/javascript; charset=utf-8"]],
  ["/results-explorer.js", [
    "public/results-explorer.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/results", ["public/results/index.html", "text/html; charset=utf-8"]],
  ["/results/", ["public/results/index.html", "text/html; charset=utf-8"]],
  ["/unified-runner.js", ["public/unified-runner.js", "text/javascript; charset=utf-8"]],
  ["/multilang-report.css", ["public/multilang-report.css", "text/css; charset=utf-8"]],
  ["/iframe-benchmark-bridge.js", [
    "public/iframe-benchmark-bridge.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/todomvc-ops.js", [
    "public/dom-hosts/todomvc-ops.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/dom-host-factory.js", [
    "public/dom-hosts/dom-host-factory.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/dom-grid-movement-host.js", [
    "public/dom-hosts/dom-grid-movement-host.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/dom-keyed-list-mutation-host.js", [
    "public/dom-hosts/dom-keyed-list-mutation-host.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/dom-nested-tree-mutation-host.js", [
    "public/dom-hosts/dom-nested-tree-mutation-host.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/dom-table-sort-filter-pagination-host.js", [
    "public/dom-hosts/dom-table-sort-filter-pagination-host.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/dom-dependent-form-validation-host.js", [
    "public/dom-hosts/dom-dependent-form-validation-host.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/dom-hosts/dom-virtualized-scrolling-host.js", [
    "public/dom-hosts/dom-virtualized-scrolling-host.js",
    "text/javascript; charset=utf-8",
  ]],
["/dom-hosts/base-dom-todomvc-journey.js", [
    "public/dom-hosts/base-dom-todomvc-journey.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/sum_u32_opt.c", [
    "benchmarks/multilang-wasm/track-b/sum_u32_opt.c",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/sum_u32_opt.js", [
    "benchmarks/multilang-wasm/track-b/sum_u32_opt.js",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/fft_opt.c", [
    "benchmarks/multilang-wasm/track-b/fft_opt.c",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/fft_opt.js", [
    "benchmarks/multilang-wasm/track-b/fft_opt.js",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/gemm_simd.c", [
    "benchmarks/multilang-wasm/track-b/gemm_simd.c",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/gemm_opt.js", [
    "benchmarks/multilang-wasm/track-b/gemm_opt.js",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/scan_log_opt.c", [
    "benchmarks/multilang-wasm/track-b/scan_log_opt.c",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/track-b/scan_log_opt.js", [
    "benchmarks/multilang-wasm/track-b/scan_log_opt.js",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/sum_u32.c", [
    "benchmarks/multilang-wasm/sum_u32.c",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/fft_kernel.c", [
    "benchmarks/multilang-wasm/fft_kernel.c",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/ml-gemm/gemm.c", [
    "benchmarks/multilang-wasm/ml-gemm/gemm.c",
    "text/plain; charset=utf-8",
  ]],
  ["/src/multilang-wasm/text-regex-log-scan/scan_log.c", [
    "benchmarks/multilang-wasm/text-regex-log-scan/scan_log.c",
    "text/plain; charset=utf-8",
  ]],
  ["/track-b.js", ["public/track-b.js", "text/javascript; charset=utf-8"]],
  ["/track-b.css", ["public/track-b.css", "text/css; charset=utf-8"]],
  ["/data/track-b-report.v1.json", [
    "public/data/track-b-report.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/track-b-optimizations.md", ["docs/track-b-optimizations.md", "text/markdown; charset=utf-8"]],
  ["/multilang-runner.js", ["public/multilang-runner.js", "text/javascript; charset=utf-8"]],
  ["/inspectability.js", ["public/inspectability.js", "text/javascript; charset=utf-8"]],
  ["/v2-results.js", ["public/v2-results.js", "text/javascript; charset=utf-8"]],
  ["/runner.js", ["public/runner.js", "text/javascript; charset=utf-8", true]],
  ["/corpus-run", ["local/corpus-run.html", "text/html; charset=utf-8", true]],
  ["/corpus-run.js", ["local/corpus-run.js", "text/javascript; charset=utf-8", true]],
  ["/hosted-runner.js", ["public/hosted-runner.js", "text/javascript; charset=utf-8"]],
  ["/provenance-probes.js", ["public/provenance-probes.js", "text/javascript; charset=utf-8"]],
  ["/hosted-runner-core.js", [
    "public/hosted-runner-core.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/hosted-runner-worker.js", [
    "public/hosted-runner-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/experiments", ["public/experiments/index.html", "text/html; charset=utf-8"]],
  ["/experiments/", ["public/experiments/index.html", "text/html; charset=utf-8"]],
  ["/experiments/m1-chrome-sum-u32-v1.json", [
    "public/experiments/m1-chrome-sum-u32-v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks", ["public/benchmarks/index.html", "text/html; charset=utf-8"]],
  ["/benchmarks/", ["public/benchmarks/index.html", "text/html; charset=utf-8"]],
  ["/benchmarks/base/cad-mesh-repair/engine.js", [
    "benchmarks/base/cad-mesh-repair/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/cad-mesh-repair-v1/dirty-grid.stl", [
    "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    "model/stl",
  ]],
  ["/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", [
    "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
    "application/wasm",
  ]],
  ["/artifacts/cad-mesh-repair-v1/build-manifest.json", [
    "public/artifacts/cad-mesh-repair-v1/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/cad-mesh-repair-v1/validation-evidence.json", [
    "public/artifacts/cad-mesh-repair-v1/validation-evidence.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base-v1/graphics-cpu-path-tracer/engine.js", [
    "benchmarks/base-v1/graphics-cpu-path-tracer/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base-v1/graphics-cpu-path-tracer/reference.js", [
    "benchmarks/base-v1/graphics-cpu-path-tracer/reference.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base-v1/graphics-cpu-path-tracer/implementation-contract.v1.json", [
    "benchmarks/base-v1/graphics-cpu-path-tracer/implementation-contract.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm", [
    "public/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm",
    "application/wasm",
  ]],
  ["/artifacts/graphics-cpu-path-tracer-v1/build-manifest.json", [
    "public/artifacts/graphics-cpu-path-tracer-v1/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/base-ml-keyword-spotting-demo.js", [
    "public/base-ml-keyword-spotting-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/base-ml-keyword-spotting-worker.js", [
    "public/base-ml-keyword-spotting-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/ml-keyword-spotting/engine.js", [
    "benchmarks/base/ml-keyword-spotting/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/ml-keyword-spotting/constants.v1.js", [
    "benchmarks/base/ml-keyword-spotting/constants.v1.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm", [
    "public/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm",
    "application/wasm",
  ]],
  ["/artifacts/base-ml-keyword-spotting/registration.v1.json", [
    "public/artifacts/base-ml-keyword-spotting/registration.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-ml-keyword-spotting/output-manifest.v1.json", [
    "public/artifacts/base-ml-keyword-spotting/output-manifest.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-ml-keyword-spotting/fixture-manifest.json", [
    "benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-ml-keyword-spotting/fixture.pcm16le", [
    "public/artifacts/base-ml-keyword-spotting/fixture.pcm16le",
    "application/octet-stream",
  ]],
  ["/artifacts/base-ml-keyword-spotting/model-checkpoint.v1.json", [
    "benchmarks/base/ml-keyword-spotting/model-checkpoint.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/demos/game-family/demo.js", [
    "public/demos/game-family/demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/demos/game-family/worker.js", [
    "public/demos/game-family/worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/demos/game-family/styles.css", [
    "public/demos/game-family/styles.css",
    "text/css; charset=utf-8",
  ]],
  ["/benchmarks/v2/game-family/engine.js", [
    "benchmarks/v2/game-family/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/game-family/fixtures.js", [
    "benchmarks/v2/game-family/fixtures.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/demo-runner.js", ["public/demo-runner.js", "text/javascript; charset=utf-8"]],
  ["/demo-worker.js", ["public/demo-worker.js", "text/javascript; charset=utf-8"]],
  ["/demo-registry.json", ["public/demo-registry.json", "application/json; charset=utf-8"]],
  ["/demo-assets/audio/manifest.json", [
    "public/demo-assets/audio/manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/workload-catalog-routes.generated.js", [
    "public/workload-catalog-routes.generated.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/workload-catalog.js", ["public/workload-catalog.js", "text/javascript; charset=utf-8"]],
  ["/crypto-file-integrity-demo.js", [
    "public/crypto-file-integrity-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/crypto-file-integrity-worker.js", [
    "public/crypto-file-integrity-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/crypto-file-integrity/sha256.js", [
    "benchmarks/base/crypto-file-integrity/sha256.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/crypto-file-integrity/workload.js", [
    "benchmarks/base/crypto-file-integrity/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/crypto-file-integrity/crypto-file-integrity.wasm", [
    "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
    "application/wasm",
  ]],
  ["/artifacts/crypto-file-integrity/build-manifest.json", [
    "public/artifacts/crypto-file-integrity/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/registrations/base/crypto.file-integrity.v1.json", [
    "registrations/base/crypto.file-integrity.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/crypto.file-integrity.v1/validation.json", [
    "public/evidence/base/crypto.file-integrity.v1/validation.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/crypto.file-integrity.v1/validation.schema.json", [
    "public/evidence/base/crypto.file-integrity.v1/validation.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/data/base-implementation-status.v1.json", [
    "public/data/base-implementation-status.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/base-implementation-status.schema.json", [
    "public/data/base-implementation-status.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/benchmarks/v1/game-ecs-frame-update/fixture.js", [
    "benchmarks/v1/game-ecs-frame-update/fixture.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/game-ecs-frame-update/engine.js", [
    "benchmarks/v1/game-ecs-frame-update/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm", [
    "public/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm",
    "application/wasm",
  ]],
  ["/artifacts/game-ecs-frame-update-v1/fixture.bin", [
    "public/artifacts/game-ecs-frame-update-v1/fixture.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/game-ecs-frame-update-v1/fixture-manifest.json", [
    "public/artifacts/game-ecs-frame-update-v1/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/game-ecs-frame-update-v1/output-manifest.json", [
    "public/artifacts/game-ecs-frame-update-v1/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/game-ecs-frame-update-v1/build-manifest.json", [
    "public/artifacts/game-ecs-frame-update-v1/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-v1/game-ecs-frame-update-v1/js-controlled.json", [
    "public/evidence/base-v1/game-ecs-frame-update-v1/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-v1/game-ecs-frame-update-v1/wasm-linear-controlled.json", [
    "public/evidence/base-v1/game-ecs-frame-update-v1/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/implementations.v1/game.ecs-frame-update.v1.json", [
    "catalog/implementations.v1/game.ecs-frame-update.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/game-ecs-frame-update-implementation.v1.schema.json", [
    "schemas/game-ecs-frame-update-implementation.v1.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/text-demo.js", ["public/text-demo.js", "text/javascript; charset=utf-8"]],
  ["/text-diff-patch-worker.js", [
    "public/text-diff-patch-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/text-markdown-cms-worker.js", [
    "public/text-markdown-cms-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/text-diff-patch/workload.js", [
    "benchmarks/v2/text-diff-patch/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/text-markdown-cms/workload.js", [
    "benchmarks/v2/text-markdown-cms/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/text-diff-patch/text-diff-patch.wasm", [
    "public/artifacts/text-diff-patch/text-diff-patch.wasm",
    "application/wasm",
  ]],
  ["/artifacts/text-diff-patch/build-manifest.json", [
    "public/artifacts/text-diff-patch/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-diff-patch/fixture-manifest.json", [
    "public/artifacts/text-diff-patch/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-diff-patch/input-manifest.json", [
    "public/artifacts/text-diff-patch/input-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-diff-patch/output-manifest.json", [
    "public/artifacts/text-diff-patch/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-markdown-cms/text-markdown-cms.wasm", [
    "public/artifacts/text-markdown-cms/text-markdown-cms.wasm",
    "application/wasm",
  ]],
  ["/artifacts/text-markdown-cms/build-manifest.json", [
    "public/artifacts/text-markdown-cms/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-markdown-cms/fixture-manifest.json", [
    "public/artifacts/text-markdown-cms/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-markdown-cms/input-manifest.json", [
    "public/artifacts/text-markdown-cms/input-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-markdown-cms/output-manifest.json", [
    "public/artifacts/text-markdown-cms/output-manifest.json",
    "application/json; charset=utf-8",
  ]],

  // Friendly route aliases to prevent 404s when navigating or entering URLs
  ["/benchmarks/text-markdown-cms", [
    "public/demos/text.markdown-cms.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/text-markdown-cms/", [
    "public/demos/text.markdown-cms.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/text-markdown-cms", [
    "public/demos/text.markdown-cms.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/text-markdown-cms/", [
    "public/demos/text.markdown-cms.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/text-diff-patch", [
    "public/demos/text.diff-patch.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/text-diff-patch/", [
    "public/demos/text.diff-patch.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/text-diff-patch", [
    "public/demos/text.diff-patch.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/text-diff-patch/", [
    "public/demos/text.diff-patch.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-canvas-arcade", [
    "public/demos/game-canvas-arcade/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-canvas-arcade/", [
    "public/demos/game-canvas-arcade/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-canvas-entity-pathfinding", [
    "public/demos/game-canvas-entity-pathfinding/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-canvas-entity-pathfinding/", [
    "public/demos/game-canvas-entity-pathfinding/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-dom-tactics-grid", [
    "public/demos/game-dom-tactics-grid/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-dom-tactics-grid/", [
    "public/demos/game-dom-tactics-grid/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-ecs-frame-update", [
    "public/demos/game-ecs-frame-update/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/game-ecs-frame-update/", [
    "public/demos/game-ecs-frame-update/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/crypto-file-integrity", [
    "public/demos/crypto.file-integrity.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/crypto-file-integrity/", [
    "public/demos/crypto.file-integrity.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/network-pcap-decode", [
    "public/demos/network.pcap-decode.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/network-pcap-decode/", [
    "public/demos/network.pcap-decode.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/numeric-polybench-panel", [
    "public/demos/numeric.polybench-panel.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/numeric-polybench-panel/", [
    "public/demos/numeric.polybench-panel.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/serialization-json-telemetry", [
    "public/demos/serialization.json-telemetry.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/serialization-json-telemetry/", [
    "public/demos/serialization.json-telemetry.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/server-ssr-template", [
    "public/demos/server.ssr-template.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/server-ssr-template/", [
    "public/demos/server.ssr-template.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/text-gc-document-edit", [
    "public/demos/text.gc-document-edit.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/text-gc-document-edit/", [
    "public/demos/text.gc-document-edit.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/image-editing", [
    "public/benchmarks/image-editing-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/image-editing/", [
    "public/benchmarks/image-editing-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/image-flood-fill", [
    "public/benchmarks/image-flood-fill-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/image-flood-fill/", [
    "public/benchmarks/image-flood-fill-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/regex-automata-duel", [
    "public/benchmarks/regex-automata-duel-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/regex-automata-duel/", [
    "public/benchmarks/regex-automata-duel-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/vdom-diff-patch", [
    "public/benchmarks/vdom-diff-patch-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/vdom-diff-patch/", [
    "public/benchmarks/vdom-diff-patch-demo/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/data/workloads.v1.json", [
    "public/data/workloads.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/workload-catalog.schema.json", [
    "public/data/workload-catalog.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/data/v2-proposal-implementation-status.v1.json", [
    "public/data/v2-proposal-implementation-status.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/v2-proposal-implementation-status.schema.json", [
    "public/data/v2-proposal-implementation-status.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/data/sum-u32-inspectability.v1.json", [
    "public/data/sum-u32-inspectability.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/sum-u32/benchmark.json", [
    "benchmarks/sum-u32/benchmark.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/sum-u32/workload.js", [
    "benchmarks/sum-u32/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/ml-gemm/index.html", [
    "public/benchmarks/ml-gemm/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/ml-dense-mlp/index.html", [
    "public/benchmarks/ml-dense-mlp/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/v2/ml-gemm/workload.js", [
    "benchmarks/v2/ml-gemm/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/ml-dense-mlp/workload.js", [
    "benchmarks/v2/ml-dense-mlp/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/shared/allocations.js", [
    "benchmarks/v2/shared/allocations.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/shared/generator.js", [
    "benchmarks/v2/shared/generator.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/shared/workload-contract.js", [
    "benchmarks/v2/shared/workload-contract.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/v2/ml-gemm/ml-gemm.wasm", [
    "artifacts/v2/ml-gemm/ml-gemm.wasm",
    "application/wasm",
  ]],
  ["/artifacts/v2/ml-gemm/reference.f64", [
    "artifacts/v2/ml-gemm/reference.f64",
    "application/octet-stream",
  ]],
  ["/artifacts/v2/ml-gemm/bounds.f32", [
    "artifacts/v2/ml-gemm/bounds.f32",
    "application/octet-stream",
  ]],
  ["/artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm", [
    "artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm",
    "application/wasm",
  ]],
  ["/artifacts/v2/ml-dense-mlp/reference.f64", [
    "artifacts/v2/ml-dense-mlp/reference.f64",
    "application/octet-stream",
  ]],
  ["/artifacts/v2/ml-dense-mlp/bounds.f32", [
    "artifacts/v2/ml-dense-mlp/bounds.f32",
    "application/octet-stream",
  ]],
  ["/benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js", [
    "benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v2/ml-gemm/ml-gemm.wat", [
    "benchmarks/v2/ml-gemm/ml-gemm.wat",
    "text/plain; charset=utf-8",
  ]],
  ["/benchmarks/v2/ml-dense-mlp/ml-dense-mlp.wat", [
    "benchmarks/v2/ml-dense-mlp/ml-dense-mlp.wat",
    "text/plain; charset=utf-8",
  ]],
  ["/artifacts/v2/ml-gemm/fixture-manifest.json", [
    "artifacts/v2/ml-gemm/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/v2/ml-gemm/output-manifest.json", [
    "artifacts/v2/ml-gemm/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/v2/ml-dense-mlp/fixture-manifest.json", [
    "artifacts/v2/ml-dense-mlp/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/v2/ml-dense-mlp/output-manifest.json", [
    "artifacts/v2/ml-dense-mlp/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/sum-u32/sum-u32.wasm", [
    "public/artifacts/sum-u32/sum-u32.wasm",
    "application/wasm",
  ]],
  ["/artifacts/sum-u32/build-manifest.json", [
    "public/artifacts/sum-u32/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/sum-u32/build-manifest.9c309c49.json", [
    "public/artifacts/sum-u32/build-manifest.9c309c49.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/cad-parametric-bracket/contract.js", [
    "benchmarks/base/cad-parametric-bracket/contract.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/cad-parametric-bracket/fixture.js", [
    "benchmarks/base/cad-parametric-bracket/fixture.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/cad-parametric-bracket/engine.js", [
    "benchmarks/base/cad-parametric-bracket/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/base-cad-parametric-bracket/bracket.wasm", [
    "public/artifacts/base-cad-parametric-bracket/bracket.wasm",
    "application/wasm",
  ]],
  ["/artifacts/base-cad-parametric-bracket/fixture-manifest.json", [
    "public/artifacts/base-cad-parametric-bracket/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-cad-parametric-bracket/build-manifest.json", [
    "public/artifacts/base-cad-parametric-bracket/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-cad-parametric-bracket/output-manifest.json", [
    "public/artifacts/base-cad-parametric-bracket/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-catalog/cad-parametric-bracket/js-controlled.json", [
    "public/evidence/base-catalog/cad-parametric-bracket/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-catalog/cad-parametric-bracket/wasm-linear-controlled.json", [
    "public/evidence/base-catalog/cad-parametric-bracket/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/crypto-authenticated-stream-demo.js", [
    "public/crypto-authenticated-stream-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/crypto-authenticated-stream-worker.js", [
    "public/crypto-authenticated-stream-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/crypto-authenticated-stream/engine.js", [
    "benchmarks/base/crypto-authenticated-stream/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/crypto-authenticated-stream/workload.js", [
    "benchmarks/base/crypto-authenticated-stream/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/crypto-authenticated-stream/registration.v1.json", [
    "benchmarks/base/crypto-authenticated-stream/registration.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm", [
    "public/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm",
    "application/wasm",
  ]],
  ["/artifacts/crypto-authenticated-stream/build-manifest.json", [
    "public/artifacts/crypto-authenticated-stream/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/crypto-authenticated-stream/fixture-manifest.json", [
    "public/artifacts/crypto-authenticated-stream/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/crypto-authenticated-stream/output-manifest.json", [
    "public/artifacts/crypto-authenticated-stream/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/crypto-authenticated-stream/js-controlled.json", [
    "public/evidence/base/crypto-authenticated-stream/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/crypto-authenticated-stream/wasm-linear-controlled.json", [
    "public/evidence/base/crypto-authenticated-stream/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/database-olap-chart/engine.js", [
    "benchmarks/base/database-olap-chart/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/database-olap-chart/browser-validation.js", [
    "benchmarks/base/database-olap-chart/browser-validation.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/database-olap-chart/fixture.js", [
    "benchmarks/base/database-olap-chart/fixture.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/database-olap-chart/database-olap-chart.wasm", [
    "public/artifacts/database-olap-chart/database-olap-chart.wasm",
    "application/wasm",
  ]],
  ["/artifacts/database-olap-chart/fixture.bin", [
    "public/artifacts/database-olap-chart/fixture.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/database-olap-chart/build-manifest.json", [
    "public/artifacts/database-olap-chart/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/database-olap-chart/fixture-manifest.json", [
    "public/artifacts/database-olap-chart/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/database-olap-chart/output-manifest.json", [
    "public/artifacts/database-olap-chart/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/database-olap-chart/correctness-record.json", [
    "public/evidence/base/database-olap-chart/correctness-record.json",
    "application/json; charset=utf-8",
  ]],
  ["/sqlite-notebook-runner.js", [
    "public/sqlite-notebook-runner.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/sqlite-notebook-worker.js", [
    "public/sqlite-notebook-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/sqlite-notebook/contract.js", [
    "benchmarks/base/sqlite-notebook/contract.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/sqlite-notebook/engine.js", [
    "benchmarks/base/sqlite-notebook/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/alasql.min.js", [
    "public/artifacts/sqlite-notebook/alasql.min.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/sqlite3.mjs", [
    "public/artifacts/sqlite-notebook/sqlite3.mjs",
    "text/javascript; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/sqlite3.wasm", [
    "public/artifacts/sqlite-notebook/sqlite3.wasm",
    "application/wasm",
  ]],
  ["/assets/sqlite-notebook/dependency-manifest.json", [
    "public/artifacts/sqlite-notebook/dependency-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/runtime-manifest.json", [
    "public/artifacts/sqlite-notebook/runtime-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/build-manifest.json", [
    "public/artifacts/sqlite-notebook/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/reference.json", [
    "public/artifacts/sqlite-notebook/reference.json",
    "application/json; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/fixtures/fixture-manifest.json", [
    "public/artifacts/sqlite-notebook/fixtures/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/fixtures/RIGHTS.md", [
    "public/artifacts/sqlite-notebook/fixtures/RIGHTS.md",
    "text/markdown; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/fixtures/customers.csv", [
    "public/artifacts/sqlite-notebook/fixtures/customers.csv",
    "text/csv; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/fixtures/products.csv", [
    "public/artifacts/sqlite-notebook/fixtures/products.csv",
    "text/csv; charset=utf-8",
  ]],
  ["/assets/sqlite-notebook/fixtures/sales.csv", [
    "public/artifacts/sqlite-notebook/fixtures/sales.csv",
    "text/csv; charset=utf-8",
  ]],
  ["/evidence/base-implementations/sqlite-notebook/javascript-controlled.json", [
    "public/evidence/base-implementations/sqlite-notebook/javascript-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-implementations/sqlite-notebook/linear-wasm-controlled.json", [
    "public/evidence/base-implementations/sqlite-notebook/linear-wasm-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/document-pdf-viewer/engine.js", [
    "benchmarks/base/document-pdf-viewer/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/document-pdf-viewer/report-100-pages.pdf", [
    "public/artifacts/document-pdf-viewer/report-100-pages.pdf",
    "application/pdf",
  ]],
  ["/artifacts/document-pdf-viewer/pdf-engine.wasm", [
    "public/artifacts/document-pdf-viewer/pdf-engine.wasm",
    "application/wasm",
  ]],
  ["/artifacts/document-pdf-viewer/implementation-contract.v1.json", [
    "public/artifacts/document-pdf-viewer/implementation-contract.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/document-pdf-viewer/fixture-manifest.json", [
    "public/artifacts/document-pdf-viewer/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/document-pdf-viewer/output-manifest.json", [
    "public/artifacts/document-pdf-viewer/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/document-pdf-viewer/build-manifest.json", [
    "public/artifacts/document-pdf-viewer/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/document-pdf-viewer/validation.json", [
    "public/evidence/base/document-pdf-viewer/validation.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/dom-todomvc-journey/benchmark.json", [
    "benchmarks/base/dom-todomvc-journey/benchmark.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/dom-todomvc-journey/fixture.js", [
    "benchmarks/base/dom-todomvc-journey/fixture.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/dom-todomvc-journey/engine.js", [
    "benchmarks/base/dom-todomvc-journey/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/dom-todomvc-journey/todomvc.wat", [
    "benchmarks/base/dom-todomvc-journey/todomvc.wat",
    "text/plain; charset=utf-8",
  ]],
  ["/artifacts/base-dom-todomvc-journey/runtime.js", [
    "public/artifacts/base-dom-todomvc-journey/runtime.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/base-dom-todomvc-journey/todomvc.wasm", [
    "public/artifacts/base-dom-todomvc-journey/todomvc.wasm",
    "application/wasm",
  ]],
  ["/artifacts/base-dom-todomvc-journey/fixture.json", [
    "public/artifacts/base-dom-todomvc-journey/fixture.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-dom-todomvc-journey/output-manifest.json", [
    "public/artifacts/base-dom-todomvc-journey/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-dom-todomvc-journey/build-manifest.json", [
    "public/artifacts/base-dom-todomvc-journey/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/base-dom-todomvc-journey.v1.json", [
    "public/data/base-dom-todomvc-journey.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/base-workload-implementation.schema.json", [
    "schemas/base-workload-implementation.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/data/base-todomvc-browser-evidence.schema.json", [
    "schemas/base-todomvc-browser-evidence.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/evidence/base/dom-todomvc-journey/js-controlled.json", [
    "public/evidence/base/dom-todomvc-journey/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/dom-todomvc-journey/wasm-linear-controlled.json", [
    "public/evidence/base/dom-todomvc-journey/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/dom-virtualized-grid/engine.js", [
    "benchmarks/base/dom-virtualized-grid/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/dom-virtualized-grid-v1/grid.wasm", [
    "public/artifacts/dom-virtualized-grid-v1/grid.wasm",
    "application/wasm",
  ]],
  ["/artifacts/dom-virtualized-grid-v1/fixture.bin", [
    "public/artifacts/dom-virtualized-grid-v1/fixture.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/dom-virtualized-grid-v1/implementation-contract.v1.json", [
    "public/artifacts/dom-virtualized-grid-v1/implementation-contract.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/dom-virtualized-grid-v1/build-manifest.json", [
    "public/artifacts/dom-virtualized-grid-v1/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/dom-virtualized-grid-v1/fixture-manifest.json", [
    "public/artifacts/dom-virtualized-grid-v1/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/dom-virtualized-grid-v1/output-manifest.json", [
    "public/artifacts/dom-virtualized-grid-v1/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/dom-virtualized-grid-v1/candidate.json", [
    "public/evidence/base/dom-virtualized-grid-v1/candidate.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/base-implementation-candidates.v1.json", [
    "catalog/base-implementation-candidates.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/ml-numeric-kernels-demo.js", [
    "public/ml-numeric-kernels-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/ml-numeric-kernels-worker.js", [
    "public/ml-numeric-kernels-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/ml-numeric-kernels/workload.js", [
    "benchmarks/base/ml-numeric-kernels/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm", [
    "public/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm",
    "application/wasm",
  ]],
  ["/artifacts/ml-numeric-kernels/fixture-manifest.json", [
    "public/artifacts/ml-numeric-kernels/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/ml-numeric-kernels/build-manifest.json", [
    "public/artifacts/ml-numeric-kernels/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/ml-numeric-kernels/output-manifest.json", [
    "public/artifacts/ml-numeric-kernels/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/implementations/ml.numeric-kernels.v1.json", [
    "catalog/implementations/ml.numeric-kernels.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/ml-numeric-kernels/fixture.bin", [
    "public/artifacts/ml-numeric-kernels/fixture.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/ml-numeric-kernels/reference.f64", [
    "public/artifacts/ml-numeric-kernels/reference.f64",
    "application/octet-stream",
  ]],
  ["/artifacts/ml-numeric-kernels/reference.i32", [
    "public/artifacts/ml-numeric-kernels/reference.i32",
    "application/octet-stream",
  ]],
  ["/artifacts/ml-numeric-kernels/reference.u8", [
    "public/artifacts/ml-numeric-kernels/reference.u8",
    "application/octet-stream",
  ]],
  ["/artifacts/ml-numeric-kernels/bounds.f64", [
    "public/artifacts/ml-numeric-kernels/bounds.f64",
    "application/octet-stream",
  ]],
  ["/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json", [
    "public/evidence/base-implementations/ml.numeric-kernels.v1/js-controlled-scalar.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-implementations/ml.numeric-kernels.v1/wasm-linear-controlled-scalar.json", [
    "public/evidence/base-implementations/ml.numeric-kernels.v1/wasm-linear-controlled-scalar.json",
    "application/json; charset=utf-8",
  ]],
  ["/network-http2-quic-state-demo.js", [
    "public/network-http2-quic-state-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/network-http2-quic-state-worker.js", [
    "public/network-http2-quic-state-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/network-http2-quic-state/engine.js", [
    "benchmarks/v1/network-http2-quic-state/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/network-http2-quic-state/fixture.js", [
    "benchmarks/v1/network-http2-quic-state/fixture.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/network-http2-quic-state/network-http2-quic-state.wasm", [
    "public/artifacts/network-http2-quic-state/network-http2-quic-state.wasm",
    "application/wasm",
  ]],
  ["/artifacts/network-http2-quic-state/trace.bin", [
    "public/artifacts/network-http2-quic-state/trace.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/network-http2-quic-state/expected-state.u32le", [
    "public/artifacts/network-http2-quic-state/expected-state.u32le",
    "application/octet-stream",
  ]],
  ["/artifacts/network-http2-quic-state/build-manifest.json", [
    "public/artifacts/network-http2-quic-state/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-v1/network-http2-quic-state/javascript-controlled.json", [
    "public/evidence/base-v1/network-http2-quic-state/javascript-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-v1/network-http2-quic-state/linear-wasm-controlled.json", [
    "public/evidence/base-v1/network-http2-quic-state/linear-wasm-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/numeric-fft-spectral-filter/workload.js", [
    "benchmarks/base/numeric-fft-spectral-filter/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm", [
    "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
    "application/wasm",
  ]],
  ["/artifacts/numeric-fft-spectral-filter/build-manifest.json", [
    "public/artifacts/numeric-fft-spectral-filter/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/numeric-fft-spectral-filter/fixture-manifest.json", [
    "public/artifacts/numeric-fft-spectral-filter/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/numeric-fft-spectral-filter/output-manifest.json", [
    "public/artifacts/numeric-fft-spectral-filter/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-v1/numeric-fft-spectral-filter/js-controlled.json", [
    "public/evidence/base-v1/numeric-fft-spectral-filter/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-v1/numeric-fft-spectral-filter/wasm-linear-controlled.json", [
    "public/evidence/base-v1/numeric-fft-spectral-filter/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/polybench-panel-demo.js", [
    "public/polybench-panel-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/polybench-panel-worker.js", [
    "public/polybench-panel-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/numeric-polybench-panel/workload.js", [
    "benchmarks/base/numeric-polybench-panel/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/numeric-polybench-panel/contract.json", [
    "benchmarks/base/numeric-polybench-panel/contract.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/numeric-polybench-panel/polybench-panel.wasm", [
    "public/artifacts/numeric-polybench-panel/polybench-panel.wasm",
    "application/wasm",
  ]],
  ["/artifacts/numeric-polybench-panel/reference-oracle.wasm", [
    "public/artifacts/numeric-polybench-panel/reference-oracle.wasm",
    "application/wasm",
  ]],
  ["/artifacts/numeric-polybench-panel/build-manifest.json", [
    "public/artifacts/numeric-polybench-panel/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/numeric-polybench-panel/correctness-record.json", [
    "evidence/base/numeric-polybench-panel/correctness-record.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/numeric-polybench-panel/prior-art-verification.json", [
    "evidence/base/numeric-polybench-panel/prior-art-verification.json",
    "application/json; charset=utf-8",
  ]],
  ["/schemas/base-workload-contract.schema.json", [
    "schemas/base-workload-contract.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/schemas/base-correctness-record.schema.json", [
    "schemas/base-correctness-record.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/telemetry-demo.js", ["public/telemetry-demo.js", "text/javascript; charset=utf-8"]],
  ["/telemetry-worker.js", ["public/telemetry-worker.js", "text/javascript; charset=utf-8"]],
  ["/telemetry-module-loader.js", [
    "public/telemetry-module-loader.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/serialization-json-telemetry/workload.js", [
    "benchmarks/v1/serialization-json-telemetry/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  [
    "/benchmarks/v1/serialization-json-telemetry/workload.54e2ee54b225d8454664dc6a24f5fa178ee0652ccf0e7e01eea93b17f29530f8.js",
    [
      "benchmarks/v1/serialization-json-telemetry/workload.js",
      "text/javascript; charset=utf-8",
    ],
  ],
  ["/artifacts/serialization-json-telemetry/telemetry.wasm", [
    "public/artifacts/serialization-json-telemetry/telemetry.wasm",
    "application/wasm",
  ]],
  ["/artifacts/serialization-json-telemetry/build-manifest.json", [
    "public/artifacts/serialization-json-telemetry/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/serialization-json-telemetry/fixture-manifest.json", [
    "public/artifacts/serialization-json-telemetry/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/serialization-json-telemetry/input-manifest.json", [
    "public/artifacts/serialization-json-telemetry/input-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/serialization-json-telemetry/output-manifest.json", [
    "public/artifacts/serialization-json-telemetry/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/serialization-protobuf-gateway/workload.js", [
    "benchmarks/base/serialization-protobuf-gateway/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json", [
    "benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm", [
    "public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm",
    "application/wasm",
  ]],
  ["/artifacts/serialization-protobuf-gateway/fixture-manifest.json", [
    "public/artifacts/serialization-protobuf-gateway/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/serialization-protobuf-gateway/output-manifest.json", [
    "public/artifacts/serialization-protobuf-gateway/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/serialization-protobuf-gateway/build-manifest.json", [
    "public/artifacts/serialization-protobuf-gateway/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/base-server-ssr-demo.js", [
    "public/base-server-ssr-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/base-server-ssr-worker.js", [
    "public/base-server-ssr-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/server-ssr-template/workload.js", [
    "benchmarks/v1/server-ssr-template/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/data/v1-implementation-registrations/server.ssr-template.v1.json", [
    "catalog/v1-implementation-registrations/server.ssr-template.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-server-ssr-template/server-ssr-template.wasm", [
    "public/artifacts/base-server-ssr-template/server-ssr-template.wasm",
    "application/wasm",
  ]],
  ["/artifacts/base-server-ssr-template/fixture.bin", [
    "public/artifacts/base-server-ssr-template/fixture.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/base-server-ssr-template/reference-output.bin", [
    "public/artifacts/base-server-ssr-template/reference-output.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/base-server-ssr-template/build-manifest.json", [
    "public/artifacts/base-server-ssr-template/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-server-ssr-template/fixture-manifest.json", [
    "public/artifacts/base-server-ssr-template/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-server-ssr-template/output-manifest.json", [
    "public/artifacts/base-server-ssr-template/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/base/simulation-nbody/contract.js", [
    "benchmarks/base/simulation-nbody/contract.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/simulation-nbody/fixture.js", [
    "benchmarks/base/simulation-nbody/fixture.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/simulation-nbody/engine.js", [
    "benchmarks/base/simulation-nbody/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/base-simulation-nbody/nbody.wasm", [
    "public/artifacts/base-simulation-nbody/nbody.wasm",
    "application/wasm",
  ]],
  ["/artifacts/base-simulation-nbody/fixture.bin", [
    "public/artifacts/base-simulation-nbody/fixture.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/base-simulation-nbody/reference-output.bin", [
    "public/artifacts/base-simulation-nbody/reference-output.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/base-simulation-nbody/build-manifest.json", [
    "public/artifacts/base-simulation-nbody/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-simulation-nbody/fixture-manifest.json", [
    "public/artifacts/base-simulation-nbody/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-simulation-nbody/output-manifest.json", [
    "public/artifacts/base-simulation-nbody/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-catalog/simulation-nbody-cloth/js-controlled.json", [
    "public/evidence/base-catalog/simulation-nbody-cloth/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base-catalog/simulation-nbody-cloth/wasm-linear-controlled.json", [
    "public/evidence/base-catalog/simulation-nbody-cloth/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/benchmarks/v1/simulation-rigid-body-2d/engine.js", [
    "benchmarks/v1/simulation-rigid-body-2d/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/simulation-rigid-body-2d/fixture.js", [
    "benchmarks/v1/simulation-rigid-body-2d/fixture.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/simulation-rigid-body-2d/contract.v1.json", [
    "benchmarks/v1/simulation-rigid-body-2d/contract.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm", [
    "public/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm",
    "application/wasm",
  ]],
  ["/artifacts/simulation-rigid-body-2d-v1/fixture.bin", [
    "public/artifacts/simulation-rigid-body-2d-v1/fixture.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/simulation-rigid-body-2d-v1/reference-checkpoints.f32le", [
    "public/artifacts/simulation-rigid-body-2d-v1/reference-checkpoints.f32le",
    "application/octet-stream",
  ]],
  ["/data/v1-base-implementation-status.v1.json", [
    "public/data/v1-base-implementation-status.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/text-gc-document-edit-runner.js", [
    "public/text-gc-document-edit-runner.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/worker-anchors.generated.js", [
    "public/worker-anchors.generated.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/text-gc-document-edit-worker.js", [
    "public/text-gc-document-edit-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/v1/text-gc-document-edit/workload.js", [
    "benchmarks/v1/text-gc-document-edit/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/text-regex-log-scan/input.js", [
    "benchmarks/text-regex-log-scan/input.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/text-regex-log-scan/workload.js", [
    "benchmarks/text-regex-log-scan/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/data/base-implementations/text.regex-log-scan.v1.json", [
    "public/data/base-implementations/text.regex-log-scan.v1.json",
    "application/json; charset=utf-8",
  ]],
  ["/data/schemas/base-workload-registration.schema.json", [
    "schemas/base-workload-registration.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/data/schemas/base-workload-correctness-record.schema.json", [
    "schemas/base-workload-correctness-record.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/artifacts/text-regex-log-scan/text-regex-log-scan.wasm", [
    "public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
    "application/wasm",
  ]],
  ["/artifacts/text-regex-log-scan/ordered-captures.bin", [
    "public/artifacts/text-regex-log-scan/ordered-captures.bin",
    "application/octet-stream",
  ]],
  ["/artifacts/text-regex-log-scan/build-manifest.json", [
    "public/artifacts/text-regex-log-scan/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-regex-log-scan/input-manifest.json", [
    "public/artifacts/text-regex-log-scan/input-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/text-regex-log-scan/output-manifest.json", [
    "public/artifacts/text-regex-log-scan/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/text.regex-log-scan.v1/js-controlled.json", [
    "public/evidence/base/text.regex-log-scan.v1/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/text.regex-log-scan.v1/wasm-linear-controlled.json", [
    "public/evidence/base/text.regex-log-scan.v1/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/archive-zip-demo.js", ["public/archive-zip-demo.js", "text/javascript; charset=utf-8"]],
  ["/archive-zip-worker.js", ["public/archive-zip-worker.js", "text/javascript; charset=utf-8"]],
  ["/benchmarks/v1/archive-zip-workspace/engine.js", [
    "benchmarks/v1/archive-zip-workspace/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm", [
    "public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm",
    "application/wasm",
  ]],
  ["/artifacts/archive-zip-workspace-v1/build-manifest.json", [
    "public/artifacts/archive-zip-workspace-v1/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/archive-zip-workspace-v1/fixture-manifest.json", [
    "public/artifacts/archive-zip-workspace-v1/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/archive-zip-workspace-v1/output-manifest.json", [
    "public/artifacts/archive-zip-workspace-v1/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/v1-implementations/archive-zip-workspace-v1/js-controlled.json", [
    "public/evidence/v1-implementations/archive-zip-workspace-v1/js-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/v1-implementations/archive-zip-workspace-v1/wasm-linear-controlled.json", [
    "public/evidence/v1-implementations/archive-zip-workspace-v1/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/base-audio-effects-demo.js", [
    "public/base-audio-effects-demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/base-audio-effects-worker.js", [
    "public/base-audio-effects-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/audio-webaudio-effects/workload.js", [
    "benchmarks/base/audio-webaudio-effects/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm", [
    "public/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
    "application/wasm",
  ]],
  ["/artifacts/base-audio-webaudio-effects-v1/build-manifest.json", [
    "public/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-audio-webaudio-effects-v1/fixture-manifest.json", [
    "public/artifacts/base-audio-webaudio-effects-v1/fixture-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/artifacts/base-audio-webaudio-effects-v1/output-manifest.json", [
    "public/artifacts/base-audio-webaudio-effects-v1/output-manifest.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/audio-webaudio-effects-v1/javascript-controlled.json", [
    "public/evidence/base/audio-webaudio-effects-v1/javascript-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/evidence/base/audio-webaudio-effects-v1/wasm-linear-controlled.json", [
    "public/evidence/base/audio-webaudio-effects-v1/wasm-linear-controlled.json",
    "application/json; charset=utf-8",
  ]],
  ["/schemas/audio-webaudio-effects-base.schema.json", [
    "schemas/audio-webaudio-effects-base.schema.json",
    "application/schema+json; charset=utf-8",
  ]],
  ["/benchmarks/audio-fft/benchmark.json", [
    "benchmarks/audio-fft/benchmark.json",
    "application/json; charset=utf-8",
    true,
  ]],
  ["/benchmarks/audio-fir/benchmark.json", [
    "benchmarks/audio-fir/benchmark.json",
    "application/json; charset=utf-8",
    true,
  ]],
  ["/benchmarks/audio-stft/benchmark.json", [
    "benchmarks/audio-stft/benchmark.json",
    "application/json; charset=utf-8",
    true,
  ]],
]);

// Generated demo-page + companion-asset routes (scripts/build-routes.ts).
// Filesystem-derived; any overlap with the hand-maintained table above is a
// hard error instead of the old silent last-wins.
for (const [path, value] of GENERATED_ROUTES) {
  if (routes.has(path)) throw new Error(`duplicate route (manual vs generated): ${path}`);
  routes.set(path, [value[0], value[1], value[2]]);
}

routes.set("/pcap-decode-demo.js", [
  "public/pcap-decode-demo.js",
  "text/javascript; charset=utf-8",
]);
routes.set("/pcap-decode-worker.js", [
  "public/pcap-decode-worker.js",
  "text/javascript; charset=utf-8",
]);
routes.set("/benchmarks/base/network-pcap-decode/engine.js", [
  "benchmarks/base/network-pcap-decode/engine.js",
  "text/javascript; charset=utf-8",
]);
for (
  const [name, contentType] of [
    ["pcap-decode.wasm", "application/wasm"],
    ["fixture.pcap", "application/vnd.tcpdump.pcap"],
    ["reference-output.bin", "application/octet-stream"],
    ["fixture-manifest.json", "application/json; charset=utf-8"],
    ["output-manifest.json", "application/json; charset=utf-8"],
    ["build-manifest.json", "application/json; charset=utf-8"],
  ] as const
) {
  routes.set(`/artifacts/base-network-pcap-decode/${name}`, [
    `public/artifacts/base-network-pcap-decode/${name}`,
    contentType,
  ]);
}
for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
  routes.set(`/evidence/base-v1/network-pcap-decode/${variant}.json`, [
    `public/evidence/base-v1/network-pcap-decode/${variant}.json`,
    "application/json; charset=utf-8",
  ]);
}

// Restored lane route registrations (post-map; lanes register these via loops/spreads).
for (const name of ["fixture-manifest.json", "output-manifest.json", "build-manifest.json"]) {
  routes.set(`/artifacts/simulation-rigid-body-2d-v1/${name}`, [
    `public/artifacts/simulation-rigid-body-2d-v1/${name}`,
    "application/json; charset=utf-8",
  ]);
}
for (
  const name of [
    "simulation-rigid-body-2d-contract.schema.json",
    "simulation-rigid-body-2d-fixture-manifest.schema.json",
    "simulation-rigid-body-2d-output-manifest.schema.json",
    "simulation-rigid-body-2d-build-manifest.schema.json",
    "simulation-rigid-body-2d-result.schema.json",
  ]
) {
  routes.set(`/data/${name}`, [
    `public/data/${name}`,
    "application/schema+json; charset=utf-8",
  ]);
}
for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
  routes.set(`/evidence/v1-base/simulation-rigid-body-2d-v1/${variant}.json`, [
    `public/evidence/v1-base/simulation-rigid-body-2d-v1/${variant}.json`,
    "application/json; charset=utf-8",
  ]);
}

for (
  const path of [
    "/benchmarks/tooling-c-to-wasm-compile-v1",
    "/benchmarks/tooling-c-to-wasm-compile-v1/",
  ]
) {
  routes.set(path, [
    "public/benchmarks/tooling-c-to-wasm-compile-v1/index.html",
    "text/html; charset=utf-8",
  ]);
}
routes.set("/benchmarks/tooling-c-to-wasm-compile-v1/demo.js", [
  "public/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
  "text/javascript; charset=utf-8",
]);
routes.set("/benchmarks/tooling-c-to-wasm-compile-v1/worker.js", [
  "public/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
  "text/javascript; charset=utf-8",
]);
for (
  const [path, file, contentType] of [
    [
      "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
      "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
      "text/javascript; charset=utf-8",
    ],
    [
      "/benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c",
      "benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c",
      "text/plain; charset=utf-8",
    ],
    [
      "/benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
      "benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
      "application/json; charset=utf-8",
    ],
    [
      "/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
      "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
      "application/wasm",
    ],
    [
      "/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
      "public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
      "application/json; charset=utf-8",
    ],
    [
      "/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
      "public/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
      "application/json; charset=utf-8",
    ],
    [
      "/evidence/base/tooling-c-to-wasm-compile/validation.json",
      "public/evidence/base/tooling-c-to-wasm-compile/validation.json",
      "application/json; charset=utf-8",
    ],
  ] as const
) routes.set(path, [file, contentType]);
for (let index = 1; index <= 20; index += 1) {
  const id = String(index).padStart(2, "0");
  routes.set(`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`, [
    `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`,
    "text/plain; charset=utf-8",
  ]);
  routes.set(`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`, [
    `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`,
    "text/plain; charset=utf-8",
  ]);
}

for (const kernel of ["gemm", "cholesky", "stencil", "jacobi2d"]) {
  for (const variant of ["reference", "javascript-controlled", "linear-wasm-controlled"]) {
    const name = `${kernel}.${variant}.f64le`;
    routes.set(`/artifacts/numeric-polybench-panel/outputs/${name}`, [
      `public/artifacts/numeric-polybench-panel/outputs/${name}`,
      "application/octet-stream",
    ]);
  }
}

for (const route of [...IMAGE_DEMO_ROUTES, ...TRADITIONAL_DEMO_ROUTES]) {
  if (routes.has(route.path)) throw new Error(`duplicate demo route: ${route.path}`);
  routes.set(route.path, [route.file, route.contentType]);
}

routes.set("/artifacts/game-v2-controlled-family/game-family.wasm", [
  "public/artifacts/game-v2-controlled-family/game-family.wasm",
  "application/wasm",
]);
for (
  const manifest of [
    "build-manifest.json",
    "fixture-manifest.json",
    "input-manifest.json",
    "output-manifest.json",
  ]
) {
  routes.set(`/artifacts/game-v2-controlled-family/${manifest}`, [
    `public/artifacts/game-v2-controlled-family/${manifest}`,
    "application/json; charset=utf-8",
  ]);
}
for (
  const id of [
    "game-canvas-arcade-v1",
    "game-canvas-entity-pathfinding-v1",
    "game-dom-tactics-grid-v1",
  ]
) {
  routes.set(`/artifacts/game-v2-controlled-family/${id}.bin`, [
    `public/artifacts/game-v2-controlled-family/${id}.bin`,
    "application/octet-stream",
  ]);
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    routes.set(`/evidence/v2-proposals/games/${id}-${variant}.json`, [
      `public/evidence/v2-proposals/games/${id}-${variant}.json`,
      "application/json; charset=utf-8",
    ]);
  }
}

for (const path of ["/benchmarks/base-gltf-viewer", "/benchmarks/base-gltf-viewer/"]) {
  routes.set(path, ["public/benchmarks/base-gltf-viewer/index.html", "text/html; charset=utf-8"]);
}
for (const script of ["demo.js", "worker.js", "decoder-worker.js"]) {
  routes.set(`/benchmarks/base-gltf-viewer/${script}`, [
    `public/benchmarks/base-gltf-viewer/${script}`,
    "text/javascript; charset=utf-8",
  ]);
}
routes.set("/benchmarks/base-gltf-viewer/style.css", [
  "public/benchmarks/base-gltf-viewer/style.css",
  "text/css; charset=utf-8",
]);
routes.set("/benchmarks/base/graphics-gltf-viewer/engine.js", [
  "benchmarks/base/graphics-gltf-viewer/engine.js",
  "text/javascript; charset=utf-8",
]);
for (
  const [name, contentType] of [
    ["Avocado.gltf", "model/gltf+json"],
    ["Avocado.bin", "application/octet-stream"],
    ["base-color-64.rgba", "application/octet-stream"],
    ["decoded-mesh.bin", "application/octet-stream"],
    ["animation-table.i32", "application/octet-stream"],
    ["reference-output.bin", "application/octet-stream"],
    ["viewer.wasm", "application/wasm"],
    ["draco_decoder_gltf.wasm", "application/wasm"],
    ["draco_decoder_gltf.js", "text/javascript; charset=utf-8"],
    ["draco_wasm_wrapper_gltf.js", "text/javascript; charset=utf-8"],
    ["DRACO-LICENSE.txt", "text/plain; charset=utf-8"],
    ["fixture-manifest.json", "application/json; charset=utf-8"],
    ["implementation-contract.v1.json", "application/json; charset=utf-8"],
    ["output-manifest.json", "application/json; charset=utf-8"],
    ["build-manifest.json", "application/json; charset=utf-8"],
  ] as const
) {
  routes.set(`/artifacts/base-gltf-viewer/${name}`, [
    `public/artifacts/base-gltf-viewer/${name}`,
    contentType,
  ]);
}
routes.set("/evidence/base-workloads/graphics-gltf-viewer/static-validation.json", [
  "public/evidence/base-workloads/graphics-gltf-viewer/static-validation.json",
  "application/json; charset=utf-8",
]);

for (const slug of ["audio-fft", "audio-fir", "audio-stft"]) {
  routes.set(`/benchmarks/${slug}`, [
    `public/benchmarks/${slug}/index.html`,
    "text/html; charset=utf-8",
  ]);
  routes.set(`/benchmarks/${slug}/`, [
    `public/benchmarks/${slug}/index.html`,
    "text/html; charset=utf-8",
  ]);
  routes.set(`/artifacts/${slug}/${slug}.wasm`, [
    `public/artifacts/${slug}/${slug}.wasm`,
    "application/wasm",
  ]);
  routes.set(`/artifacts/${slug}/reference-output.f32le`, [
    `public/artifacts/${slug}/reference-output.f32le`,
    "application/octet-stream",
  ]);
  for (
    const manifest of [
      "fixture-manifest.json",
      "input-manifest.json",
      "reference-manifest.json",
      "output-manifest.json",
      "build-manifest.json",
    ]
  ) {
    routes.set(`/artifacts/${slug}/${manifest}`, [
      `public/artifacts/${slug}/${manifest}`,
      "application/json; charset=utf-8",
    ]);
  }
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    routes.set(`/evidence/v2-proposals/${slug}/${variant}.json`, [
      `public/evidence/v2-proposals/${slug}/${variant}.json`,
      "application/json; charset=utf-8",
    ]);
  }
}

// Multi-language Wasm kernel benchmark (benchmarks/multilang-wasm): the demo
// page plus every compiled artifact and its build manifest. The Dart WasmGC
// module additionally needs its dart2wasm-generated glue (.mjs).
{
  const base = "multilang-wasm-benchmark";
  routes.set("/benchmarks/multilang-wasm", [
    "public/benchmarks/multilang-wasm/index.html",
    "text/html; charset=utf-8",
  ]);
  routes.set("/benchmarks/multilang-wasm/", [
    "public/benchmarks/multilang-wasm/index.html",
    "text/html; charset=utf-8",
  ]);
  routes.set("/benchmarks/multilang-wasm/runner.js", [
    "public/benchmarks/multilang-wasm/runner.js",
    "text/javascript; charset=utf-8",
  ]);
  routes.set("/data/multilang-wasm-benchmark-report.v1.json", [
    "public/data/multilang-wasm-benchmark-report.v1.json",
    "application/json; charset=utf-8",
  ]);
  routes.set("/benchmarks/multilang-wasm-benchmark.md", [
    "public/benchmarks/multilang-wasm-benchmark.md",
    "text/markdown; charset=utf-8",
  ]);
  for (
    const file of [
      "numeric-polybench-panel.manifest.json",
      "text-diff-patch.manifest.json",
      "text-regex-log-scan.manifest.json",
      "crypto-file-integrity.manifest.json",
      "database-olap-chart.manifest.json",
      "ml-gemm.manifest.json",
      "multilang-wasm.manifest.json",
      "game-ecs-frame-update.manifest.json",
      "base-dom-todomvc-journey.manifest.json",
    ]
  ) {
    routes.set(`/benchmarks/multilang-wasm/${file}`, [
      `public/benchmarks/multilang-wasm/${file}`,
      "application/json; charset=utf-8",
    ]);
  }
  for (
    const file of [
      "sum_c.wasm",
      "sum_cpp.wasm",
      "sum_asc.wasm",
      "sum_rs.wasm",
      "sum_wat.wasm",
      "fft_c.wasm",
      "fft_cpp.wasm",
      "fft_asc.wasm",
      "fft_rs.wasm",
      "fft_dart.wasm",
      "fft_dart.mjs",
      "gemm_c.wasm",
      "gemm_cpp.wasm",
      "gemm_rs.wasm",
      "gemm_dart.wasm",
      "gemm_dart.mjs",
      "myers_diff_c.wasm",
      "myers_diff_cpp.wasm",
      "myers_diff_rs.wasm",
      "myers_diff_dart.wasm",
      "myers_diff_dart.mjs",
      "scan_log_c.wasm",
      "scan_log_cpp.wasm",
      "mlp_forward_c.wasm",
      "mlp_forward_cpp.wasm",
      "mlp_forward_rs.wasm",
      "mlp_forward_dart.wasm",
      "mlp_forward_dart.mjs",
      "telemetry_c.wasm",
      "telemetry_cpp.wasm",
      "telemetry_rs.wasm",
      "telemetry_dart.wasm",
      "telemetry_dart.mjs",
      "scan_log_rs.wasm",
      "scan_log_dart.wasm",
      "scan_log_dart.mjs",
      "polybench_c.wasm",
      "polybench_cpp.wasm",
      "polybench_rs.wasm",
      "polybench_dart.wasm",
      "polybench_dart.mjs",
      "fir_c.wasm",
      "fir_cpp.wasm",
      "fir_rs.wasm",
      "fir_dart.wasm",
      "fir_dart.mjs",
      "stft_c.wasm",
      "stft_cpp.wasm",
      "stft_rs.wasm",
      "stft_dart.wasm",
      "stft_dart.mjs",
      "sha256_c.wasm",
      "sha256_cpp.wasm",
      "sha256_rs.wasm",
      "sha256_dart.wasm",
      "sha256_dart.mjs",
      "ecs_frame_update_c.wasm",
      "ecs_frame_update_cpp.wasm",
      "ecs_frame_update_rs.wasm",
      "ecs_frame_update_dart.wasm",
      "ecs_frame_update_dart.mjs",
      "olap_c.wasm",
      "olap_cpp.wasm",
      "olap_rs.wasm",
      "olap_dart.wasm",
      "olap_dart.mjs",
      "pcap_decode_c.wasm",
      "pcap_decode_cpp.wasm",
      "todomvc_engine_c.wasm",
      "todomvc_engine_cpp.wasm",
      "todomvc_engine_rs.wasm",
      "todomvc_engine_dart.wasm",
      "todomvc_engine_dart.mjs",
    ]
  ) {
    const type = file.endsWith(".wasm") ? "application/wasm" : "text/javascript; charset=utf-8";
    routes.set(`/artifacts/${base}/${file}`, [
      `public/artifacts/${base}/${file}`,
      type,
    ]);
  }
  routes.set(`/artifacts/${base}/build-manifest.json`, [
    `public/artifacts/${base}/build-manifest.json`,
    "application/json; charset=utf-8",
  ]);
}

// Transpiled demo engine modules: a closed, explicitly listed set. Anything
// else under /demo-assets/ falls through to 404.
for (
  const modulePath of [
    "benchmarks/audio-fft/workload.js",
    "benchmarks/audio-fir/workload.js",
    "benchmarks/audio-stft/workload.js",
    "benchmarks/audio-shared/canonical.js",
    "benchmarks/audio-shared/constants.js",
    "benchmarks/audio-shared/oracle.js",
    "lib/audio-workloads.js",
  ]
) {
  routes.set(`/demo-assets/audio/${modulePath}`, [
    `public/demo-assets/audio/${modulePath}`,
    "text/javascript; charset=utf-8",
  ]);
}

for (
  const [name, contentType] of [
    ["fixture.v1.txt", "text/plain; charset=utf-8"],
    ["fixture-manifest.json", "application/json; charset=utf-8"],
    ["reference.json", "application/json; charset=utf-8"],
    ["build-manifest.json", "application/json; charset=utf-8"],
    ["text-gc-document-edit.mjs", "text/javascript; charset=utf-8"],
    ["text-gc-document-edit.import-object.mjs", "text/javascript; charset=utf-8"],
    ["text-gc-document-edit.js-builtins.mjs", "text/javascript; charset=utf-8"],
    ["text-gc-document-edit.wasm", "application/wasm"],
  ] as const
) {
  routes.set(`/artifacts/text-gc-document-edit/${name}`, [
    `public/artifacts/text-gc-document-edit/${name}`,
    contentType,
  ]);
}
for (const variant of ["js-controlled", "wasmgc-controlled"]) {
  routes.set(`/evidence/v1-base/text-gc-document-edit/${variant}.json`, [
    `public/evidence/v1-base/text-gc-document-edit/${variant}.json`,
    "application/json; charset=utf-8",
  ]);
}

function createHandler(
  store: LocalRunStore | null,
  serverMode: ServerMode = "local",
  corpus: CorpusCoordinator | null = null,
) {
  if (serverMode === "local" && !store) throw new Error("local store required");
  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // M3 reporting API: handle /v1/ routes before the public read-only block.
    // POST /v1/runs is the only non-GET allowed in public mode (schema-validated ingestion).
    if (url.pathname.startsWith("/v1/")) {
      const response = await handleReportingRoute(
        request,
        url,
        reportingConfig,
        serverMode,
      );
      if (response) return response;
    }

    if (serverMode === "public" && request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "public service is permanently read-only" }, 403);
    }
    if (url.pathname === "/healthz") {
      return request.method === "GET"
        ? json({
          status: "ok",
          mode: serverMode === "public" ? "public-read-only" : "local-m1-pilot",
          schemaVersion: 1,
          acceptedImplementationCommit,
          ...(serverMode === "local" ? { localCheckoutCommit, collectorAssets } : {}),
        })
        : json({ error: "method denied" }, 405);
    }
    if (url.pathname === "/assets/sqlite-notebook/runtime-trust-root.json") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method denied" }, 405);
      }
      const bytes = new TextEncoder().encode(`${JSON.stringify(sqliteNotebookTrustRoot)}\n`);
      return response(request.method === "HEAD" ? null : bytes, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    if (url.pathname.startsWith("/api/corpus/")) {
      if (serverMode === "public" || !corpus) {
        return json(
          { error: "corpus collector is local-only" },
          serverMode === "public" ? 403 : 404,
        );
      }
      try {
        if (url.pathname === "/api/corpus/launch") {
          if (request.method !== "POST") return json({ error: "method denied" }, 405);
          return json({ token: corpus.issue(await boundedJson(request) as never) }, 201);
        }
        if (url.pathname === "/api/corpus/manifest") {
          if (request.method !== "GET") return json({ error: "method denied" }, 405);
          return json(corpus.lookup(url.searchParams.get("token") ?? ""));
        }
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "corpus request denied" },
          400,
        );
      }
      return json({ error: "not found" }, 404);
    }
    if (url.pathname === "/api/summary") {
      if (request.method !== "GET") return json({ error: "method denied" }, 405);
      if (serverMode === "public") return json(generateSummary([]));
      const page = await store!.listPage(50);
      return json(generateSummary(page.runs, page.total, page.truncated));
    }
    if (url.pathname === "/api/runs" || url.pathname.startsWith("/api/runs/")) {
      if (serverMode === "public") {
        return json({ error: "run records are not exposed by the public service" }, 403);
      }
      if (url.pathname === "/api/runs") {
        if (request.method !== "POST") return json({ error: "method denied" }, 405);
        try {
          const stored = await store!.put(await boundedJson(request));
          return json({ stored: true, ...stored }, 201);
        } catch (error) {
          const message = error instanceof Error ? error.message : "run denied";
          return json({ error: message }, message.includes("already exists") ? 409 : 400);
        }
      }
      if (request.method !== "GET") return json({ error: "method denied" }, 405);
      const run = await store!.get(url.pathname.slice("/api/runs/".length));
      return run ? json(run) : json({ error: "not found" }, 404);
    }
    // Retired /run/ runner — the homepage playground's sum-u32 card supersedes it.
    const retiredRun = url.pathname === "/run" || url.pathname === "/run/" ||
      url.pathname === "/run.html";
    if (retiredRun) {
      return new Response(null, {
        status: 302,
        headers: { location: "/#workload-sum-u32" },
      });
    }
    const route = routes.get(url.pathname);
    if (!route || (serverMode === "public" && route[2])) {
      return json({ error: "not found" }, 404);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method denied" }, 405);
    }
    try {
      const [path, contentType] = route;
      const runtimePath = url.pathname === "/benchmarks/database-sqlite-notebook-v1"
        ? "/benchmarks/database-sqlite-notebook-v1/"
        : url.pathname;
      const bytes = sqliteNotebookRuntimeBytes.get(runtimePath) ??
        await Deno.readFile(new URL(path, root));
      return response(request.method === "HEAD" ? null : Uint8Array.from(bytes), {
        headers: {
          "content-type": contentType,
          // no-store everywhere: the edge cache truncates long CSP headers on
          // cached objects (platform bug, 2026-08-05) and immutable caching of
          // non-content-addressed URLs caused stale-page incidents (#298).
          // Restore immutable caching only with slice-4 hash-addressed URLs.
          "cache-control": "no-store",
        },
      });
    } catch {
      return json({ error: "not found" }, 404);
    }
  };
}

const handler = createHandler(defaultStore, mode, defaultCorpus);

if (import.meta.main) {
  console.log(
    `${mode === "public" ? "Public evidence" : "M1 local pilot"}: http://${host}:${port}/`,
  );
  Deno.serve({ hostname: host, port }, handler);
}

export { createHandler, handler };
