// Real-DOM host for the DOM Keyed-List Mutation workload (iframe orchestration).
//
// Renders the 1,000-item list as real <li> elements and applies the frozen
// 2,000-action mutation stream to them, mirroring the engine's semantics
// exactly (modulo-index swap, modulo-target move, key-based insert/remove/
// update). The rendered item count + key sum are verified against a plain-data
// replay of the workload's intended semantics.

import { createModelDomHost } from "./dom-host-factory.js";

const INITIAL_ITEMS = 1000;

export function createTodomvcHost() {
  return createModelDomHost({
    slug: "dom-keyed-list-mutation",
    label: "DOM Keyed-List Mutation Engine",
    loadEngine: () => import("../benchmarks/dom-keyed-list-mutation/engine.js"),
    generateActions: (engine) => engine.generateKeyedListActions(),

    renderDom: () => {
      const root = document.createElement("div");
      root.id = "wvj-keyedlist-host";
      root.className = "wvj-keyedlist-app";
      const list = document.createElement("ul");
      list.id = "wvj-keyed-list";
      root.append(list);
      document.body.append(root);
      const items = [];
      const reset = () => {
        list.replaceChildren();
        items.length = 0;
        for (let i = 0; i < INITIAL_ITEMS; i += 1) {
          const li = document.createElement("li");
          li.dataset.key = String(i);
          li.textContent = `Item ${i}`;
          list.append(li);
          items.push(li);
        }
      };
      reset();
      return { root, list, items, reset };
    },

    applyAction: (dom, action) => {
      const { list, items } = dom;
      if (action.op === "insert") {
        const li = document.createElement("li");
        li.dataset.key = String(action.key);
        li.textContent = action.text;
        list.append(li);
        items.push(li);
      } else if (action.op === "remove") {
        const idx = items.findIndex((li) => li.dataset.key === String(action.key));
        if (idx !== -1) {
          items[idx].remove();
          items.splice(idx, 1);
        }
      } else if (action.op === "swap" && items.length >= 2) {
        const idx1 = action.key % items.length;
        const idx2 = action.targetKey % items.length;
        const a = items[idx1];
        const b = items[idx2];
        if (idx1 !== idx2) {
          list.insertBefore(b, a);
          list.insertBefore(a, b.nextSibling ?? null);
          items[idx1] = b;
          items[idx2] = a;
        }
      } else if (action.op === "update") {
        const idx = items.findIndex((li) => li.dataset.key === String(action.key));
        if (idx !== -1) items[idx].textContent = action.text;
      } else if (action.op === "move" && items.length >= 2) {
        const idx = items.findIndex((li) => li.dataset.key === String(action.key));
        if (idx !== -1) {
          const [moved] = items.splice(idx, 1);
          moved.remove();
          const targetIdx = action.targetKey % items.length;
          items.splice(targetIdx, 0, moved);
          const ref = items[targetIdx + 1] ?? null;
          list.insertBefore(moved, ref);
        }
      }
    },

    computeReference: (actions) => {
      const keys = [];
      for (let i = 0; i < INITIAL_ITEMS; i += 1) keys.push(i);
      for (const a of actions) {
        if (a.op === "insert") keys.push(a.key);
        else if (a.op === "remove") {
          const idx = keys.indexOf(a.key);
          if (idx !== -1) keys.splice(idx, 1);
        } else if (a.op === "swap" && keys.length >= 2) {
          const i1 = a.key % keys.length;
          const i2 = a.targetKey % keys.length;
          const t = keys[i1];
          keys[i1] = keys[i2];
          keys[i2] = t;
        } else if (a.op === "move" && keys.length >= 2) {
          const idx = keys.indexOf(a.key);
          if (idx !== -1) {
            const [moved] = keys.splice(idx, 1);
            const targetIdx = a.targetKey % keys.length;
            keys.splice(targetIdx, 0, moved);
          }
        }
      }
      return { count: keys.length, keySum: keys.reduce((acc, k) => acc + k, 0) };
    },

    readDomState: (dom) => {
      const keys = dom.items.map((li) => Number(li.dataset.key));
      return { count: keys.length, keySum: keys.reduce((acc, k) => acc + k, 0) };
    },

    verifyDom: (state, reference) => {
      if (state.count !== reference.count) {
        throw new Error(
          `keyed-list DOM drift: ${state.count} items != reference ${reference.count}`,
        );
      }
      if (state.keySum !== reference.keySum) {
        throw new Error(
          `keyed-list DOM drift: keySum ${state.keySum} != reference ${reference.keySum}`,
        );
      }
    },

    runModel: (engine, actions, target) =>
      target === "wasm"
        ? engine.runKeyedListMutationWasm(actions)
        : engine.runKeyedListMutationJS(actions),
  });
}
