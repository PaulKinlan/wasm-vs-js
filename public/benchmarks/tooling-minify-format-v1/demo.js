const form = document.querySelector("form"),
  start = document.querySelector("#start"),
  cancel = document.querySelector("#cancel"),
  status = document.querySelector("#status"),
  output = document.querySelector("#output");
let worker = null, token = 0, timer = 0;
function cleanup(message) {
  token++;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  timer = 0;
  start.disabled = false;
  cancel.disabled = true;
  if (message) status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  worker = new Worker("./worker.js", { type: "module" });
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Running exact generated fixture…";
  output.textContent = "No result yet.";
  worker.onmessage = ({ data }) => {
    if (runToken !== token || data.token !== runToken) return;
    if (!data.ok) {
      cleanup(`Failed: ${data.error}`);
      return;
    }
    output.textContent = JSON.stringify(data, null, 2);
    cleanup("Complete. Canonical output and fixed work passed.");
  };
  worker.onerror = (event) => {
    if (runToken !== token) return;
    cleanup(`Failed: ${event.message}`);
  };
  worker.postMessage({
    token: runToken,
    target: form.target.value,
    language: form.language.value,
    operation: form.operation.value,
    mode: form.mode.value,
  });
  timer = setTimeout(() => cleanup("Stopped after the 30 second bound."), 30_000);
});
cancel.addEventListener("click", () => cleanup("Cancelled."));
addEventListener("pagehide", () => cleanup());
