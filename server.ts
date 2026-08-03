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
  ["/benchmarks/cad-mesh-repair-v1", [
    "public/benchmarks/cad-mesh-repair-v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/cad-mesh-repair-v1/", [
    "public/benchmarks/cad-mesh-repair-v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/benchmarks/cad-mesh-repair-v1/demo.js", [
    "public/benchmarks/cad-mesh-repair-v1/demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/cad-mesh-repair-v1/worker.js", [
    "public/benchmarks/cad-mesh-repair-v1/worker.js",
    "text/javascript; charset=utf-8",
  ]],
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
  ["/workload-catalog.js", ["public/workload-catalog.js", "text/javascript; charset=utf-8"]],
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
