// Virtual DOM Diff, Patch Application & Host DOM Adapter (JS Controlled)

import { PatchOp, VDOMNode } from "./input.ts";
import { sha256Hex } from "../../lib/canonical.ts";

export interface VDOMRunResult {
  patches: PatchOp[];
  nodesVisited: number;
  patchesGenerated: number;
  patchDigestSha256: string;
  canonicalHtmlHash: string;
  appliedTreeHtmlHash: string;
}

export async function diffVDOMTrees(
  treeA: VDOMNode[],
  treeB: VDOMNode[],
): Promise<VDOMRunResult> {
  const patches: PatchOp[] = [];
  let nodesVisited = 0;

  const nodeMapA = new Map<number, VDOMNode>();
  for (const n of treeA) {
    nodeMapA.set(n.id, n);
  }

  for (const nodeB of treeB) {
    nodesVisited++;
    const nodeA = nodeMapA.get(nodeB.id);

    if (!nodeA) {
      patches.push({
        op: 7, // REPLACE_NODE
        nodeId: nodeB.id,
        targetId: nodeB.id,
        attrKey: nodeB.attrKey,
        attrVal: nodeB.attrVal,
        index: -1,
      });
      continue;
    }

    // Compare text node content
    if (nodeA.tag === -1 && nodeB.tag === -1) {
      if (nodeA.textId !== nodeB.textId) {
        patches.push({
          op: 1, // SET_TEXT
          nodeId: nodeB.id,
          targetId: nodeB.textId,
          attrKey: -1,
          attrVal: -1,
          index: -1,
        });
      }
      continue;
    }

    // Compare attributes
    if (nodeA.attrKey !== nodeB.attrKey || nodeA.attrVal !== nodeB.attrVal) {
      if (nodeB.attrKey === -1 && nodeA.attrKey !== -1) {
        patches.push({
          op: 3, // REMOVE_ATTR
          nodeId: nodeB.id,
          targetId: -1,
          attrKey: nodeA.attrKey,
          attrVal: -1,
          index: -1,
        });
      } else {
        patches.push({
          op: 2, // SET_ATTR
          nodeId: nodeB.id,
          targetId: -1,
          attrKey: nodeB.attrKey,
          attrVal: nodeB.attrVal,
          index: -1,
        });
      }
    }

    // Compare children lists (reordering)
    if (!arraysEqual(nodeA.children, nodeB.children)) {
      patches.push({
        op: 6, // REORDER_CHILDREN
        nodeId: nodeB.id,
        targetId: nodeB.children.length,
        attrKey: -1,
        attrVal: -1,
        index: nodeB.children.length,
      });
    }
  }

  // Deterministic patch sorting: op type, then nodeId
  patches.sort((a, b) => {
    if (a.op !== b.op) return a.op - b.op;
    return a.nodeId - b.nodeId;
  });

  const encoder = new TextEncoder();
  const patchDigestSha256 = await sha256Hex(
    encoder.encode(JSON.stringify(patches)),
  );

  const canonicalHtml = serializeVDOMToCanonicalHTML(treeB);

  // Apply patches to Tree A clone to produce Tree B'
  const treeBPrime = applyPatchesToVDOMTree(treeA, patches, treeB);
  const appliedHtml = serializeVDOMToCanonicalHTML(treeBPrime);
  const appliedTreeHtmlHash = await sha256Hex(encoder.encode(appliedHtml));
  const canonicalHtmlHash = await sha256Hex(encoder.encode(canonicalHtml));

  return {
    patches,
    nodesVisited,
    patchesGenerated: patches.length,
    patchDigestSha256,
    canonicalHtmlHash,
    appliedTreeHtmlHash,
  };
}

