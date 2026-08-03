const form = document.querySelector("form[data-pcap-demo]");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const output = document.querySelector("#output");
const TIMEOUT_MS = 10_000;
let active = null;
let generation = 0;

function stop(message, text = "") {
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
  const runGeneration = ++generation;
  const token = crypto.randomUUID();
  const worker = new Worker("/pcap-decode-worker.js", { type: "module" });
  const timeout = setTimeout(() => {
    if (active?.generation === runGeneration) stop("Stopped: the 10 second timeout expired.");
  }, TIMEOUT_MS);
  active = { generation: runGeneration, token, worker, timeout };
  start.disabled = true;
  cancel.disabled = false;
  output.textContent = "";
  status.textContent = "Parsing the frozen eight-packet capture in a fresh worker.";
  worker.addEventListener("message", (event) => {
    if (!active || active.generation !== runGeneration || event.data?.token !== token) return;
    if (event.data.type === "error") return stop(`Stopped: ${event.data.message}`);
    if (event.data.type !== "complete") return;
    const result = event.data.result;
    stop(
      "Complete.",
      [
        `Target: ${result.target}`,
        `Canonical flow-table SHA-256: ${result.outputHash}`,
        `Protocols exercised: ${result.protocols.join(", ")}`,
        `Counters: ${JSON.stringify(result.counters, null, 2)}`,
      ].join("\n"),
    );
  });
  worker.addEventListener("error", (event) => {
    if (active?.generation === runGeneration) stop(`Stopped: ${event.message || "worker failed"}`);
  });
  worker.postMessage({ token, target: form.elements.target.value });
});
cancel.addEventListener("click", () => stop("Cancelled. No result was retained."));
self.addEventListener("pagehide", () => stop("Stopped for navigation."));
