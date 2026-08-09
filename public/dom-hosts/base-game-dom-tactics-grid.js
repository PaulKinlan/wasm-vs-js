// Real-DOM tactics-grid host for the iframe orchestration bridge.
//
// Runs the frozen tactics-grid model (JS or the REAL Wasm kernel
// /artifacts/game-v2-controlled-family/game-family.wasm), then renders the
// model's own visual contract — a 12×8 grid with per-turn selected/focused
// highlights plus turn/initiative/objectives — using real DOM APIs
// (createElement/classList/textContent/data attributes) for all 60 turns,
// and requires the rendered DOM's final state to match the model's final
// visual state exactly.
//
// Bridge contract: createTodomvcHost() export.

import { runGameJavaScript, runGameWasm } from "/benchmarks/v2/game-family/engine.js";

const WORKLOAD = "game-dom-tactics-grid";
const TACTICS_ID = "game.dom-tactics-grid.v1";
const WASM_URL = "/artifacts/game-v2-controlled-family/game-family.wasm";
const VISUAL_COLS = 12;
const VISUAL_ROWS = 8;

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function statsFor(runs) {
  const sorted = [...runs].sort((a, b) => a - b);
  return {
    coldMs: runs[0],
    warmMedianMs: median(runs),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  };
}

async function fetchWasm() {
  const response = await fetch(WASM_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`game-family.wasm fetch failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}

/** Build the real 12×8 DOM grid + status bar per the model's visual contract. */
export function buildTacticsGridDom({ container }) {
  const wrap = document.createElement("div");
  wrap.dataset.wvjTacticsGrid = "1";
  wrap.style.font = "11px ui-monospace, monospace";
  wrap.style.color = "#d8e2f2";

  const grid = document.createElement("div");
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "Tactics grid visual");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${VISUAL_COLS}, 28px)`;
  grid.style.gridTemplateRows = `repeat(${VISUAL_ROWS}, 28px)`;
  grid.style.gap = "1px";
  grid.style.border = "1px solid #555";
  grid.style.background = "#101015";
  grid.style.padding = "2px";

  const cells = [];
  for (let i = 0; i < VISUAL_COLS * VISUAL_ROWS; i++) {
    const cell = document.createElement("div");
    cell.dataset.wvjTacticsCell = "1";
    cell.dataset.cell = String(i);
    cell.style.width = "28px";
    cell.style.height = "28px";
    cell.style.boxSizing = "border-box";
    cell.style.border = "1px solid rgba(255,255,255,0.08)";
    cell.style.display = "flex";
    cell.style.alignItems = "center";
    cell.style.justifyContent = "center";
    cell.style.background = "rgba(120,160,220,0.10)";
    grid.append(cell);
    cells.push(cell);
  }
  wrap.append(grid);

  const status = document.createElement("div");
  status.dataset.wvjTacticsStatus = "1";
  status.style.marginTop = "6px";
  status.style.color = "#9ab";
  wrap.append(status);
  container.append(wrap);

  function applyTurn(state, domOpsRef) {
    // real DOM state updates for one turn (separate selected/focused flags)
    for (const cell of cells) {
      if (cell.dataset.selected || cell.dataset.focused) {
        delete cell.dataset.selected;
        delete cell.dataset.focused;
        cell.style.background = "rgba(120,160,220,0.10)";
        domOpsRef.n += 1;
      }
    }
    const selected = cells[state.selected % cells.length];
    selected.dataset.selected = "true";
    selected.style.background = "rgba(255, 200, 80, 0.55)";
    domOpsRef.n += 1;
    const focused = cells[state.focused % cells.length];
    focused.dataset.focused = "true";
    focused.style.background = focused === selected
      ? "rgba(255, 220, 120, 0.75)"
      : "rgba(120, 230, 140, 0.45)";
    domOpsRef.n += 1;
    status.textContent = `turn ${state.turn} · initiative ${state.initiative} · ` +
      `objectives ${state.objectives[0]}/${
        state.objectives[1]
      } · selected ${state.selected} · focused ${state.focused}`;
    domOpsRef.n += 1;
  }

  function verifyFinal(finalVisual) {
    const selected = cells.find((c) => c.dataset.selected === "true");
    const focused = cells.find((c) => c.dataset.focused === "true");
    let ok = true;
    let firstBad = "";
    if (!selected || Number(selected.dataset.cell) !== finalVisual.selected % cells.length) {
      ok = false;
      firstBad = `selected cell: dom=${selected?.dataset.cell} model=${
        finalVisual.selected % cells.length
      }`;
    }
    if (ok && (!focused || Number(focused.dataset.cell) !== finalVisual.focused % cells.length)) {
      ok = false;
      firstBad = `focused cell: dom=${focused?.dataset.cell} model=${
        finalVisual.focused % cells.length
      }`;
    }
    if (ok && !status.textContent.includes(`turn ${finalVisual.turn}`)) {
      ok = false;
      firstBad = `status turn mismatch: ${status.textContent}`;
    }
    return { ok, firstBad, cells: cells.length };
  }

  return { wrap, applyTurn, verifyFinal };
}

export function createTodomvcHost() {
  return {
    run: async ({ iterations = 30, targets = ["js", "wasm"], onProgress = () => {} }) => {
      const section = document.createElement("section");
      section.id = "wvj-todomvc-host";
      section.setAttribute("data-wvj-dom-host", WORKLOAD);
      section.style.margin = "16px 0";
      section.style.padding = "12px";
      section.style.border = "1px solid #666";
      section.style.borderRadius = "6px";
      section.style.background = "#101014";
      const heading = document.createElement("h2");
      heading.textContent = "Real DOM tactics grid (under test — frozen 60-turn visual contract)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "The model (JS or the REAL Wasm kernel) advances 128 units over 60 turns of " +
        "move/attack/pathfinding; this host renders the model's visual contract with " +
        "real DOM APIs (createElement/classList/textContent) and requires the rendered " +
        "final state to match the model's final visual state exactly.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjTacticsContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmExports = targets.includes("wasm") ? await fetchWasm() : null;

      const measuredPass = (target, { keep = false } = {}) => {
        const dom = buildTacticsGridDom({ container });
        const t0 = performance.now();
        const result = target === "wasm"
          ? runGameWasm(TACTICS_ID, wasmExports)
          : runGameJavaScript(TACTICS_ID);
        const replay = result.replay;
        const ops = { n: 0 };
        for (const state of replay) dom.applyTurn(state, ops);
        const finalVisual = result.visual;
        const verified = dom.verifyFinal(finalVisual);
        const ms = performance.now() - t0;
        if (!keep) dom.wrap.remove();
        return { ms, verified, domOps: ops.n };
      };

      const perTarget = {};
      for (const target of targets) {
        await measuredPass(target);
        const runs = [];
        for (let iteration = 1; iteration <= iterations; iteration++) {
          const isLast = iteration === iterations && target === targets[targets.length - 1];
          const { ms, verified } = await measuredPass(target, { keep: isLast });
          if (!verified.ok) {
            throw new Error(`real-DOM verification failed (${target}): ${verified.firstBad}`);
          }
          runs.push(ms);
          onProgress({ target, iteration, total: iterations });
        }
        perTarget[target] = statsFor(runs);
      }

      return { perTarget, detail: { workload: WORKLOAD, iterations, turns: 60 } };
    },
  };
}
