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
let preparedResult = null;
let workerPrepared = false;
let workerPhases = null;
let runStarted = 0;
let eventCount = 0;
let dispatchedEvents = 0;
let renderSpans = [];
let actual = null;

function epochNow() {
  return performance.timeOrigin + performance.now();
}

function spanDuration(spans) {
  return spans.reduce((total, span) => total + span.durationMs, 0);
}

function reconciledPhases(workerPhaseData, endToEndEndedEpochMs) {
  const render = { spans: renderSpans, durationMs: spanDuration(renderSpans) };
  const phases = {
    load: workerPhaseData.load,
    transfer: workerPhaseData.transfer,
    instantiate: workerPhaseData.instantiate,
    compute: workerPhaseData.compute,
    render,
  };
  const exclusiveDurationMs = Object.values(phases).reduce(
    (total, phase) => total + phase.durationMs,
    0,
  );
  const endToEnd = {
    startedEpochMs: performance.timeOrigin + runStarted,
    endedEpochMs: endToEndEndedEpochMs,
    durationMs: endToEndEndedEpochMs - (performance.timeOrigin + runStarted),
  };
  const unattributedDurationMs = endToEnd.durationMs - exclusiveDurationMs;
  if (unattributedDurationMs < 0) {
    throw new Error("Exclusive lifecycle phases exceeded end-to-end duration");
  }
  return {
    clock: "Performance timeOrigin + performance.now",
    definitions: {
      load:
        "resource fetch through response validation, JSON.parse, and SHA-256 hashing; excludes response body arrayBuffer, Uint8Array construction, and TextDecoder construction/decode",
      transfer:
        "response body arrayBuffer, Uint8Array construction, and build-manifest TextDecoder construction/decode",
      instantiate: "WebAssembly.instantiate only; zero for the JavaScript target",
      compute: "controlled model prepare, 300 event steps, and finish",
      render: "host command application through two animation frames for each event",
      endToEnd: "Start activation through receipt of completion after final paint acknowledgment",
    },
    ...phases,
    endToEnd,
    reconciliation: {
      exclusiveDurationMs,
      unattributedDurationMs,
      reconciledEndToEndMs: exclusiveDurationMs + unattributedDurationMs,
    },
  };
}

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

function bindRow(element, rowId, rowIndex, score, selected) {
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

function applyCommands(words) {
  if (!(words instanceof Uint32Array) || words.length % 6 !== 0) {
    throw new Error("Typed command stream is malformed");
  }
  let layoutTerminators = 0;
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
      layoutTerminators += 1;
    } else throw new Error(`Unknown command opcode ${op}`);
  }
  if (layoutTerminators !== 1) throw new Error("Event batch omitted its layout terminator");
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
    tabIndex: row.tabIndex,
  }));
  return {
    role: grid.getAttribute("role"),
    rowCount: Number(grid.getAttribute("aria-rowcount")),
    activeDescendant: grid.getAttribute("aria-activedescendant") || null,
    activeElement: document.activeElement?.id || null,
    selectedRow: rows.find((row) => row.selected)?.rowId ?? null,
    rows,
  };
}

async function sha256(text) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

function afterPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
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
  grid.scrollTop = 0;
  slots = [];
  preparedResult = null;
  workerPrepared = false;
  workerPhases = null;
  eventCount = 0;
  dispatchedEvents = 0;
  renderSpans = [];
  actual = emptyCounters();
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
  runStarted = performance.now();
  worker = new Worker("/benchmarks/dom-virtualized-grid-v1/grid-worker.js", { type: "module" });
  document.documentElement.dataset.gridWorkerActive = "true";
  status.textContent = "Running 300 trace slots at 100 ms cadence (±20 ms)…";
  output.textContent = "Waiting for 300 rendered events.";
  start.disabled = true;
  cancel.disabled = false;
  worker.onerror = () => {
    if (runToken === token) fail("The worker stopped unexpectedly.");
  };
  worker.onmessage = async ({ data }) => {
    if (runToken !== token || !data || data.token !== runToken) return;
    if (data.type === "error") return fail(data.message);
    try {
      if (data.type === "prepared") {
        workerPrepared = true;
        return;
      }
      if (data.type === "event") {
        if (!workerPrepared || data.actionIndex !== eventCount) {
          throw new Error("Trace event arrived out of order");
        }
        const renderedStartedEpochMs = epochNow();
        grid.scrollTop = data.scrollOffset;
        grid.dispatchEvent(
          new CustomEvent("gridtraceevent", {
            detail: {
              actionIndex: data.actionIndex,
              eventType: data.eventType,
              scheduledOffsetMs: data.scheduledOffsetMs,
              actualOffsetMs: data.actualOffsetMs,
              scrollOffset: data.scrollOffset,
            },
          }),
        );
        dispatchedEvents += 1;
        applyCommands(new Uint32Array(data.commands));
        await afterPaint();
        const renderedEndedEpochMs = epochNow();
        renderSpans.push({
          label: `host:render:${data.actionIndex}`,
          startedEpochMs: renderedStartedEpochMs,
          endedEpochMs: renderedEndedEpochMs,
          durationMs: renderedEndedEpochMs - renderedStartedEpochMs,
        });
        eventCount += 1;
        worker?.postMessage({ type: "ack", token: runToken, actionIndex: data.actionIndex });
        return;
      }
      if (data.type !== "complete") return;
      const endToEndEndedEpochMs = epochNow();
      preparedResult = data.result;
      workerPhases = data.workerPhases;
      if (!workerPrepared || !preparedResult || eventCount !== 300 || dispatchedEvents !== 300) {
        throw new Error("Trace completed without 300 rendered events");
      }
      const expected = preparedResult.counters;
      for (const key of Object.keys(actual)) {
        if (actual[key] !== expected[key]) throw new Error(`${key} physical counter mismatch`);
      }
      const dom = canonicalDom();
      const domSource = JSON.stringify(dom);
      const domSha256 = await sha256(domSource);
      const phases = reconciledPhases(workerPhases, endToEndEndedEpochMs);
      clearTimeout(timeout);
      terminate();
      status.textContent = "Virtualized grid completed 300 interleaved event and render steps.";
      output.textContent = JSON.stringify(
        {
          workloadId: preparedResult.workloadId,
          executionTarget: preparedResult.executionTarget,
          commandDigest: preparedResult.commandDigest,
          commandCount: preparedResult.counters.commands,
          "Browser DOM SHA-256": domSha256,
          browserDom: dom,
          mountedRows: grid.children.length,
          activeElement: document.activeElement?.id || null,
          actualPhysicalCounters: actual,
          modelCounters: preparedResult.counters,
          final: preparedResult.final,
          checkpoints: preparedResult.checkpoints,
          fixture: preparedResult.fixture,
          trace: { ...data.trace, dispatchedEvents, renderedEvents: eventCount },
          phases,
          fixtureScrollTop: grid.scrollTop,
          buildManifestSha256: preparedResult.buildManifestSha256,
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
      worker?.onmessage?.({ data: { type: "complete", token: token - 1 } });
    },
    workerActive() {
      return Boolean(worker);
    },
  });
}
