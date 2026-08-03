const DEMOS = Object.freeze({
  "image-flood-fill-demo": Object.freeze({
    title: "64 × 48 threshold flood fill",
    maskLabel: "3,072-byte visited mask",
    boundsLabel: "inclusive changed-pixel bounds",
  }),
  "image-editing-demo": Object.freeze({
    title: "40 × 30 integer luma + separable Gaussian pipeline",
    maskLabel: "not part of this reduced pipeline",
    boundsLabel: "not part of this reduced pipeline",
  }),
});
const TIMEOUT_MS = 5_000;
const demoId = document.body.dataset.demo;
const demo = DEMOS[demoId];
if (!demo) throw new Error("page demo identifier is not allowlisted");

const form = document.querySelector("#demo-form");
const target = document.querySelector("#implementation");
const startButton = document.querySelector("#start");
const cancelButton = document.querySelector("#cancel");
const renderCanvas = document.querySelector("#render-canvas");
const canvas = document.querySelector("#output-canvas");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
let active = null;
let sequence = 0;
let lastOutput = null;

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

function setFailure(message) {
  status.textContent = message;
  result.replaceChildren();
  result.hidden = true;
  setRunning(false);
}

function appendFact(list, term, value) {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}

function drawOutput(output, dimensions) {
  lastOutput = { output, dimensions };
  canvas.hidden = !renderCanvas.checked;
  if (!renderCanvas.checked) return;
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) {
    canvas.hidden = true;
    return;
  }
  context.putImageData(
    new ImageData(new Uint8ClampedArray(output), dimensions.width, dimensions.height),
    0,
    0,
  );
}

function showResult(payload) {
  const list = document.createElement("dl");
  list.className = "result-grid";
  appendFact(list, "Fixture", `${payload.fixture.url} — SHA-256 ${payload.fixture.sha256}`);
  appendFact(
    list,
    "Pixels",
    `${payload.dimensions.width} × ${payload.dimensions.height}; all ${payload.dimensions.rgbaBytes} RGBA bytes exact`,
  );
  appendFact(list, "Output SHA-256", payload.outputSha256);
  appendFact(
    list,
    "Visited mask",
    payload.maskSha256 ? `${demo.maskLabel}; SHA-256 ${payload.maskSha256}` : demo.maskLabel,
  );
  appendFact(
    list,
    "Changed bounds",
    payload.changedBounds ? JSON.stringify(payload.changedBounds) : demo.boundsLabel,
  );
  appendFact(list, "Validation", payload.validation);
  const heading = document.createElement("h3");
  heading.textContent = "Exact work counters";
  const counters = document.createElement("pre");
  counters.textContent = JSON.stringify(payload.counters, null, 2);
  result.replaceChildren(list, heading, counters);
  result.hidden = false;
  drawOutput(payload.output, payload.dimensions);
  status.textContent = `${demo.title} completed with exact fixture and oracle hashes.`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  retireActive();
  const token = `${++sequence}:${crypto.randomUUID()}`;
  const worker = new Worker("/benchmarks/image-demo-worker.js", { type: "module" });
  const timeout = setTimeout(() => {
    if (!active || active.token !== token) return;
    retireActive();
    sequence += 1;
    setFailure(`Stopped after the fixed ${TIMEOUT_MS / 1_000}-second timeout.`);
  }, TIMEOUT_MS);
  active = { token, worker, timeout };
  setRunning(true);
  result.hidden = true;
  canvas.hidden = true;
  status.textContent = `Running ${demo.title} in a fresh module worker…`;
  worker.addEventListener("message", (messageEvent) => {
    if (!active || active.token !== token || messageEvent.data?.token !== token) return;
    const message = messageEvent.data;
    retireActive();
    setRunning(false);
    if (message.type === "result") showResult(message.result);
    else setFailure(`Run failed: ${message.message ?? "unknown worker error"}`);
  });
  worker.addEventListener("error", () => {
    if (!active || active.token !== token) return;
    retireActive();
    setFailure("Run failed before the worker returned a result.");
  });
  worker.postMessage({ type: "run", token, demoId, target: target.value });
});

cancelButton.addEventListener("click", () => {
  if (!active) return;
  sequence += 1;
  retireActive();
  setRunning(false);
  status.textContent =
    "Canceled. The worker was terminated and its in-memory result was discarded.";
});

renderCanvas.addEventListener("change", () => {
  if (lastOutput) drawOutput(lastOutput.output, lastOutput.dimensions);
  else canvas.hidden = true;
});

globalThis.addEventListener("pagehide", () => {
  sequence += 1;
  retireActive();
});
