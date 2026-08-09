// Deterministic Virtualized DOM List Scrolling Engine (JS vs Wasm) — REAL DOM.
//
// Two honest halves, both measured:
//   1. Window computation  — JS (binary search over Float64 prefix sums) or
//      a REAL Wasm kernel (/artifacts/dom-virtualized-scrolling/dom_vscroll.wasm).
//   2. DOM application      — the computed visible window is applied to an
//      actual virtualized DOM list (createElement/appendChild/removeChild,
//      row recycling, spacer height) by the iframe DOM host. The Wasm arm
//      computes windows in linear memory; the DOM mutation is the shared
//      host work for both targets (documented honestly in the page).
//
// The frozen action trace (seeded 0x0badf00d, 1,800 actions) is unchanged, so
// the JS-vs-Wasm window math is exactly comparable with prior runs.

export const VSCROLL_ROW_COUNT = 100000;
export const VSCROLL_PREFIX_WASM_OFFSET = 0; // Float64[100001]
export const VSCROLL_ACTIONS_WASM_OFFSET = 0x100000; // u32 pairs
export const VSCROLL_RESULTS_WASM_OFFSET = 0x200000; // u32 triples

export function generateScrollActions() {
  const actions = [];
  let seed = 0x0badf00d;
  function rand() {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 1800; i++) {
    const isResize = rand() < 0.05;
    actions.push({
      type: isResize ? "resize" : "scroll",
      scrollTop: Math.floor(rand() * 2500000), // Scroll position up to ~2.5M px
      viewportHeight: isResize ? 400 + Math.floor(rand() * 600) : 600,
    });
  }
  return actions;
}

export function buildPrefixSums(rowCount = VSCROLL_ROW_COUNT) {
  const prefixSums = new Float64Array(rowCount + 1);
  prefixSums[0] = 0;
  for (let i = 0; i < rowCount; i++) {
    prefixSums[i + 1] = prefixSums[i] + (30 + ((i * 17) % 60));
  }
  return prefixSums;
}

/** JS window computation — returns { startIndex, endIndex, visibleCount }. */
export function computeWindowJS(prefixSums, scrollTop, viewportHeight) {
  const rowCount = prefixSums.length - 1;
  let low = 0, high = rowCount - 1, startIndex = 0;
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
  while (endIndex < rowCount && prefixSums[endIndex] < scrollBottom) {
    endIndex++;
  }
  return { startIndex, endIndex, visibleCount: Math.max(1, endIndex - startIndex) };
}

export function runVirtualizedScrollingJS(actions, prefixSums = buildPrefixSums()) {
  let totalVisibleItems = 0;
  let totalRecycled = 0;
  const windows = [];
  for (const action of actions) {
    const win = computeWindowJS(prefixSums, action.scrollTop, action.viewportHeight);
    windows.push(win);
    totalVisibleItems += win.visibleCount;
    totalRecycled += Math.max(0, win.visibleCount - 1);
  }
  return {
    actionsProcessed: actions.length,
    rowCount: VSCROLL_ROW_COUNT,
    totalVisibleItems,
    totalRecycled,
    totalHeightPx: prefixSums[VSCROLL_ROW_COUNT],
    windows,
  };
}

