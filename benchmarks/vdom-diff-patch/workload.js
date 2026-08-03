import { generateVDOMFixture } from "./input.ts";
import {
  applyPatchesToVDOMTree,
  canonicalizePatches,
  createVDOMPatches,
  diffVDOMTrees,
  digestPatches,
  DOMHostAdapter,
  HostDOMAdapter,
  MemoryHostAdapter,
  serializeVDOMToCanonicalHTML,
} from "./js.ts";
import { sha256Hex } from "../../lib/canonical.ts";

export {
  applyPatchesToVDOMTree,
  diffVDOMTrees,
  DOMHostAdapter,
  generateVDOMFixture,
  HostDOMAdapter,
  MemoryHostAdapter,
  serializeVDOMToCanonicalHTML,
};

const hashText = (text) => sha256Hex(new TextEncoder().encode(text));

export async function runVdomJS(fixture) {
  const startCompute = performance.now();
  const { patches, nodesVisited } = createVDOMPatches(fixture.treeA, fixture.treeB);
  const endCompute = performance.now();

  const startRender = performance.now();
  const host = new MemoryHostAdapter();
  host.createTree(fixture.treeA);
  host.applyPatches(patches);
  const canonicalHtml = host.serializeHTML();
  const endRender = performance.now();

  const targetHtml = serializeVDOMToCanonicalHTML(fixture.treeB);
  return {
    patches,
    nodesVisited,
    patchesGenerated: patches.length,
    patchDigestSha256: await digestPatches(patches),
    canonicalHtml,
    canonicalHtmlHash: await hashText(canonicalHtml),
    targetHtmlHash: await hashText(targetHtml),
    domMutations: host.domMutations,
    boundaryCrossings: 0,
    phases: {
      computeMs: endCompute - startCompute,
      boundaryMs: 0,
      renderMs: endRender - startRender,
    },
  };
}

function decodeNode(view, nodePtr, childPtr) {
  const childCount = view.getUint16(nodePtr + 12, true);
  const children = [];
  for (let index = 0; index < childCount; index++) {
    children.push(view.getUint16(childPtr + index * 2, true));
  }
  return {
    id: view.getUint16(nodePtr, true),
    tag: view.getInt16(nodePtr + 2, true),
    key: view.getInt16(nodePtr + 4, true),
    attrKey: view.getInt16(nodePtr + 6, true),
    attrVal: view.getInt16(nodePtr + 8, true),
    textId: view.getInt16(nodePtr + 10, true),
    children,
  };
}

export async function runVdomWasm(fixture, wasmInstance) {
  const memory = wasmInstance.exports.memory;
  const diff = wasmInstance.exports.diff_vdom_flat;
  if (!(memory instanceof WebAssembly.Memory) || typeof diff !== "function") {
    throw new Error("VDOM Wasm exports are incomplete");
  }
  const bytes = new Uint8Array(memory.buffer);
  const treeAPtr = 1024;
  const treeBPtr = (treeAPtr + fixture.flatA.byteLength + 7) & ~7;
  const outPtr = (treeBPtr + fixture.flatB.byteLength + 7) & ~7;
  const indexPtr = 262144;
  if (outPtr >= indexPtr) throw new Error("VDOM reduced fixture overlaps the Wasm ID index");
  bytes.set(fixture.flatA, treeAPtr);
  bytes.set(fixture.flatB, treeBPtr);

  const startCompute = performance.now();
  const patchCount = diff(treeAPtr, treeBPtr, outPtr);
  const endCompute = performance.now();
  if (outPtr + patchCount * 24 > indexPtr) {
    throw new Error("VDOM Wasm patch output exceeded memory");
  }

  const startBoundary = performance.now();
  const view = new DataView(memory.buffer);
  const patches = [];
  for (let index = 0; index < patchCount; index++) {
    const offset = outPtr + index * 24;
    const op = view.getUint16(offset, true);
    const nodeId = view.getUint16(offset + 2, true);
    const targetId = view.getInt16(offset + 4, true);
    const attrKey = view.getInt16(offset + 6, true);
    const attrVal = view.getInt16(offset + 8, true);
    const patchIndex = view.getInt16(offset + 10, true);
    const childPtr = view.getUint32(offset + 12, true);
    const nodePtr = view.getUint32(offset + 16, true);
    const patch = { op, nodeId, targetId, attrKey, attrVal, index: patchIndex };
    if (op === 6) {
      patch.childIds = [];
      for (let child = 0; child < targetId; child++) {
        patch.childIds.push(view.getUint16(childPtr + child * 2, true));
      }
    } else if (op === 7) {
      const node = decodeNode(view, nodePtr, childPtr);
      patch.childIds = [...node.children];
      patch.node = node;
    }
    patches.push(patch);
  }
  canonicalizePatches(patches);
  const endBoundary = performance.now();

  const startRender = performance.now();
  const host = new MemoryHostAdapter();
  host.createTree(fixture.treeA);
  host.applyPatches(patches);
  const canonicalHtml = host.serializeHTML();
  const endRender = performance.now();
  const targetHtml = serializeVDOMToCanonicalHTML(fixture.treeB);

  return {
    patches,
    nodesVisited: 2 * (fixture.nodeCountA + fixture.nodeCountB),
    patchesGenerated: patchCount,
    patchDigestSha256: await digestPatches(patches),
    canonicalHtml,
    canonicalHtmlHash: await hashText(canonicalHtml),
    targetHtmlHash: await hashText(targetHtml),
    domMutations: host.domMutations,
    boundaryCrossings: 1,
    phases: {
      computeMs: endCompute - startCompute,
      boundaryMs: endBoundary - startBoundary,
      renderMs: endRender - startRender,
    },
  };
}
