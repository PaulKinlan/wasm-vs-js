const root = new URL("../", import.meta.url);
const routes: Readonly<Record<string, readonly [string, string]>> = {
  "/benchmarks/numeric-fft-spectral-filter-v1/": [
    "public/benchmarks/numeric-fft-spectral-filter-v1/index.html",
    "text/html; charset=utf-8",
  ],
  "/benchmarks/numeric-fft-spectral-filter-v1/demo.js": [
    "public/benchmarks/numeric-fft-spectral-filter-v1/demo.js",
    "text/javascript; charset=utf-8",
  ],
  "/benchmarks/numeric-fft-spectral-filter-v1/worker.js": [
    "public/benchmarks/numeric-fft-spectral-filter-v1/worker.js",
    "text/javascript; charset=utf-8",
  ],
  "/benchmarks/base/numeric-fft-spectral-filter/workload.js": [
    "benchmarks/base/numeric-fft-spectral-filter/workload.js",
    "text/javascript; charset=utf-8",
  ],
  "/artifacts/numeric-fft-spectral-filter/output-manifest.json": [
    "public/artifacts/numeric-fft-spectral-filter/output-manifest.json",
    "application/json; charset=utf-8",
  ],
  "/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm": [
    "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
    "application/wasm",
  ],
  "/styles.css": ["public/styles.css", "text/css; charset=utf-8"],
};

export async function numericFftEvidenceResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (url.pathname === "/healthz") {
    return new Response(request.method === "HEAD" ? null : "ok\n", {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const route = routes[url.pathname];
  if (!route) return new Response("not found\n", { status: 404 });
  const body = await Deno.readFile(new URL(route[0], root));
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "content-type": route[1],
      "content-length": String(body.byteLength),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function parsePort(args: readonly string[]): number {
  if (args.length !== 1 || !args[0].startsWith("--port=")) throw new Error("exact --port required");
  const port = Number(args[0].slice(7));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("invalid port");
  return port;
}

if (import.meta.main) {
  Deno.serve(
    { hostname: "127.0.0.1", port: parsePort(Deno.args) },
    numericFftEvidenceResponse,
  );
}
