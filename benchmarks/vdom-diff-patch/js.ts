// Canonical VDOM diff, self-contained patch application, and host adapters.

import type { PatchOp, VDOMNode } from "./input.ts";
import { sha256Hex } from "../../lib/canonical.ts";

export interface VDOMRunResult {
  patches: PatchOp[];
  nodesVisited: number;
  patchesGenerated: number;
  patchDigestSha256: string;
  canonicalHtmlHash: string;
  appliedTreeHtmlHash: string;
}

const cloneNode = (node: VDOMNode): VDOMNode => ({ ...node, children: [...node.children] });

export function canonicalizePatches(patches: PatchOp[]): PatchOp[] {
  return patches.sort((a, b) => a.op - b.op || a.nodeId - b.nodeId || a.targetId - b.targetId);
}

export async function digestPatches(patches: PatchOp[]): Promise<string> {
  return await sha256Hex(new TextEncoder().encode(JSON.stringify(patches)));
}

export function createVDOMPatches(
  treeA: VDOMNode[],
  treeB: VDOMNode[],
): { patches: PatchOp[]; nodesVisited: number } {
  const patches: PatchOp[] = [];
  const mapA = new Map(treeA.map((node) => [node.id, node]));
  const mapB = new Map(treeB.map((node) => [node.id, node]));

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
        childIds: [...nodeB.children],
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
        childIds: [...nodeB.children],
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
  return { patches, nodesVisited: treeA.length + treeB.length };
}

export async function diffVDOMTrees(treeA: VDOMNode[], treeB: VDOMNode[]): Promise<VDOMRunResult> {
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

export function applyPatchesToVDOMTree(treeA: VDOMNode[], patches: PatchOp[]): VDOMNode[] {
  const map = new Map(treeA.map((node) => [node.id, cloneNode(node)]));
  // Materialize replacements/insertions before child lists reference them.
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
    } else if (patch.op === 6 && patch.childIds) node.children = [...patch.childIds];
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const TAG_NAMES = ["div", "span", "p", "ul", "li", "button", "input"];

export function serializeVDOMToCanonicalHTML(tree: VDOMNode[]): string {
  const map = new Map(tree.map((node) => [node.id, node]));
  const render = (id: number): string => {
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

interface MemoryElement {
  tag: string;
  attrs: Record<string, string>;
  children: number[];
  text?: string;
}

/** Non-browser oracle adapter. It models host mutations but is intentionally
 * separate from DOMHostAdapter, which performs real DOM API calls. */
export class MemoryHostAdapter {
  protected elementMap = new Map<number, MemoryElement>();
  public domMutations = 0;

  createTree(tree: VDOMNode[]): void {
    this.elementMap.clear();
    for (const node of tree) this.elementMap.set(node.id, this.fromNode(node));
  }

  applyPatches(patches: PatchOp[]): void {
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
      else if (patch.op === 6 && patch.childIds) element.children = [...patch.childIds];
      else continue;
      this.domMutations++;
    }
  }

  serializeHTML(): string {
    const render = (id: number): string => {
      const element = this.elementMap.get(id);
      if (!element) return "";
      if (element.tag === "text") return element.text ?? "";
      const attributes = Object.entries(element.attrs)
        .sort(([a], [b]) =>
          (a.startsWith("k") ? -1 : 1) - (b.startsWith("k") ? -1 : 1) || a.localeCompare(b)
        )
        .map(([key, value]) => ` ${key}="${value}"`).join("");
      const children = element.children.map(render).join("");
      return element.tag === "input"
        ? `<input${attributes}/>`
        : `<${element.tag}${attributes}>${children}</${element.tag}>`;
    };
    return render(0);
  }

  private fromNode(node: VDOMNode): MemoryElement {
    if (node.tag === -1) {
      return { tag: "text", attrs: {}, children: [], text: `text_${node.textId}` };
    }
    const attrs: Record<string, string> = {};
    if (node.attrKey >= 0) attrs[`k${node.attrKey}`] = `v${node.attrVal}`;
    if (node.key >= 0) attrs["data-key"] = `${node.key}`;
    return { tag: TAG_NAMES[node.tag] ?? "div", attrs, children: [...node.children] };
  }
}

interface HostNode {
  readonly nodeType: number;
  parentNode: {
    replaceChild(node: HostNode, prior: HostNode): void;
    removeChild(node: HostNode): void;
  } | null;
}
interface HostText extends HostNode {
  data: string;
}
interface HostElement extends HostNode {
  append(...nodes: HostNode[]): void;
  replaceChildren(...nodes: HostNode[]): void;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttributeNames(): string[];
}
interface HostDocument {
  createTextNode(text: string): HostText;
  createElement(tag: string): HostElement;
}

/** Browser host adapter. No benchmark compute runs here: this class translates
 * an already-produced self-contained patch script into real DOM mutations. */
export class DOMHostAdapter {
  private nodes = new Map<number, HostNode>();
  public domMutations = 0;

  constructor(private readonly document: HostDocument, private readonly mount: HostElement) {}

  createTree(tree: VDOMNode[]): void {
    this.nodes.clear();
    this.mount.replaceChildren();
    const byId = new Map(tree.map((node) => [node.id, node]));
    const create = (id: number): HostNode => {
      const node = byId.get(id)!;
      const host = this.createNode(node);
      this.nodes.set(id, host);
      if (host.nodeType === 1) {
        for (const child of node.children) (host as HostElement).append(create(child));
      }
      return host;
    };
    this.mount.append(create(0));
  }

  applyPatches(patches: PatchOp[]): void {
    for (const patch of patches) {
      if (patch.op !== 7 || !patch.node) continue;
      const replacement = this.createNode(patch.node);
      const prior = this.nodes.get(patch.nodeId);
      prior?.parentNode?.replaceChild(replacement, prior);
      this.nodes.set(patch.nodeId, replacement);
      this.domMutations++;
    }
    for (const patch of patches) {
      const host = this.nodes.get(patch.nodeId);
      if (patch.op === 7 || !host) continue;
      if (patch.op === 1 && host.nodeType === 3) {
        (host as HostText).data = `text_${patch.targetId}`;
      } else if (patch.op === 2 && host.nodeType === 1) {
        const element = host as HostElement;
        for (const name of element.getAttributeNames()) {
          if (name.startsWith("k")) element.removeAttribute(name);
        }
        element.setAttribute(`k${patch.attrKey}`, `v${patch.attrVal}`);
      } else if (patch.op === 3 && host.nodeType === 1) {
        (host as HostElement).removeAttribute(`k${patch.attrKey}`);
      } else if (patch.op === 5) {
        host.parentNode?.removeChild(host);
        this.nodes.delete(patch.nodeId);
      } else if (patch.op === 6 && host.nodeType === 1 && patch.childIds) {
        (host as HostElement).append(
          ...patch.childIds.map((id) => this.nodes.get(id)).filter((node): node is HostNode =>
            !!node
          ),
        );
      } else continue;
      this.domMutations++;
    }
  }

  private createNode(node: VDOMNode): HostNode {
    if (node.tag === -1) return this.document.createTextNode(`text_${node.textId}`);
    const host = this.document.createElement(TAG_NAMES[node.tag] ?? "div");
    if (node.attrKey >= 0) host.setAttribute(`k${node.attrKey}`, `v${node.attrVal}`);
    if (node.key >= 0) host.setAttribute("data-key", `${node.key}`);
    return host;
  }
}

// Compatibility name for callers that only need the no-browser oracle adapter.
export { MemoryHostAdapter as HostDOMAdapter };
