// Virtual DOM Diff & DOM Mutation Implementation (JS Controlled)

import { PatchOp, VDOMNode } from "./input.ts";

export interface VDOMRunResult {
  patches: PatchOp[];
  nodesVisited: number;
  patchesGenerated: number;
  canonicalHtmlHash: string;
}

export function diffVDOMTrees(treeA: VDOMNode[], treeB: VDOMNode[]): VDOMRunResult {
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
      patches.push({
        op: 2, // SET_ATTR
        nodeId: nodeB.id,
        targetId: -1,
        attrKey: nodeB.attrKey,
        attrVal: nodeB.attrVal,
        index: -1,
      });
    }

    // Compare children lists
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

  // Sort patches deterministically (removals before insertions, by node ID)
  patches.sort((a, b) => {
    if (a.op !== b.op) return a.op - b.op;
    return a.nodeId - b.nodeId;
  });

  const canonicalHtml = serializeVDOMToCanonicalHTML(treeB);

  return {
    patches,
    nodesVisited,
    patchesGenerated: patches.length,
    canonicalHtmlHash: canonicalHtml,
  };
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
