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
  let workerUrl = null;
  let timeout = null;
  let token = 0;

  async function sha256(bytes) {
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function fetchBytes(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function prepareWorker(requireExact) {
    const trustResponse = await fetch("/assets/sqlite-notebook/runtime-trust-root.json", {
      cache: "no-store",
    });
    if (!trustResponse.ok) {
      throw new Error(`Runtime trust root returned ${trustResponse.status}`);
    }
    const trustRoot = await trustResponse.json();
    const manifestBytes = await fetchBytes("/assets/sqlite-notebook/runtime-manifest.json");
    const manifestHash = await sha256(manifestBytes);
    if (requireExact && manifestHash !== trustRoot.runtimeManifestSha256) {
      throw new Error(`Runtime manifest mismatch: ${manifestHash}`);
    }
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    const entries = new Map(manifest.files.map((entry) => [entry.id, entry]));
    for (const id of ["page", "runner", "worker"]) {
      if (!entries.has(id)) throw new Error(`Runtime manifest is missing ${id}`);
    }
    if (
      requireExact &&
      (entries.get("page").sha256 !== trustRoot.pageSha256 ||
        entries.get("runner").sha256 !== trustRoot.runnerSha256)
    ) {
      throw new Error("Page or runner does not match the external trust root");
    }
    const workerEntry = entries.get("worker");
    const workerBytes = await fetchBytes(workerEntry.path);
    const workerHash = await sha256(workerBytes);
    if (requireExact && workerHash !== workerEntry.sha256) {
      throw new Error(`${workerEntry.path} SHA-256 mismatch`);
    }
    const url = URL.createObjectURL(new Blob([workerBytes], { type: "text/javascript" }));
    return {
      manifest,
      url,
      shellChecks: [
        `runtime-manifest:${manifestHash}`,
        `page:${entries.get("page").sha256}`,
        `runner:${entries.get("runner").sha256}`,
        `worker:${workerHash}`,
      ],
    };
  }

  function cleanup() {
    token++;
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;
    worker?.terminate();
    worker = null;
    if (workerUrl !== null) URL.revokeObjectURL(workerUrl);
    workerUrl = null;
    start.disabled = false;
    cancel.disabled = true;
  }

  function setFailure(message) {
    status.textContent = `Failed: ${message}`;
    progress.value = 0;
    result.textContent = message;
    cleanup();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    cleanup();
    const runToken = token;
    start.disabled = true;
    cancel.disabled = false;
    status.textContent = "Binding the runtime to verified response bytes…";
    progress.value = 0;
    result.textContent = "Running…";
    let prepared;
    try {
      prepared = await prepareWorker(exact.checked);
    } catch (error) {
      if (runToken !== token) return;
      setFailure(error instanceof Error ? error.message : String(error));
      return;
    }
    if (runToken !== token) {
      URL.revokeObjectURL(prepared.url);
      return;
    }
    workerUrl = prepared.url;
    worker = new Worker(workerUrl);
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
          `Executed-byte checks: ${output.exactChecks.join("; ")}`,
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
      manifest: prepared.manifest,
      shellChecks: prepared.shellChecks,
    });
  });

  cancel.addEventListener("click", () => {
    cleanup();
    status.textContent = "Cancelled. The worker and in-memory database were discarded.";
    result.textContent = "No result retained.";
    progress.value = 0;
  });
  self.addEventListener("pagehide", cleanup);
})();
