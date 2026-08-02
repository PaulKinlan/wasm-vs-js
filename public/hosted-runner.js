import { boundedIterations, ORACLE } from "./hosted-runner-core.js";

const INPUT_LENGTH = 65_536;
const INPUT_BYTES = INPUT_LENGTH * Uint32Array.BYTES_PER_ELEMENT;
const INPUT_SHA256 = "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7";
const WORKER_TIMEOUT_MS = 120_000;
const form = document.querySelector("#hosted-runner-form");
const button = document.querySelector("#start-live-run");
const status = document.querySelector("#live-status");
const progress = document.querySelector("#run-progress");
const phases = document.querySelector("#live-phases");
const results = document.querySelector("#live-results");
const resultContent = document.querySelector("#result-content");
const resultDisclaimer = document.querySelector("#result-disclaimer");

function addPhase(message) {
  const item = document.createElement("li");
  item.textContent = message;
  phases.append(item);
  status.textContent = message;
}

function ms(value) {
  return `${value.toFixed(3)} ms`;
}

function appendDefinition(parent, rows) {
  const list = document.createElement("dl");
  list.className = "result-facts";
  for (const [term, description] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = String(description);
    list.append(dt, dd);
  }
  parent.append(list);
}

function appendTable(parent, captionText, headers, rows) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-wrap";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = captionText;
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const values of rows) {
    const row = document.createElement("tr");
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(caption, head, body);
  wrapper.append(table);
  parent.append(wrapper);
}

function renderResult(data) {
  resultContent.replaceChildren();
  resultDisclaimer.textContent =
    "Exploratory single-tab run only. Do not use these values as an accepted JavaScript-versus-Wasm performance claim; independent fresh-launch pairs and the preregistered precision gate are absent.";

  const disclosure = document.createElement("section");
  const disclosureTitle = document.createElement("h3");
  disclosureTitle.textContent = "Run disclosure";
  disclosure.append(disclosureTitle);
  appendDefinition(disclosure, [
    ["Captured", data.capturedAt],
    ["Browser", navigator.userAgent],
    ["Logical processors", navigator.hardwareConcurrency ?? "unavailable"],
    ["Viewport", `${innerWidth} × ${innerHeight} at ${devicePixelRatio} DPR`],
    ["Secure / isolated", `${isSecureContext} / ${crossOriginIsolated}`],
    [
      "Service Worker",
      navigator.serviceWorker?.controller ? "controlling this page" : "none controlling this page",
    ],
    ["Order", data.order === "js-first" ? "JavaScript, then Wasm" : "Wasm, then JavaScript"],
    ["Scored iterations", data.iterations],
    ["Cache", data.cache],
  ]);

  const correctness = document.createElement("section");
  const correctnessTitle = document.createElement("h3");
  correctnessTitle.textContent = "Correctness and fixed work";
  correctness.append(correctnessTitle);
  appendDefinition(correctness, [
    ["Verdict", `Passed: JavaScript and linear Wasm both returned exact u32 oracle ${ORACLE}.`],
    [
      "Input",
      `${INPUT_LENGTH.toLocaleString()} Uint32 values · ${INPUT_BYTES.toLocaleString()} bytes · SHA-256 ${INPUT_SHA256}`,
    ],
    [
      "Per scored sample",
      `${data.work.items.toLocaleString()} items, ${data.work.inputBytes.toLocaleString()} input bytes, ${data.work.additions.toLocaleString()} additions, ${data.work.loads.toLocaleString()} loads, ${data.work.boundaryCrossings.toLocaleString()} boundary crossings`,
    ],
    ["Measurement batch", `${data.batchSize} complete sums per scored sample`],
  ]);

  const provenance = document.createElement("section");
  const provenanceTitle = document.createElement("h3");
  provenanceTitle.textContent = "Published build provenance";
  provenance.append(provenanceTitle);
  appendDefinition(provenance, [
    ["Track", "Controlled Track A · scalar O(n) modulo-2³² sum"],
    ["Build source SHA-256", data.manifest.sourceSha256],
    ["JavaScript SHA-256", `${data.jsSha256} · fetched bytes verified before execution`],
    ["Wasm SHA-256", data.wasmSha256],
    [
      "Wasm footprint",
      `${data.manifest.variants["wasm-linear-controlled"].footprint.rawBytes} raw / ${
        data.manifest.variants["wasm-linear-controlled"].footprint.gzipBytes
      } gzip / ${
        data.manifest.variants["wasm-linear-controlled"].footprint.brotliBytes
      } Brotli bytes`,
    ],
    ["Build command", data.manifest.build.command],
    ["Build flags", data.manifest.build.flags.join(" · ")],
  ]);

  const lifecycle = document.createElement("section");
  const lifecycleTitle = document.createElement("h3");
  lifecycleTitle.textContent = "First-use lifecycle (not scored samples)";
  lifecycle.append(lifecycleTitle);
  appendTable(lifecycle, "First-use lifecycle durations", ["Phase", "Duration / availability"], [
    [
      `Build manifest transfer (${data.lifecycle.manifestBytes} bytes)`,
      ms(data.lifecycle.manifestTransferMs),
    ],
    ["Build manifest decode + JSON parse", ms(data.lifecycle.manifestDecodeParseMs)],
    [
      `JavaScript workload transfer (${data.lifecycle.jsBytes} bytes)`,
      ms(data.lifecycle.jsTransferMs),
    ],
    ["JavaScript SHA-256 verification", ms(data.lifecycle.jsHashVerifyMs)],
    [
      "Verified JavaScript module import (combined)",
      `${
        ms(data.lifecycle.jsVerifiedModuleImportMs)
      } · resolution, parse, and evaluation not separable`,
    ],
    [
      "JavaScript module parse",
      `${data.lifecycle.jsModuleParseMs.status}: ${data.lifecycle.jsModuleParseMs.reason}`,
    ],
    [
      "JavaScript module evaluation",
      `${data.lifecycle.jsModuleEvaluationMs.status}: ${data.lifecycle.jsModuleEvaluationMs.reason}`,
    ],
    [
      `Wasm transfer (${data.lifecycle.wasmBytes} bytes)`,
      ms(data.lifecycle.wasmTransferMs),
    ],
    ["Wasm SHA-256 verification", ms(data.lifecycle.wasmHashVerifyMs)],
    ["Wasm compile", ms(data.lifecycle.wasmCompileMs)],
    ["Wasm instantiate", ms(data.lifecycle.wasmInstantiateMs)],
    ["Input generation", ms(data.lifecycle.inputGenerateMs)],
    ["Input copy into linear memory", ms(data.lifecycle.inputCopyMs)],
    ["First JavaScript execute", ms(data.lifecycle.jsFirstExecuteMs)],
    ["First Wasm execute", ms(data.lifecycle.wasmFirstExecuteMs)],
  ]);

  const timing = document.createElement("section");
  const timingTitle = document.createElement("h3");
  timingTitle.textContent = "Scored post-calibration samples";
  timing.append(timingTitle);
  appendTable(timing, "Absolute scored durations; no winner or ratio is inferred", [
    "Variant",
    "First scored",
    "Median",
    "p95",
    "Samples",
  ], [
    [
      "JavaScript controlled",
      ms(data.js.firstScoredMs),
      ms(data.js.medianMs),
      ms(data.js.p95Ms),
      data.js.count,
    ],
    [
      "Linear Wasm controlled",
      ms(data.wasm.firstScoredMs),
      ms(data.wasm.medianMs),
      ms(data.wasm.p95Ms),
      data.wasm.count,
    ],
  ]);
  appendTable(
    timing,
    "Complete scored trajectory",
    ["Iteration", "JavaScript", "Linear Wasm"],
    data.js.samples.map((value, index) => [index + 1, ms(value), ms(data.wasm.samples[index])]),
  );

  resultContent.append(disclosure, correctness, provenance, lifecycle, timing);
  results.hidden = false;
  results.focus?.();
}

