async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function verifiedRuntimeFiles(exact, manifest, shellChecks) {
  const shellIds = new Set(["page", "runner", "worker"]);
  const bytesById = new Map();
  const checks = [...shellChecks];
  for (const entry of manifest.files) {
    if (shellIds.has(entry.id)) continue;
    const bytes = await fetchBytes(entry.path);
    const actual = await sha256(bytes);
    if (exact && actual !== entry.sha256) throw new Error(`${entry.path} SHA-256 mismatch`);
    bytesById.set(entry.id, bytes);
    checks.push(`${entry.id}:${actual}`);
  }
  for (
    const id of [
      "contract",
      "engine",
      "javascript-engine",
      "sqlite-glue",
      "sqlite-wasm",
      "customers",
      "products",
      "sales",
      "reference",
    ]
  ) {
    if (!bytesById.has(id)) throw new Error(`Runtime manifest is missing ${id}`);
  }
  return { bytesById, checks };
}

function blobUrl(bytes, type = "text/javascript") {
  return URL.createObjectURL(new Blob([bytes], { type }));
}

self.addEventListener("message", async (message) => {
  if (message.data?.type !== "run") return;
  const { token, target, queryId, exact, manifest, shellChecks } = message.data;
  const progress = (value, label) => self.postMessage({ type: "progress", token, value, label });
  const objectUrls = [];
  try {
    progress(1, "Verifying fixture, reference, source and engine bytes…");
    const { bytesById, checks } = await verifiedRuntimeFiles(
      Boolean(exact),
      manifest,
      shellChecks,
    );
    const decoder = new TextDecoder();
    const contractUrl = blobUrl(bytesById.get("contract"));
    const engineUrl = blobUrl(bytesById.get("engine"));
    objectUrls.push(contractUrl, engineUrl);
    const contract = await import(contractUrl);
    const engine = await import(engineUrl);
    engine.bindContract(contract);

    const fixture = {};
    for (const table of contract.IMPORT_ORDER) {
      fixture[table] = engine.parseCsv(decoder.decode(bytesById.get(table)), table);
    }
    const reference = JSON.parse(decoder.decode(bytesById.get("reference")));
    progress(2, "Creating a fresh in-memory database and importing 4,192 rows…");
    let output;
    if (target === "javascript-controlled") {
      const alasqlUrl = blobUrl(bytesById.get("javascript-engine"));
      objectUrls.push(alasqlUrl);
      importScripts(alasqlUrl);
      if (typeof self.alasql !== "function") throw new Error("AlaSQL did not initialize");
      output = await engine.runAlaSql(self.alasql, fixture, queryId);
    } else if (target === "linear-wasm-controlled") {
      const glueUrl = blobUrl(bytesById.get("sqlite-glue"));
      objectUrls.push(glueUrl);
      const { default: sqlite3InitModule } = await import(glueUrl);
      const sqlite3 = await sqlite3InitModule({
        wasmBinary: bytesById.get("sqlite-wasm"),
        locateFile: (path) => {
          if (path === "sqlite3.wasm") return "verified:sqlite3.wasm";
          throw new Error(`Unexpected SQLite runtime file: ${path}`);
        },
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
  } finally {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  }
});
