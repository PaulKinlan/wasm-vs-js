import { LocalRunStore } from "./lib/run-store.ts";
import { generateSummary } from "./lib/summary.ts";

const root = new URL("./", import.meta.url);
const defaultStore = new LocalRunStore(
  Deno.env.get("RUN_STORE") ?? new URL("raw/runs/", root).pathname,
);
await defaultStore.initialize();
const port = Number(Deno.env.get("PORT") ?? "8787");
const MAX_BODY = 512 * 1024;

const securityHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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

const routes = new Map([
  ["/", ["public/index.html", "text/html; charset=utf-8"]],
  ["/run", ["public/run.html", "text/html; charset=utf-8"]],
  ["/run.html", ["public/run.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["public/styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["public/app.js", "text/javascript; charset=utf-8"]],
  ["/runner.js", ["public/runner.js", "text/javascript; charset=utf-8"]],
  ["/benchmarks/sum-u32/workload.js", [
    "benchmarks/sum-u32/workload.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/sum-u32/sum-u32.wasm", [
    "public/artifacts/sum-u32/sum-u32.wasm",
    "application/wasm",
  ]],
  ["/artifacts/sum-u32/build-manifest.json", [
    "public/artifacts/sum-u32/build-manifest.json",
    "application/json; charset=utf-8",
  ]],
]);

function createHandler(store: LocalRunStore) {
  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return request.method === "GET"
        ? json({ status: "ok", mode: "local-m1-pilot", schemaVersion: 1 })
        : json({ error: "method denied" }, 405);
    }
    if (url.pathname === "/api/summary") {
      return request.method === "GET"
        ? json(generateSummary(await store.list()))
        : json({ error: "method denied" }, 405);
    }
    if (url.pathname === "/api/runs") {
      if (request.method !== "POST") return json({ error: "method denied" }, 405);
      try {
        const stored = await store.put(await boundedJson(request));
        return json({ stored: true, ...stored }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : "run denied";
        return json({ error: message }, message.includes("already exists") ? 409 : 400);
      }
    }
    if (url.pathname.startsWith("/api/runs/")) {
      if (request.method !== "GET") return json({ error: "method denied" }, 405);
      const run = await store.get(url.pathname.slice("/api/runs/".length));
      return run ? json(run) : json({ error: "not found" }, 404);
    }
    const route = routes.get(url.pathname);
    if (!route) return json({ error: "not found" }, 404);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method denied" }, 405);
    }
    try {
      const [path, contentType] = route;
      const bytes = await Deno.readFile(new URL(path, root));
      return response(request.method === "HEAD" ? null : bytes, {
        headers: {
          "content-type": contentType,
          "cache-control":
            url.pathname.startsWith("/artifacts/") || url.pathname.startsWith("/benchmarks/")
              ? "public, max-age=31536000, immutable"
              : "no-store",
        },
      });
    } catch {
      return json({ error: "not found" }, 404);
    }
  };
}

const handler = createHandler(defaultStore);

if (import.meta.main) {
  console.log(`M1 local pilot: http://127.0.0.1:${port}/`);
  Deno.serve({ hostname: "127.0.0.1", port }, handler);
}

export { createHandler, handler };
