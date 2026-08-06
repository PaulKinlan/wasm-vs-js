const root = document.querySelector("main[data-workload-id]");
const workloadId = root?.dataset.workloadId;
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const target = document.querySelector("#target");
const status = document.querySelector("#status");
const output = document.querySelector("#result");
const canvas = document.querySelector("canvas");
const grid = document.querySelector("#grid");
let worker;
let token = 0;
let timer;

function makeWorker() {
  worker = new Worker("/benchmarks/game-family/worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    if (!data || data.token !== token) return;
    if (data.type === "error") return finishError(data.message);
    if (data.type !== "result") return;
    clearTimeout(timer);
    status.textContent =
      "Completed deterministic validation run; replaying retained trace checkpoints.";
    output.textContent = JSON.stringify(data.result, null, 2);
    replay(data.result, token);
    start.disabled = false;
    cancel.disabled = true;
  };
  worker.onerror = () => finishError("The worker stopped unexpectedly.");
}

function stopWorker() {
  clearTimeout(timer);
  worker?.terminate();
  makeWorker();
}

function finishError(message) {
  token += 1;
  stopWorker();
  status.textContent = message;
  output.textContent = "No result was accepted.";
  start.disabled = false;
  cancel.disabled = true;
}

function renderSnapshot(snapshot, result) {
  if (canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#161b22";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f2c94c";
    if (workloadId === "game.canvas-arcade.v1") {
      context.fillRect(
        (snapshot.x / 1280) * canvas.width - 6,
        (snapshot.y / 720) * canvas.height - 4,
        12,
        8,
      );
      context.fillStyle = "#71d4c8";
      for (let i = 0; i < snapshot.entities; i += 1) {
        context.fillRect(
          (i * 47 + snapshot.score) % canvas.width,
          (i * 29 + snapshot.frame) % canvas.height,
          3,
          3,
        );
      }
    } else {
      for (let i = 0; i < snapshot.entities; i += 1) {
        context.fillRect(
          (i * 37 + snapshot.sampleX) % canvas.width,
          (i * 23 + snapshot.sampleY) % canvas.height,
          4,
          4,
        );
      }
      context.strokeStyle = "#ef8354";
      context.strokeRect(snapshot.goalX * 20, snapshot.goalY * 20, 18, 18);
    }
  }
  if (grid) {
    grid.replaceChildren();
    for (let i = 0; i < result.visual.columns * result.visual.rows; i += 1) {
      const cell = document.createElement("span");
      cell.className = `cell${i === snapshot.selected ? " selected" : ""}${
        i < result.visual.units ? " occupied" : ""
      }`;
      grid.append(cell);
    }
  }
}

function replay(result, acceptedToken) {
  const trace = result.replay;
  if (!Array.isArray(trace) || trace.length === 0) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    renderSnapshot(trace.at(-1), result);
    return;
  }
  let index = 0;
  const next = () => {
    if (acceptedToken !== token) return;
    renderSnapshot(trace[index], result);
    index += 1;
    if (index < trace.length) requestAnimationFrame(next);
  };
  requestAnimationFrame(next);
}

if (document.body?.dataset?.unifiedRunnerActive) {
  // unified-runner.js owns the run control (composed flow). demo.js keeps only
  // the static visual render; the worker run + result rendering defer.
  if (start) start.disabled = false;
} else {
  start?.addEventListener("click", () => {
    token += 1;
    status.textContent = "Running in a dedicated worker…";
    output.textContent = "Waiting for deterministic output.";
    start.disabled = true;
    cancel.disabled = false;
    worker.postMessage({ type: "start", token, workloadId, variantId: target.value });
    timer = setTimeout(
      () =>
        finishError(
          "Timed out after 15 seconds; the worker was terminated and its token invalidated.",
        ),
      15000,
    );
  });

  cancel?.addEventListener("click", () => {
    token += 1;
    stopWorker();
    status.textContent = "Cancelled; late output from the invalidated token will be ignored.";
    output.textContent = "No result was accepted.";
    start.disabled = false;
    cancel.disabled = true;
  });
}

makeWorker();
start.disabled = false;
