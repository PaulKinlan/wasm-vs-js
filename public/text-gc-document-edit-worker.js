const EXPECTED = Object.freeze({
  fixture: "45b117b798a6b35f42a3b5a541f5112bb7100510735e17650fee11ee6c8d6075",
  fixtureManifest: "8b4145b0d91f6eb086e7c3cabe1bf1bb9a647c9e7771ad0f824005141ebe5681",
  reference: "4b38bffbe6c4f9787a4d629ccbd363ebc52318195f5141dde55011333582b695",
  buildManifest: "e29521af4395d93a9f4f9b468dd37d103206e0b9c3d3f12afb27f7a3ec22bbcf",
  js: "466731002f3c005583c26592f4495cb80cc42639e40b1f0c6de236f7676eb443",
  wasm: "4a3083a510acc7f26fc4bd1877c87321545931b0b05580db2d5efdbc3d3582b5",
  kotlinGlue: "a4994be989542f4cc826fc2b782974b83ca81b55614eee22553cc064fc4bcb23",
  kotlinImports: "10be918973da81e5a576212ecae8c17a6b423e13015aeb92f899c7d781b5e111",
  kotlinBuiltins: "5265daba0f4204a469f87b09f6a63ebfc59555441e4fcc98f8b2006115048451",
  canonical: "40e55287bfd9486ef258602766e7c839e2ad77ba7f52b843117607132a6fd0c4",
});
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchAnchored(path, expected) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = await digest(bytes);
  if (actual !== expected) throw new Error(`${path} byte hash mismatch`);
  return bytes;
}

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${
    Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")
  }}`;
}

self.addEventListener("message", async (event) => {
  const { token, target } = event.data ?? {};
  if (typeof token !== "string" || !["js-controlled", "wasmgc-controlled"].includes(target)) return;
  const progress = (value, message) => postMessage({ token, type: "progress", value, message });
  try {
    progress(10, "Hashing the frozen fixture and package manifests.");
    const [fixtureBytes, fixtureManifestBytes, referenceBytes, buildManifestBytes, jsBytes] =
      await Promise.all([
        fetchAnchored("/artifacts/text-gc-document-edit/fixture.v1.txt", EXPECTED.fixture),
        fetchAnchored(
          "/artifacts/text-gc-document-edit/fixture-manifest.json",
          EXPECTED.fixtureManifest,
        ),
        fetchAnchored("/artifacts/text-gc-document-edit/reference.json", EXPECTED.reference),
        fetchAnchored(
          "/artifacts/text-gc-document-edit/build-manifest.json",
          EXPECTED.buildManifest,
        ),
        fetchAnchored("/benchmarks/v1/text-gc-document-edit/workload.js", EXPECTED.js),
      ]);
    const fixtureManifest = JSON.parse(decoder.decode(fixtureManifestBytes));
    const reference = JSON.parse(decoder.decode(referenceBytes));
    const buildManifest = JSON.parse(decoder.decode(buildManifestBytes));
    if (
      fixtureManifest.fixture.sha256 !== EXPECTED.fixture ||
      fixtureManifest.oracle.outputSha256 !== EXPECTED.canonical ||
      buildManifest.artifact.sha256 !== EXPECTED.wasm
    ) {
      throw new Error("manifest relationship mismatch");
    }
    progress(
      35,
      `Executing ${target === "js-controlled" ? "JavaScript" : "Kotlin WasmGC"} target.`,
    );
    const fixtureText = decoder.decode(fixtureBytes);
    let result;
    if (target === "js-controlled") {
      const sourceUrl = URL.createObjectURL(new Blob([jsBytes], { type: "text/javascript" }));
      try {
        const module = await import(sourceUrl);
        result = module.executeFixture(fixtureText, target);
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    } else {
      const [wasmBytes, glueBytes, importsBytes, builtinsBytes] = await Promise.all([
        fetchAnchored("/artifacts/text-gc-document-edit/text-gc-document-edit.wasm", EXPECTED.wasm),
        fetchAnchored(
          "/artifacts/text-gc-document-edit/text-gc-document-edit.mjs",
          EXPECTED.kotlinGlue,
        ),
        fetchAnchored(
          "/artifacts/text-gc-document-edit/text-gc-document-edit.import-object.mjs",
          EXPECTED.kotlinImports,
        ),
        fetchAnchored(
          "/artifacts/text-gc-document-edit/text-gc-document-edit.js-builtins.mjs",
          EXPECTED.kotlinBuiltins,
        ),
      ]);
      try {
        await WebAssembly.compile(wasmBytes, {
          builtins: ["js-string"],
          importedStringConstants: "'",
        });
      } catch (error) {
        if (error instanceof WebAssembly.CompileError) {
          postMessage({
            token,
            type: "unsupported",
            message: "this engine did not compile the pinned WasmGC and exception-handling module",
          });
          return;
        }
        throw error;
      }
      const builtinsUrl = URL.createObjectURL(
        new Blob([builtinsBytes], { type: "text/javascript" }),
      );
      const importsSource = decoder.decode(importsBytes).replace(
        "'./text-gc-document-edit.js-builtins.mjs'",
        JSON.stringify(builtinsUrl),
      );
      const importsUrl = URL.createObjectURL(
        new Blob([importsSource], { type: "text/javascript" }),
      );
      const glueSource = decoder.decode(glueBytes).replace(
        "'./text-gc-document-edit.import-object.mjs'",
        JSON.stringify(importsUrl),
      );
      const glueUrl = URL.createObjectURL(new Blob([glueSource], { type: "text/javascript" }));
      globalThis.__TEXT_GC_DOCUMENT_EDIT_WASM_BYTES__ = wasmBytes;
      try {
        const module = await import(glueUrl);
        if (module.wasmGcFeatureProof() !== "0:array-backed child:1") {
          throw new Error("WasmGC managed-object feature proof failed");
        }
        result = JSON.parse(module.runDocumentFixture(fixtureText));
      } finally {
        delete globalThis.__TEXT_GC_DOCUMENT_EDIT_WASM_BYTES__;
        URL.revokeObjectURL(glueUrl);
        URL.revokeObjectURL(importsUrl);
        URL.revokeObjectURL(builtinsUrl);
      }
    }
    progress(85, "Comparing every canonical output byte and structural counter.");
    const outputBytes = encoder.encode(result.canonical);
    if (
      await digest(outputBytes) !== reference.canonicalSha256 ||
      outputBytes.length !== reference.canonicalBytes ||
      reference.canonical !== result.canonical
    ) {
      throw new Error("complete canonical output mismatch");
    }
    const expectedCounters = {
      ...reference.counters,
      "boundary-crossings": target === "wasmgc-controlled" ? 2 : 0,
    };
    if (stable(result.counters) !== stable(expectedCounters)) {
      throw new Error("structural counter mismatch");
    }
    if (stable(result.identity) !== stable(reference.identity)) {
      throw new Error("tree identity mismatch");
    }
    const summary = {
      target,
      passed: true,
      canonicalSha256: reference.canonicalSha256,
      canonicalBytes: reference.canonicalBytes,
      counters: result.counters,
      identity: result.identity,
      gcDiagnostics: result.gcDiagnostics,
      packageByteHashesVerified: true,
      performanceClaim: null,
      persistence: false,
    };
    progress(100, "Validation passed.");
    postMessage({ token, type: "complete", text: JSON.stringify(summary, null, 2) });
  } catch (error) {
    postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
