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

const root = new URL("../", import.meta.url);
async function readJson(path: string) {
  return JSON.parse(await Deno.readTextFile(new URL(path, root)));
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
  assertEquals(fixture.sourceModel.license, "CC0-1.0");
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

Deno.test("complete 600-frame JS and material-Wasm outputs equal the retained oracle", async () => {
  const decoded = await decode("javascript");
  const mesh = quantizeDecodedMesh(decoded);
  const texture = await Deno.readFile(
    new URL("fixtures/base/graphics-gltf-viewer/base-color-64.rgba", root),
  );
  const animation = makeAnimationTable();
  const js = runJavaScript(mesh, texture, animation);
  const wasmBytes = await Deno.readFile(
    new URL("public/artifacts/base-gltf-viewer/viewer.wasm", root),
  );
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const ex = instance.exports as never as Record<string, CallableFunction> & {
    memory: WebAssembly.Memory;
  };
  const memory = new Uint8Array(ex.memory.buffer),
    base = Number(ex.heap_ptr()),
    copy = (value: ArrayBufferView, state = { cursor: 0 }) => {
      state.cursor = (state.cursor + 7) & ~7;
      const off = state.cursor;
      memory.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), base + off);
      state.cursor += value.byteLength;
      return off;
    };
  const state = { cursor: 0 };
  const p = copy(mesh.positions, state),
    n = copy(mesh.normals, state),
    u = copy(mesh.texcoords, state),
    i = copy(mesh.indices, state),
    t = copy(texture, state),
    a = copy(animation, state);
  const json = new TextEncoder().encode(
      await Deno.readTextFile(new URL("fixtures/base/graphics-gltf-viewer/Avocado.gltf", root)),
    ),
    j = copy(json, state);
  assertEquals(Number(ex.validate_gltf(j, json.length)), 0);
  assertEquals(Number(ex.run(p, n, u, i, t, a, mesh.vertexCount, mesh.indices.length)), 0);
  const wasm = memory.slice(Number(ex.output_ptr()), Number(ex.output_ptr()) + OUTPUT_BYTES);
  assertEquals(
    await sha256Hex(normalizeControlledOutput(js)),
    await sha256Hex(normalizeControlledOutput(wasm)),
  );
  const manifest = await readJson("public/artifacts/base-gltf-viewer/output-manifest.json");
  assertEquals(await sha256Hex(js), manifest.output.variants.javascript.sha256);
  assertEquals(await sha256Hex(wasm), manifest.output.variants.wasm.sha256);
  assertEquals(await sha256Hex(normalizeControlledOutput(js)), manifest.output.semanticSha256);
  assertEquals(js.length, manifest.output.bytes);
  const header = new Uint32Array(js.buffer, 0, 20);
  assertEquals(header[1], 406);
  assertEquals(header[2], 2046);
  assertEquals(header[3], 600);
  assertEquals(header[9], 406 * 600);
  assertEquals(header[10], 682 * 600);
  assertEquals(header[11], 600);
  assertEquals(header[12], 6);
  assertEquals(header[13], 12);
});

Deno.test("base glTF route is read-only and all runtime assets are explicitly served", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/base-gltf-viewer/",
      "/benchmarks/base-gltf-viewer/demo.js",
      "/benchmarks/base-gltf-viewer/worker.js",
      "/benchmarks/base-gltf-viewer/decoder-worker.js",
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
    assertEquals(response.status, 200, path);
  }
  const denied = await handler(
    new Request("http://127.0.0.1/benchmarks/base-gltf-viewer/", { method: "POST" }),
  );
  assertEquals(denied.status, 403);
});

Deno.test("demo lifecycle uses fresh workers, cancellation, timeout, stale tokens and pagehide", async () => {
  const source = await Deno.readTextFile(
    new URL("public/benchmarks/base-gltf-viewer/demo.js", root),
  );
  for (
    const marker of [
      "new Worker",
      "worker.terminate()",
      "runToken!==token",
      "setTimeout",
      "pagehide",
      "No result retained.",
    ]
  ) assert(source.includes(marker), marker);
  assert(!source.includes("localStorage"));
  assert(!source.includes("indexedDB"));
  assert(!source.includes("fetch("));
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
