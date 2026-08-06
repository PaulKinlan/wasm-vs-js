// Real-DOM host for the DOM Grid Movement workload (iframe orchestration).
//
// Renders the 64×64 entity grid as real DOM elements and applies the frozen
// 3,600-action directional stream to them (entity moves + collision marks),
// while the JS vs wasm-linear engines compute the equivalent model. The
// rendered positions are verified against the workload's intended semantics
// (a plain-data replay); engine-variant divergence, if any, is surfaced in
// the result detail rather than hidden.

import { createModelDomHost } from "./dom-host-factory.js";

const GRID_W = 64;
const ENTITIES = 128;

function directionDelta(dir) {
  switch (dir) {
    case "up": return { dx: 0, dy: -1 };
    case "down": return { dx: 0, dy: 1 };
    case "left": return { dx: -1, dy: 0 };
    case "right": return { dx: 1, dy: 0 };
    default: return { dx: 0, dy: 0 };
  }
}

export async function createTodomvcHost() {
  return createModelDomHost({
    slug: "dom-grid-movement",
    label: "DOM Grid Movement Engine",
    loadEngine: () => import("/benchmarks/dom-grid-movement/engine.js"),
    generateActions: (engine) => engine.generateGridActions(),

    renderDom: () => {
      const root = document.createElement("div");
      root.id = "wvj-grid-host";
      root.className = "wvj-grid-app";
      root.style.position = "relative";
      root.style.width = "640px";
      root.style.height = "640px";
      const cells = [];
      for (let i = 0; i < ENTITIES; i += 1) {
        const cell = document.createElement("div");
        cell.className = "wvj-entity";
        cell.dataset.id = String(i);
        cell.style.position = "absolute";
        cell.style.width = "8px";
        cell.style.height = "8px";
        cell.style.background = "#36c";
        root.append(cell);
        cells.push(cell);
      }
      document.body.append(root);
      const reset = () => {
        for (let i = 0; i < ENTITIES; i += 1) {
          const x = (i * 3) % GRID_W;
          const y = Math.floor((i * 3) / GRID_W);
          const cell = cells[i];
          cell.style.left = `${x * 10}px`;
          cell.style.top = `${y * 10}px`;
          cell.classList.remove("wvj-collision");
        }
      };
      reset();
      return { root, cells, reset };
    },

    applyAction: (dom, action) => {
      const { cells } = dom;
      const entity = cells[action.entityId];
      const { dx, dy } = directionDelta(action.dir);
      const left = parseInt(entity.style.left, 10);
      const top = parseInt(entity.style.top, 10);
      const nx = Math.max(0, Math.min(GRID_W - 1, left / 10 + dx)) * 10;
      const ny = Math.max(0, Math.min(GRID_W - 1, top / 10 + dy)) * 10;
      let occupied = false;
      for (let j = 0; j < cells.length; j += 1) {
        if (j !== action.entityId && cells[j].style.left === `${nx}px` && cells[j].style.top === `${ny}px`) {
          occupied = true;
          break;
        }
      }
      if (occupied) {
        entity.classList.add("wvj-collision");
      } else {
        entity.style.left = `${nx}px`;
        entity.style.top = `${ny}px`;
      }
    },

    computeReference: (actions) => {
      const pos = new Array(ENTITIES).fill(0).map((_, i) => [(i * 3) % GRID_W, Math.floor((i * 3) / GRID_W)]);
      for (const a of actions) {
        const e = pos[a.entityId];
        const { dx, dy } = directionDelta(a.dir);
        const nx = Math.max(0, Math.min(GRID_W - 1, e[0] + dx));
        const ny = Math.max(0, Math.min(GRID_W - 1, e[1] + dy));
        const occupied = pos.some((p, j) => j !== a.entityId && p[0] === nx && p[1] === ny);
        if (!occupied) { e[0] = nx; e[1] = ny; }
      }
      return { posSum: pos.reduce((acc, p) => acc + p[0] + p[1] * GRID_W, 0) };
    },

    readDomState: (dom) => {
      let posSum = 0;
      for (const cell of dom.cells) {
        posSum += parseInt(cell.style.left, 10) / 10 + (parseInt(cell.style.top, 10) / 10) * GRID_W;
      }
      return { posSum };
    },

    verifyDom: (state, reference) => {
      if (state.posSum !== reference.posSum) {
        throw new Error(`grid DOM drift: rendered posSum ${state.posSum} != reference ${reference.posSum}`);
      }
    },

    runModel: (engine, actions, target) =>
      target === "wasm" ? engine.runGridMovementWasm(actions) : engine.runGridMovementJS(actions),
  });
}
