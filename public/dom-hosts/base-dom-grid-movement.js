// Real-DOM grid-movement host for the iframe orchestration bridge.
//
// Renders a REAL 64×64 DOM grid with 128 entity cells and applies the frozen
// 3,600-action move trace with real DOM APIs (style.left/top + textContent),
// measuring the full journey per target:
//   - "js"   : model computed in JS (runGridMovementJSSteps)
//   - "wasm" : model computed by the REAL Wasm kernel
//             (/artifacts/dom-grid-movement/dom_grid.wasm)
// The DOM application is the shared host work for both targets; the measured
// iteration includes the model run + the real DOM mutation.
//
// Bridge contract: createTodomvcHost() must be exported (shared validator).

import {
  generateGridActions,
  GRID_ENTITIES,
  instantiateGridWasm,
  runGridDomTraceOnce,
  runGridMovementJSSteps,
  runGridMovementWasm,
} from "/benchmarks/dom-grid-movement/engine.js";

const WORKLOAD = "dom-grid-movement";

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
      const actions = generateGridActions();

      const section = document.createElement("section");
      section.id = "wvj-todomvc-host";
      section.setAttribute("data-wvj-dom-host", WORKLOAD);
      section.style.margin = "16px 0";
      section.style.padding = "12px";
      section.style.border = "1px solid #666";
      section.style.borderRadius = "6px";
      section.style.background = "#101014";
      const heading = document.createElement("h2");
      heading.textContent = "Real DOM grid (under test — frozen 3,600-move entity trace)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent = `${GRID_ENTITIES} entities on a 64×64 grid · every move updates a real ` +
        "entity cell (style.left/top + textContent) with real DOM APIs.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjGridContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm") ? await instantiateGridWasm() : null;

      const measuredPass = async (target, { keep = false } = {}) => {
        if (target === "wasm") {
          const computeSteps = () => {
            const r = runGridMovementWasm(actions, wasmInstance);
            return { steps: r.steps, entities: r.entities };
          };
          return await runGridDomTraceOnce({ actions, computeSteps, container, keep });
        }
        const computeSteps = () => {
          const r = runGridMovementJSSteps(actions);
          return { steps: r.steps, entities: r.entities };
        };
        return await runGridDomTraceOnce({ actions, computeSteps, container, keep });
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
