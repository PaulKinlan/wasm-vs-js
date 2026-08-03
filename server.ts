import { LocalRunStore } from "./lib/run-store.ts";
import { generateSummary } from "./lib/summary.ts";
import { CorpusCoordinator } from "./lib/corpus-store.ts";
import { collectorRouteHashes } from "./lib/source-identity.ts";
import { IMAGE_DEMO_ROUTES } from "./lib/image-demo-registry.ts";
import { TRADITIONAL_DEMO_ROUTES } from "./lib/traditional-demo-registry.ts";

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
const port = Number(Deno.env.get("PORT") ?? "8787");
const host = Deno.env.get("HOST") ?? (mode === "public" ? "0.0.0.0" : "127.0.0.1");
const MAX_BODY = 512 * 1024;
const collectorAssets = await collectorRouteHashes();

// This server-held digest is outside the browser runtime graph. The runtime-manifest builder
// updates it only after hashing the page, runner, worker, and every runtime dependency.
const SQLITE_NOTEBOOK_RUNTIME_MANIFEST_SHA256 =
  "2ce28bfc0925ccb9881858fe8e6fcd9c39d6b7d41ec25e01b22e7abe15c82c4e";

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
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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
  ["/run", ["public/run.html", "text/html; charset=utf-8", true]],
  ["/run/", ["public/run/index.html", "text/html; charset=utf-8"]],
  ["/run.html", ["public/run.html", "text/html; charset=utf-8", true]],
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
  ["/homepage-runner.js", ["public/homepage-runner.js", "text/javascript; charset=utf-8"]],
  ["/playground.js", ["public/playground.js", "text/javascript; charset=utf-8"]],
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
  ["/benchmarks/cad-mesh-repair-v1", [
    "public/benchmarks/cad-mesh-repair-v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/cad-mesh-repair-v1/", [
  ["/benchmarks/cad-mesh-repair-v1/demo.js", [
    "public/benchmarks/cad-mesh-repair-v1/demo.js",
    "text/javascript; charset=utf-8",
  ["/benchmarks/cad-mesh-repair-v1/worker.js", [
    "public/benchmarks/cad-mesh-repair-v1/worker.js",
  ["/benchmarks/base/cad-mesh-repair/engine.js", [
    "benchmarks/base/cad-mesh-repair/engine.js",
  ["/artifacts/cad-mesh-repair-v1/dirty-grid.stl", [
    "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    "model/stl",
  ["/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", [
    "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
    "application/wasm",
  ["/artifacts/cad-mesh-repair-v1/build-manifest.json", [
    "public/artifacts/cad-mesh-repair-v1/build-manifest.json",
    "application/json; charset=utf-8",
  ["/artifacts/cad-mesh-repair-v1/validation-evidence.json", [
    "public/artifacts/cad-mesh-repair-v1/validation-evidence.json",
  ["/demos/cad-parametric-bracket", [
    "public/demos/cad-parametric-bracket/index.html",
  ["/demos/cad-parametric-bracket/", [
  ["/demos/cad-parametric-bracket/demo.js", [
    "public/demos/cad-parametric-bracket/demo.js",
  ["/demos/cad-parametric-bracket/worker.js", [
    "public/demos/cad-parametric-bracket/worker.js",
  ["/benchmarks/base/cad-parametric-bracket/contract.js", [
    "benchmarks/base/cad-parametric-bracket/contract.js",
  ["/benchmarks/base/cad-parametric-bracket/fixture.js", [
    "benchmarks/base/cad-parametric-bracket/fixture.js",
  ["/benchmarks/base/cad-parametric-bracket/engine.js", [
    "benchmarks/base/cad-parametric-bracket/engine.js",
  ["/artifacts/base-cad-parametric-bracket/bracket.wasm", [
    "public/artifacts/base-cad-parametric-bracket/bracket.wasm",
  ["/artifacts/base-cad-parametric-bracket/fixture-manifest.json", [
    "public/artifacts/base-cad-parametric-bracket/fixture-manifest.json",
  ["/artifacts/base-cad-parametric-bracket/build-manifest.json", [
    "public/artifacts/base-cad-parametric-bracket/build-manifest.json",
  ["/artifacts/base-cad-parametric-bracket/output-manifest.json", [
    "public/artifacts/base-cad-parametric-bracket/output-manifest.json",
  ["/evidence/base-catalog/cad-parametric-bracket/js-controlled.json", [
    "public/evidence/base-catalog/cad-parametric-bracket/js-controlled.json",
  ["/evidence/base-catalog/cad-parametric-bracket/wasm-linear-controlled.json", [
    "public/evidence/base-catalog/cad-parametric-bracket/wasm-linear-controlled.json",
  ["/benchmarks/database-sqlite-notebook-v1", [
    "public/benchmarks/database-sqlite-notebook-v1/index.html",
  ["/benchmarks/database-sqlite-notebook-v1/", [
  ["/sqlite-notebook-runner.js", [
    "public/sqlite-notebook-runner.js",
  ["/sqlite-notebook-worker.js", [
    "public/sqlite-notebook-worker.js",
  ["/benchmarks/base/sqlite-notebook/contract.js", [
    "benchmarks/base/sqlite-notebook/contract.js",
  ["/benchmarks/base/sqlite-notebook/engine.js", [
    "benchmarks/base/sqlite-notebook/engine.js",
  ["/assets/sqlite-notebook/alasql.min.js", [
    "public/artifacts/sqlite-notebook/alasql.min.js",
  ["/assets/sqlite-notebook/sqlite3.mjs", [
    "public/artifacts/sqlite-notebook/sqlite3.mjs",
  ["/assets/sqlite-notebook/sqlite3.wasm", [
    "public/artifacts/sqlite-notebook/sqlite3.wasm",
  ["/assets/sqlite-notebook/dependency-manifest.json", [
    "public/artifacts/sqlite-notebook/dependency-manifest.json",
  ["/assets/sqlite-notebook/runtime-manifest.json", [
    "public/artifacts/sqlite-notebook/runtime-manifest.json",
  ["/assets/sqlite-notebook/build-manifest.json", [
    "public/artifacts/sqlite-notebook/build-manifest.json",
  ["/assets/sqlite-notebook/reference.json", [
    "public/artifacts/sqlite-notebook/reference.json",
  ["/assets/sqlite-notebook/fixtures/fixture-manifest.json", [
    "public/artifacts/sqlite-notebook/fixtures/fixture-manifest.json",
  ["/assets/sqlite-notebook/fixtures/RIGHTS.md", [
    "public/artifacts/sqlite-notebook/fixtures/RIGHTS.md",
    "text/markdown; charset=utf-8",
  ["/assets/sqlite-notebook/fixtures/customers.csv", [
    "public/artifacts/sqlite-notebook/fixtures/customers.csv",
    "text/csv; charset=utf-8",
  ["/assets/sqlite-notebook/fixtures/products.csv", [
    "public/artifacts/sqlite-notebook/fixtures/products.csv",
  ["/assets/sqlite-notebook/fixtures/sales.csv", [
    "public/artifacts/sqlite-notebook/fixtures/sales.csv",
  ["/evidence/base-implementations/sqlite-notebook/javascript-controlled.json", [
    "public/evidence/base-implementations/sqlite-notebook/javascript-controlled.json",
  ["/evidence/base-implementations/sqlite-notebook/linear-wasm-controlled.json", [
    "public/evidence/base-implementations/sqlite-notebook/linear-wasm-controlled.json",
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
  ["/benchmarks/database-olap-chart", [
    "public/benchmarks/database-olap-chart/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/database-olap-chart/", [
  ["/benchmarks/database-olap-chart/runner.js", [
    "public/benchmarks/database-olap-chart/runner.js",
    "text/javascript; charset=utf-8",
  ["/benchmarks/database-olap-chart/worker.js", [
    "public/benchmarks/database-olap-chart/worker.js",
  ["/benchmarks/base/database-olap-chart/engine.js", [
    "benchmarks/base/database-olap-chart/engine.js",
  ["/benchmarks/base/database-olap-chart/browser-validation.js", [
    "benchmarks/base/database-olap-chart/browser-validation.js",
  ["/benchmarks/base/database-olap-chart/fixture.js", [
    "benchmarks/base/database-olap-chart/fixture.js",
  ["/artifacts/database-olap-chart/database-olap-chart.wasm", [
    "public/artifacts/database-olap-chart/database-olap-chart.wasm",
    "application/wasm",
  ["/artifacts/database-olap-chart/fixture.bin", [
    "public/artifacts/database-olap-chart/fixture.bin",
    "application/octet-stream",
  ["/artifacts/database-olap-chart/build-manifest.json", [
    "public/artifacts/database-olap-chart/build-manifest.json",
    "application/json; charset=utf-8",
  ["/artifacts/database-olap-chart/fixture-manifest.json", [
    "public/artifacts/database-olap-chart/fixture-manifest.json",
  ["/artifacts/database-olap-chart/output-manifest.json", [
    "public/artifacts/database-olap-chart/output-manifest.json",
  ["/evidence/base/database-olap-chart/correctness-record.json", [
    "public/evidence/base/database-olap-chart/correctness-record.json",
    "application/json; charset=utf-8",
  ]],
  ["/workload-catalog.js", ["public/workload-catalog.js", "text/javascript; charset=utf-8"]],
  ["/demos/crypto.file-integrity.v1", [
    "public/demos/crypto.file-integrity.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/crypto.file-integrity.v1/", [
  ["/crypto-file-integrity-demo.js", [
    "public/crypto-file-integrity-demo.js",
    "text/javascript; charset=utf-8",
  ["/crypto-file-integrity-worker.js", [
    "public/crypto-file-integrity-worker.js",
  ["/benchmarks/base/crypto-file-integrity/sha256.js", [
    "benchmarks/base/crypto-file-integrity/sha256.js",
  ["/benchmarks/base/crypto-file-integrity/workload.js", [
    "benchmarks/base/crypto-file-integrity/workload.js",
  ["/artifacts/crypto-file-integrity/crypto-file-integrity.wasm", [
    "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
    "application/wasm",
  ["/artifacts/crypto-file-integrity/build-manifest.json", [
    "public/artifacts/crypto-file-integrity/build-manifest.json",
    "application/json; charset=utf-8",
  ["/registrations/base/crypto.file-integrity.v1.json", [
    "registrations/base/crypto.file-integrity.v1.json",
  ["/evidence/base/crypto.file-integrity.v1/validation.json", [
    "public/evidence/base/crypto.file-integrity.v1/validation.json",
  ["/evidence/base/crypto.file-integrity.v1/validation.schema.json", [
    "public/evidence/base/crypto.file-integrity.v1/validation.schema.json",
    "application/schema+json; charset=utf-8",
  ["/data/base-implementation-status.v1.json", [
    "public/data/base-implementation-status.v1.json",
  ["/data/base-implementation-status.schema.json", [
    "public/data/base-implementation-status.schema.json",
  ["/benchmarks/crypto-authenticated-stream", [
    "public/benchmarks/crypto-authenticated-stream/index.html",
  ["/benchmarks/crypto-authenticated-stream/", [
  ["/crypto-authenticated-stream-demo.js", [
    "public/crypto-authenticated-stream-demo.js",
  ["/crypto-authenticated-stream-worker.js", [
    "public/crypto-authenticated-stream-worker.js",
  ["/benchmarks/base/crypto-authenticated-stream/engine.js", [
    "benchmarks/base/crypto-authenticated-stream/engine.js",
  ["/benchmarks/base/crypto-authenticated-stream/workload.js", [
    "benchmarks/base/crypto-authenticated-stream/workload.js",
  ["/benchmarks/base/crypto-authenticated-stream/registration.v1.json", [
    "benchmarks/base/crypto-authenticated-stream/registration.v1.json",
  ["/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm", [
    "public/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm",
  ["/artifacts/crypto-authenticated-stream/build-manifest.json", [
    "public/artifacts/crypto-authenticated-stream/build-manifest.json",
  ["/artifacts/crypto-authenticated-stream/fixture-manifest.json", [
    "public/artifacts/crypto-authenticated-stream/fixture-manifest.json",
  ["/artifacts/crypto-authenticated-stream/output-manifest.json", [
    "public/artifacts/crypto-authenticated-stream/output-manifest.json",
  ["/evidence/base/crypto-authenticated-stream/js-controlled.json", [
    "public/evidence/base/crypto-authenticated-stream/js-controlled.json",
  ["/evidence/base/crypto-authenticated-stream/wasm-linear-controlled.json", [
    "public/evidence/base/crypto-authenticated-stream/wasm-linear-controlled.json",
  ]],
  ["/demos/text.diff-patch.v1", [
    "public/demos/text.diff-patch.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/text.diff-patch.v1/", [
    "public/demos/text.diff-patch.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/text.markdown-cms.v1", [
    "public/demos/text.markdown-cms.v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/demos/text.markdown-cms.v1/", [
    "public/demos/text.markdown-cms.v1/index.html",
    "text/html; charset=utf-8",
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

  ["/benchmarks/ml-gemm/", [
    "public/benchmarks/ml-gemm/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/ml-gemm/index.html", [
    "public/benchmarks/ml-gemm/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/ml-gemm/neural-gemm-runner.js", [
    "public/benchmarks/ml-gemm/neural-gemm-runner.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/ml-gemm/neural-gemm-worker.js", [
    "public/benchmarks/ml-gemm/neural-gemm-worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/ml-dense-mlp/", [
    "public/benchmarks/ml-dense-mlp/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/ml-dense-mlp/index.html", [
    "public/benchmarks/ml-dense-mlp/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/ml-dense-mlp/neural-mlp-runner.js", [
    "public/benchmarks/ml-dense-mlp/neural-mlp-runner.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/ml-dense-mlp/neural-mlp-worker.js", [
    "public/benchmarks/ml-dense-mlp/neural-mlp-worker.js",
    "text/javascript; charset=utf-8",
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
  ["/benchmarks/document-pdf-viewer-v1", [
    "public/benchmarks/document-pdf-viewer-v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/document-pdf-viewer-v1/", [
    "public/benchmarks/document-pdf-viewer-v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/document-pdf-viewer-v1/runner.js", [
    "public/benchmarks/document-pdf-viewer-v1/runner.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/document-pdf-viewer-v1/worker.js", [
    "public/benchmarks/document-pdf-viewer-v1/worker.js",
    "text/javascript; charset=utf-8",
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
  ["/artifacts/document-pdf-viewer/pdfbase-5x7-v1.bin", [
    "public/artifacts/document-pdf-viewer/pdfbase-5x7-v1.bin",
    "application/octet-stream",
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
]);

for (const route of [...IMAGE_DEMO_ROUTES, ...TRADITIONAL_DEMO_ROUTES]) {
  if (routes.has(route.path)) throw new Error(`duplicate demo route: ${route.path}`);
  routes.set(route.path, [route.file, route.contentType]);
}

for (
  const slug of ["game-canvas-arcade", "game-canvas-entity-pathfinding", "game-dom-tactics-grid"]
) {
  for (const path of [`/demos/${slug}`, `/demos/${slug}/`]) {
    if (routes.has(path)) throw new Error(`duplicate demo route: ${path}`);
    routes.set(path, [`public/demos/${slug}/index.html`, "text/html; charset=utf-8"]);
  }
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

function createHandler(
  store: LocalRunStore | null,
  serverMode: ServerMode = "local",
  corpus: CorpusCoordinator | null = null,
) {
  if (serverMode === "local" && !store) throw new Error("local store required");
  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
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
    const route = serverMode === "public" && url.pathname === "/run"
      ? ["public/run/index.html", "text/html; charset=utf-8"] as [string, string, boolean?]
      : routes.get(url.pathname);
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
          "cache-control": url.pathname.startsWith("/artifacts/") ||
              url.pathname.startsWith("/benchmarks/") ||
              url.pathname.startsWith("/evidence/v1/")
            ? "public, max-age=31536000, immutable"
            : "no-store",
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
