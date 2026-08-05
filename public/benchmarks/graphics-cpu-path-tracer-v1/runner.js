const form = document.querySelector("form"),
  start = document.querySelector("#pt-start"),
  cancel = document.querySelector("#pt-cancel"),
  status = document.querySelector("#pt-status"),
  output = document.querySelector("#pt-output"),
  canvas = document.querySelector("canvas"),
  progress = document.querySelector("progress");
let worker = null, token = 0, timer = null;
function cleanup() {
  token++;
  if (worker) worker.terminate();
  worker = null;
  if (timer) clearTimeout(timer);
  timer = null;
  start.disabled = false;
  cancel.disabled = true;
  progress.removeAttribute("value");
}
function show(message) {
  status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token, target = form.elements.target.value, mode = form.elements.mode.value;
  worker = new Worker("/benchmarks/graphics-cpu-path-tracer-v1/worker.js", { type: "module" });
  start.disabled = true;
  cancel.disabled = false;
  progress.value = 0.1;
  show("Starting fresh worker.");
  const active = worker;
  active.onmessage = (event) => {
    if (active !== worker || event.data.token !== runToken) return;
    if (event.data.type === "progress") {
      progress.value = event.data.phase === "compute" ? 0.35 : 0.8;
      show(`${event.data.phase}.`);
      return;
    }
    if (event.data.type === "error") {
      const message = event.data.message;
      cleanup();
      show(`Failed: ${message}`);
      output.textContent = "No accepted result.";
      return;
    }
    if (event.data.type === "complete") {
      const data = event.data,
        bytes = new Uint8ClampedArray(data.framebuffer),
        image = new ImageData(bytes, data.width, data.height);
      canvas.width = data.width;
      canvas.height = data.height;
      canvas.getContext("2d").putImageData(image, 0, 0);
      const text =
        `Target: ${data.target}\nMode: ${data.mode}\nFixed work: ${data.width}×${data.height} × ${data.spp} samples per pixel\nFramebuffer SHA-256: ${data.framebufferHash}\nReference: max channel delta ${data.comparison.maxChannelDelta}; mean ${data.comparison.meanChannelDelta}\nCounters: ${
          JSON.stringify(data.counters, null, 2)
        }\nCheckpoints: ${JSON.stringify(data.checkpoints, null, 2)}`;
      cleanup();
      show("Complete. Correctness passed; no timing was recorded.");
      output.textContent = text;
    }
  };
  active.onerror = (event) => {
    if (active !== worker) return;
    const message = event.message;
    cleanup();
    show(`Failed: ${message}`);
  };
  const timeout = mode === "exact" ? 150000 : 15000;
  timer = setTimeout(() => {
    if (active !== worker) return;
    cleanup();
    show(`Stopped after the ${timeout / 1000} second bound.`);
  }, timeout);
  active.postMessage({
    token: runToken,
    target,
    mode,
    trust: {
      buildManifestSha256: document.querySelector('meta[name="build-manifest-sha256"]').content,
    },
  });
});
cancel.addEventListener("click", () => {
  cleanup();
  show("Cancelled. Worker terminated.");
  output.textContent = "No accepted result.";
});
addEventListener("pagehide", cleanup);
