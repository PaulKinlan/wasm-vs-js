// Shared real-DOM host factory for the iframe orchestration bridge.
//
// Paul's vision (docs/dom-orchestration.md): the DOM workloads exist to
// measure JS vs Wasm interacting with the ACTUAL DOM. This factory turns a
// workload's model engine + action stream into a real-DOM benchmark: the
// engine (JS object-model or wasm-linear Int32Array variant) computes the
// model, a shared JS host applies every action to rendered DOM elements, and
// the journey is measured end-to-end.
//
// Honest boundary (mirrors the TodoMVC host): engine compute is the
// JS-vs-Wasm comparison; DOM application is a shared JS host for both
// targets, so the comparison isolates engine compute while the measured
// iteration includes real DOM mutation. Layout/paint is not forced.
//
// Engine equivalence: the factory runs both engine variants once at setup
// and records whether their model summaries agree. If they diverge (a real
// finding for these workloads — the repo never asserted JS/wasm-linear
// equivalence for the DOM engines), the divergence is surfaced in the detail
// payload instead of silently rejected, and the DOM verification runs against
// the workload's intended semantics (computeReference) rather than the
// diverging engine counters.
//
// Protocol compatibility: exports createTodomvcHost() so the bridge's
// child-side host discovery works unchanged.

import { computeStats } from "./todomvc-ops.js";

/**
 * @param {object} spec
 * @param {string} spec.slug          workload slug, e.g. "dom-grid-movement"
 * @param {string} spec.label         human label for the detail note
 * @param {() => Promise<object>} spec.loadEngine   import the workload engine module
 * @param {(engine: object) => unknown[]} spec.generateActions  frozen action stream
 * @param {(engine: object, actions: unknown[], target: string) => object} spec.runModel
 *        run the model for a target ("js" | "wasm"), return the model summary
 * @param {() => { root: HTMLElement; reset(): void }} spec.renderDom
 *        render the workload's real DOM, return root + reset
 * @param {(dom, action: unknown, index: number) => void} spec.applyAction
 *        apply one action to the real DOM
 * @param {(actions: unknown[]) => object} spec.computeReference
 *        plain-data replay of the workload's intended semantics (no DOM) —
 *        the DOM end-state must match this reference
 * @param {(dom) => object} spec.readDomState  derive the DOM-observable state
 * @param {(domState: object, reference: object) => void} spec.verifyDom
 *        throw if the rendered DOM does not match the reference
 */
export async function createModelDomHost(spec) {
  const engine = await spec.loadEngine();
  const actions = spec.generateActions(engine);
  const reference = spec.computeReference(actions);

  // Non-blocking engine divergence check (surface, don't hide).
  const jsSummary = spec.runModel(engine, actions, "js");
  const wasmSummary = spec.runModel(engine, actions, "wasm");
  const summariesEqual = JSON.stringify(jsSummary) === JSON.stringify(wasmSummary);

  function runIteration(target, dom) {
    const start = performance.now();
    const engineStart = performance.now();
    const model = spec.runModel(engine, actions, target);
    const engineMs = performance.now() - engineStart;
    dom.reset();
    for (let i = 0; i < actions.length; i += 1) {
      spec.applyAction(dom, actions[i], i);
    }
    const totalMs = performance.now() - start;
    spec.verifyDom(spec.readDomState(dom), reference);
    return { totalMs, engineMs, model };
  }

  async function run({ iterations = 30, targets = ["js", "wasm"], onProgress = () => {} }) {
    const dom = spec.renderDom();
    try {
      const consoleErrors = [];
      const onError = (event) => {
        if (event && (event.message || event.error)) {
          consoleErrors.push(event.message || String(event.error));
        }
      };
      globalThis.addEventListener("error", onError);
      const perTarget = {};
      try {
        for (const target of targets) {
          const samples = [];
          let lastDetail = null;
          for (let i = 0; i < iterations; i += 1) {
            const iteration = runIteration(target, dom);
            samples.push(iteration.totalMs);
            lastDetail = { engineMs: iteration.engineMs, model: iteration.model };
            onProgress({ target, iteration: i + 1, total: iterations });
          }
          perTarget[target] = { ...computeStats(samples), detail: lastDetail };
        }
      } finally {
        globalThis.removeEventListener("error", onError);
      }
      return {
        perTarget,
        consoleErrors,
        detail: {
          workload: spec.slug,
          label: spec.label,
          mode: "real-dom-iframe",
          renderedDom: true,
          actionsApplied: actions.length,
          engine: "js|wasm-linear (model) + shared JS DOM host",
          enginesEquivalent: summariesEqual,
          ...(summariesEqual
            ? {}
            : {
                engineDivergence: {
                  note:
                    "The workload's JS and wasm-linear engine variants produce different model " +
                    "summaries (the repo never asserted their equivalence). The DOM application " +
                    "is a shared JS host and is verified against the workload's intended semantics; " +
                    "the JS-vs-Wasm timing comparison is exploratory and flagged accordingly.",
                  js: jsSummary,
                  wasm: wasmSummary,
                },
              }),
          note:
            "Exploratory in-browser measurement; engine compute is the JS-vs-Wasm comparison, DOM application is shared JS. Layout/paint not forced.",
        },
      };
    } finally {
      dom.root.remove();
    }
  }

  return { run };
}