export function applyPatchesToVDOMTree(
  treeA: VDOMNode[],
  patches: PatchOp[],
  targetTreeB: VDOMNode[],
): VDOMNode[] {
  // Deep clone tree A
  const tree: VDOMNode[] = JSON.parse(JSON.stringify(treeA));
  const nodeMap = new Map<number, VDOMNode>();
  for (const n of tree) nodeMap.set(n.id, n);

  const targetMap = new Map<number, VDOMNode>();
  for (const n of targetTreeB) targetMap.set(n.id, n);

  for (const patch of patches) {
    const node = nodeMap.get(patch.nodeId);
    if (!node) continue;

    switch (patch.op) {
      case 1: // SET_TEXT
        node.textId = patch.targetId;
        break;
      case 2: // SET_ATTR
        node.attrKey = patch.attrKey;
        node.attrVal = patch.attrVal;
        break;
      case 3: // REMOVE_ATTR
        node.attrKey = -1;
        node.attrVal = -1;
        break;
      case 6: { // REORDER_CHILDREN
        const targetNode = targetMap.get(patch.nodeId);
        if (targetNode) {
          node.children = [...targetNode.children];
        }
        break;
      }
    }
  }

  return tree;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const TAG_NAMES = ["div", "span", "p", "ul", "li", "button", "input"];

export function serializeVDOMToCanonicalHTML(tree: VDOMNode[]): string {
  const nodeMap = new Map<number, VDOMNode>();
  for (const n of tree) {
    nodeMap.set(n.id, n);
  }

  function renderNode(id: number): string {
    const node = nodeMap.get(id);
    if (!node) return "";

    if (node.tag === -1) {
      return `text_${node.textId}`;
    }

    const tagName = TAG_NAMES[node.tag] || "div";
    let attrStr = "";
    if (node.attrKey >= 0) {
      attrStr = ` k${node.attrKey}="v${node.attrVal}"`;
    }
    if (node.key >= 0) {
      attrStr += ` data-key="${node.key}"`;
    }

    const childHtml = node.children.map(renderNode).join("");

    if (tagName === "input") {
      return `<input${attrStr}/>`;
    }

    return `<${tagName}${attrStr}>${childHtml}</${tagName}>`;
  }

  return renderNode(0);
}

// Host DOM Element Adapter
export class HostDOMAdapter {
  private elementMap = new Map<
    number,
    { tag: string; attrs: Record<string, string>; children: number[]; text?: string }
  >();

  public createTree(tree: VDOMNode[]) {
    for (const node of tree) {
      if (node.tag === -1) {
        this.elementMap.set(node.id, {
          tag: "text",
          attrs: {},
          children: [],
          text: `text_${node.textId}`,
        });
      } else {
        const tag = TAG_NAMES[node.tag] || "div";
        const attrs: Record<string, string> = {};
        if (node.attrKey >= 0) attrs[`k${node.attrKey}`] = `v${node.attrVal}`;
        if (node.key >= 0) attrs["data-key"] = `${node.key}`;
        this.elementMap.set(node.id, { tag, attrs, children: [...node.children] });
      }
    }
  }

  public applyPatches(patches: PatchOp[], targetTreeB: VDOMNode[]) {
    const targetMap = new Map<number, VDOMNode>();
    for (const n of targetTreeB) targetMap.set(n.id, n);

    for (const patch of patches) {
      const el = this.elementMap.get(patch.nodeId);
      if (!el) continue;

      if (patch.op === 1) {
        el.text = `text_${patch.targetId}`;
      } else if (patch.op === 2) {
        el.attrs[`k${patch.attrKey}`] = `v${patch.attrVal}`;
      } else if (patch.op === 3) {
        delete el.attrs[`k${patch.attrKey}`];
      } else if (patch.op === 6) {
        const targetNode = targetMap.get(patch.nodeId);
        if (targetNode) {
          el.children = [...targetNode.children];
        }
      }
    }
  }

  public serializeHTML(): string {
    const render = (id: number): string => {
      const el = this.elementMap.get(id);
      if (!el) return "";
      if (el.tag === "text") return el.text || "";

      let attrStr = "";
      for (const [k, v] of Object.entries(el.attrs)) {
        attrStr += ` ${k}="${v}"`;
      }
      const childrenHtml = el.children.map(render).join("");
      if (el.tag === "input") return `<input${attrStr}/>`;
      return `<${el.tag}${attrStr}>${childrenHtml}</${el.tag}>`;
    };

    return render(0);
  }
}