/** Fetch + instantiate the REAL Wasm kernel (linear memory, 4 MiB). */
export async function instantiateVscrollWasm() {
  const response = await fetch("/artifacts/dom-virtualized-scrolling/dom_vscroll.wasm", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`dom_vscroll.wasm fetch failed: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance;
}

/**
 * Wasm window computation — writes the prefix sums + actions into linear
 * memory, calls compute_windows, and returns per-action windows plus the
 * kernel's total. `instance` comes from instantiateVscrollWasm().
 */
export function runVirtualizedScrollingWasm(actions, instance) {
  const memory = new Uint8Array(instance.exports.memory.buffer);
  const prefix = new Float64Array(
    memory.buffer,
    VSCROLL_PREFIX_WASM_OFFSET,
    VSCROLL_ROW_COUNT + 1,
  );
  const actionsView = new Uint32Array(
    memory.buffer,
    VSCROLL_ACTIONS_WASM_OFFSET,
    actions.length * 2,
  );
  const resultsView = new Uint32Array(
    memory.buffer,
    VSCROLL_RESULTS_WASM_OFFSET,
    actions.length * 3,
  );

  prefix[0] = 0;
  for (let i = 0; i < VSCROLL_ROW_COUNT; i++) {
    prefix[i + 1] = prefix[i] + (30 + ((i * 17) % 60));
  }
  for (let i = 0; i < actions.length; i++) {
    actionsView[i * 2] = actions[i].scrollTop;
    actionsView[i * 2 + 1] = actions[i].viewportHeight;
  }

  const totalVisibleItems = instance.exports.compute_windows(
    VSCROLL_PREFIX_WASM_OFFSET,
    VSCROLL_ACTIONS_WASM_OFFSET,
    actions.length,
    VSCROLL_RESULTS_WASM_OFFSET,
  );

  const windows = [];
  let totalRecycled = 0;
  for (let i = 0; i < actions.length; i++) {
    const startIndex = resultsView[i * 3];
    const endIndex = resultsView[i * 3 + 1];
    const visibleCount = resultsView[i * 3 + 2];
    windows.push({ startIndex, endIndex, visibleCount });
    totalRecycled += Math.max(0, visibleCount - 1);
  }

  return {
    actionsProcessed: actions.length,
    rowCount: VSCROLL_ROW_COUNT,
    totalVisibleItems,
    totalRecycled,
    totalHeightPx: prefix[VSCROLL_ROW_COUNT],
    windows,
  };
}

// ── REAL DOM: a virtualized list the host drives with actual DOM APIs ───────

/**
 * Build a real virtualized list inside `container` (an iframe or page body):
 * a scroll viewport with a total-height spacer and an absolutely-positioned
 * row layer holding only the visible window of rows. Rows are recycled
 * (reused elements, data-index + text updated) as the window moves.
 */
export function buildVirtualizedList({ container, rowCount = VSCROLL_ROW_COUNT }) {
  const prefixSums = buildPrefixSums(rowCount);
  const totalHeightPx = prefixSums[rowCount];

  const viewport = document.createElement("div");
  viewport.dataset.wvjVlistViewport = "1";
  viewport.style.position = "relative";
  viewport.style.overflow = "hidden";
  viewport.style.height = "600px";
  viewport.style.width = "100%";
  viewport.style.background = "#0f0f12";
  viewport.style.border = "1px solid #555";

  const spacer = document.createElement("div");
  spacer.dataset.wvjVlistSpacer = "1";
  spacer.style.position = "absolute";
  spacer.style.top = "0";
  spacer.style.left = "0";
  spacer.style.width = "1px";
  spacer.style.height = `${totalHeightPx}px`;

  const rowLayer = document.createElement("div");
  rowLayer.dataset.wvjVlistRows = "1";
  rowLayer.style.position = "absolute";
  rowLayer.style.top = "0";
  rowLayer.style.left = "0";
  rowLayer.style.right = "0";

  viewport.append(spacer, rowLayer);
  container.append(viewport);

  const rendered = [];

  /**
   * Apply one frozen action to the real DOM: recycle the row layer so it
   * contains exactly `visibleCount` rows showing indices [startIndex, …),
   * positioned via the prefix sums. Returns { domOps, rowsRendered }.
   */
  function apply(action, win) {
    const { startIndex, visibleCount } = win;
    let domOps = 0;
    // Recycle: create missing rows, remove surplus, then update in place.
    while (rendered.length < visibleCount) {
      const row = document.createElement("div");
      row.dataset.wvjVlistRow = "1";
      row.style.position = "absolute";
      row.style.left = "0";
      row.style.right = "0";
      row.style.background = "rgba(140, 190, 255, 0.14)";
      row.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
      row.style.color = "#d8e2f2";
      row.style.font = "11px ui-monospace, monospace";
      row.style.padding = "4px 8px";
      row.style.boxSizing = "border-box";
      rowLayer.append(row);
      rendered.push(row);
      domOps += 1; // createElement + appendChild counted as the DOM write
    }
    while (rendered.length > visibleCount) {
      const row = rendered.pop();
      rowLayer.removeChild(row);
      domOps += 1;
    }
    for (let i = 0; i < rendered.length; i++) {
      const idx = startIndex + i;
      const row = rendered[i];
      row.textContent = `row ${idx} — height ${30 + ((idx * 17) % 60)}px`;
      row.dataset.index = String(idx);
      row.style.top = `${prefixSums[idx] - action.scrollTop}px`;
      domOps += 1;
    }
    return { domOps, rowsRendered: rendered.length };
  }

  function verifyFinal(win) {
    const rows = rowLayer.querySelectorAll("[data-wvj-vlist-row]");
    return {
      rowsRendered: rows.length,
      expectedVisible: win.visibleCount,
      firstIndex: rows.length ? Number(rows[0].dataset.index) : -1,
      expectedFirstIndex: win.startIndex,
      spacerHeight: spacer.style.height,
      ok: rows.length === win.visibleCount &&
        (rows.length === 0 || Number(rows[0].dataset.index) === win.startIndex),
    };
  }

  return { viewport, spacer, rowLayer, prefixSums, totalHeightPx, apply, verifyFinal };
}

/** One full trace pass over the real DOM. Returns timing + verification. */
export function runDomTraceOnce({
  actions,
  computeWindows, // () => windows[] — JS or Wasm backed, runs INSIDE the timed region
  container,
  build = buildVirtualizedList,
  keep = false, // keep the final list in the DOM (visible inspection after the run)
}) {
  const list = build({ container });
  const t0 = performance.now();
  const windows = computeWindows();
  let domOps = 0;
  for (let i = 0; i < actions.length; i++) {
    const applied = list.apply(actions[i], windows[i]);
    domOps += applied.domOps;
  }
  const lastWin = windows[windows.length - 1];
  const verified = list.verifyFinal(lastWin);
  const ms = performance.now() - t0;
  if (!keep) list.viewport.remove();
  return { ms, domOps, verified, list: keep ? list : null };
}
