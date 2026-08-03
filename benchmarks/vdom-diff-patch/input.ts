// Deterministic Virtual DOM Tree Generator and Fixture Producer
// Seed: 0xVDOM2026 (3989831718) using SplitMix64 PRNG

export interface VDOMNode {
  id: number;
  tag: number; // -1 for text node, 0: div, 1: span, 2: p, 3: ul, 4: li, 5: button, 6: input
  key: number; // -1 if unkeyed
  attrKey: number; // -1 if none
  attrVal: number; // -1 if none
  textId: number; // -1 if element
  children: number[];
}

export interface PatchOp {
  op: number; // 1: SET_TEXT, 2: SET_ATTR, 3: REMOVE_ATTR, 4: INSERT_CHILD, 5: REMOVE_CHILD, 6: REORDER_CHILDREN, 7: REPLACE_NODE
  nodeId: number;
  targetId: number;
  attrKey: number;
  attrVal: number;
  index: number;
  childIds?: number[];
  node?: VDOMNode;
}

export interface VDOMFixture {
  seed: number;
  nodeCountA: number;
  nodeCountB: number;
  treeA: VDOMNode[];
  treeB: VDOMNode[];
  flatA: Uint8Array;
  flatB: Uint8Array;
  expectedPatchCount: number;
}

class SplitMix64 {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = seed;
  }

  nextUint32(): number {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return Number((z ^ (z >> 31n)) & 0xffffffffn) >>> 0;
  }

  nextIntRange(min: number, max: number): number {
    const span = max - min + 1;
    return min + (this.nextUint32() % span);
  }
}

export const VDOM_SEED = 0xed012026;
export const VDOM_NODE_COUNT = 1000;

export function generateVDOMFixture(
  seed = VDOM_SEED,
  targetNodeCount = VDOM_NODE_COUNT,
): VDOMFixture {
  const prng = new SplitMix64(BigInt(seed));
  const treeA: VDOMNode[] = [];

  // Create root node (id: 0, tag: div)
  treeA.push({
    id: 0,
    tag: 0,
    key: -1,
    attrKey: 0,
    attrVal: 1,
    textId: -1,
    children: [],
  });

  let currentId = 1;
  const depths = [0];

  while (currentId < targetNodeCount) {
    // A deterministic ternary breadth-first shape guarantees depth <= 6 for
    // the frozen 1,000-node fixture while leaving node content seed-driven.
    const parentId = Math.floor((currentId - 1) / 3);
    const isText = currentId > Math.ceil((targetNodeCount - 1) / 3) &&
      prng.nextIntRange(0, 4) === 0; // leaf-only text nodes; enough for 50 distinct edits
    const tag = isText ? -1 : prng.nextIntRange(0, 6);
    const key = prng.nextIntRange(0, 4) === 0 ? prng.nextIntRange(100, 999) : -1; // 25% keyed
    const attrKey = isText ? -1 : prng.nextIntRange(0, 15);
    const attrVal = isText ? -1 : prng.nextIntRange(0, 50);
    const textId = isText ? prng.nextIntRange(0, 100) : -1;

    const node: VDOMNode = {
      id: currentId,
      tag,
      key,
      attrKey,
      attrVal,
      textId,
      children: [],
    };

    treeA.push(node);
    treeA[parentId].children.push(currentId);

    depths[currentId] = depths[parentId] + 1;
    currentId += 1;
  }

  // Deep clone treeA to create treeB
  const treeB: VDOMNode[] = JSON.parse(JSON.stringify(treeA));

  const shuffle = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = prng.nextIntRange(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  // Apply exactly 250 effective, non-collapsing edits: 100 distinct reorders,
  // 100 distinct attribute changes, and 50 distinct text changes.
  const reorderNodes = shuffle(treeB.filter((node) => node.children.length >= 2)).slice(0, 100);
  const attributeNodes = shuffle(treeB.filter((node) => node.tag !== -1)).slice(0, 100);
  const textNodes = shuffle(treeB.filter((node) => node.tag === -1)).slice(0, 50);
  if (reorderNodes.length !== 100 || attributeNodes.length !== 100 || textNodes.length !== 50) {
    throw new Error("VDOM fixture cannot satisfy the frozen 250-edit contract");
  }
  for (const node of reorderNodes) {
    const first = node.children.shift()!;
    node.children.push(first);
  }
  for (const node of attributeNodes) node.attrVal = (node.attrVal + 17) % 100;
  for (const node of textNodes) node.textId = (node.textId + 31) % 100;
  const patchCount = 250;

  // Serialize to Flat Array representation for Wasm
  const flatA = flattenVDOMTree(treeA);
  const flatB = flattenVDOMTree(treeB);

  return {
    seed,
    nodeCountA: treeA.length,
    nodeCountB: treeB.length,
    treeA,
    treeB,
    flatA,
    flatB,
    expectedPatchCount: patchCount,
  };
}

export function flattenVDOMTree(nodes: VDOMNode[]): Uint8Array {
  // Fixed size per node: 16 bytes
  // Header: 4 bytes (nodeCount u32)
  // Node table: nodeCount * 16 bytes
  // Child array table: u16 array
  let childTotal = 0;
  for (const n of nodes) {
    childTotal += n.children.length;
  }

  const buffer = new ArrayBuffer(4 + nodes.length * 16 + childTotal * 2);
  const view = new DataView(buffer);
  view.setUint32(0, nodes.length, true);

  let nodeOffset = 4;
  let childBufferOffset = 4 + nodes.length * 16;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    view.setUint16(nodeOffset + 0, n.id, true);
    view.setInt16(nodeOffset + 2, n.tag, true);
    view.setInt16(nodeOffset + 4, n.key, true);
    view.setInt16(nodeOffset + 6, n.attrKey, true);
    view.setInt16(nodeOffset + 8, n.attrVal, true);
    view.setInt16(nodeOffset + 10, n.textId, true);
    view.setUint16(nodeOffset + 12, n.children.length, true);
    view.setUint16(nodeOffset + 14, (childBufferOffset - (4 + nodes.length * 16)) / 2, true);

    for (let c = 0; c < n.children.length; c++) {
      view.setUint16(childBufferOffset, n.children[c], true);
      childBufferOffset += 2;
    }

    nodeOffset += 16;
  }

  return new Uint8Array(buffer);
}
