const DEMOS = Object.freeze({
  "regex-automata-duel-demo": Object.freeze({
    title: "1 MiB / 20-pattern reduced regex fixture",
    worker: "/benchmarks/regex-automata-duel-demo/worker.js",
  }),
  "vdom-diff-patch-demo": Object.freeze({
    title: "1,000-node / 250-edit reduced virtual-DOM fixture",
    worker: "/benchmarks/vdom-diff-patch-demo/worker.js",
  }),
});
const TIMEOUT_MS = 30_000;
const demoId = document.body.dataset.demo;
const demo = DEMOS[demoId];
if (!demo) throw new Error("page demo identifier is not allowlisted");

const form = document.querySelector("#demo-form");
const target = document.querySelector("#target");
const startButton = document.querySelector("#start");
const cancelButton = document.querySelector("#cancel");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
let active = null;
let sequence = 0;

const missingCapabilities = [];
if (typeof Worker !== "function") missingCapabilities.push("module workers");
if (!globalThis.crypto?.subtle || typeof globalThis.crypto.randomUUID !== "function") {
  missingCapabilities.push("Web Crypto");
}
for (const option of target.options) {
  if (option.value.includes("wasm") && typeof WebAssembly !== "object") option.disabled = true;
}
if (missingCapabilities.length > 0) {
  startButton.disabled = true;
  target.disabled = true;
  status.textContent = `Unavailable: ${missingCapabilities.join(" and ")} are required.`;
}

function setRunning(running) {
  startButton.disabled = running;
  target.disabled = running;
  cancelButton.disabled = !running;
  status.setAttribute("aria-busy", String(running));
}

function retireActive() {
  if (!active) return;
  clearTimeout(active.timeout);
  active.worker.terminate();
  active = null;
}

function fail(message) {
  result.replaceChildren();
  result.hidden = true;
  status.textContent = message;
  setRunning(false);
}

function appendFact(list, term, value) {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}

function showResult(payload) {
  const facts = document.createElement("dl");
  facts.className = "result-grid";
  appendFact(facts, "Target", payload.targetLabel);
  appendFact(facts, "Reduced fixture", payload.fixtureLabel);
  appendFact(facts, "Input SHA-256", payload.inputSha256);
  for (const [label, value] of Object.entries(payload.oracles)) appendFact(facts, label, value);
  appendFact(facts, "Validation", payload.validation);
  appendFact(
    facts,
    "Full proposal contract",
    `${payload.fullContract.status}: ${payload.fullContract.reasonCode} — ${payload.fullContract.detail}`,
  );
  const heading = document.createElement("h3");
  heading.textContent = "Exact work counters";
  const counters = document.createElement("pre");
  counters.textContent = JSON.stringify(payload.counters, null, 2);
  result.replaceChildren(facts, heading, counters);
  result.hidden = false;
  status.textContent = `${demo.title} completed; oracle and work counters match exactly.`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  retireActive();
  const token = `${++sequence}:${crypto.randomUUID()}`;
  const worker = new Worker(demo.worker, { type: "module" });
  const timeout = setTimeout(() => {
    if (!active || active.token !== token) return;
    retireActive();
    sequence += 1;
    fail(`Stopped after the fixed ${TIMEOUT_MS / 1_000}-second timeout.`);
  }, TIMEOUT_MS);
  active = { token, worker, timeout };
  setRunning(true);
  result.hidden = true;
  status.textContent = `Running ${demo.title} in a fresh module worker…`;

  worker.addEventListener("message", (messageEvent) => {
    if (!active || active.token !== token || messageEvent.data?.token !== token) return;
    const message = messageEvent.data;
    retireActive();
    setRunning(false);
    if (message.type === "result") showResult(message.result);
    else fail(`Run failed: ${message.message ?? "unknown worker error"}`);
  });
  worker.addEventListener("error", () => {
    if (!active || active.token !== token) return;
    retireActive();
    fail("Run failed before the worker returned a result.");
  });
  worker.postMessage({ type: "run", token, target: target.value });
});

cancelButton.addEventListener("click", () => {
  if (!active) return;
  sequence += 1;
  retireActive();
  setRunning(false);
  result.replaceChildren();
  result.hidden = true;
  status.textContent =
    "Canceled. The worker was terminated and its in-memory fixture and result were discarded.";
});

globalThis.addEventListener("pagehide", () => {
  sequence += 1;
  retireActive();
});
