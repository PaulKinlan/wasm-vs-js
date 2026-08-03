const form = document.querySelector("#effects-form");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const output = document.querySelector("#output");
const progress = document.querySelector("#progress");
const TIMEOUT_MS = 120_000;
let generation = 0;
let active = null;

function cleanup(message, text = "") {
  generation++;
  if (active) {
    clearTimeout(active.timeout);
    active.worker.terminate();
    active = null;
  }
  start.disabled = false;
  cancel.disabled = true;
  status.textContent = message;
  if (text) output.textContent = text;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (active || !form.reportValidity()) return;
  const token = ++generation;
  const worker = new Worker("/base-audio-effects-worker.js", { type: "module" });
  active = {
    token,
    worker,
    timeout: setTimeout(() => {
      if (active?.token === token) cleanup("Stopped: the 120-second validation timeout expired.");
    }, TIMEOUT_MS),
  };
  start.disabled = true;
  cancel.disabled = false;
  progress.value = 0;
  output.textContent = "";
  status.textContent = "Generating the exact fixture in a fresh worker.";
  worker.addEventListener("message", (event) => {
    if (
      !active || active.worker !== worker || event.data?.token !== token || generation !== token
    ) return;
    if (event.data.type === "progress") {
      progress.value = event.data.phase;
      status.textContent = event.data.message;
    } else if (event.data.type === "complete") {
      progress.value = 4;
      cleanup("Complete. The full output matched the committed oracle.", event.data.text);
    } else if (event.data.type === "error") cleanup(`Stopped: ${event.data.message}`);
  });
  worker.addEventListener("error", (event) => {
    if (active?.worker === worker && generation === token) {
      cleanup(`Stopped: ${event.message || "worker failed"}`);
    }
  });
  worker.postMessage({ token, target: new FormData(form).get("target") });
});

cancel.addEventListener("click", () => cleanup("Cancelled. No result was retained."));
addEventListener("pagehide", () => cleanup("Page hidden; active work was terminated."));
