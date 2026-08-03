// benchmarks/vdom-diff-patch/input.ts
const SplitMix64 = class {
  state;
  constructor(seed) {
    this.state = seed;
  }
  nextUint32() {
    this.state = this.state + 0x9e3779b97f4a7c15n & 0xffffffffffffffffn;
    let z = this.state;
    z = (z ^ z >> 30n) * 0xbf58476d1ce4e5b9n & 0xffffffffffffffffn;
    z = (z ^ z >> 27n) * 0x94d049bb133111ebn & 0xffffffffffffffffn;
    return Number((z ^ z >> 31n) & 0xffffffffn) >>> 0;
  }
  nextIntRange(min, max) {
    const span = max - min + 1;
    return min + this.nextUint32() % span;
  }
};
const VDOM_SEED = 3976273958;
const VDOM_NODE_COUNT = 1e3;
function generateVDOMFixture(seed = VDOM_SEED, targetNodeCount = VDOM_NODE_COUNT) {
  const prng = new SplitMix64(BigInt(seed));
  const treeA = [];
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
  const depths = [
    0,
  ];
  while (currentId < targetNodeCount) {
    const parentId = Math.floor((currentId - 1) / 3);
    const isText = currentId > Math.ceil((targetNodeCount - 1) / 3) &&
      prng.nextIntRange(0, 4) === 0;
    const tag = isText ? -1 : prng.nextIntRange(0, 6);
    const key = prng.nextIntRange(0, 4) === 0 ? prng.nextIntRange(100, 999) : -1;
    const attrKey = isText ? -1 : prng.nextIntRange(0, 15);
    const attrVal = isText ? -1 : prng.nextIntRange(0, 50);
    const textId = isText ? prng.nextIntRange(0, 100) : -1;
    const node = {
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
  const treeB = JSON.parse(JSON.stringify(treeA));
  const shuffle = (items) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = prng.nextIntRange(0, i);
      [items[i], items[j]] = [
        items[j],
        items[i],
      ];
    }
    return items;
  };
  const reorderNodes = shuffle(treeB.filter((node) => node.children.length >= 2)).slice(0, 100);
  const attributeNodes = shuffle(treeB.filter((node) => node.tag !== -1)).slice(0, 100);
  const textNodes = shuffle(treeB.filter((node) => node.tag === -1)).slice(0, 50);
  if (reorderNodes.length !== 100 || attributeNodes.length !== 100 || textNodes.length !== 50) {
    throw new Error("VDOM fixture cannot satisfy the frozen 250-edit contract");
  }
  for (const node of reorderNodes) {
    const first = node.children.shift();
    node.children.push(first);
  }
  for (const node of attributeNodes) node.attrVal = (node.attrVal + 17) % 100;
  for (const node of textNodes) node.textId = (node.textId + 31) % 100;
  const patchCount = 250;
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
function flattenVDOMTree(nodes) {
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

// lib/canonical.ts
const encoder = new TextEncoder();
async function sha256Hex(value) {
  const source = typeof value === "string" ? encoder.encode(value) : value;
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [
    ...digest,
  ].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// benchmarks/vdom-diff-patch/js.ts
const cloneNode = (node) => ({
  ...node,
  children: [
    ...node.children,
  ],
});
function canonicalizePatches(patches) {
  return patches.sort((a, b) => a.op - b.op || a.nodeId - b.nodeId || a.targetId - b.targetId);
}
async function digestPatches(patches) {
  return await sha256Hex(new TextEncoder().encode(JSON.stringify(patches)));
}
function createVDOMPatches(treeA, treeB) {
  const patches = [];
  const mapA = new Map(treeA.map((node) => [
    node.id,
    node,
  ]));
  const mapB = new Map(treeB.map((node) => [
    node.id,
    node,
  ]));
  for (const nodeB of treeB) {
    const nodeA = mapA.get(nodeB.id);
    if (!nodeA || nodeA.tag !== nodeB.tag || nodeA.key !== nodeB.key) {
      patches.push({
        op: 7,
        nodeId: nodeB.id,
        targetId: nodeB.id,
        attrKey: nodeB.attrKey,
        attrVal: nodeB.attrVal,
        index: -1,
        childIds: [
          ...nodeB.children,
        ],
        node: cloneNode(nodeB),
      });
      continue;
    }
    if (nodeB.tag === -1) {
      if (nodeA.textId !== nodeB.textId) {
        patches.push({
          op: 1,
          nodeId: nodeB.id,
          targetId: nodeB.textId,
          attrKey: -1,
          attrVal: -1,
          index: -1,
        });
      }
      continue;
    }
    if (nodeA.attrKey !== nodeB.attrKey || nodeA.attrVal !== nodeB.attrVal) {
      patches.push(
        nodeB.attrKey < 0
          ? {
            op: 3,
            nodeId: nodeB.id,
            targetId: -1,
            attrKey: nodeA.attrKey,
            attrVal: -1,
            index: -1,
          }
          : {
            op: 2,
            nodeId: nodeB.id,
            targetId: -1,
            attrKey: nodeB.attrKey,
            attrVal: nodeB.attrVal,
            index: -1,
          },
      );
    }
    if (!arraysEqual(nodeA.children, nodeB.children)) {
      patches.push({
        op: 6,
        nodeId: nodeB.id,
        targetId: nodeB.children.length,
        attrKey: -1,
        attrVal: -1,
        index: nodeB.children.length,
        childIds: [
          ...nodeB.children,
        ],
      });
    }
  }
  for (const nodeA of treeA) {
    if (!mapB.has(nodeA.id)) {
      patches.push({
        op: 5,
        nodeId: nodeA.id,
        targetId: nodeA.id,
        attrKey: -1,
        attrVal: -1,
        index: -1,
      });
    }
  }
  canonicalizePatches(patches);
  return {
    patches,
    nodesVisited: 2 * (treeA.length + treeB.length),
  };
}
async function diffVDOMTrees(treeA, treeB) {
  const { patches, nodesVisited } = createVDOMPatches(treeA, treeB);
  const canonicalHtml = serializeVDOMToCanonicalHTML(treeB);
  const appliedHtml = serializeVDOMToCanonicalHTML(applyPatchesToVDOMTree(treeA, patches));
  return {
    patches,
    nodesVisited,
    patchesGenerated: patches.length,
    patchDigestSha256: await digestPatches(patches),
    canonicalHtmlHash: await sha256Hex(new TextEncoder().encode(canonicalHtml)),
    appliedTreeHtmlHash: await sha256Hex(new TextEncoder().encode(appliedHtml)),
  };
}
function applyPatchesToVDOMTree(treeA, patches) {
  const map = new Map(treeA.map((node) => [
    node.id,
    cloneNode(node),
  ]));
  for (const patch of patches) {
    if (patch.op === 7 && patch.node) map.set(patch.nodeId, cloneNode(patch.node));
  }
  for (const patch of patches) {
    if (patch.op === 5) {
      map.delete(patch.nodeId);
      continue;
    }
    const node = map.get(patch.nodeId);
    if (!node || patch.op === 7) continue;
    if (patch.op === 1) node.textId = patch.targetId;
    else if (patch.op === 2) {
      node.attrKey = patch.attrKey;
      node.attrVal = patch.attrVal;
    } else if (patch.op === 3) {
      node.attrKey = -1;
      node.attrVal = -1;
    } else if (patch.op === 6 && patch.childIds) {
      node.children = [
        ...patch.childIds,
      ];
    }
  }
  return [
    ...map.values(),
  ].sort((a, b) => a.id - b.id);
}
function arraysEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
const TAG_NAMES = [
  "div",
  "span",
  "p",
  "ul",
  "li",
  "button",
  "input",
];
function serializeVDOMToCanonicalHTML(tree) {
  const map = new Map(tree.map((node) => [
    node.id,
    node,
  ]));
  const render = (id) => {
    const node = map.get(id);
    if (!node) return "";
    if (node.tag === -1) return `text_${node.textId}`;
    const tag = TAG_NAMES[node.tag] ?? "div";
    let attributes = node.attrKey >= 0 ? ` k${node.attrKey}="v${node.attrVal}"` : "";
    if (node.key >= 0) attributes += ` data-key="${node.key}"`;
    const children = node.children.map(render).join("");
    return tag === "input" ? `<input${attributes}/>` : `<${tag}${attributes}>${children}</${tag}>`;
  };
  return render(0);
}
const MemoryHostAdapter = class {
  elementMap = /* @__PURE__ */ new Map();
  domMutations = 0;
  createTree(tree) {
    this.elementMap.clear();
    for (const node of tree) this.elementMap.set(node.id, this.fromNode(node));
  }
  applyPatches(patches) {
    for (const patch of patches) {
      if (patch.op === 7 && patch.node) {
        this.elementMap.set(patch.nodeId, this.fromNode(patch.node));
        this.domMutations++;
      }
    }
    for (const patch of patches) {
      if (patch.op === 7) continue;
      if (patch.op === 5) {
        this.elementMap.delete(patch.nodeId);
        this.domMutations++;
        continue;
      }
      const element = this.elementMap.get(patch.nodeId);
      if (!element) continue;
      if (patch.op === 1) element.text = `text_${patch.targetId}`;
      else if (patch.op === 2) {
        for (const key of Object.keys(element.attrs)) {
          if (key.startsWith("k")) delete element.attrs[key];
        }
        element.attrs[`k${patch.attrKey}`] = `v${patch.attrVal}`;
      } else if (patch.op === 3) delete element.attrs[`k${patch.attrKey}`];
      else if (patch.op === 6 && patch.childIds) {
        element.children = [
          ...patch.childIds,
        ];
      } else continue;
      this.domMutations++;
    }
  }
  serializeHTML() {
    const render = (id) => {
      const element = this.elementMap.get(id);
      if (!element) return "";
      if (element.tag === "text") return element.text ?? "";
      const attributes = Object.entries(element.attrs).sort(([a], [b]) =>
        (a.startsWith("k") ? -1 : 1) - (b.startsWith("k") ? -1 : 1) || a.localeCompare(b)
      ).map(([key, value]) => ` ${key}="${value}"`).join("");
      const children = element.children.map(render).join("");
      return element.tag === "input"
        ? `<input${attributes}/>`
        : `<${element.tag}${attributes}>${children}</${element.tag}>`;
    };
    return render(0);
  }
  fromNode(node) {
    if (node.tag === -1) {
      return {
        tag: "text",
        attrs: {},
        children: [],
        text: `text_${node.textId}`,
      };
    }
    const attrs = {};
    if (node.attrKey >= 0) attrs[`k${node.attrKey}`] = `v${node.attrVal}`;
    if (node.key >= 0) attrs["data-key"] = `${node.key}`;
    return {
      tag: TAG_NAMES[node.tag] ?? "div",
      attrs,
      children: [
        ...node.children,
      ],
    };
  }
};
const DOMHostAdapter = class {
  document;
  mount;
  nodes;
  domMutations;
  constructor(document, mount) {
    this.document = document;
    this.mount = mount;
    this.nodes = /* @__PURE__ */ new Map();
    this.domMutations = 0;
  }
  createTree(tree) {
    this.nodes.clear();
    this.mount.replaceChildren();
    const byId = new Map(tree.map((node) => [
      node.id,
      node,
    ]));
    const create = (id) => {
      const node = byId.get(id);
      const host = this.createNode(node);
      this.nodes.set(id, host);
      if (host.nodeType === 1) {
        for (const child of node.children) host.append(create(child));
      }
      return host;
    };
    this.mount.append(create(0));
  }
  applyPatches(patches) {
    const replacements = /* @__PURE__ */ new Map();
    const replacementPatches = patches.filter((patch) => patch.op === 7 && patch.node);
    for (const patch of replacementPatches) {
      replacements.set(patch.nodeId, this.createNode(patch.node));
    }
    const nestedReplacements = /* @__PURE__ */ new Set();
    for (const patch of replacementPatches) {
      const replacement = replacements.get(patch.nodeId);
      if (replacement.nodeType !== 1) continue;
      for (const childId of patch.node.children) {
        const child = replacements.get(childId) ?? this.nodes.get(childId);
        if (child) replacement.append(child);
        if (replacements.has(childId)) nestedReplacements.add(childId);
      }
    }
    for (const patch of replacementPatches) {
      const replacement = replacements.get(patch.nodeId);
      const prior = this.nodes.get(patch.nodeId);
      if (prior && !nestedReplacements.has(patch.nodeId)) {
        prior.parentNode?.replaceChild(replacement, prior);
      }
      this.nodes.set(patch.nodeId, replacement);
      this.domMutations++;
    }
    for (const patch of patches) {
      const host = this.nodes.get(patch.nodeId);
      if (patch.op === 7 || !host) continue;
      if (patch.op === 1 && host.nodeType === 3) {
        host.data = `text_${patch.targetId}`;
      } else if (patch.op === 2 && host.nodeType === 1) {
        const element = host;
        for (const name of element.getAttributeNames()) {
          if (name.startsWith("k")) element.removeAttribute(name);
        }
        element.setAttribute(`k${patch.attrKey}`, `v${patch.attrVal}`);
      } else if (patch.op === 3 && host.nodeType === 1) {
        host.removeAttribute(`k${patch.attrKey}`);
      } else if (patch.op === 5) {
        host.parentNode?.removeChild(host);
        this.nodes.delete(patch.nodeId);
      } else if (patch.op === 6 && host.nodeType === 1 && patch.childIds) {
        host.append(...patch.childIds.map((id) => this.nodes.get(id)).filter((node) => !!node));
      } else continue;
      this.domMutations++;
    }
  }
  createNode(node) {
    if (node.tag === -1) return this.document.createTextNode(`text_${node.textId}`);
    const host = this.document.createElement(TAG_NAMES[node.tag] ?? "div");
    if (node.attrKey >= 0) host.setAttribute(`k${node.attrKey}`, `v${node.attrVal}`);
    if (node.key >= 0) host.setAttribute("data-key", `${node.key}`);
    return host;
  }
};

// benchmarks/vdom-diff-patch/workload.js
const hashText = (text) => sha256Hex(new TextEncoder().encode(text));
async function runVdomJS(fixture) {
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
async function runVdomWasm(fixture, wasmInstance) {
  const memory = wasmInstance.exports.memory;
  const diff = wasmInstance.exports.diff_vdom_flat;
  if (!(memory instanceof WebAssembly.Memory) || typeof diff !== "function") {
    throw new Error("VDOM Wasm exports are incomplete");
  }
  const bytes = new Uint8Array(memory.buffer);
  const treeAPtr = 1024;
  const treeBPtr = treeAPtr + fixture.flatA.byteLength + 7 & ~7;
  const outPtr = treeBPtr + fixture.flatB.byteLength + 7 & ~7;
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
export {
  applyPatchesToVDOMTree,
  diffVDOMTrees,
  DOMHostAdapter,
  generateVDOMFixture,
  MemoryHostAdapter,
  MemoryHostAdapter as HostDOMAdapter,
  runVdomJS,
  runVdomWasm,
  serializeVDOMToCanonicalHTML,
};
