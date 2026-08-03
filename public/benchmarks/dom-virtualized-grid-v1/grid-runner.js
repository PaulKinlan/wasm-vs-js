const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const target = document.querySelector("#target");
const status = document.querySelector("#status");
const output = document.querySelector("#result");
const grid = document.querySelector("#grid");
let worker = null;
let token = 0;
let timeout = 0;
let slots = [];

function rowText(rowId, score, rowIndex) {
  return `Row ${rowId} · score ${score} · position ${rowIndex + 1}`;
}

function bindRow(element, rowId, rowIndex, score, selected) {
  if (
    grid.getAttribute("aria-activedescendant") === element.id && element.id !== `grid-row-${rowId}`
  ) {
    grid.removeAttribute("aria-activedescendant");
  }
  element.id = `grid-row-${rowId}`;
  element.dataset.rowId = String(rowId);
  element.dataset.score = String(score);
  element.setAttribute("aria-rowindex", String(rowIndex + 1));
  element.setAttribute("aria-selected", selected ? "true" : "false");
  element.textContent = rowText(rowId, score, rowIndex);
  element.hidden = false;
}

function applyCommands(words) {
  if (!(words instanceof Uint32Array) || words.length % 6 !== 0) {
    throw new Error("Typed command stream is malformed");
  }
  const actual = {
    physicalCreates: 0,
    physicalReuses: 0,
    physicalUpdates: 0,
    physicalPlacements: 0,
    physicalHides: 0,
    focusOperations: 0,
    layoutReads: 0,
  };
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
    } else throw new Error(`Unknown command opcode ${op}`);
  }
  return actual;
}

function canonicalDom() {
  const rows = [...grid.children].map((row) => ({
    id: row.id,
    rowId: Number(row.dataset.rowId),
    score: Number(row.dataset.score),
    rowIndex: Number(row.getAttribute("aria-rowindex")),
    selected: row.getAttribute("aria-selected") === "true",
    text: row.textContent,
    role: row.getAttribute("role"),
  }));
  return JSON.stringify({
    role: grid.getAttribute("role"),
    rowCount: Number(grid.getAttribute("aria-rowcount")),
    activeDescendant: grid.getAttribute("aria-activedescendant") || null,
    focusedRow: grid.dataset.focusedRow || null,
    selectedRow: grid.dataset.selectedRow || null,
    rows,
  });
}

async function sha256(text) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

function terminate() {
  clearTimeout(timeout);
  worker?.terminate();
  worker = null;
  document.documentElement.dataset.gridWorkerActive = "false";
}

function resetDom() {
  grid.replaceChildren();
  grid.removeAttribute("aria-activedescendant");
  grid.dataset.focusedRow = "";
  grid.dataset.selectedRow = "";
  slots = [];
}

function fail(message) {
  token += 1;
  terminate();
  resetDom();
  status.textContent = message;
  output.textContent = "No result was accepted.";
  start.disabled = false;
  cancel.disabled = true;
}

start.addEventListener("click", () => {
  terminate();
  resetDom();
  const runToken = ++token;
  worker = new Worker("/benchmarks/dom-virtualized-grid-v1/grid-worker.js", { type: "module" });
  document.documentElement.dataset.gridWorkerActive = "true";
  status.textContent = "Running exact model and typed DOM command stream…";
  output.textContent = "Waiting for exact output.";
  start.disabled = true;
  cancel.disabled = false;
  worker.onerror = () => {
    if (runToken === token) fail("The worker stopped unexpectedly.");
  };
  worker.onmessage = async ({ data }) => {
    if (runToken !== token || !data || data.token !== runToken) return;
    if (data.type === "error") return fail(data.message);
    if (data.type !== "result") return;
    try {
      const commands = new Uint32Array(data.commands);
      const actual = applyCommands(commands);
      const expected = data.result.counters;
      for (const key of Object.keys(actual)) {
        if (actual[key] !== expected[key]) throw new Error(`${key} physical counter mismatch`);
      }
      grid.dataset.focusedRow = String(data.result.final.focused);
      grid.dataset.selectedRow = String(data.result.final.selected);
      const domSource = canonicalDom();
      const domSha256 = await sha256(domSource);
      clearTimeout(timeout);
      terminate();
      status.textContent =
        "Virtualized grid completed; exact commands were physically applied to the host DOM.";
      output.textContent = JSON.stringify(
        {
          workloadId: data.result.workloadId,
          executionTarget: data.result.executionTarget,
          commandDigest: data.result.commandDigest,
          commandWords: commands.length,
          commandCount: data.result.counters.commands,
          "Browser DOM SHA-256": domSha256,
          mountedRows: grid.children.length,
          activeElement: document.activeElement?.id || null,
          actualPhysicalCounters: actual,
          modelCounters: data.result.counters,
          final: data.result.final,
          checkpoints: data.result.checkpoints,
          fixture: data.result.fixture,
          buildManifestSha256: data.result.buildManifestSha256,
        },
        null,
        2,
      );
      start.disabled = false;
      cancel.disabled = true;
    } catch (error) {
      fail(error instanceof Error ? error.message : "Host command application failed.");
    }
  };
  worker.postMessage({
    type: "start",
    token: runToken,
    variantId: target.value,
    holdMs: new URLSearchParams(location.search).get("demo-test") === "1" ? 500 : 0,
  });
  timeout = setTimeout(() => {
    if (runToken === token) fail("Timed out after 60 seconds; the owned worker was terminated.");
  }, 60_000);
});

cancel.addEventListener("click", () => {
  token += 1;
  terminate();
  resetDom();
  status.textContent = "Canceled. Late messages from the invalidated worker token are ignored.";
  output.textContent = "No result was accepted.";
  start.disabled = false;
  cancel.disabled = true;
});

addEventListener("pagehide", () => {
  token += 1;
  terminate();
});

if (new URLSearchParams(location.search).get("demo-test") === "1") {
  globalThis.__gridDemoTest = Object.freeze({
    injectWrongToken() {
      worker?.onmessage?.({ data: { type: "result", token: token - 1 } });
    },
    workerActive() {
      return Boolean(worker);
    },
  });
}
