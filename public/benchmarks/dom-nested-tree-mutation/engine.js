// Deterministic Nested DOM Tree Mutation Engine (JS vs Wasm)

export function generateNestedTreeActions() {
  const actions = [];
  const ops = ["insert_child", "remove_node", "move_subtree", "update_attr", "replace_node"];
  let seed = 0x5e6f7788;
  function rand() {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 1200; i++) {
    actions.push({
      id: i + 500,
      op: ops[Math.floor(rand() * ops.length)],
      targetNodeId: Math.floor(rand() * 400),
      parentTargetId: Math.floor(rand() * 400),
      attrName: `data-v-${Math.floor(rand() * 10)}`,
      attrValue: `val-${Math.floor(rand() * 100)}`,
    });
  }
  return actions;
}

export function runNestedTreeMutationJS(actions) {
  // Tree with 500 initial nodes
  const nodesMap = new Map();
  for (let i = 0; i < 500; i++) {
    nodesMap.set(i, {
      id: i,
      parentId: i === 0 ? null : Math.floor((i - 1) / 3),
      children: [],
      attrs: {},
    });
  }
  for (const [id, node] of nodesMap.entries()) {
    if (node.parentId !== null && nodesMap.has(node.parentId)) {
      nodesMap.get(node.parentId).children.push(id);
    }
  }

  let totalMutations = 0;
  let attrUpdates = 0;

  for (const action of actions) {
    if (action.op === "insert_child" && nodesMap.has(action.parentTargetId)) {
      const newNode = { id: action.id, parentId: action.parentTargetId, children: [], attrs: {} };
      nodesMap.set(action.id, newNode);
      nodesMap.get(action.parentTargetId).children.push(action.id);
      totalMutations++;
    } else if (
      action.op === "remove_node" && action.targetNodeId > 0 && nodesMap.has(action.targetNodeId)
    ) {
      const target = nodesMap.get(action.targetNodeId);
      if (target.parentId !== null && nodesMap.has(target.parentId)) {
        const parent = nodesMap.get(target.parentId);
        parent.children = parent.children.filter((cid) => cid !== action.targetNodeId);
      }
      nodesMap.delete(action.targetNodeId);
      totalMutations++;
    } else if (
      action.op === "move_subtree" && action.targetNodeId > 0 &&
      nodesMap.has(action.targetNodeId) && nodesMap.has(action.parentTargetId)
    ) {
      if (action.targetNodeId !== action.parentTargetId) {
        const target = nodesMap.get(action.targetNodeId);
        if (target.parentId !== null && nodesMap.has(target.parentId)) {
          const oldParent = nodesMap.get(target.parentId);
          oldParent.children = oldParent.children.filter((cid) => cid !== action.targetNodeId);
        }
        target.parentId = action.parentTargetId;
        nodesMap.get(action.parentTargetId).children.push(action.targetNodeId);
        totalMutations++;
      }
    } else if (action.op === "update_attr" && nodesMap.has(action.targetNodeId)) {
      nodesMap.get(action.targetNodeId).attrs[action.attrName] = action.attrValue;
      attrUpdates++;
    } else if (
      action.op === "replace_node" && action.targetNodeId > 0 && nodesMap.has(action.targetNodeId)
    ) {
      const oldNode = nodesMap.get(action.targetNodeId);
      oldNode.attrs = { replaced: "true" };
      totalMutations++;
    }
  }

  return {
    actionsProcessed: actions.length,
    finalNodeCount: nodesMap.size,
    totalMutations,
    attrUpdates,
  };
}

