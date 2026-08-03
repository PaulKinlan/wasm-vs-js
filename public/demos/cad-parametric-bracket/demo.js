const target = document.querySelector("#target");
const form = document.querySelector("#controls");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
let worker = null;
let token = 0;
let timeout = null;
function cleanup() {
  token++;
  if (timeout !== null) clearTimeout(timeout);
  timeout = null;
  worker?.terminate();
  worker = null;
  start.disabled = false;
  cancel.disabled = true;
}
function finish(message) {
  cleanup();
  status.textContent = message;
}
function begin() {
  cleanup();
  const runToken = token;
  const owned = new Worker("/demos/cad-parametric-bracket/worker.js", { type: "module" });
  worker = owned;
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Constructing the complete bracket in a fresh worker…";
  result.textContent = "No completed result.";
  owned.onmessage = (event) => {
    if (worker !== owned || token !== runToken || event.data?.token !== runToken) return;
    if (event.data.type === "error") return finish(`Failed: ${event.data.message}`);
    if (event.data.type !== "result") return;
    const value = event.data.result;
    if (value.oracleVerified !== true) return finish("Failed: frozen oracle was not verified.");
    cleanup();
    status.textContent =
      "Complete. Frozen exact-output oracle verified; no duration was collected.";
    result.textContent = [
      `Target: ${value.variantId}`,
      `Complete output SHA-256: ${value.completeOutputSha256}`,
      `Complete output digest: ${value.completeOutputDigest}`,
      `Triangles: ${value.triangleCount}`,
      `Topology: ${JSON.stringify(value.topology, null, 2)}`,
      `Counters: ${JSON.stringify(value.counters, null, 2)}`,
    ].join("\n");
  };
  owned.onerror = (event) => {
    if (worker === owned && token === runToken) {
      finish(`Failed: ${event.message || "worker error"}`);
    }
  };
  timeout = setTimeout(() => {
    if (worker === owned && token === runToken) {
      finish("Stopped after the 10-second correctness timeout.");
    }
  }, 10_000);
  owned.postMessage({ type: "start", token: runToken, variantId: target.value });
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  begin();
});
cancel.addEventListener("click", () => finish("Cancelled. The worker was terminated."));
addEventListener("pagehide", cleanup);
