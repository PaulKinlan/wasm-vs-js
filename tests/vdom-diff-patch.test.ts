import { assert, assertEquals } from "./assert.ts";
import { generateVDOMFixture } from "../benchmarks/vdom-diff-patch/input.ts";
import { runVdomJS, runVdomWasm } from "../benchmarks/vdom-diff-patch/workload.js";
import wabtFactory from "wabt";

Deno.test("vdom-diff-patch: deterministic fixture and oracle correctness", async () => {
  const fixture1 = generateVDOMFixture();
  const fixture2 = generateVDOMFixture();

  assertEquals(fixture1.nodeCountA, 1000);
  assertEquals(fixture1.nodeCountB, 1000);
  assertEquals(fixture1.flatA, fixture2.flatA);
  assertEquals(fixture1.flatB, fixture2.flatB);

  const jsResult = runVdomJS(fixture1);
  assert(jsResult.patchesGenerated > 0);
  assert(jsResult.canonicalHtml.length > 0);
  assert(jsResult.phases.computeMs >= 0);
  assert(jsResult.phases.renderMs >= 0);

  // Compile Wasm module and test Wasm execution
  const wat = await Deno.readTextFile("benchmarks/vdom-diff-patch/vdom-diff-patch.wat");
  const wabt = await wabtFactory();
  const module = wabt.parseWat("vdom-diff-patch.wat", wat, {});
  const binary = module.toBinary({ canonicalize_lebs: true });
  module.destroy();

  const wasmBytes = new Uint8Array(binary.buffer);
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const wasmInstance = await WebAssembly.instantiate(wasmModule, {});

  const wasmResult = runVdomWasm(fixture1, wasmInstance);
  assertEquals(wasmResult.canonicalHtml, jsResult.canonicalHtml);
  assertEquals(wasmResult.nodesVisited, jsResult.nodesVisited);
});

Deno.test("vdom-diff-patch: source inspectability contract metadata", async () => {
  const manifestText = await Deno.readTextFile(
    "public/artifacts/vdom-diff-patch/build-manifest.json",
  );
  const manifest = JSON.parse(manifestText);

  assert(manifest.inspectability !== undefined);
  assertEquals(
    manifest.inspectability.commitPermalinkTemplate,
    "https://github.com/PaulKinlan/wasm-vs-js/tree/{commit}",
  );
  assertEquals(
    manifest.inspectability.executedJsSource.path,
    "benchmarks/vdom-diff-patch/workload.js",
  );
  assert(manifest.inspectability.executedJsSource.sha256.length === 64);
  assertEquals(
    manifest.inspectability.authoredWasmSource.path,
    "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
  );
  assertEquals(manifest.inspectability.authoredWasmSource.language, "wat");
  assert(manifest.inspectability.authoredWasmSource.sha256.length === 64);
  assertEquals(
    manifest.inspectability.compiledArtifact.downloadRoute,
    "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
  );
  assert(manifest.inspectability.buildRecipe.command === "deno task build");
});
