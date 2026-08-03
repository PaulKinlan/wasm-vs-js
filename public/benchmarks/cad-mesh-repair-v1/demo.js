document.documentElement.classList.add("js");

const form = document.querySelector("#demo-form"),
  target = document.querySelector("#target"),
  start = document.querySelector("#start"),
  cancel = document.querySelector("#cancel"),
  status = document.querySelector("#status"),
  progress = document.querySelector("#progress"),
  result = document.querySelector("#result");
let worker = null, token = 0, timer = 0;
function cleanup() {
  token++;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  start.disabled = false;
  cancel.disabled = true;
  progress.value = 0;
}
function finish(message) {
  if (message.token !== token) return;
  clearTimeout(timer);
  worker?.terminate();
  worker = null;
  start.disabled = false;
  cancel.disabled = true;
  progress.value = 1;
  status.textContent = "Complete.";
  result.textContent = JSON.stringify(message.result, null, 2);
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  status.textContent = "Running bounded correctness check…";
  result.textContent = "No result yet.";
  progress.value = .2;
  start.disabled = true;
  cancel.disabled = false;
  worker = new Worker("/benchmarks/cad-mesh-repair-v1/worker.js", { type: "module" });
  const owned = worker;
  owned.onmessage = (event) => {
    if (owned !== worker || event.data.token !== runToken) return;
    if (event.data.type === "complete") finish(event.data);
    else if (event.data.type === "error") {
      cleanup();
      status.textContent = `Error: ${event.data.message}`;
    }
  };
  owned.onerror = () => {
    if (owned !== worker) return;
    cleanup();
    status.textContent = "Worker failed.";
  };
  owned.postMessage({ token: runToken, target: target.value });
  timer = setTimeout(() => {
    if (owned !== worker) return;
    cleanup();
    status.textContent = "Stopped after the 20 second limit.";
  }, 20000);
});
cancel.addEventListener("click", () => {
  cleanup();
  status.textContent = "Cancelled.";
  result.textContent = "No result retained.";
});
addEventListener("pagehide", cleanup);
