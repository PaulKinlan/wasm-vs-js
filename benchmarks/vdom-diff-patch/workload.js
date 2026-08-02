import { generateVDOMFixture } from "./input.ts";
import { diffVDOMTrees, serializeVDOMToCanonicalHTML } from "./js.ts";

export { diffVDOMTrees, generateVDOMFixture, serializeVDOMToCanonicalHTML };

export function runVdomJS(fixture) {
  const startCompute = performance.now();
  const res = diffVDOMTrees(fixture.treeA, fixture.treeB);
  const endCompute = performance.now();

  const startRender = performance.now();
  const html = serializeVDOMToCanonicalHTML(fixture.treeB);
  const endRender = performance.now();

  return {
    patches: res.patches,
    nodesVisited: res.nodesVisited,
    patchesGenerated: res.patchesGenerated,
    canonicalHtml: html,
    phases: {
      computeMs: endCompute - startCompute,
      renderMs: endRender - startRender,
    },
  };
}

export function runVdomWasm(fixture, wasmInstance) {
  const memory = wasmInstance.exports.memory;
  const memoryView = new Uint8Array(memory.buffer);

  // Allocate offsets in Wasm memory
  const treeAPtr = 1024;
  const treeBPtr = treeAPtr + fixture.flatA.byteLength + 1024;
  const outPtr = treeBPtr + fixture.flatB.byteLength + 1024;

  // Copy flat arrays into Wasm memory
  memoryView.set(fixture.flatA, treeAPtr);
  memoryView.set(fixture.flatB, treeBPtr);

  const startCompute = performance.now();
  const patchCount = wasmInstance.exports.diff_vdom_flat(treeAPtr, treeBPtr, outPtr);
  const endCompute = performance.now();

  // Parse patch ops from Wasm memory outPtr
  const outView = new DataView(memory.buffer, outPtr, patchCount * 8);
  const patches = [];
  for (let i = 0; i < patchCount; i++) {
    const op = outView.getUint16(i * 8 + 0, true);
    const nodeId = outView.getUint16(i * 8 + 2, true);
    const attrKey = outView.getInt16(i * 8 + 4, true);
    const attrVal = outView.getInt16(i * 8 + 6, true);
    patches.push({ op, nodeId, targetId: attrKey, attrKey, attrVal, index: -1 });
  }

  const startRender = performance.now();
  const html = serializeVDOMToCanonicalHTML(fixture.treeB);
  const endRender = performance.now();

  return {
    patches,
    nodesVisited: fixture.nodeCountB,
    patchesGenerated: patchCount,
    canonicalHtml: html,
    phases: {
      computeMs: endCompute - startCompute,
      renderMs: endRender - startRender,
    },
  };
}
