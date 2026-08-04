import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { createHandler } from "../server.ts";
import {
  makeAnimationTable,
  normalizeControlledOutput,
  OUTPUT_BYTES,
  quantizeDecodedMesh,
  runJavaScript,
  validateGltfContract,
} from "../benchmarks/base/graphics-gltf-viewer/engine.js";
import { assert, assertEquals, assertRejects } from "./assert.ts";

function assertThrows(fn: () => unknown) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error("expected throw");
}

async function assertSemanticRejects(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error("expected semantic corpus rejection");
}

const root = new URL("../", import.meta.url);

function assertSameBytes(actual: Uint8Array, expected: Uint8Array, label: string): void {
  assertEquals(actual.length, expected.length);
  for (let index = 0; index < actual.length; index++) {
    if (actual[index] !== expected[index]) {
      throw new Error(`${label} differs at byte ${index}: ${actual[index]} != ${expected[index]}`);
    }
  }
}
async function readJson(path: string) {
  return JSON.parse(await Deno.readTextFile(new URL(path, root)));
}
async function assertClosedCorpus(
  fixture: Record<string, unknown>,
  build: Record<string, unknown>,
  output: Record<string, unknown>,
  evidence: Record<string, unknown>,
) {
  const fixtureFiles = fixture.files as Array<{ path: string; bytes: number; sha256: string }>;
  const sources = build.sources as Array<{
    path: string;
    bytes: number;
    sha256: string;
    immutableUrl: string;
  }>;
  const artifacts = build.artifacts as Array<{ path: string; bytes: number; sha256: string }>;
  const sourceCommit = build.sourceCommit as string;
  assertEquals(
    fixtureFiles.map((entry) => entry.path),
    [
      "fixtures/base/graphics-gltf-viewer/Avocado.gltf",
      "fixtures/base/graphics-gltf-viewer/Avocado.bin",
      "fixtures/base/graphics-gltf-viewer/base-color-64.rgba",
      "fixtures/base/graphics-gltf-viewer/AVOCADO-LICENSE.md",
    ],
  );
  assertEquals(
    sources.map((entry) => entry.path),
    [
      "benchmarks/base/graphics-gltf-viewer/engine.js",
      "benchmarks/base/graphics-gltf-viewer/viewer.c",
      "scripts/decode-gltf-draco.cjs",
      "scripts/build-base-gltf-viewer.ts",
      "public/benchmarks/base-gltf-viewer/worker.js",
      "public/benchmarks/base-gltf-viewer/decoder-worker.js",
      "public/benchmarks/base-gltf-viewer/demo.js",
      "public/benchmarks/base-gltf-viewer/index.html",
      "public/benchmarks/base-gltf-viewer/style.css",
      "schemas/base-gltf-fixture-manifest.schema.json",
      "schemas/base-gltf-build-manifest.schema.json",
      "schemas/base-gltf-output-manifest.schema.json",
      "schemas/base-gltf-evidence.schema.json",
      "tests/base-gltf-viewer.test.ts",
      "server.ts",
      "deno.json",
      "deno.lock",
    ],
  );
  assertEquals(
    artifacts.map((entry) => entry.path),
    [
      "public/artifacts/base-gltf-viewer/draco_decoder_gltf.js",
      "public/artifacts/base-gltf-viewer/draco_wasm_wrapper_gltf.js",
      "public/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm",
      "public/artifacts/base-gltf-viewer/DRACO-LICENSE.txt",
      "public/artifacts/base-gltf-viewer/viewer.wasm",
      "public/artifacts/base-gltf-viewer/decoded-mesh.bin",
      "public/artifacts/base-gltf-viewer/animation-table.i32",
      "public/artifacts/base-gltf-viewer/reference-output.bin",
      "public/artifacts/base-gltf-viewer/fixture-manifest.json",
      "public/artifacts/base-gltf-viewer/implementation-contract.v1.json",
      "public/artifacts/base-gltf-viewer/output-manifest.json",
    ],
  );
  assertEquals(output.sourceCommit, sourceCommit);
  assertEquals(evidence.sourceCommit, sourceCommit);
  for (const entry of [...fixtureFiles, ...sources, ...artifacts]) {
    const bytes = await Deno.readFile(new URL(entry.path, root));
    assertEquals(bytes.length, entry.bytes);
    assertEquals(await sha256Hex(bytes), entry.sha256);
  }
  for (const source of sources) {
    assertEquals(
      source.immutableUrl,
      `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${source.path}`,
    );
  }
  const outputValue = output.output as Record<string, unknown>;
  const input = output.input as Record<string, unknown>;
  const reference = await Deno.readFile(
    new URL("public/artifacts/base-gltf-viewer/reference-output.bin", root),
  );
  assertEquals(
    input.decodedMeshSha256,
    await sha256Hex(
      await Deno.readFile(new URL("public/artifacts/base-gltf-viewer/decoded-mesh.bin", root)),
    ),
  );
  assertEquals(outputValue.semanticSha256, await sha256Hex(reference));
  assertEquals(evidence.semanticOutputSha256, outputValue.semanticSha256);
}

