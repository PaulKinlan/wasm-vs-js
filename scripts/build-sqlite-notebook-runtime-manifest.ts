const root = new URL("../", import.meta.url);
const runnerSource = "public/sqlite-notebook-runner.js";
const pageSource = "public/benchmarks/database-sqlite-notebook-v1/index.html";
const manifestSource = "public/artifacts/sqlite-notebook/runtime-manifest.json";
const files = [
  ["page", pageSource, "/benchmarks/database-sqlite-notebook-v1/"],
  ["runner", runnerSource, "/sqlite-notebook-runner.js"],
  ["worker", "public/sqlite-notebook-worker.js", "/sqlite-notebook-worker.js"],
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

async function sha256Bytes(bytes: Uint8Array) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)));
}

async function sha256(bytes: Uint8Array) {
  return [...await sha256Bytes(bytes)]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const runnerBytes = await Deno.readFile(new URL(runnerSource, root));
const runnerSri = `sha256-${base64(await sha256Bytes(runnerBytes))}`;
const pageUrl = new URL(pageSource, root);
const page = await Deno.readTextFile(pageUrl);
const updatedPage = page.replace(
  /integrity="sha256-[A-Za-z0-9+/_=-]+"/,
  `integrity="${runnerSri}"`,
);
if (updatedPage === page && !page.includes(`integrity="${runnerSri}"`)) {
  throw new Error("Page runner-integrity anchor was not updated");
}
await Deno.writeTextFile(pageUrl, updatedPage);

const entries = [];
for (const [id, source, path] of files) {
  const bytes = await Deno.readFile(new URL(source, root));
  entries.push({ id, source, path, bytes: bytes.byteLength, sha256: await sha256(bytes) });
}
const manifest = {
  schemaVersion: 1,
  workloadId: "database.sqlite-notebook.v1",
  implementationId: "database.sqlite-notebook.controlled.v1",
  exactMode:
    "server-held manifest trust root; page SRI; execute fetched and SHA-256-checked Blob/module/Wasm bytes without refetch",
  files: entries,
};
const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
const manifestHash = await sha256(manifestBytes);
await Deno.writeFile(new URL(manifestSource, root), manifestBytes);

const serverUrl = new URL("server.ts", root);
const server = await Deno.readTextFile(serverUrl);
const updatedServer = server.replace(
  /const SQLITE_NOTEBOOK_RUNTIME_MANIFEST_SHA256\s*=\s*"[a-f0-9A-Z_]+";/,
  `const SQLITE_NOTEBOOK_RUNTIME_MANIFEST_SHA256 =\n  "${manifestHash}";`,
);
if (updatedServer === server && !server.includes(manifestHash)) {
  throw new Error("Server runtime-manifest trust-root anchor was not updated");
}
await Deno.writeTextFile(serverUrl, updatedServer);
console.log(JSON.stringify({ manifestHash, runnerSri, files: entries.length }, null, 2));
