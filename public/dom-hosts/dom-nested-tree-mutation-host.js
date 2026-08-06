// Real-DOM host for the DOM Nested-Tree Mutation workload (iframe orchestration).
//
// Renders the 500-node tree as real nested <ul>/<li> elements and applies the
// frozen 1,200-action mutation stream to them, mirroring the engine's guards
// exactly (insert only when the parent exists; remove only for existing
// nodes; move only between two existing distinct nodes; replace re-labels).
// The rendered node count is verified against a plain-data replay of the
// workload's intended semantics.

import { createModelDomHost } from "./dom-host-factory.js";

const INITIAL_NODES = 500;

export async function createTodomvcHost() {
  return createModelDomHost({
    slug: "dom-nested-tree-mutation",
    label: "DOM Nested-Tree Mutation Engine",
    loadEngine: () => import("/benchmarks/dom-nested-tree-mutation/engine.js"),
    generateActions: (engine) => engine.generateNestedTreeActions(),

    renderDom: () => {
      const root = document.createElement("div");
      root.id = "wvj-tree-host";
      root.className = "wvj-tree-app";
      const tree = document.createElement("ul");
      tree.id = "wvj-tree-root";
      root.append(tree);
      document.body.append(root);
      const nodes = new Map();
      const reset = () => {
        tree.replaceChildren();
        nodes.clear();
        for (let i = 0; i < INITIAL_NODES; i += 1) {
          const li = document.createElement("li");
          li.dataset.id = String(i);
          li.textContent = `node-${i}`;
          nodes.set(String(i), li);
          tree.append(li);
        }
      };
      reset();
      return { root, tree, nodes, reset };
    },

    applyAction: (dom, action) => {
      const { tree, nodes } = dom;
      if (action.op === "insert_child" && nodes.has(String(action.parentTargetId))) {
        const li = document.createElement("li");
        li.dataset.id = String(action.id);
        li.textContent = `node-${action.id}`;
        nodes.get(String(action.parentTargetId)).append(li);
        nodes.set(String(action.id), li);
      } else if (
        action.op === "remove_node" && action.targetNodeId > 0 &&
        nodes.has(String(action.targetNodeId))
      ) {
        nodes.get(String(action.targetNodeId)).remove();
        nodes.delete(String(action.targetNodeId));
      } else if (
        action.op === "move_subtree" && action.targetNodeId > 0 &&
        nodes.has(String(action.targetNodeId)) && nodes.has(String(action.parentTargetId)) &&
        action.targetNodeId !== action.parentTargetId
      ) {
        const el = nodes.get(String(action.targetNodeId));
        el.remove();
        nodes.get(String(action.parentTargetId)).append(el);
      } else if (action.op === "update_attr" && nodes.has(String(action.targetNodeId))) {
        nodes.get(String(action.targetNodeId)).setAttribute(action.attrName, action.attrValue);
      } else if (
        action.op === "replace_node" && action.targetNodeId > 0 &&
        nodes.has(String(action.targetNodeId))
      ) {
        const el = nodes.get(String(action.targetNodeId));
        el.textContent = `replaced-${action.targetNodeId}`;
        el.dataset.replaced = "true";
      }
    },

    computeReference: (actions) => {
      let nodeCount = INITIAL_NODES;
      const exists = new Set();
      for (let i = 0; i < INITIAL_NODES; i += 1) exists.add(String(i));
      for (const a of actions) {
        if (a.op === "insert_child" && exists.has(String(a.parentTargetId))) {
          exists.add(String(a.id));
          nodeCount += 1;
        } else if (
          a.op === "remove_node" && a.targetNodeId > 0 && exists.has(String(a.targetNodeId))
        ) {
          exists.delete(String(a.targetNodeId));
          nodeCount -= 1;
        }
      }
      return { nodeCount };
    },

    readDomState: (dom) => ({ nodeCount: dom.tree.querySelectorAll("li").length }),

    verifyDom: (state, reference) => {
      if (state.nodeCount !== reference.nodeCount) {
        throw new Error(
          `nested-tree DOM drift: ${state.nodeCount} nodes != reference ${reference.nodeCount}`,
        );
      }
    },

    runModel: (engine, actions, target) =>
      target === "wasm"
        ? engine.runNestedTreeMutationWasm(actions)
        : engine.runNestedTreeMutationJS(actions),
  });
}