async function decode(mode: "javascript" | "wasm") {
  const result = await new Deno.Command("node", {
    cwd: root.pathname,
    args: [
      "scripts/decode-gltf-draco.cjs",
      mode,
      mode === "javascript"
        ? "public/artifacts/base-gltf-viewer/draco_decoder_gltf.js"
        : "public/artifacts/base-gltf-viewer/draco_wasm_wrapper_gltf.js",
      mode === "wasm" ? "public/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm" : "-",
      "fixtures/base/graphics-gltf-viewer/Avocado.bin",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  const data = JSON.parse(new TextDecoder().decode(result.stdout));
  return {
    positions: new Float32Array(data.positions),
    normals: new Float32Array(data.normals),
    texcoords: new Float32Array(data.texcoords),
    indices: new Uint32Array(data.indices),
    metrics: data.metrics as {
      allocations: number;
      allocationUnits: Record<string, number>;
      apiCalls: number;
      wasmBoundaryCrossings: number;
      generatedExportCalls: number;
    },
  };
}

Deno.test("base glTF fixture has audited immutable rights and exact catalog identity", async () => {
  const catalog = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  const fixture = await readJson("public/artifacts/base-gltf-viewer/fixture-manifest.json");
  assertEquals(fixture.sourceModel.name, "Avocado");
  assertEquals(fixture.sourceModel.modelAssetLicense, "CC0-1.0");
  assertEquals(fixture.sourceModel.licenseDocumentLicense, "CC-BY-4.0");
  assertEquals(
    fixture.sourceModel.licenseCopy.upstreamSha256,
    "09cc6fda57c9c9063ce96a520fd0401da109009855e32f518ab1c54c9d5bc2c4",
  );
  assertEquals(fixture.draco.version, "1.5.7");
  assertEquals(fixture.files.length, 4);
  for (const entry of fixture.files) {
    const bytes = await Deno.readFile(new URL(entry.path, root));
    assertEquals(bytes.length, entry.bytes);
    assertEquals(await sha256Hex(bytes), entry.sha256);
  }
});

Deno.test("independent Draco asm.js and linear-Wasm payloads decode every attribute identically", async () => {
  const [js, wasm] = await Promise.all([decode("javascript"), decode("wasm")]);
  const a = quantizeDecodedMesh(js), b = quantizeDecodedMesh(wasm);
  assertEquals(a.vertexCount, 406);
  assertEquals(a.indices.length, 2046);
  assertEquals(Array.from(a.positions), Array.from(b.positions));
  assertEquals(Array.from(a.normals), Array.from(b.normals));
  assertEquals(Array.from(a.texcoords), Array.from(b.texcoords));
  assertEquals(Array.from(a.indices), Array.from(b.indices));
});

Deno.test("glTF parser accepts the exact Draco product model and rejects malformed contracts", async () => {
  const text = await Deno.readTextFile(
    new URL("fixtures/base/graphics-gltf-viewer/Avocado.gltf", root),
  );
  assertEquals(validateGltfContract(text), {
    attributeIds: { TEXCOORD_0: 0, NORMAL: 1, TANGENT: 2, POSITION: 3 },
    indexCount: 2046,
    vertexCount: 406,
  });
  assertThrows(() => validateGltfContract(text.replace('"POSITION": 3', '"POSITION": 9')));
  assertThrows(() =>
    validateGltfContract(text.replace('"alphaMode": "OPAQUE"', '"alphaMode": "BLEND"'))
  );
  assertThrows(() => validateGltfContract("{}"));
});

// Wasm half of the 600-frame differential run, executed on a worker thread
// (inline source so this pinned file stays the only source-graph entry):
// it is independent of the JS render below, and both are sync CPU.
const WASM_HALF_WORKER_SOURCE = `
self.onmessage = async (event) => {
  const m = event.data;
  const { instance } = await WebAssembly.instantiate(m.wasmBytes, {});
  const ex = instance.exports;
  const memory = new Uint8Array(ex.memory.buffer);
  const base = Number(ex.heap_ptr());
  const state = { cursor: 0 };
  const copy = (value) => {
    state.cursor = (state.cursor + 7) & ~7;
    const off = state.cursor;
    memory.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), base + off);
    state.cursor += value.byteLength;
    return off;
  };
  const p = copy(m.positions), n = copy(m.normals), u = copy(m.texcoords),
    i = copy(m.indices), t = copy(m.texture), a = copy(m.animation);
  const j = copy(m.json);
  const validate = Number(ex.validate_gltf(j, m.json.length));
  const run = Number(
    ex.run(
      p, n, u, i, t, a, m.vertexCount, m.indexCount,
      m.allocations, m.apiCalls, m.wasmBoundaryCrossings,
    ),
  );
  const output = memory.slice(Number(ex.output_ptr()), Number(ex.output_ptr()) + m.outputBytes);
  self.postMessage({ validate, run, output });
};
`;

Deno.test("complete 600-frame JS and material-Wasm outputs equal the retained oracle", async () => {
  const [decoded, wasmDecoded] = await Promise.all([decode("javascript"), decode("wasm")]);
  const mesh = quantizeDecodedMesh(decoded);
  const texture = await Deno.readFile(
    new URL("fixtures/base/graphics-gltf-viewer/base-color-64.rgba", root),
  );
  const animation = makeAnimationTable();
  const wasmBytes = await Deno.readFile(
    new URL("public/artifacts/base-gltf-viewer/viewer.wasm", root),
  );
  const json = new TextEncoder().encode(
    await Deno.readTextFile(new URL("fixtures/base/graphics-gltf-viewer/Avocado.gltf", root)),
  );
  const worker = new Worker(
    `data:text/javascript;base64,${btoa(WASM_HALF_WORKER_SOURCE)}`,
    { type: "module" },
  );
  const wasmHalf = new Promise<{ validate: number; run: number; output: Uint8Array }>(
    (resolve, reject) => {
      worker.onmessage = (event) => resolve(event.data);
      worker.onerror = (event) => reject(event.error ?? new Error(event.message));
    },
  );
  worker.postMessage({
    wasmBytes,
    positions: mesh.positions,
    normals: mesh.normals,
    texcoords: mesh.texcoords,
    indices: mesh.indices,
    texture,
    animation,
    json,
    vertexCount: mesh.vertexCount,
    indexCount: mesh.indices.length,
    allocations: wasmDecoded.metrics.allocations,
    apiCalls: wasmDecoded.metrics.apiCalls,
    wasmBoundaryCrossings: wasmDecoded.metrics.wasmBoundaryCrossings,
    outputBytes: OUTPUT_BYTES,
  });
  const js = runJavaScript(mesh, texture, animation, decoded.metrics);
  const { validate, run, output: wasm } = await wasmHalf;
  worker.terminate();
  assertEquals(validate, 0);
  assertEquals(run, 0);
  const oracle = await Deno.readFile(
    new URL("public/artifacts/base-gltf-viewer/reference-output.bin", root),
  );
  const jsSemantic = normalizeControlledOutput(js);
  const wasmSemantic = normalizeControlledOutput(wasm);
  // Byte-exact comparison against the retained oracle. assertEquals compares
  // via JSON.stringify, which costs ~3s per 22MB array; this is the same
  // byte-equality semantics with byte-index failure localization, ~100x
  // faster. (The old per-frame slice loop asserted nothing these two checks
  // do not already imply, so it was removed rather than converted.)
  assertSameBytes(jsSemantic, oracle, "js semantic output");
  assertSameBytes(wasmSemantic, oracle, "wasm semantic output");
  const pixelOffset = (28 + 600 * 8) * 4;
  const frameBytes = 96 * 96 * 4;
  const manifest = await readJson("public/artifacts/base-gltf-viewer/output-manifest.json");
  assertEquals(await sha256Hex(js), manifest.output.variants.javascript.sha256);
  assertEquals(await sha256Hex(wasm), manifest.output.variants.wasm.sha256);
  assertEquals(await sha256Hex(jsSemantic), manifest.output.semanticSha256);
  assertEquals(await sha256Hex(oracle), manifest.output.semanticSha256);
  assertEquals(js.length, manifest.output.bytes);
  const header = new Uint32Array(js.buffer, 0, 28);
  assertEquals(header[1], 406);
  assertEquals(header[2], 2046);
  assertEquals(header[3], 600);
  assertEquals(header[9], 406 * 600);
  assertEquals(header[10], 682 * 600 * 2);
  assertEquals(header[11], 600);
  assertEquals(header[12], 600);
  assertEquals(header[13], 12);
  assertEquals(header[15], 27);
  assertEquals(header[20], 18);
  assertEquals(header[21], 6002);
  assertEquals(manifest.output.variants.javascript.allocations, 27);
  assertEquals(manifest.output.variants.wasm.allocations, 25);
  assertEquals(manifest.output.variants.wasm.decoderInitializationAndGeneratedExportCrossings, 35);
  assertEquals(manifest.output.variants.wasm.decoderWasmBoundaryCrossings, 6037);
  assertEquals(manifest.output.variants.wasm.totalWasmBoundaryCrossings, 6041);
  assertEquals(manifest.output.variants.wasm.wasmCopyOperations, 8);
  assertEquals(manifest.output.variants.wasm.wasmCopyBytes, 47843 + OUTPUT_BYTES);
  assertEquals(header[25], 600);
  assertEquals(header[26], 600);
  assertEquals(js.length, pixelOffset + 600 * frameBytes);
  assert(header[8] > 6 * 96 * 96, `all-frame raster count ${header[8]}`);
  assert(header[5] > 0 && header[5] <= 12, `pick hits ${header[5]}`);
});

Deno.test("base glTF route is read-only and all runtime assets are explicitly served", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/base-gltf-viewer/",
      "/benchmarks/base-gltf-viewer/demo.js",
      "/benchmarks/base-gltf-viewer/worker.js",
      "/benchmarks/base-gltf-viewer/decoder-worker.js",
      "/benchmarks/base-gltf-viewer/style.css",
      "/benchmarks/base/graphics-gltf-viewer/engine.js",
      "/artifacts/base-gltf-viewer/Avocado.gltf",
      "/artifacts/base-gltf-viewer/Avocado.bin",
      "/artifacts/base-gltf-viewer/base-color-64.rgba",
      "/artifacts/base-gltf-viewer/viewer.wasm",
      "/artifacts/base-gltf-viewer/draco_decoder_gltf.js",
      "/artifacts/base-gltf-viewer/draco_wasm_wrapper_gltf.js",
      "/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm",
      "/artifacts/base-gltf-viewer/build-manifest.json",
      "/evidence/base-workloads/graphics-gltf-viewer/static-validation.json",
    ]
  ) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assert(response.status === 200, `${path} returned ${response.status}`);
  }
  const denied = await handler(
    new Request("http://127.0.0.1/benchmarks/base-gltf-viewer/", { method: "POST" }),
  );
  assertEquals(denied.status, 403);
  const build = await readJson("public/artifacts/base-gltf-viewer/build-manifest.json");
  assert(
    build.sources.some((source: { path: string }) =>
      source.path === "public/benchmarks/base-gltf-viewer/decoder-worker.js"
    ),
    "decoder worker missing from source graph",
  );
  const worker = await Deno.readTextFile(
    new URL("public/benchmarks/base-gltf-viewer/worker.js", root),
  );
  const decoderWorker = await Deno.readTextFile(
    new URL("public/benchmarks/base-gltf-viewer/decoder-worker.js", root),
  );
  assert(worker.includes("verify(`public/artifacts/base-gltf-viewer/${decoderPath}`"));
  assert(worker.includes("decoderScript: decoderScript.buffer"));
  assert(decoderWorker.includes("new Blob([decoderScript]"));
  assert(decoderWorker.includes('const wasmBinary = mode === "wasm"'));
  assert(decoderWorker.includes("WebAssembly.instantiate(wasmBinary, imports)"));
  assert(!decoderWorker.includes('importScripts("/artifacts/'));
});

