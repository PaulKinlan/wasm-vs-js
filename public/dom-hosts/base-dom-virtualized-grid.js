// Real-DOM virtualized-grid host for the iframe orchestration bridge.
//
// Loads the frozen fixture (+ the REAL Wasm grid kernel for the wasm target),
// runs the 300-event model execution, and applies every typed command batch to
// a REAL DOM grid (createElement/bindRow/style.transform/textContent/aria/
// focus/scrollTop) — the same physical command application the page runner
// performs — then requires the physical counters (creates/reuses/updates/
// placements/hides/focus/layout reads) to match the model's expected counters
// exactly (the page's own acceptance check).
//
// Bridge contract: createTodomvcHost() export.

import {
  ACTION_BYTES,
  ACTIONS,
  createJavaScriptGridExecution,
  createWasmGridExecution,
  GRID_TRACE_LIFECYCLE,
  HEADER_BYTES,
  instantiateGridWasm,
  ROW_BYTES,
  ROWS,
} from "/benchmarks/base/dom-virtualized-grid/engine.js";

const ACTION_OFFSET = HEADER_BYTES + ROWS * ROW_BYTES;

const WORKLOAD = "dom-virtualized-grid-v1";
const FIXTURE_URL = "/artifacts/dom-virtualized-grid-v1/fixture.bin";
const WASM_URL = "/artifacts/dom-virtualized-grid-v1/grid.wasm";
const MAX_MOUNTED = 28;

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

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function rowText(rowId, score, rowIndex) {
  return `Row ${rowId} · score ${score} · position ${rowIndex + 1}`;
}

