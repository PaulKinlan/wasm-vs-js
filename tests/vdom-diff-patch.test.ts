import { assert, assertEquals } from "./assert.ts";
import {
  flattenVDOMTree,
  generateVDOMFixture,
  type VDOMFixture,
  type VDOMNode,
} from "../benchmarks/vdom-diff-patch/input.ts";
import {
  applyPatchesToVDOMTree,
  runVdomJS,
  runVdomWasm,
  serializeVDOMToCanonicalHTML,
} from "../benchmarks/vdom-diff-patch/workload.js";
import wabtFactory from "wabt";

async function compileVdomWasm(): Promise<WebAssembly.Instance> {
  const wat = await Deno.readTextFile("benchmarks/vdom-diff-patch/vdom-diff-patch.wat");
  const wabt = await wabtFactory();
  const module = wabt.parseWat("vdom-diff-patch.wat", wat, {});
  const binary = module.toBinary({ canonicalize_lebs: true });
  module.destroy();
  return await WebAssembly.instantiate(
    await WebAssembly.compile(new Uint8Array(binary.buffer)),
    {},
  );
}

function maximumDepth(tree: VDOMNode[]): number {
  const byId = new Map(tree.map((node) => [node.id, node]));
  const visit = (id: number, depth: number): number =>
    Math.max(depth, ...((byId.get(id)?.children ?? []).map((child) => visit(child, depth + 1))));
  return visit(0, 0);
}

async function assertEquivalent(fixture: VDOMFixture, wasm: WebAssembly.Instance) {
  const js = await runVdomJS(fixture);
  const wasmResult = await runVdomWasm(fixture, wasm);
  assertEquals(wasmResult.patches, js.patches);
  assertEquals(wasmResult.patchDigestSha256, js.patchDigestSha256);
  assertEquals(wasmResult.canonicalHtml, js.canonicalHtml);
  assertEquals(js.canonicalHtmlHash, js.targetHtmlHash);
  assertEquals(wasmResult.canonicalHtmlHash, wasmResult.targetHtmlHash);
  assertEquals(wasmResult.nodesVisited, js.nodesVisited);
  assertEquals(wasmResult.patchesGenerated, js.patchesGenerated);
  assertEquals(wasmResult.domMutations, js.domMutations);
  assertEquals(js.boundaryCrossings, 0);
  assertEquals(wasmResult.boundaryCrossings, 1);
  for (const result of [js, wasmResult]) {
    assert(result.phases.computeMs >= 0);
    assert(result.phases.boundaryMs >= 0);
    assert(result.phases.renderMs >= 0);
  }
}

Deno.test("vdom-diff-patch: exact 250-edit, depth-bounded frozen fixture and complete oracle", async () => {
  const fixture1 = generateVDOMFixture();
  const fixture2 = generateVDOMFixture();
  assertEquals(fixture1.nodeCountA, 1000);
  assertEquals(fixture1.nodeCountB, 1000);
  assertEquals(fixture1.expectedPatchCount, 250);
  assert(maximumDepth(fixture1.treeA) <= 8);
  assertEquals(fixture1.flatA, fixture2.flatA);
  assertEquals(fixture1.flatB, fixture2.flatB);
  const wasm = await compileVdomWasm();
  await assertEquivalent(fixture1, wasm);
  assertEquals((await runVdomJS(fixture1)).patchesGenerated, 250);
});

Deno.test("vdom-diff-patch: insert, tag replacement, attribute, reorder, and removal patches are self-contained", async () => {
  const treeA: VDOMNode[] = [
    { id: 0, tag: 0, key: -1, attrKey: -1, attrVal: -1, textId: -1, children: [1, 2, 3] },
    { id: 1, tag: 1, key: -1, attrKey: -1, attrVal: -1, textId: -1, children: [] },
    { id: 2, tag: 2, key: -1, attrKey: 1, attrVal: 1, textId: -1, children: [] },
    { id: 3, tag: -1, key: -1, attrKey: -1, attrVal: -1, textId: 3, children: [] },
  ];
  const treeB: VDOMNode[] = [
    { ...treeA[0], children: [2, 1, 4] },
    { ...treeA[1], tag: 5 },
    { ...treeA[2], attrVal: 9 },
    { id: 4, tag: -1, key: -1, attrKey: -1, attrVal: -1, textId: 44, children: [] },
  ];
  const fixture: VDOMFixture = {
    seed: 0,
    nodeCountA: treeA.length,
    nodeCountB: treeB.length,
    treeA,
    treeB,
    flatA: flattenVDOMTree(treeA),
    flatB: flattenVDOMTree(treeB),
    expectedPatchCount: 5,
  };
  const wasm = await compileVdomWasm();
  await assertEquivalent(fixture, wasm);
  const patches = (await runVdomWasm(fixture, wasm)).patches;
  assert(patches.some((patch) => patch.op === 5 && patch.nodeId === 3));
  assert(patches.some((patch) => patch.op === 7 && patch.nodeId === 4 && "node" in patch));
  assertEquals(
    serializeVDOMToCanonicalHTML(applyPatchesToVDOMTree(treeA, patches)),
    serializeVDOMToCanonicalHTML(treeB),
  );
});

Deno.test("vdom-diff-patch: source inspectability contract metadata", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/vdom-diff-patch/build-manifest.json"),
  );
  assert(manifest.inspectability !== undefined);
  assertEquals(
    manifest.inspectability.commitPermalinkTemplate,
    "https://github.com/PaulKinlan/wasm-vs-js/tree/{commit}",
  );
  assertEquals(
    manifest.inspectability.executedJsSource.path,
    "benchmarks/vdom-diff-patch/workload.js",
  );
  assertEquals(
    manifest.inspectability.authoredWasmSource.path,
    "benchmarks/vdom-diff-patch/vdom-diff-patch.wat",
  );
  assertEquals(
    manifest.inspectability.compiledArtifact.downloadRoute,
    "/artifacts/vdom-diff-patch/vdom-diff-patch.wasm",
  );
  assertEquals(manifest.inspectability.buildRecipe.command, "deno task build");
});
