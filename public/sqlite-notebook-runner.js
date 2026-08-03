(() => {
  const form = document.querySelector("#notebook-form");
  const target = document.querySelector("#target");
  const query = document.querySelector("#query");
  const exact = document.querySelector("#exact");
  const start = document.querySelector("#start");
  const cancel = document.querySelector("#cancel");
  const status = document.querySelector("#status");
  const progress = document.querySelector("#progress");
  const result = document.querySelector("#result");
  const TIMEOUT_MS = 120_000;
  let worker = null;
  let timeout = null;
  let token = 0;

  function cleanup() {
    token++;
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;
    worker?.terminate();
    worker = null;
    start.disabled = false;
    cancel.disabled = true;
  }

  function setFailure(message) {
    status.textContent = `Failed: ${message}`;
    progress.value = 0;
    result.textContent = message;
    cleanup();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    cleanup();
    const runToken = token;
    worker = new Worker("/sqlite-notebook-worker.js");
    start.disabled = true;
    cancel.disabled = false;
    status.textContent = "Starting a fresh in-memory database…";
    progress.value = 0;
    result.textContent = "Running…";
    const ownedWorker = worker;
    ownedWorker.addEventListener("message", (message) => {
      if (runToken !== token || ownedWorker !== worker || message.data.token !== runToken) return;
      if (message.data.type === "progress") {
        status.textContent = message.data.label;
        progress.value = message.data.value;
        return;
      }
      if (message.data.type === "error") {
        setFailure(message.data.message);
        return;
      }
      if (message.data.type === "result") {
        const output = message.data.result;
        status.textContent = "Complete. Every returned value matched the independent reference.";
        progress.value = 4;
        result.textContent = [
          `Variant: ${output.variant}`,
          `Engine: ${output.engine.engine} ${output.engine.version}`,
          `Queries: ${output.results.length}`,
          `Canonical output SHA-256: ${output.sha256}`,
          `Counters: ${JSON.stringify(output.counters, null, 2)}`,
          `Raw-byte checks: ${output.exactChecks.join("; ")}`,
          "",
          JSON.stringify(output.results, null, 2),
        ].join("\n");
        cleanup();
      }
    });
    ownedWorker.addEventListener("error", (error) => {
      if (runToken !== token || ownedWorker !== worker) return;
      setFailure(error.message || "Worker error");
    });
    timeout = setTimeout(() => {
      if (runToken !== token || ownedWorker !== worker) return;
      setFailure(`Stopped after ${TIMEOUT_MS / 1000} seconds`);
    }, TIMEOUT_MS);
    ownedWorker.postMessage({
      type: "run",
      token: runToken,
      target: target.value,
      queryId: query.value === "all" ? null : query.value,
      exact: exact.checked,
    });
  });

  cancel.addEventListener("click", () => {
    if (!worker) return;
    cleanup();
    status.textContent = "Cancelled. The worker and in-memory database were discarded.";
    result.textContent = "No result retained.";
    progress.value = 0;
  });
  self.addEventListener("pagehide", cleanup);
})();
