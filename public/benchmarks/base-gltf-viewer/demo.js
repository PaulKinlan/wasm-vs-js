const form = document.querySelector("form"),
  start = document.querySelector("#gltf-start"),
  cancel = document.querySelector("#gltf-cancel");
const status = document.querySelector("#gltf-status"),
  output = document.querySelector("#gltf-output"),
  progress = document.querySelector("progress");
const canvas = document.querySelector("canvas"), ctx = canvas.getContext("2d");
let worker = null, token = 0, timer = 0;
function cleanup() {
  token++;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  clearTimeout(timer);
  start.disabled = false;
  cancel.disabled = true;
  progress.value = 0;
}
function finish(message) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  clearTimeout(timer);
  start.disabled = false;
  cancel.disabled = true;
  status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Starting fresh worker.";
  output.textContent = "No result yet.";
  worker = new Worker("/benchmarks/base-gltf-viewer/worker.js", { type: "module" });
  worker.onmessage = (event) => {
    if (runToken !== token || event.data?.token !== runToken) return;
    if (event.data.type === "progress") {
      status.textContent = event.data.phase;
      progress.value = event.data.value;
    } else if (event.data.type === "error") {
      output.textContent = event.data.message;
      finish("Run failed.");
    } else if (event.data.type === "complete") {
      const r = event.data.result;
      const preview = new Uint8ClampedArray(r.preview);
      ctx.putImageData(new ImageData(preview, 96, 96), 0, 0);
      output.textContent =
        `Target: ${r.target}\nMode: ${r.mode}\nComplete output SHA-256: ${r.digest}\nSource commit: ${r.sourceCommit}\nFrames: ${r.frames}\nDecoded vertices / indices: ${r.decodedVertices} / ${r.decodedIndices}\nVertex transforms: ${r.vertexTransforms}\nTriangles tested / visible: ${r.trianglesTested} / ${r.visibleTriangles}\nPick tests / hits: ${r.pickTests} / ${r.pickHits}\nRetained raster frames / pixel writes: ${r.retainedRasterFrames} / ${r.rasterizedPixels}\nBoundary crossings: ${r.boundaryCrossings}\nAllocations: ${r.allocations}\nInput / output bytes: ${r.inputBytes} / ${r.outputBytes}`;
      progress.value = 100;
      finish("Complete. Output and fixed work matched the registered oracle.");
    }
  };
  worker.onerror = (event) => {
    if (runToken !== token) return;
    output.textContent = event.message;
    finish("Worker error.");
  };
  worker.postMessage({
    token: runToken,
    target: form.elements.target.value,
    mode: form.elements.mode.value,
  });
  timer = setTimeout(() => {
    if (runToken !== token) return;
    cleanup();
    status.textContent = "Stopped after the 120 second limit.";
    output.textContent = "No result retained.";
  }, 120000);
});
cancel.addEventListener("click", () => {
  cleanup();
  status.textContent = "Cancelled. The worker was terminated.";
  output.textContent = "No result retained.";
});
addEventListener("pagehide", cleanup);
