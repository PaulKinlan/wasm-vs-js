const RUNTIME_MANIFEST_SHA256 = "4589d6ef9162b8721e315146a4c14aaebf17cc2e4d805d3d3446914f79e1756c";

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function verifiedRuntimeFiles(exact) {
  const manifestBytes = await fetchBytes("/assets/sqlite-notebook/runtime-manifest.json");
  const manifestHash = await sha256(manifestBytes);
  if (exact && manifestHash !== RUNTIME_MANIFEST_SHA256) {
    throw new Error(`Runtime manifest mismatch: ${manifestHash}`);
  }
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  const bytesByPath = new Map();
  const checks = [`runtime-manifest:${manifestHash}`];
  for (const entry of manifest.files) {
    const bytes = await fetchBytes(entry.path);
    const actual = await sha256(bytes);
    if (exact && actual !== entry.sha256) throw new Error(`${entry.path} SHA-256 mismatch`);
    bytesByPath.set(entry.path, bytes);
    checks.push(`${entry.id}:${actual}`);
  }
  return { bytesByPath, checks };
}

self.addEventListener("message", async (message) => {
  if (message.data?.type !== "run") return;
  const { token, target, queryId, exact } = message.data;
  const progress = (value, label) => self.postMessage({ type: "progress", token, value, label });
  try {
    progress(1, "Verifying fixture, reference, source and engine bytes…");
    const { bytesByPath, checks } = await verifiedRuntimeFiles(Boolean(exact));
    const decoder = new TextDecoder();
    const engine = await import("/benchmarks/base/sqlite-notebook/engine.js");
    const contract = await import("/benchmarks/base/sqlite-notebook/contract.js");
    const fixture = {};
    for (const table of contract.IMPORT_ORDER) {
      const path = `/assets/sqlite-notebook/fixtures/${table}.csv`;
      fixture[table] = engine.parseCsv(decoder.decode(bytesByPath.get(path)), table);
    }
    const reference = JSON.parse(
      decoder.decode(bytesByPath.get("/assets/sqlite-notebook/reference.json")),
    );
    progress(2, "Creating a fresh in-memory database and importing 4,192 rows…");
    let output;
    if (target === "javascript-controlled") {
      importScripts("/assets/sqlite-notebook/alasql.min.js");
      if (typeof self.alasql !== "function") throw new Error("AlaSQL did not initialize");
      output = await engine.runAlaSql(self.alasql, fixture, queryId);
    } else if (target === "linear-wasm-controlled") {
      const { default: sqlite3InitModule } = await import("/assets/sqlite-notebook/sqlite3.mjs");
      const sqlite3 = await sqlite3InitModule({
        locateFile: (path) => `/assets/sqlite-notebook/${path}`,
        print: () => {},
        printErr: () => {},
      });
      output = await engine.runSqlite(sqlite3, fixture, queryId);
    } else {
      throw new Error(`Unknown target: ${target}`);
    }
    progress(3, "Checking every returned value against the independent SQL reference…");
    const expectedResults = queryId
      ? reference.results.filter((entry) => entry.id === queryId)
      : reference.results;
    if (expectedResults.length !== output.results.length) {
      throw new Error("Reference query count mismatch");
    }
    const expected = await engine.canonicalResults(expectedResults);
    if (output.canonical !== expected.canonical || output.sha256 !== expected.sha256) {
      throw new Error(
        `Complete SQL output mismatch: expected ${expected.sha256}, received ${output.sha256}`,
      );
    }
    const expectedAllHash = "fae41d80865456365118c98ee8dd74a502fb359ace69878190edca22e4f6572d";
    if (!queryId && output.sha256 !== expectedAllHash) {
      throw new Error("Frozen full-oracle hash mismatch");
    }
    output.exactChecks = checks;
    delete output.canonical;
    self.postMessage({ type: "result", token, result: output });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