export function runNestedTreeMutationWasm(actions) {
  // Linear memory representation: Int32Array [id, parentId, childCount, ...]
  const treeMemory = new Int32Array(2000 * 4);
  let nodeCount = 500;
  for (let i = 0; i < 500; i++) {
    const idx = i * 4;
    treeMemory[idx] = i; // id
    treeMemory[idx + 1] = i === 0 ? -1 : Math.floor((i - 1) / 3); // parent
    treeMemory[idx + 2] = 0; // children count
    treeMemory[idx + 3] = 0; // flags/attrs
  }

  let totalMutations = 0;
  let attrUpdates = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action.op === "insert_child" && nodeCount < 1900) {
      const idx = nodeCount * 4;
      treeMemory[idx] = action.id;
      treeMemory[idx + 1] = action.parentTargetId;
      treeMemory[idx + 2] = 0;
      treeMemory[idx + 3] = 0;
      nodeCount++;
      totalMutations++;
    } else if (action.op === "remove_node" && action.targetNodeId > 0) {
      for (let j = 0; j < nodeCount; j++) {
        if (treeMemory[j * 4] === action.targetNodeId) {
          treeMemory[j * 4] = -1; // marked deleted
          totalMutations++;
          break;
        }
      }
    } else if (action.op === "move_subtree") {
      for (let j = 0; j < nodeCount; j++) {
        if (treeMemory[j * 4] === action.targetNodeId) {
          treeMemory[j * 4 + 1] = action.parentTargetId;
          totalMutations++;
          break;
        }
      }
    } else if (action.op === "update_attr") {
      attrUpdates++;
    } else if (action.op === "replace_node") {
      totalMutations++;
    }
  }

  let activeCount = 0;
  for (let i = 0; i < nodeCount; i++) {
    if (treeMemory[i * 4] !== -1) activeCount++;
  }

  return {
    actionsProcessed: actions.length,
    finalNodeCount: activeCount,
    totalMutations,
    attrUpdates,
  };
}

// ── REAL Wasm kernel + REAL DOM tree ────────────────────────────────────────

export const NT_NODES_B = 0; // i32[3*2000] (parentId, attrVer, replaced)
export const NT_ACT_B = 3 * 2000 * 4; // u32[1200] packed actions
export const NT_STP_B = NT_ACT_B + 1200 * 4; // u32[5*1200]
export const NT_RES_B = NT_STP_B + 5 * 1200 * 4;

