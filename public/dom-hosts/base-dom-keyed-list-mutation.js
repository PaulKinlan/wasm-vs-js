// Real-DOM keyed-list host for the iframe orchestration bridge.
//
// Renders a REAL keyed DOM list (1,000 initial <li> nodes) and applies the
// frozen 2,000-action mutation trace with real DOM APIs (appendChild,
// removeChild, insertBefore, textContent), measuring the full journey per
// target: "js" (model in JS) vs "wasm" (REAL Wasm kernel).

import {
  generateKeyedListActions,
  instantiateKeyedListWasm,
  runKeyedListDomTraceOnce,
  runKeyedListMutationJSSteps,
  runKeyedListMutationWasmSteps,
} from "/benchmarks/dom-keyed-list-mutation/engine.js";

const WORKLOAD = "dom-keyed-list-mutation";

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
      const actions = generateKeyedListActions();

      const section = document.createElement("section");
      section.id = "wvj-todomvc-host";
      section.setAttribute("data-wvj-dom-host", WORKLOAD);
      section.style.margin = "16px 0";
      section.style.padding = "12px";
      section.style.border = "1px solid #666";
      section.style.borderRadius = "6px";
      section.style.background = "#101014";
      const heading = document.createElement("h2");
      heading.textContent = "Real DOM keyed list (under test — frozen 2,000-op mutation trace)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "1,000 keyed <li> nodes · insert/remove/swap/update/move applied with real " +
        "DOM APIs (appendChild/removeChild/insertBefore/textContent).";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjKeyedContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm") ? await instantiateKeyedListWasm() : null;

      const measuredPass = async (target, { keep = false } = {}) => {
        if (target === "wasm") {
          const computeSteps = () => {
            const r = runKeyedListMutationWasmSteps(actions, wasmInstance);
            return { steps: r.steps, items: r.items };
          };
          return await runKeyedListDomTraceOnce({ actions, computeSteps, container, keep });
        }
        const computeSteps = () => {
          const r = runKeyedListMutationJSSteps(actions);
          return { steps: r.steps, items: r.items };
        };
        return await runKeyedListDomTraceOnce({ actions, computeSteps, container, keep });
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
