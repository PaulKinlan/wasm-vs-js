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
  worker = new Worker("/demos/game-family/worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    if (!data || data.token !== token) return;
    if (data.type === "error") return finishError(data.message);
    if (data.type !== "result") return;
    clearTimeout(timer);
    status.textContent = "Completed deterministic validation run.";
    output.textContent = JSON.stringify(data.result, null, 2);
    draw(data.result);
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
  stopWorker();
  status.textContent = message;
  output.textContent = "No result was accepted.";
  start.disabled = false;
  cancel.disabled = true;
}

function draw(result) {
  const visual = result.visual;
  if (canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#161b22";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f2c94c";
    if (workloadId === "game.canvas-arcade.v1") {
      context.fillRect(
        (visual.x / 1280) * canvas.width - 6,
        (visual.y / 720) * canvas.height - 4,
        12,
        8,
      );
      context.fillStyle = "#71d4c8";
      for (let i = 0; i < visual.entities; i += 1) {
        context.fillRect((i * 47 + visual.score) % canvas.width, (i * 29) % canvas.height, 3, 3);
      }
    } else {
      for (let i = 0; i < visual.entities; i += 1) {
        context.fillRect((i * 37) % canvas.width, (i * 23) % canvas.height, 4, 4);
      }
      context.strokeStyle = "#ef8354";
      context.strokeRect(visual.goalX * 20, visual.goalY * 20, 18, 18);
    }
  }
  if (grid) {
    grid.replaceChildren();
    for (let i = 0; i < visual.columns * visual.rows; i += 1) {
      const cell = document.createElement("span");
      cell.className = `cell${i === visual.selected ? " selected" : ""}${
        i < visual.units ? " occupied" : ""
      }`;
      grid.append(cell);
    }
  }
}

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

makeWorker();
