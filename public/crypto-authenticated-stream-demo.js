const form = document.querySelector("#demo-form");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const output = document.querySelector("#output");
const TIMEOUT_MS = 120_000;
let sequence = 0;
let active = null;

function stop(message, text = "") {
  if (!active) return;
  clearTimeout(active.timeout);
  active.worker.terminate();
  active = null;
  start.disabled = false;
  cancel.disabled = true;
  status.textContent = message;
  if (text) output.textContent = text;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (active || !form.reportValidity()) return;
  const token = ++sequence;
  const worker = new Worker("/crypto-authenticated-stream-worker.js", { type: "module" });
  active = {
    token,
    worker,
    timeout: setTimeout(() => {
      if (active?.token === token) stop("Stopped: the 120 second timeout expired.");
    }, TIMEOUT_MS),
  };
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Running in a fresh worker.";
  output.textContent = "";
  worker.addEventListener("message", (event) => {
    if (!active || event.data?.token !== active.token || event.data?.token !== token) return;
    if (event.data.type === "complete") {
      stop(
        "Complete. Exact output and counters passed.",
        JSON.stringify(event.data.result, null, 2),
      );
    } else if (event.data.type === "error") stop(`Stopped: ${event.data.message}`);
  });
  worker.addEventListener("error", (event) => {
    if (active?.token === token) stop(`Stopped: ${event.message || "worker failed"}`);
  });
  const values = Object.fromEntries(new FormData(form));
  worker.postMessage({ token, variant: values.variant, mode: values.mode });
});

cancel.addEventListener("click", () => {
  if (active) stop("Cancelled. No result was retained.");
});
addEventListener("pagehide", () => {
  if (active) stop("Stopped because the page was hidden.");
});
