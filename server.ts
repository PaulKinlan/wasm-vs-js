import { LocalRunStore } from "./lib/run-store.ts";
import { generateSummary } from "./lib/summary.ts";
import { CorpusCoordinator } from "./lib/corpus-store.ts";
import { collectorRouteHashes } from "./lib/source-identity.ts";

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

const securityHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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
  ["/workload-catalog.js", ["public/workload-catalog.js", "text/javascript; charset=utf-8"]],
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
]);

for (const slug of ["audio-fft", "audio-fir", "audio-stft"]) {
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
      const bytes = await Deno.readFile(new URL(path, root));
      return response(request.method === "HEAD" ? null : bytes, {
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
