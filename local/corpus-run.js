const status = document.querySelector("#corpus-status"),
  button = document.querySelector("#run-corpus");
const token = new URL(location.href).searchParams.get("token");
let manifest;
let activeWorker;
globalThis.__releaseCorpusWorker = () => {
  activeWorker?.terminate();
  activeWorker = undefined;
  globalThis.__corpusWorkerReleased = true;
};
try {
  if (!token) throw new Error("launch token missing");
  const response = await fetch(`/api/corpus/manifest?token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("launch manifest denied");
  manifest = await response.json();
  if (manifest.experimentId !== "m1-chrome-sum-u32-v1") throw new Error("experiment mismatch");
  status.textContent = `Bound block ${manifest.blockId}; ${manifest.stratum}; ${
    manifest.order.join(" then ")
  }.`;
} catch (error) {
  button.disabled = true;
  status.textContent = `Blocked: ${error instanceof Error ? error.message : "manifest failure"}`;
}
button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "Running immutable pair…";
  const worker = new Worker("/hosted-runner-worker.js", { type: "module" });
  activeWorker = worker;
  try {
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("collector timeout")), 120000);
      worker.onmessage = (event) => {
        if (event.data?.type === "complete") {
          clearTimeout(timeout);
          resolve(event.data.result);
        } else if (event.data?.type === "error") {
          clearTimeout(timeout);
          reject(new Error(event.data.message));
        }
      };
      worker.onerror = () => reject(new Error("collector worker error"));
      worker.postMessage({
        iterations: 20,
        order: manifest.order[0] === "js-controlled" ? "js-first" : "wasm-first",
        serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
      });
    });
    globalThis.__corpusResult = { manifest, result };
    status.textContent = "Pair complete; awaiting orchestrator collection.";
  } catch (error) {
    globalThis.__corpusError = String(error);
    status.textContent = `Blocked: ${error instanceof Error ? error.message : "collector error"}`;
  }
});
