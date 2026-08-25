// Real-DOM table-sort host for the iframe orchestration bridge.
// Renders a REAL <table> (5,000 rows of data, 50-row page) and applies the
// frozen 120-action trace (sort/filter/paginate/edit_cell) with real DOM
// APIs (tbody rebuild via createElement/appendChild, cell textContent),
// per target: "js" vs "wasm" (REAL kernel with per-step page slices).

import {
  generateTableActions,
  instantiateTableSortWasm,
  runTableSortDomTraceOnce,
  runTableSortJSSteps,
  runTableSortWasmSteps,
} from "/benchmarks/dom-table-sort-filter-pagination/engine.js";

const WORKLOAD = "dom-table-sort-filter-pagination";

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function statsFor(runs) {
  if (!runs || runs.length === 0) return null;
  const sorted = [...runs].sort((a, b) => a - b);
  return {
    coldMs: runs[0],
    warmMedianMs: median(runs),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    // The parent computes confidence intervals from these; a median alone
    // cannot say whether a difference was measured or observed once.
    samples: sorted,
  };
}

export function createTodomvcHost() {
  return {
    run: async ({ iterations = 30, targets = ["js", "wasm"], onProgress = () => {} }) => {
      const actions = generateTableActions();

      const section = document.createElement("section");
      section.id = "wvj-todomvc-host";
      section.setAttribute("data-wvj-dom-host", WORKLOAD);
      section.style.margin = "16px 0";
      section.style.padding = "12px";
      section.style.border = "1px solid #666";
      section.style.borderRadius = "6px";
      section.style.background = "#101014";
      const heading = document.createElement("h2");
      heading.textContent =
        "Real DOM table (under test — frozen 120-op sort/filter/paginate/edit trace)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "5,000 rows, 50-row page · every order change rebuilds the tbody with real " +
        "DOM APIs; cell edits update td textContent.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjTableContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm") ? await instantiateTableSortWasm() : null;

      const measuredPass = async (target, { keep = false } = {}) => {
        if (target === "wasm") {
          return await runTableSortDomTraceOnce({
            actions,
            computeSteps: () => runTableSortWasmSteps(actions, wasmInstance),
            container,
            keep,
          });
        }
        return await runTableSortDomTraceOnce({
          actions,
          computeSteps: () => runTableSortJSSteps(actions),
          container,
          keep,
        });
      };

      const perTarget = {};
      for (const target of targets) {
        await measuredPass(target);
        const runs = [];
        for (let iteration = 1; iteration <= iterations; iteration++) {
          const isLast = iteration === iterations && target === targets[targets.length - 1];
          const { ms, verified } = await measuredPass(target, { keep: isLast });
          if (!verified.ok) {
            throw new Error(
              `real-DOM verification failed (${target}): ${JSON.stringify(verified)}`,
            );
          }
          runs.push(ms);
          onProgress({ target, iteration, total: iterations });
        }
        perTarget[target] = statsFor(runs);
      }

      return { perTarget, detail: { workload: WORKLOAD, iterations, actions: actions.length } };
    },
  };
}