Deno.test("demo lifecycle uses fresh workers, cancellation, timeout, stale tokens and pagehide", async () => {
  const source = await Deno.readTextFile(
    new URL("public/benchmarks/base-gltf-viewer/demo.js", root),
  );
  for (
    const marker of [
      "new Worker",
      "worker.terminate()",
      "runToken !== token",
      "setTimeout",
      "pagehide",
      "No result retained.",
    ]
  ) assert(source.includes(marker), marker);
  const html = await Deno.readTextFile(
    new URL("public/benchmarks/base-gltf-viewer/index.html", root),
  );
  assert(!html.includes("<style"));
  assert(!html.includes("<script>") && html.includes('script type="module" src='));
  assert(!source.includes("localStorage"));
  assert(!source.includes("indexedDB"));
  assert(!source.includes("fetch("));
});

Deno.test("Wasm glTF validation parses JSON and rejects token-like or changed documents", async () => {
  const wasm = await Deno.readFile(new URL("public/artifacts/base-gltf-viewer/viewer.wasm", root));
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const ex = instance.exports as never as Record<string, CallableFunction> & {
    memory: WebAssembly.Memory;
  };
  const memory = new Uint8Array(ex.memory.buffer);
  const base = Number(ex.heap_ptr());
  const validate = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    memory.set(bytes, base);
    return Number(ex.validate_gltf(0, bytes.length));
  };
  const exact = await Deno.readTextFile(
    new URL("fixtures/base/graphics-gltf-viewer/Avocado.gltf", root),
  );
  assertEquals(validate(exact), 0);
  assert(validate('not JSON "version": "2.0" "KHR_draco_mesh_compression"') !== 0);
  assert(validate(exact.replace('"POSITION": 3', '"POSITION": 9')) !== 0);
});

