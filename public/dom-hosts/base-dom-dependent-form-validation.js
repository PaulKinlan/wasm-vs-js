// Real-DOM form-validation host for the iframe orchestration bridge.
// Renders a REAL form (10 inputs + per-rule error messages) and applies the
// frozen 240-action trace with real DOM APIs (input.value, error display),
// per target: "js" vs "wasm" (REAL kernel).

import {
  generateFormActions,
  instantiateFormValidateWasm,
  runFormDomTraceOnce,
  runFormValidationJSSteps,
  runFormValidationWasmSteps,
} from "/benchmarks/dom-dependent-form-validation/engine.js";

const WORKLOAD = "dom-dependent-form-validation";

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

export function createTodomvcHost() {
  return {
    run: async ({ iterations = 30, targets = ["js", "wasm"], onProgress = () => {} }) => {
      const actions = generateFormActions();

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
        "Real DOM form (under test — frozen 240-op input/blur validation trace)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "10 dependent fields · every action sets input.value and toggles per-rule " +
        "error messages with real DOM APIs.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjFormContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm") ? await instantiateFormValidateWasm() : null;

      const measuredPass = async (target, { keep = false } = {}) => {
        if (target === "wasm") {
          return await runFormDomTraceOnce({
            actions,
            computeSteps: () => runFormValidationWasmSteps(actions, wasmInstance),
            container,
            keep,
          });
        }
        return await runFormDomTraceOnce({
          actions,
          computeSteps: () => runFormValidationJSSteps(actions),
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
