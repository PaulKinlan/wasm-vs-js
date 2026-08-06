// Real-DOM host for the DOM Virtualized-Scrolling workload (iframe orchestration).
//
// Renders a real scroll container with a virtualized row window and applies
// the frozen 1,800-action scroll/resize stream to it, mirroring the engine's
// variable row heights + binary-search window computation exactly (same
// seeded heights and prefix sums). The rendered visible-item counter is
// verified against a plain-data replay of the workload's intended semantics.

import { createModelDomHost } from "./dom-host-factory.js";

const ROW_COUNT = 100000;
const VIEWPORT = 400;

function buildPrefixSums() {
  const prefixSums = new Float64Array(ROW_COUNT + 1);
  prefixSums[0] = 0;
  for (let i = 0; i < ROW_COUNT; i += 1) {
    prefixSums[i + 1] = prefixSums[i] + (30 + ((i * 17) % 60));
  }
  return prefixSums;
}

function visibleWindow(prefixSums, scrollTop, viewportHeight) {
  let low = 0, high = ROW_COUNT - 1, startIndex = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (prefixSums[mid] <= scrollTop) {
      startIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  let endIndex = startIndex;
  const scrollBottom = scrollTop + viewportHeight;
  while (endIndex < ROW_COUNT && prefixSums[endIndex] < scrollBottom) {
    endIndex += 1;
  }
  return { startIndex, endIndex, visibleCount: Math.max(1, endIndex - startIndex) };
}

export async function createTodomvcHost() {
  return createModelDomHost({
    slug: "dom-virtualized-scrolling",
    label: "DOM Virtualized-Scrolling Engine",
    loadEngine: () => import("/benchmarks/dom-virtualized-scrolling/engine.js"),
    generateActions: (engine) => engine.generateScrollActions(),

    renderDom: () => {
      const prefixSums = buildPrefixSums();
      const root = document.createElement("div");
      root.id = "wvj-scroll-host";
      root.className = "wvj-scroll-app";
      const scroller = document.createElement("div");
      scroller.id = "wvj-scroller";
      scroller.style.overflow = "auto";
      scroller.style.height = `${VIEWPORT}px`;
      scroller.style.position = "relative";
      const spacer = document.createElement("div");
      spacer.id = "wvj-spacer";
      spacer.style.height = `${prefixSums[ROW_COUNT]}px`;
      const windowEl = document.createElement("div");
      windowEl.id = "wvj-scroll-window";
      windowEl.style.position = "absolute";
      windowEl.style.top = "0";
      windowEl.style.width = "100%";
      scroller.append(spacer, windowEl);
      root.append(scroller);
      document.body.append(root);
      const state = { visibleItems: 0, recycled: 0 };
      const reset = () => {
        scroller.scrollTop = 0;
        windowEl.replaceChildren();
        state.visibleItems = 0;
        state.recycled = 0;
      };
      reset();
      return { root, scroller, windowEl, prefixSums, state, reset };
    },

    applyAction: (dom, action) => {
      const { windowEl, prefixSums, state } = dom;
      const scrollTop = action.type === "resize" ? 0 : action.scrollTop;
      const viewportHeight = action.viewportHeight ?? VIEWPORT;
      const { startIndex, endIndex, visibleCount } = visibleWindow(prefixSums, scrollTop, viewportHeight);
      const keep = new Set();
      for (let i = startIndex; i < endIndex; i += 1) keep.add(i);
      for (const row of [...windowEl.children]) {
        const idx = Number(row.dataset.index);
        if (!keep.has(idx)) {
          row.remove();
          state.recycled += 1;
        }
      }
      const current = new Set([...windowEl.children].map((row) => Number(row.dataset.index)));
      for (let i = startIndex; i < endIndex; i += 1) {
        if (!current.has(i)) {
          const row = document.createElement("div");
          row.className = "wvj-row";
          row.dataset.index = String(i);
          row.style.height = `${30 + ((i * 17) % 60)}px`;
          windowEl.append(row);
        }
      }
      state.visibleItems += visibleCount;
    },

    computeReference: (actions) => {
      const prefixSums = buildPrefixSums();
      let visibleItems = 0;
      for (const a of actions) {
        const scrollTop = a.type === "resize" ? 0 : a.scrollTop;
        const viewportHeight = a.viewportHeight ?? VIEWPORT;
        visibleItems += visibleWindow(prefixSums, scrollTop, viewportHeight).visibleCount;
      }
      return { visibleItems };
    },

    readDomState: (dom) => ({ visibleItems: dom.state.visibleItems }),

    verifyDom: (state, reference) => {
      if (state.visibleItems !== reference.visibleItems) {
        throw new Error(
          `virtualized DOM drift: visibleItems ${state.visibleItems} != reference ${reference.visibleItems}`,
        );
      }
    },

    runModel: (engine, actions, target) =>
      target === "wasm" ? engine.runVirtualizedScrollingWasm(actions) : engine.runVirtualizedScrollingJS(actions),
  });
}
