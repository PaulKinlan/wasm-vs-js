// Real-DOM virtualized-scrolling host for the iframe orchestration bridge.
//
// Paul's directive (2026-08-06, reinforced 2026-08-09): DOM workloads must
// actually drive a rendered UI. This host builds a REAL virtualized list
// (scroll viewport + total-height spacer + a recycled row layer) inside the
// iframe and applies the frozen 1,800-action trace with real DOM APIs
// (createElement/appendChild/removeChild/textContent), measuring the full
// journey per target:
//   - "js"   : visible windows computed in JS  (binary search, Float64 prefix)
//   - "wasm" : visible windows computed by the REAL Wasm kernel
//             (/artifacts/dom-virtualized-scrolling/dom_vscroll.wasm)
// The DOM application is the shared host work for both targets; the measured
// iteration includes the window computation + the real DOM mutation.
//
// The bridge protocol requires a createTodomvcHost() export (the bridge's
// message validator is shared with the TodoMVC host).

import {
  buildPrefixSums,
  computeWindowJS,
  generateScrollActions,
  instantiateVscrollWasm,
  runDomTraceOnce,
  runVirtualizedScrollingWasm,
  VSCROLL_ROW_COUNT,
} from "/benchmarks/dom-virtualized-scrolling/engine.js";

const WORKLOAD = "dom-virtualized-scrolling";

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
      const actions = generateScrollActions();
      const prefixSums = buildPrefixSums();

      // A visible host section at the top of the page's main content. The
      // parent runner scrolls the kept iframe to #wvj-todomvc-host, so the
      // section reuses that id to stay on-screen after the run.
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
        "Real virtualized DOM list (under test — frozen 1,800-action scroll trace)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        `${VSCROLL_ROW_COUNT.toLocaleString()} logical rows · variable heights 30–90px · ` +
        "rows are created, recycled and repositioned with real DOM APIs per scroll action.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjVlistContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm") ? await instantiateVscrollWasm() : null;

      // One measured pass: window computation (JS or the REAL Wasm kernel) +
      // full DOM application, timed together so the comparison is honest.
      const measuredPass = async (target) => {
        if (target === "wasm") {
          // The kernel executes inside the timed region: linear-memory writes
          // (prefix sums + actions) + compute_windows + reading results.
          const computeWindows = () => runVirtualizedScrollingWasm(actions, wasmInstance).windows;
          return await runDomTraceOnce({ actions, computeWindows, container });
        }
        const computeWindows = () =>
          actions.map((action) =>
            computeWindowJS(prefixSums, action.scrollTop, action.viewportHeight)
          );
        return await runDomTraceOnce({ actions, computeWindows, container });
      };

      const perTarget = {};
      for (const target of targets) {
        // Warmup pass (not measured) so JIT/wasm-cache effects are not the
        // headline; the reported cold run is the first measured pass.
        await measuredPass(target);
        const runs = [];
        for (let iteration = 1; iteration <= iterations; iteration++) {
          const { ms, verified } = await measuredPass(target);
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
