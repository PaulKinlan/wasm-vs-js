const form = document.querySelector("#run-form");
const engine = document.querySelector("#engine");
const startButton = document.querySelector("#start");
const cancelButton = document.querySelector("#cancel");
const progress = document.querySelector("#progress");
const status = document.querySelector("#status");
const result = document.querySelector("#result");

let worker = null;
let token = 0;
let timer = 0;

function cleanup() {
  token++;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  timer = 0;
  startButton.disabled = false;
  cancelButton.disabled = true;
}

function fail(message) {
  cleanup();
  status.textContent = `Failed: ${message}`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  worker = new Worker("./worker.js", { type: "module" });
  startButton.disabled = true;
  cancelButton.disabled = false;
  progress.value = 0;
  status.textContent = "Starting fresh worker…";
  result.textContent = "No result yet.";
  const ownedWorker = worker;
  ownedWorker.addEventListener("message", ({ data }) => {
    if (worker !== ownedWorker || runToken !== token || data.token !== runToken) return;
    if (data.type === "progress") {
      progress.value = data.step;
      status.textContent = data.message;
      return;
    }
    if (data.type === "error") {
      fail(data.message);
      return;
    }
    if (data.type === "complete") {
      const output = data.result;
      cleanup();
      progress.value = 4;
      status.textContent = "Complete. Exact registration and oracle passed.";
      result.textContent = [
        `Variant: ${output.variant}`,
        `Input SHA-256: ${output.inputSha256}`,
        `Ordered captures SHA-256: ${output.outputSha256}`,
        `Matches: ${output.counters.matchesFound}`,
        `Per-pattern captures: ${output.counters.perPattern.join(", ")}`,
        `Candidate starts: ${output.counters.candidateStarts}`,
        `Prefix byte comparisons: ${output.counters.prefixByteComparisons}`,
        `Tail byte comparisons: ${output.counters.tailByteComparisons}`,
        `Boundary crossings: ${output.counters.boundaryCrossings}`,
      ].join("\n");
    }
  });
  ownedWorker.addEventListener("error", (event) => {
    if (worker !== ownedWorker || runToken !== token) return;
    fail(event.message || "worker error");
  });
  ownedWorker.postMessage({ token: runToken, variant: engine.value });
  timer = setTimeout(() => {
    if (worker !== ownedWorker || runToken !== token) return;
    fail("120 second worker timeout");
  }, 120_000);
});

cancelButton.addEventListener("click", () => {
  cleanup();
  progress.value = 0;
  status.textContent = "Cancelled. The worker was terminated.";
  result.textContent = "No result retained.";
});

addEventListener("pagehide", cleanup);