Deno.test("base glTF schemas and retained corpus reject identity, graph and hash contradictions", async () => {
  type Validator = ((value: unknown) => boolean) & { errors?: unknown };
  type AjvConstructor = new (options?: Record<string, unknown>) => {
    compile(schema: unknown): Validator;
  };
  const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
    Ajv2020Module) as unknown as AjvConstructor;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const cases = [
    [
      "fixture",
      "public/artifacts/base-gltf-viewer/fixture-manifest.json",
      "schemas/base-gltf-fixture-manifest.schema.json",
      (v: Record<string, unknown>) => {
        (v.sourceModel as Record<string, unknown>).modelAssetLicense = "CC-BY-4.0";
      },
    ],
    [
      "build",
      "public/artifacts/base-gltf-viewer/build-manifest.json",
      "schemas/base-gltf-build-manifest.schema.json",
      (v: Record<string, unknown>) => {
        (v.toolchain as Record<string, unknown>).draco = "unversioned";
      },
    ],
    [
      "output",
      "public/artifacts/base-gltf-viewer/output-manifest.json",
      "schemas/base-gltf-output-manifest.schema.json",
      (v: Record<string, unknown>) => {
        ((v.output as Record<string, unknown>).variants as Record<string, Record<string, unknown>>)
          .wasm.totalWasmBoundaryCrossings = 0;
      },
    ],
    [
      "evidence",
      "public/evidence/base-workloads/graphics-gltf-viewer/static-validation.json",
      "schemas/base-gltf-evidence.schema.json",
      (v: Record<string, unknown>) => {
        v.semanticOutputSha256 = "0".repeat(64);
      },
    ],
  ] as const;
  for (const [name, documentPath, schemaPath, contradict] of cases) {
    const document = await readJson(documentPath) as Record<string, unknown>;
    const schema = await readJson(schemaPath);
    const validate = ajv.compile(schema);
    assert(validate(document), `${name}: ${JSON.stringify(validate.errors)}`);
    const extra = structuredClone(document);
    extra.undeclared = true;
    assert(!validate(extra), `${name} accepted undeclared field`);
    const contradictory = structuredClone(document);
    contradict(contradictory);
    assert(!validate(contradictory), `${name} accepted contradictory semantics`);
  }

  const fixture = await readJson("public/artifacts/base-gltf-viewer/fixture-manifest.json");
  const build = await readJson("public/artifacts/base-gltf-viewer/build-manifest.json");
  const output = await readJson("public/artifacts/base-gltf-viewer/output-manifest.json");
  const evidence = await readJson(
    "public/evidence/base-workloads/graphics-gltf-viewer/static-validation.json",
  );
  await assertClosedCorpus(fixture, build, output, evidence);

  const duplicateFixture = structuredClone(fixture);
  duplicateFixture.files[1] = duplicateFixture.files[0];
  await assertSemanticRejects(() => assertClosedCorpus(duplicateFixture, build, output, evidence));
  const duplicateSource = structuredClone(build);
  duplicateSource.sources[1] = duplicateSource.sources[0];
  await assertSemanticRejects(() => assertClosedCorpus(fixture, duplicateSource, output, evidence));
  const falseCommit = structuredClone(build);
  falseCommit.sourceCommit = "0".repeat(40);
  await assertSemanticRejects(() => assertClosedCorpus(fixture, falseCommit, output, evidence));
  const falseOutputHash = structuredClone(output);
  falseOutputHash.output.semanticSha256 = "0".repeat(64);
  await assertSemanticRejects(() => assertClosedCorpus(fixture, build, falseOutputHash, evidence));
  const falseEvidenceHash = structuredClone(evidence);
  falseEvidenceHash.semanticOutputSha256 = "0".repeat(64);
  await assertSemanticRejects(() => assertClosedCorpus(fixture, build, output, falseEvidenceHash));
});

Deno.test("build fails closed when source commit is absent", async () => {
  await assertRejects(async () => {
    const result = await new Deno.Command(Deno.execPath(), {
      cwd: root.pathname,
      args: [
        "run",
        "--allow-read=.",
        "--allow-write=public/artifacts,public/evidence",
        "--allow-run=node,clang,wasm-ld,git",
        "scripts/build-base-gltf-viewer.ts",
      ],
      stdout: "null",
      stderr: "null",
    }).output();
    if (!result.success) throw new Error("failed closed");
  }, "failed closed");
});
