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
