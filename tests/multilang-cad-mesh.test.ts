import { assert, assertEquals } from "./assert.ts";
import { generateDirtyStl } from "../benchmarks/base/cad-mesh-repair/fixture.js";
import {
  instantiateMeshWasm,
  repairMeshJavaScript,
  repairMeshWasm,
} from "../benchmarks/base/cad-mesh-repair/engine.js";

// Multi-language cad-mesh-repair kernels must be bit-identical to the
// workload engine's JS oracle on the full frozen fixture.

const fixture = generateDirtyStl();

function jsWords(): Int32Array {
  const result = repairMeshJavaScript(fixture);
  return new Int32Array(result.bytes.buffer);
}

async function linearWords(wasmPath: string): Promise<Int32Array> {
  const wasm = await Deno.readFile(wasmPath);
  const exports = await instantiateMeshWasm(wasm);
  const result = repairMeshWasm(exports, fixture);
  return new Int32Array(result.bytes.buffer);
}

Deno.test("cad-mesh-repair: C kernel is bit-identical to the JS oracle", async () => {
  const js = jsWords();
  const c = await linearWords(
    "public/artifacts/multilang-wasm-benchmark/mesh_repair_c.wasm",
  );
  assertEquals(c.length, js.length);
  for (let i = 0; i < js.length; i++) assert(c[i] === js[i], `C word ${i}: ${c[i]} != ${js[i]}`);
});

Deno.test("cad-mesh-repair: C++ kernel is bit-identical to the JS oracle", async () => {
  const js = jsWords();
  const cpp = await linearWords(
    "public/artifacts/multilang-wasm-benchmark/mesh_repair_cpp.wasm",
  );
  assertEquals(cpp.length, js.length);
  for (let i = 0; i < js.length; i++) assert(cpp[i] === js[i], `C++ word ${i}: ${cpp[i]} != ${js[i]}`);
});

Deno.test("cad-mesh-repair: Rust kernel is bit-identical to the JS oracle", async () => {
  const js = jsWords();
  const rs = await linearWords(
    "public/artifacts/multilang-wasm-benchmark/mesh_repair_rs.wasm",
  );
  assertEquals(rs.length, js.length);
  for (let i = 0; i < js.length; i++) assert(rs[i] === js[i], `Rust word ${i}: ${rs[i]} != ${js[i]}`);
});

Deno.test("cad-mesh-repair: Dart kernel is bit-identical to the JS oracle", async () => {
  const glue = await import(
    `file://${Deno.cwd()}/public/artifacts/multilang-wasm-benchmark/mesh_repair_dart.mjs`
  );
  const app = await glue.compile(
    await Deno.readFile(
      "public/artifacts/multilang-wasm-benchmark/mesh_repair_dart.wasm",
    ),
  );
  const inst = await app.instantiate({});
  inst.invokeMain();
  const kernels = (globalThis as Record<string, unknown>).dartKernels as {
    meshRepair: (input: Uint8Array, outWords: Int32Array) => number;
  };
  assert(kernels, "dartKernels not published");
  const js = jsWords();
  const out = new Int32Array(65536);
  const ret = kernels.meshRepair(fixture, out);
  assertEquals(ret, js.length);
  for (let i = 0; i < js.length; i++) assert(out[i] === js[i], `Dart word ${i}: ${out[i]} != ${js[i]}`);
});

Deno.test("cad-mesh-repair: header sanity (magic + word count)", () => {
  const js = jsWords();
  assertEquals(js[0], 0x4d455348); // "MESH"
  assertEquals(js[1], 2);
  assertEquals(js[2], 2112); // source faces
  assertEquals(js[5], 1024); // target faces
});
