const root = new URL("../", import.meta.url);
const files = [
  [
    "page",
    "public/benchmarks/database-sqlite-notebook-v1/index.html",
    "/benchmarks/database-sqlite-notebook-v1/",
  ],
  ["runner", "public/sqlite-notebook-runner.js", "/sqlite-notebook-runner.js"],
  [
    "contract",
    "benchmarks/base/sqlite-notebook/contract.js",
    "/benchmarks/base/sqlite-notebook/contract.js",
  ],
  [
    "engine",
    "benchmarks/base/sqlite-notebook/engine.js",
    "/benchmarks/base/sqlite-notebook/engine.js",
  ],
  [
    "javascript-engine",
    "public/artifacts/sqlite-notebook/alasql.min.js",
    "/assets/sqlite-notebook/alasql.min.js",
  ],
  [
    "sqlite-glue",
    "public/artifacts/sqlite-notebook/sqlite3.mjs",
    "/assets/sqlite-notebook/sqlite3.mjs",
  ],
  [
    "sqlite-wasm",
    "public/artifacts/sqlite-notebook/sqlite3.wasm",
    "/assets/sqlite-notebook/sqlite3.wasm",
  ],
  [
    "dependencies",
    "public/artifacts/sqlite-notebook/dependency-manifest.json",
    "/assets/sqlite-notebook/dependency-manifest.json",
  ],
  [
    "fixture-manifest",
    "public/artifacts/sqlite-notebook/fixtures/fixture-manifest.json",
    "/assets/sqlite-notebook/fixtures/fixture-manifest.json",
  ],
  [
    "customers",
    "public/artifacts/sqlite-notebook/fixtures/customers.csv",
    "/assets/sqlite-notebook/fixtures/customers.csv",
  ],
  [
    "products",
    "public/artifacts/sqlite-notebook/fixtures/products.csv",
    "/assets/sqlite-notebook/fixtures/products.csv",
  ],
  [
    "sales",
    "public/artifacts/sqlite-notebook/fixtures/sales.csv",
    "/assets/sqlite-notebook/fixtures/sales.csv",
  ],
  [
    "reference",
    "public/artifacts/sqlite-notebook/reference.json",
    "/assets/sqlite-notebook/reference.json",
  ],
] as const;

async function sha256(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

const entries = [];
for (const [id, source, path] of files) {
  const bytes = await Deno.readFile(new URL(source, root));
  entries.push({ id, source, path, bytes: bytes.byteLength, sha256: await sha256(bytes) });
}
const manifest = {
  schemaVersion: 1,
  workloadId: "database.sqlite-notebook.v1",
  implementationId: "database.sqlite-notebook.controlled.v1",
  exactMode: "hash raw response bytes before parsing or execution",
  files: entries,
};
const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
const manifestHash = await sha256(manifestBytes);
await Deno.writeFile(
  new URL("public/artifacts/sqlite-notebook/runtime-manifest.json", root),
  manifestBytes,
);
const workerUrl = new URL("public/sqlite-notebook-worker.js", root);
const worker = await Deno.readTextFile(workerUrl);
const updated = worker.replace(
  /const RUNTIME_MANIFEST_SHA256 = "[a-f0-9A-Z_]+";/,
  `const RUNTIME_MANIFEST_SHA256 = "${manifestHash}";`,
);
if (updated === worker && !worker.includes(manifestHash)) {
  throw new Error("Worker runtime-manifest anchor was not updated");
}
await Deno.writeTextFile(workerUrl, updated);
console.log(JSON.stringify({ manifestHash, files: entries.length }, null, 2));