function executeRun(iterations, order) {
  progress.max = iterations * 2;
  progress.value = 0;
  return new Promise((resolve, reject) => {
    const worker = new Worker("/hosted-runner-worker.js", { type: "module" });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      callback(value);
    };
    const timeout = setTimeout(
      () => finish(reject, new Error("The bounded live run exceeded 120 seconds.")),
      WORKER_TIMEOUT_MS,
    );
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message?.type === "phase") {
        addPhase(message.message);
      } else if (message?.type === "progress") {
        progress.value = Math.min(iterations * 2, message.completed);
        status.textContent = `Scoring ${message.variant}, iteration ${
          message.iteration + 1
        } of ${iterations} in the worker…`;
      } else if (message?.type === "complete") {
        progress.value = iterations * 2;
        finish(resolve, message.result);
      } else if (message?.type === "error") {
        finish(reject, new Error(message.message));
      }
    });
    worker.addEventListener("error", (event) => {
      finish(reject, new Error(event.message || "The measurement worker failed."));
    });
    worker.postMessage({ iterations, order });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  results.hidden = true;
  resultContent.replaceChildren();
  phases.replaceChildren();
  progress.value = 0;
  try {
    const data = new FormData(form);
    const iterations = boundedIterations(data.get("iterations"));
    const order = String(data.get("order"));
    const result = await executeRun(iterations, order);
    renderResult(result);
    addPhase("Exploratory pair complete. Nothing was uploaded or saved.");
  } catch (error) {
    status.textContent = `Run blocked: ${
      error instanceof Error ? error.message : "Unknown error."
    }`;
  } finally {
    button.disabled = false;
  }
});
