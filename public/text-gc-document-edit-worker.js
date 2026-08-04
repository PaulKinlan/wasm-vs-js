import { WORKER_ANCHORS } from "/worker-anchors.generated.js";

const EXPECTED = Object.freeze({
  ...WORKER_ANCHORS["text-gc-document-edit"],
  canonical: "40e55287bfd9486ef258602766e7c839e2ad77ba7f52b843117607132a6fd0c4", // runtime oracle digest — pins execution, not bytes
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