/** Real-DOM command application (mirrors the page runner's grid-runner.js). */
function createGridDom({ container }) {
  const grid = document.createElement("div");
  grid.dataset.wvjVirtualGrid = "1";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-rowcount", "100000");
  grid.style.position = "relative";
  grid.style.height = "280px";
  grid.style.overflow = "auto";
  grid.style.border = "1px solid #555";
  grid.style.background = "#101015";
  grid.style.color = "#d8e2f2";
  grid.style.font = "11px ui-monospace, monospace";
  container.append(grid);

  const slots = [];
  const actual = {
    physicalCreates: 0,
    physicalReuses: 0,
    physicalUpdates: 0,
    physicalPlacements: 0,
    physicalHides: 0,
    focusOperations: 0,
    layoutReads: 0,
  };

  function bindRow(element, rowId, rowIndex, score, selected) {
    if (
      grid.getAttribute("aria-activedescendant") === element.id &&
      element.id !== `grid-row-${rowId}`
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

  function applyCommands(words) {
    if (!(words instanceof Uint32Array) || words.length % 6 !== 0) {
      throw new Error("Typed command stream is malformed");
    }
    let layoutTerminators = 0;
    for (let at = 0; at < words.length; at += 6) {
      const [op, slot, b, c, d, e] = words.subarray(at, at + 6);
      if (slot >= MAX_MOUNTED && op !== 7) throw new Error("Command slot exceeds the frozen bound");
      if (op === 1) {
        if (slots[slot]) throw new Error("Create targeted an occupied slot");
        const element = document.createElement("div");
        element.className = "virtual-row";
        element.setAttribute("role", "row");
        element.tabIndex = -1;
        slots[slot] = element;
        bindRow(element, b, c, d | 0, e);
        actual.physicalCreates += 1;
      } else if (op === 2) {
        if (!slots[slot]) throw new Error("Reuse targeted a missing slot");
        bindRow(slots[slot], b, c, d | 0, e);
        actual.physicalReuses += 1;
      } else if (op === 3) {
        if (!slots[slot]) throw new Error("Update targeted a missing slot");
        bindRow(slots[slot], b, c, d | 0, e);
        actual.physicalUpdates += 1;
      } else if (op === 4) {
        if (!slots[slot]) throw new Error("Place targeted a missing slot");
        grid.append(slots[slot]);
        actual.physicalPlacements += 1;
      } else if (op === 5) {
        if (!slots[slot]) throw new Error("Hide targeted a missing slot");
        if (grid.getAttribute("aria-activedescendant") === slots[slot].id) {
          grid.removeAttribute("aria-activedescendant");
        }
        slots[slot].remove();
        slots[slot].hidden = true;
        actual.physicalHides += 1;
      } else if (op === 6) {
        if (!slots[slot] || !slots[slot].isConnected) {
          throw new Error("Focus targeted an unmounted slot");
        }
        slots[slot].focus({ preventScroll: true });
        grid.setAttribute("aria-activedescendant", slots[slot].id);
        actual.focusOperations += 1;
      } else if (op === 7) {
        grid.getBoundingClientRect();
        actual.layoutReads += 1;
        layoutTerminators += 1;
      } else throw new Error(`Unknown command opcode ${op}`);
    }
    if (layoutTerminators !== 1) throw new Error("Event batch omitted its layout terminator");
  }

  function scrollTo(top) {
    grid.scrollTop = top;
  }

  function verify(expectedCounters) {
    let ok = true;
    let firstBad = "";
    for (const key of Object.keys(actual)) {
      if (actual[key] !== expectedCounters[key]) {
        ok = false;
        firstBad = `${key}: dom=${actual[key]} model=${expectedCounters[key]}`;
        break;
      }
    }
    return { ok, firstBad, mountedRows: grid.children.length };
  }

  return { grid, applyCommands, scrollTo, verify, actual };
}

export function createTodomvcHost() {
  return {
    run: async ({ iterations = 30, targets = ["js", "wasm"], onProgress = () => {} }) => {
      const fixture = await fetchBytes(FIXTURE_URL);
      const fixtureView = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);

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
        "Real DOM virtualized grid (under test — frozen 300-event typed command trace)";
      heading.style.margin = "0 0 8px";
      heading.style.fontSize = "13px";
      heading.style.color = "#bcd";
      const note = document.createElement("p");
      note.textContent =
        "100,000 logical rows · the model (JS or REAL Wasm kernel) emits a typed command " +
        "stream that is applied to the real grid with DOM APIs (createElement/style." +
        "transform/textContent/aria/focus/scrollTop); physical counters must equal the " +
        "model's expected counters exactly.";
      note.style.margin = "0 0 10px";
      note.style.fontSize = "11px";
      note.style.color = "#89a";
      const container = document.createElement("div");
      container.dataset.wvjGridContainer = "1";
      section.append(heading, note, container);
      document.querySelector("#main")?.prepend(section);

      const wasmInstance = targets.includes("wasm")
        ? await instantiateGridWasm(await fetchBytes(WASM_URL))
        : null;

      const measuredPass = (target, { keep = false } = {}) => {
        const dom = createGridDom({ container });
        const t0 = performance.now();
        const execution = target === "wasm"
          ? createWasmGridExecution(wasmInstance, fixture)
          : createJavaScriptGridExecution(fixture);
        let scrollOffset = 0;
        for (let actionIndex = 0; actionIndex < ACTIONS; actionIndex++) {
          const step = execution.next();
          if (step.done || step.value.actionIndex !== actionIndex) {
            throw new Error("Controlled target omitted an interleaved trace event");
          }
          const batch = step.value.commands;
          const at = ACTION_OFFSET + actionIndex * ACTION_BYTES;
          const eventType = fixtureView.getUint32(at + 4, true);
          const a = fixtureView.getUint32(at + 8, true);
          const filteredLength = batch[batch.length - 1];
          if (eventType === 0) {
            scrollOffset = Math.min(a, Math.max(0, filteredLength - 20) * 24);
          } else {
            scrollOffset = 0;
          }
          dom.scrollTo(scrollOffset);
          dom.applyCommands(batch);
        }
        const completed = execution.next();
        if (!completed.done) throw new Error("Controlled target did not complete after 300 events");
        const expected = completed.value.counters;
        const verified = dom.verify(expected);
        const ms = performance.now() - t0;
        if (!keep) dom.grid.remove();
        return { ms, verified, domOps: dom.actual.physicalCreates + dom.actual.physicalReuses };
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
              `real-DOM verification failed (${target}): ${verified.firstBad}`,
            );
          }
          runs.push(ms);
          onProgress({ target, iteration, total: iterations });
        }
        perTarget[target] = statsFor(runs);
      }

      return {
        perTarget,
        detail: {
          workload: WORKLOAD,
          iterations,
          actions: ACTIONS,
          cadenceMs: GRID_TRACE_LIFECYCLE.cadenceMs,
        },
      };
    },
  };
}