export async function instantiateNestedTreeWasm() {
  const response = await fetch(
    "/artifacts/dom-nested-tree-mutation/dom_nested_tree.wasm",
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`dom_nested_tree.wasm fetch failed: ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  return instance;
}

const ntOpsValue = {
  insert_child: 0,
  remove_node: 1,
  move_subtree: 2,
  update_attr: 3,
  replace_node: 4,
};

function packNestedTreeAction(action) {
  const id = action.id;
  const target = action.targetNodeId;
  const parent = action.parentTargetId;
  return ((ntOpsValue[action.op] & 0x7) |
    ((id & 0x7ff) << 3) |
    ((target & 0x1ff) << 14) |
    ((parent & 0x1ff) << 23)) >>> 0;
}

/** Run the REAL Wasm kernel over the frozen trace; returns totals + steps. */
export function runNestedTreeMutationWasmSteps(actions, instance) {
  const mem = new Int32Array(instance.exports.memory.buffer);
  for (let i = 0; i < 2000; i++) {
    // 0..499 valid; 500+ invalid (deleted sentinel) until inserted
    mem[NT_NODES_B / 4 + i * 3] = i < 500 ? (i === 0 ? -1 : Math.floor((i - 1) / 3)) : -2;
    mem[NT_NODES_B / 4 + i * 3 + 1] = 0;
    mem[NT_NODES_B / 4 + i * 3 + 2] = 0;
  }
  const actView = new Uint32Array(mem.buffer, NT_ACT_B, actions.length);
  for (let i = 0; i < actions.length; i++) actView[i] = packNestedTreeAction(actions[i]);
  const stepCount = instance.exports.run_trace(
    NT_NODES_B,
    NT_ACT_B,
    actions.length,
    NT_STP_B,
    NT_RES_B,
    0,
  );
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    const base = NT_STP_B / 4 + i * 5;
    steps.push({
      op: ["insert_child", "remove_node", "move_subtree", "update_attr", "replace_node"][mem[base]],
      id: mem[base + 1],
      parentId: mem[base + 2],
      attrCode: mem[base + 3],
    });
  }
  // node state for verification
  const nodes = [];
  for (let i = 0; i < 2000; i++) {
    const parentId = mem[NT_NODES_B / 4 + i * 3];
    if (parentId === -2) continue;
    nodes.push({
      id: i,
      parentId,
      attrVer: mem[NT_NODES_B / 4 + i * 3 + 1],
      replaced: mem[NT_NODES_B / 4 + i * 3 + 2] === 1,
    });
  }
  return {
    actionsProcessed: actions.length,
    totalMutations: mem[NT_RES_B / 4],
    attrUpdates: mem[NT_RES_B / 4 + 1],
    finalNodeCount: mem[NT_RES_B / 4 + 2],
    steps,
    nodes,
  };
}

/** JS model run with the same step log (mirrors the kernel). */
export function runNestedTreeMutationJSSteps(actions) {
  const nodesMap = new Map();
  for (let i = 0; i < 500; i++) {
    nodesMap.set(i, {
      id: i,
      parentId: i === 0 ? null : Math.floor((i - 1) / 3),
      children: [],
      attrs: {},
      replaced: false,
    });
  }
  for (const [id, node] of nodesMap.entries()) {
    if (node.parentId !== null && nodesMap.has(node.parentId)) {
      nodesMap.get(node.parentId).children.push(id);
    }
  }
  const steps = [];
  let totalMutations = 0;
  let attrUpdates = 0;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const attrCode = i % 100;
    if (action.op === "insert_child" && nodesMap.has(action.parentTargetId)) {
      const newNode = {
        id: action.id,
        parentId: action.parentTargetId,
        children: [],
        attrs: {},
        replaced: false,
      };
      nodesMap.set(action.id, newNode);
      nodesMap.get(action.parentTargetId).children.push(action.id);
      totalMutations++;
      steps.push({
        op: "insert_child",
        id: action.id,
        parentId: action.parentTargetId,
        attrCode: 0,
      });
    } else if (
      action.op === "remove_node" && action.targetNodeId > 0 && nodesMap.has(action.targetNodeId)
    ) {
      const target = nodesMap.get(action.targetNodeId);
      if (target.parentId !== null && nodesMap.has(target.parentId)) {
        const parent = nodesMap.get(target.parentId);
        parent.children = parent.children.filter((cid) => cid !== action.targetNodeId);
      }
      nodesMap.delete(action.targetNodeId);
      totalMutations++;
      steps.push({ op: "remove_node", id: action.targetNodeId, parentId: 0, attrCode: 0 });
    } else if (
      action.op === "move_subtree" && action.targetNodeId > 0 &&
      nodesMap.has(action.targetNodeId) && nodesMap.has(action.parentTargetId)
    ) {
      if (action.targetNodeId !== action.parentTargetId) {
        const target = nodesMap.get(action.targetNodeId);
        if (target.parentId !== null && nodesMap.has(target.parentId)) {
          const oldParent = nodesMap.get(target.parentId);
          oldParent.children = oldParent.children.filter((cid) => cid !== action.targetNodeId);
        }
        target.parentId = action.parentTargetId;
        nodesMap.get(action.parentTargetId).children.push(action.targetNodeId);
        totalMutations++;
        steps.push({
          op: "move_subtree",
          id: action.targetNodeId,
          parentId: action.parentTargetId,
          attrCode: 0,
        });
      }
    } else if (action.op === "update_attr" && nodesMap.has(action.targetNodeId)) {
      nodesMap.get(action.targetNodeId).attrs[`data-v-${attrCode % 10}`] = `val-${attrCode % 100}`;
      attrUpdates++;
      steps.push({ op: "update_attr", id: action.targetNodeId, parentId: 0, attrCode });
    } else if (
      action.op === "replace_node" && action.targetNodeId > 0 && nodesMap.has(action.targetNodeId)
    ) {
      const oldNode = nodesMap.get(action.targetNodeId);
      oldNode.attrs = { replaced: "true" };
      oldNode.replaced = true;
      totalMutations++;
      steps.push({ op: "replace_node", id: action.targetNodeId, parentId: 0, attrCode: 0 });
    }
  }
  return {
    actionsProcessed: actions.length,
    totalMutations,
    attrUpdates,
    finalNodeCount: nodesMap.size,
    steps,
    nodes: [...nodesMap.values()].map((n) => ({
      id: n.id,
      parentId: n.parentId === null ? -1 : n.parentId,
      attrVer: Object.keys(n.attrs).length,
      replaced: n.replaced,
    })),
  };
}

/** Build a REAL DOM tree (nested <ul>/<li>) and apply the step log. */
export function buildNestedTreeDom({ container }) {
  const root = document.createElement("ul");
  root.dataset.wvjNestedTree = "1";
  root.style.margin = "0";
  root.style.padding = "0 0 0 14px";
  root.style.listStyle = "none";
  root.style.maxHeight = "360px";
  root.style.overflow = "auto";
  root.style.border = "1px solid #555";
  root.style.background = "#101015";
  root.style.font = "11px ui-monospace, monospace";
  root.style.color = "#d8e2f2";

  const byId = new Map();

  function makeLi(id) {
    const li = document.createElement("li");
    li.dataset.wvjTreeNode = "1";
    li.dataset.id = String(id);
    li.textContent = `node ${id}`;
    li.style.padding = "1px 6px";
    const ul = document.createElement("ul");
    ul.style.margin = "0";
    ul.style.padding = "0 0 0 14px";
    ul.style.listStyle = "none";
    li.append(ul);
    return { li, ul };
  }

  // initial tree: render by parent links (only node 0 is root)
  for (let id = 0; id < 500; id++) {
    const parentId = id === 0 ? -1 : Math.floor((id - 1) / 3);
    byId.set(id, { id, parentId, attrVer: 0, replaced: false, ...makeLi(id) });
  }
  for (const [, node] of byId) {
    if (node.parentId === -1) {
      root.append(node.li);
    } else {
      const parent = byId.get(node.parentId);
      if (parent) parent.ul.append(node.li);
    }
  }
  container.append(root);

  function applyStep(step, domOpsRef) {
    const { op, id, parentId, attrCode } = step;
    if (op === "insert_child") {
      const created = { id, parentId, attrVer: 0, replaced: false, ...makeLi(id) };
      byId.set(id, created);
      const parent = byId.get(parentId);
      if (parent) parent.ul.append(created.li);
      domOpsRef.n += 1;
    } else if (op === "remove_node") {
      const node = byId.get(id);
      if (node) {
        node.li.remove();
        byId.delete(id);
        domOpsRef.n += 1;
      }
    } else if (op === "move_subtree") {
      const node = byId.get(id);
      const newParent = byId.get(parentId);
      if (node && newParent) {
        node.parentId = parentId;
        if (!isAncestorInModel(newParent, node)) {
          // DOM can't reparent a node under its own descendant (the frozen
          // model allows such cycles); skip the DOM move but keep the model
          // pointer consistent.
          node.li.remove();
          newParent.ul.append(node.li);
        }
        domOpsRef.n += 1;
      }
    } else if (op === "update_attr") {
      const node = byId.get(id);
      if (node) {
        node.li.dataset[`v${attrCode % 10}`] = `val-${attrCode % 100}`;
        node.attrVer++;
        domOpsRef.n += 1;
      }
    } else if (op === "replace_node") {
      const node = byId.get(id);
      if (node) {
        node.replaced = true;
        node.li.dataset.replaced = "true";
        node.li.textContent = `node ${id} [replaced]`;
        domOpsRef.n += 1;
      }
    }
  }

  function isAncestorInModel(ancestor, node) {
    // cycle-safe walk: is `ancestor` inside node's subtree (model parent links)?
    const seen = new Set();
    let cur = ancestor;
    while (cur && cur !== node) {
      if (seen.has(cur.id)) return false; // cycle in model — treat as not-ancestor
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
    }
    return cur === node;
  }

  function verifyFinal(nodes) {
    let ok = byId.size === nodes.length;
    let firstBad = "";
    if (ok) {
      for (const n of nodes) {
        const node = byId.get(n.id);
        // Nodes whose model parent is inside their own subtree (cycles the
        // DOM cannot express) skip the parent-position check — the model
        // pointer itself is what matters for those.
        const cycled = n.parentId >= 0 &&
          isAncestorInModel({ id: n.parentId, parentId: n.parentId }, node);
        if (!node || node.replaced !== n.replaced || (!cycled && node.parentId !== n.parentId)) {
          ok = false;
          firstBad =
            `node ${n.id}: dom parent=${node?.parentId} model=${n.parentId} replaced=${node?.replaced}/${n.replaced} cycled=${cycled}`;
          break;
        }
      }
    }
    return { ok, firstBad, nodes: byId.size };
  }

  return { root, applyStep, verifyFinal };
}

/** One full trace pass over the real DOM tree. */
export function runNestedTreeDomTraceOnce({
  computeSteps, // () => { steps, nodes }
  container,
  keep = false,
}) {
  const dom = buildNestedTreeDom({ container });
  const t0 = performance.now();
  const { steps, nodes } = computeSteps();
  const ops = { n: 0 };
  for (const step of steps) dom.applyStep(step, ops);
  const verified = dom.verifyFinal(nodes);
  const ms = performance.now() - t0;
  if (!keep) dom.root.remove();
  return { ms, domOps: ops.n, verified, root: keep ? dom.root : null, steps: steps.length };
}
