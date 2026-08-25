// Real-DOM nested-tree host for the iframe orchestration bridge.
// Renders a REAL nested DOM tree (500 nodes as <ul>/<li>) and applies the
// frozen 1,200-op mutation trace with real DOM APIs (appendChild/remove/
// insertBefore/dataset), per target: "js" vs "wasm" (REAL kernel).

import {
  generateNestedTreeActions,
  instantiateNestedTreeWasm,
  runNestedTreeDomTraceOnce,
  runNestedTreeMutationJSSteps,
  runNestedTreeMutationWasmSteps,
} from "/benchmarks/dom-nested-tree-mutation/engine.js";

const WORKLOAD = "dom-nested-tree-mutation";

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
      const actions = generateNestedTreeActions();

      const section = document.createElement("section");
      section.id = "wvj-todomvc-host";
      section.setAttribute("data-wvj-dom-host", WORKLOAD);
      section.style.margin = "16px 0";
      section.style.padding = "12px";
      section.style.border = "1px solid #666";
      section.style.borderRadius = "6px";
      section.style.background = "#101014";
      const heading = document.createElement("h2");
      heading.textContent = "Real DOM tree (under test — frozen 1,200-op mutation trace)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "500-node nested tree · insert/remove/move/replace/update-attr applied with " +
        "real DOM APIs (appendChild/remove/dataset/textContent).";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjNestedContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm") ? await instantiateNestedTreeWasm() : null;

      const measuredPass = async (target, { keep = false } = {}) => {
        if (target === "wasm") {
          const computeSteps = () => {
            const r = runNestedTreeMutationWasmSteps(actions, wasmInstance);
            return { steps: r.steps, nodes: r.nodes };
          };
          return await runNestedTreeDomTraceOnce({ actions, computeSteps, container, keep });
        }
        const computeSteps = () => {
          const r = runNestedTreeMutationJSSteps(actions);
          return { steps: r.steps, nodes: r.nodes };
        };
        return await runNestedTreeDomTraceOnce({ actions, computeSteps, container, keep });
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
