// Real-DOM host for the DOM Virtualized-Data-Grid workload (iframe orchestration).
//
// Paul's directive (2026-08-06): "All demos should be able to run in the
// benchmark. Simulate scrolls and interactions if we really need to."
//
// The page's own demo replays the 300-action interaction trace at a
// wall-clock cadence (±20 ms slot tolerance) to mimic a human — that paced
// mode stays on the page as the "human-realistic" demo. This host runs the
// SAME trace as a max-throughput benchmark: the engine (JS object-model or
// the real committed grid.wasm linear-memory variant) computes each event's
// command batch, and a shared JS host applies every command to a real
// rendered grid DOM (create/reuse/update/place/hide/focus + a layout read
// per event, mirroring the page's applyCommands exactly). No wall-clock
// pacing, no slot validation — the interactions are simulated at engine
// speed, and the DOM end-state is verified against a plain-data replay of
// the command stream.
//
// Honest boundary (same as the other DOM hosts): engine compute is the
// JS-vs-Wasm comparison; DOM application is a shared JS host for both
// targets. The 100,000-row fixture, 300-event trace and command streams are
// the workload's frozen artifacts — bit-identical to the page's demo run.

import { createModelDomHost } from "./dom-host-factory.js";

function emptyCounters() {
  return {
    physicalCreates: 0,
    physicalReuses: 0,
    physicalUpdates: 0,
    physicalPlacements: 0,
    physicalHides: 0,
    focusOperations: 0,
    layoutReads: 0,
  };
}

function rowText(rowId, score, rowIndex) {
  return `Row ${rowId} · score ${score} · position ${rowIndex + 1}`;
}

// Mirrors the page's grid-runner applyCommands: the 6-wide frozen command
// stream drives a real grid DOM (create/reuse/update/place/hide/focus/layout).
function applyCommands(dom, words) {
  if (!(words instanceof Uint32Array) || words.length % 6 !== 0) {
    throw new Error("Typed command stream is malformed");
  }
  let layoutTerminators = 0;
  const { grid, slots } = dom;
  for (let at = 0; at < words.length; at += 6) {
    const [op, slot, b, c, d, e] = words.subarray(at, at + 6);
    if (slot >= 28 && op !== 7) throw new Error("Command slot exceeds the frozen bound");
    if (op === 1) {
      if (slots[slot]) throw new Error("Create targeted an occupied slot");
      const element = document.createElement("div");
      element.className = "virtual-row";
      element.setAttribute("role", "row");
      element.tabIndex = -1;
      slots[slot] = element;
      bindRow(dom, element, b, c, d | 0, e);
      dom.actual.physicalCreates += 1;
    } else if (op === 2) {
      if (!slots[slot]) throw new Error("Reuse targeted a missing slot");
      bindRow(dom, slots[slot], b, c, d | 0, e);
      dom.actual.physicalReuses += 1;
    } else if (op === 3) {
      if (!slots[slot]) throw new Error("Update targeted a missing slot");
      bindRow(dom, slots[slot], b, c, d | 0, e);
      dom.actual.physicalUpdates += 1;
    } else if (op === 4) {
      if (!slots[slot]) throw new Error("Place targeted a missing slot");
      grid.append(slots[slot]);
      dom.actual.physicalPlacements += 1;
    } else if (op === 5) {
      if (!slots[slot]) throw new Error("Hide targeted a missing slot");
      if (grid.getAttribute("aria-activedescendant") === slots[slot].id) {
        grid.removeAttribute("aria-activedescendant");
      }
      slots[slot].remove();
      slots[slot].hidden = true;
      dom.actual.physicalHides += 1;
    } else if (op === 6) {
      if (!slots[slot] || !slots[slot].isConnected) {
        throw new Error("Focus targeted an unmounted slot");
      }
      slots[slot].focus({ preventScroll: true });
      grid.setAttribute("aria-activedescendant", slots[slot].id);
      dom.actual.focusOperations += 1;
    } else if (op === 7) {
      grid.getBoundingClientRect();
      dom.actual.layoutReads += 1;
      layoutTerminators += 1;
    } else throw new Error(`Unknown command opcode ${op}`);
  }
  if (layoutTerminators !== 1) throw new Error("Event batch omitted its layout terminator");
}

function bindRow(dom, element, rowId, rowIndex, score, selected) {
  const { grid } = dom;
  if (
    grid.getAttribute("aria-activedescendant") === element.id && element.id !== `grid-row-${rowId}`
  ) {
    grid.removeAttribute("aria-activedescendant");
  }
  element.id = `grid-row-${rowId}`;
  element.dataset.rowId = String(rowId);
  element.dataset.score = String(score);
  element.style.transform = `translateY(${rowIndex * 24}px)`;
  element.setAttribute("aria-rowindex", String(rowIndex + 1));
  element.setAttribute("aria-selected", selected ? "true" : "false");
  element.textContent = rowText(rowId, score, rowIndex);
  element.hidden = false;
}

