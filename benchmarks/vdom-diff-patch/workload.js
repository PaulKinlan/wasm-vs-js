import { generateVDOMFixture } from "./input.ts";
import {
  applyPatchesToVDOMTree,
  diffVDOMTrees,
  HostDOMAdapter,
  serializeVDOMToCanonicalHTML,
} from "./js.ts";

export {
  applyPatchesToVDOMTree,
  diffVDOMTrees,
  generateVDOMFixture,
  HostDOMAdapter,
  serializeVDOMToCanonicalHTML,
};

export async function runVdomJS(fixture) {
  const startCompute = performance.now();
  const res = await diffVDOMTrees(fixture.treeA, fixture.treeB);
  const endCompute = performance.now();

  const startRender = performance.now();
  const hostAdapter = new HostDOMAdapter();
  hostAdapter.createTree(fixture.treeA);
  hostAdapter.applyPatches(res.patches);
  const html = hostAdapter.serializeHTML();
  const endRender = performance.now();

  return {
    patches: res.patches,
    nodesVisited: res.nodesVisited,
    patchesGenerated: res.patchesGenerated,
    patchDigestSha256: res.patchDigestSha256,
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
  const patchCount = wasmInstance.exports.diff_vdom_flat(
    treeAPtr,
    treeBPtr,
    outPtr,
  );
  const endCompute = performance.now();

  // Parse patch ops from Wasm memory outPtr (16 bytes per patch)
  const outView = new DataView(memory.buffer, outPtr, patchCount * 16);
  const patches = [];
  for (let i = 0; i < patchCount; i++) {
    const op = outView.getUint16(i * 16 + 0, true);
    const nodeId = outView.getUint16(i * 16 + 2, true);
    const attrKey = outView.getInt16(i * 16 + 4, true);
    const attrVal = outView.getInt16(i * 16 + 6, true);
    const childPtr = outView.getUint32(i * 16 + 8, true);

    const patch = {
      op,
      nodeId,
      targetId: attrKey,
      attrKey,
      attrVal,
      index: -1,
    };

    if (op === 6 && childPtr > 0) {
      const childCount = attrKey;
      const childView = new DataView(memory.buffer, childPtr, childCount * 2);
      const childIds = [];
      for (let c = 0; c < childCount; c++) {
        childIds.push(childView.getUint16(c * 2, true));
      }
      patch.childIds = childIds;
    }

    patches.push(patch);
  }

  const startRender = performance.now();
  const hostAdapter = new HostDOMAdapter();
  hostAdapter.createTree(fixture.treeA);
  hostAdapter.applyPatches(patches);
  const html = hostAdapter.serializeHTML();
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
