import {
  clearCanvasPresentation,
  DEMO_TIMEOUT_MS,
  ImageDemoController,
} from "./image-demo-controller.js";

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

function setRunning(running) {
  startButton.disabled = running;
  target.disabled = running;
  cancelButton.disabled = !running;
  status.setAttribute("aria-busy", String(running));
}

function clearPresentation() {
  result.replaceChildren();
  result.hidden = true;
  clearCanvasPresentation(canvas);
}

function appendFact(list, term, value) {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}

function drawOutput(output, dimensions) {
  canvas.hidden = !renderCanvas.checked;
  if (!renderCanvas.checked) return;
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) {
    clearCanvasPresentation(canvas);
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
}

const controller = new ImageDemoController({
  createWorker: () => new Worker("/benchmarks/image-demo-worker.js", { type: "module" }),
  onPresentation: (payload) => payload ? showResult(payload) : clearPresentation(),
  onState: (event) => {
    const running = event.state === "running";
    setRunning(running);
    if (running) status.textContent = `Running ${demo.title} in a fresh module worker…`;
    else if (event.state === "completed") {
      status.textContent = `${demo.title} completed with exact fixture and oracle values.`;
    } else if (event.state === "canceled") {
      status.textContent =
        "Canceled. The worker was terminated and its in-memory result was discarded.";
    } else if (event.state === "timeout") {
      status.textContent = `Stopped after the fixed ${event.timeoutMs / 1_000}-second timeout.`;
    } else if (event.state === "error") status.textContent = `Run failed: ${event.message}.`;
  },
  timeoutMs: DEMO_TIMEOUT_MS,
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    controller.start({ demoId, target: target.value });
  } catch (error) {
    clearPresentation();
    setRunning(false);
    status.textContent = `Run failed: ${
      error instanceof Error ? error.message : "worker setup failed"
    }.`;
  }
});

cancelButton.addEventListener("click", () => controller.cancel());
renderCanvas.addEventListener("change", () => {
  const payload = controller.getLastResult();
  if (payload) drawOutput(payload.output, payload.dimensions);
  else clearCanvasPresentation(canvas);
});
globalThis.addEventListener("pagehide", () => controller.dispose());