// Materialize the frozen 300-action trace ONCE from the engine's JS generator.
// Each action carries its command batch (deterministic — bit-identical to the
// commands the page's worker dispatches); the shared JS host applies them to
// the real grid DOM.
export function materializeActions(engine, fixture) {
  // createJavaScriptGridExecution consumes the initial "prepared" yield
  // internally; the returned generator yields the 300 event steps directly.
  const steps = engine.createJavaScriptGridExecution(fixture);
  const actions = [];
  for (;;) {
    const step = steps.next();
    if (step.done) break;
    if (step.value.type !== "event") throw new Error("unexpected grid trace step");
    actions.push({
      actionIndex: step.value.actionIndex,
      scrollOffset: step.value.scrollOffset,
      commands: step.value.commands,
    });
  }
  if (actions.length !== engine.ACTIONS) {
    throw new Error(`virtualized-grid trace action count mismatch (${actions.length})`);
  }
  return actions;
}

// Plain-data replay of the command stream (no DOM): the final mounted-slot
// count and the op counters the rendered DOM must match.
export function replayReference(actions) {
  const counters = emptyCounters();
  const mounted = new Set();
  for (const action of actions) {
    for (let at = 0; at < action.commands.length; at += 6) {
      const op = action.commands[at];
      const slot = action.commands[at + 1];
      if (op === 1) counters.physicalCreates += 1;
      else if (op === 2) counters.physicalReuses += 1;
      else if (op === 3) counters.physicalUpdates += 1;
      else if (op === 4) {
        counters.physicalPlacements += 1;
        mounted.add(slot);
      } else if (op === 5) {
        counters.physicalHides += 1;
        mounted.delete(slot);
      } else if (op === 6) counters.focusOperations += 1;
      else if (op === 7) counters.layoutReads += 1;
      else throw new Error(`Unknown command opcode ${op}`);
    }
  }
  return { ...counters, mountedCount: mounted.size };
}

export async function createTodomvcHost() {
  const engine = await import("../benchmarks/base/dom-virtualized-grid/engine.js");
  const fixture = engine.generateFixture();

  // The real committed grid.wasm powers the wasm-linear target (same artifact
  // the page's worker fetches and the build manifest pins).
  const wasmResponse = await fetch("/artifacts/dom-virtualized-grid-v1/grid.wasm");
  if (!wasmResponse.ok) throw new Error(`grid.wasm returned ${wasmResponse.status}`);
  const wasmExports = await engine.instantiateGridWasm(
    new Uint8Array(await wasmResponse.arrayBuffer()),
  );

  const actions = materializeActions(engine, fixture);

  return createModelDomHost({
    slug: "dom-virtualized-grid-v1",
    label: "Virtualized Data Grid Engine",
    loadEngine: () => Promise.resolve(engine),
    generateActions: () => actions,

    renderDom: () => {
      const grid = document.createElement("div");
      grid.id = "wvj-grid-host";
      grid.className = "wvj-grid-app";
      grid.setAttribute("role", "grid");
      grid.setAttribute("aria-label", "Virtualized benchmark rows");
      grid.setAttribute("aria-rowcount", String(engine.ROWS));
      grid.style.overflow = "auto";
      grid.style.height = "400px";
      grid.style.position = "relative";
      document.body.append(grid);
      const state = { slots: [], actual: emptyCounters() };
      const reset = () => {
        grid.replaceChildren();
        grid.removeAttribute("aria-activedescendant");
        grid.scrollTop = 0;
        state.slots = [];
        state.actual = emptyCounters();
      };
      reset();
      return { grid, ...state, reset };
    },

    applyAction: (dom, action) => {
      dom.grid.scrollTop = action.scrollOffset;
      applyCommands(dom, action.commands);
    },

    computeReference: (traceActions) => replayReference(traceActions),

    readDomState: (dom) => ({
      ...dom.actual,
      mountedCount: dom.slots.filter((slot) => slot && slot.isConnected).length,
    }),

    verifyDom: (state, reference) => {
      for (
        const key of [
          "physicalCreates",
          "physicalReuses",
          "physicalUpdates",
          "physicalPlacements",
          "physicalHides",
          "focusOperations",
          "layoutReads",
          "mountedCount",
        ]
      ) {
        if (state[key] !== reference[key]) {
          throw new Error(
            `virtualized-grid DOM drift: ${key} ${state[key]} != reference ${reference[key]}`,
          );
        }
      }
    },

    runModel: (mod, traceActions, target) =>
      target === "wasm"
        ? mod.normalizeForEquivalence(mod.runWasm(wasmExports, fixture))
        : mod.normalizeForEquivalence(mod.runJavaScript(fixture)),
  });
}
