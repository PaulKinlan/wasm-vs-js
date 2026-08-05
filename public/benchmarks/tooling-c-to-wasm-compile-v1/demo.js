const form = document.querySelector("#demo-compiler-form");
const program = document.querySelector("#demo-program");
const target = document.querySelector("#demo-target");
const start = document.querySelector("#demo-start");
const cancel = document.querySelector("#demo-cancel");
const status = document.querySelector("#demo-status");
const result = document.querySelector("#demo-result");
for (let index = 1; index <= 20; index += 1) {
  const id = String(index).padStart(2, "0");
  program.add(new Option(`Program ${id}`, id));
}
let worker = null;
let token = 0;
let timeout = null;
function cleanup(message) {
  token += 1;
  if (worker) worker.terminate();
  worker = null;
  if (timeout !== null) clearTimeout(timeout);
  timeout = null;
  start.disabled = false;
  cancel.disabled = true;
  if (message) status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  worker = new Worker("/benchmarks/tooling-c-to-wasm-compile-v1/worker.js", { type: "module" });
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Compiling…";
  result.textContent = "No result yet.";
  worker.onmessage = ({ data }) => {
    if (runToken !== token || data.token !== runToken) return;
    if (data.type === "complete") {
      result.textContent = JSON.stringify(data.result, null, 2);
      cleanup("Complete.");
    } else if (data.type === "error") {
      result.textContent = data.message;
      cleanup("Failed.");
    }
  };
  worker.onerror = () => {
    if (runToken === token) cleanup("Worker failed.");
  };
  worker.postMessage({ token: runToken, target: target.value, program: program.value });
  timeout = setTimeout(() => cleanup("Stopped after the 20 second limit."), 20_000);
});
cancel.addEventListener("click", () => cleanup("Cancelled."));
addEventListener("pagehide", () => cleanup());
