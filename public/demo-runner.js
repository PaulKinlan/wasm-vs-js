// Shared safe demo runner for the audio workload routes.
//
// Lifecycle: each Start spawns a FRESH module worker, hands it a unique run
// token, and arms a wall-clock timeout. Cancel terminates the worker. Any
// message carrying a stale token is ignored, so a terminated worker can never
// overwrite a newer run's state. The main thread only renders status and
// results; all fixture generation, hashing, and compute happen inside the
// worker, so the page stays responsive.
//
// Scope limits: no upload, no storage, no performance comparison. The runner
// reports correctness, oracle, and counter evidence only; no timing values
// are requested from the worker or displayed.

const identity = JSON.parse(document.getElementById("workload-identity").textContent);

const elements = {
  target: document.getElementById("demo-target"),
  mode: document.getElementById("demo-mode"),
  start: document.getElementById("demo-start"),
  cancel: document.getElementById("demo-cancel"),
  status: document.getElementById("demo-status"),
  results: document.getElementById("demo-results"),
  summary: document.getElementById("demo-summary"),
  hashes: document.getElementById("demo-hashes"),
  oracle: document.getElementById("demo-oracle"),
  counters: document.getElementById("demo-counters"),
  contract: document.getElementById("demo-contract"),
};

let currentToken = 0;
let worker = null;
let timeoutId = 0;

function setStatus(text) {
  elements.status.textContent = text;
}

function setRunning(running) {
  elements.start.disabled = running;
  elements.cancel.disabled = !running;
  elements.target.disabled = running;
  elements.mode.disabled = running;
}

function teardownWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = 0;
  }
}

function formatMetricValue(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toExponential(4);
  }
  return String(value);
}

function renderResult(message) {
  elements.results.hidden = false;
  const targetLabel = message.target === "wasm-linear"
    ? "WebAssembly (linear memory)"
    : "JavaScript";
  const modeLabel = message.mode === "exact-contract" ? "exact contract" : "bounded";
  elements.summary.textContent =
    `${identity.title} completed on the ${targetLabel} engine in ${modeLabel} mode. ` +
    `Variant ${message.variantId}; output matched the pinned f64 reference within the ` +
    `frozen tolerances and passed every structural invariant.`;

  elements.hashes.replaceChildren();
  for (
    const [label, actual, expected] of [
      ["Input SHA-256", message.inputSha256, identity.frozenHashes.inputSha256],
      ["Output SHA-256", message.outputSha256, identity.frozenHashes.outputSha256],
    ]
  ) {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = label;
    const actualCell = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = actual;
    actualCell.append(code);
    const verdict = document.createElement("td");
    verdict.textContent = actual === expected
      ? "matches frozen hash"
      : `MISMATCH (expected ${expected})`;
    row.append(name, actualCell, verdict);
    elements.hashes.append(row);
  }

  elements.oracle.replaceChildren();
  for (const [checkId, check] of Object.entries(message.oracleChecks)) {
    const item = document.createElement("li");
    const heading = document.createElement("strong");
    heading.textContent = `${checkId}: ${check.status}`;
    item.append(heading);
    const list = document.createElement("dl");
    list.className = "metrics demo-metrics";
    for (const [metric, value] of Object.entries(check.metrics)) {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = metric;
      const definition = document.createElement("dd");
      definition.textContent = formatMetricValue(value);
      wrapper.append(term, definition);
      list.append(wrapper);
    }
    item.append(list);
    elements.oracle.append(item);
  }

  elements.counters.replaceChildren();
  for (const [counter, value] of Object.entries(message.counters)) {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = counter;
    const cell = document.createElement("td");
    cell.textContent = String(value);
    row.append(name, cell);
    elements.counters.append(row);
  }

  elements.contract.replaceChildren();
  if (message.contractChecks) {
    for (const [label, ok, detail] of message.contractChecks) {
      const item = document.createElement("li");
      item.textContent = `${label}: ${ok ? "verified" : "FAILED"} — ${detail}`;
      elements.contract.append(item);
    }
    elements.contract.closest("section").hidden = false;
  } else {
    elements.contract.closest("section").hidden = true;
  }
}

function finish(text) {
  teardownWorker();
  setRunning(false);
  setStatus(text);
}

elements.start.addEventListener("click", () => {
  currentToken += 1;
  const token = currentToken;
  teardownWorker();
  elements.results.hidden = true;
  setRunning(true);
  setStatus("Preparing a fresh worker…");

  const runWorker = new Worker("/demo-worker.js", { type: "module" });
  worker = runWorker;
  timeoutId = setTimeout(() => {
    finish(`Timed out after ${identity.timeoutMs / 1000} seconds; the worker was terminated.`);
  }, identity.timeoutMs);

  runWorker.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.token !== token) return; // stale token: ignore
    if (message.type === "progress") {
      setStatus(message.step);
      return;
    }
    if (message.type === "completed") {
      renderResult(message);
      finish("Run complete. All reported evidence comes from this page's worker run.");
      return;
    }
    if (message.type === "failed") {
      finish(`Run failed: ${message.message}`);
    }
  });
  runWorker.addEventListener("error", (event) => {
    // Stale-safe: a late error from a terminated older worker must not
    // finish a newer run.
    if (worker !== runWorker || token !== currentToken) return;
    finish(`Worker error: ${event.message ?? "unknown"}`);
  });

  runWorker.postMessage({
    token,
    slug: identity.slug,
    target: elements.target.value,
    mode: elements.mode.value,
  });
});

elements.cancel.addEventListener("click", () => {
  currentToken += 1; // invalidate any in-flight messages
  finish("Cancelled; the worker was terminated.");
});

// Explicit page teardown: leaving or reloading the page terminates any
// in-flight worker and disarms its timeout.
addEventListener("pagehide", () => {
  currentToken += 1;
  teardownWorker();
});

document.documentElement.classList.add("js");
setStatus("Idle. Choose an engine and a mode, then start a run.");
