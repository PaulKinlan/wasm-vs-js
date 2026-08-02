import { boundedIterations, ORACLE } from "./hosted-runner-core.js";
import {
  captureLegacyChromiumHeap,
  captureUaClientHints,
  measureRefreshEstimate,
  positiveNumberHint,
  startResponsivenessObservation,
  supported,
  unavailable,
} from "./provenance-probes.js";

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

function typedText(metric, format = (value) => JSON.stringify(value)) {
  if (!metric || metric.status !== "supported-value") {
    return `${metric?.status ?? "unavailable"}: ${metric?.reason ?? "No evidence."}`;
  }
  return format(metric.value);
}

function heapText(metric) {
  return typedText(
    metric,
    (value) =>
      `${value.usedJSHeapSize.toLocaleString()} used / ${value.totalJSHeapSize.toLocaleString()} total JS heap bytes (${metric.scope})`,
  );
}

function uaChText(metric) {
  if (!metric || metric.status !== "supported-value") return typedText(metric);
  const high = metric.value.highEntropy;
  if (high.status !== "supported-value") return `${high.status}: ${high.reason}`;
  const field = (name) =>
    typedText(
      high.value[name],
      (value) =>
        value === ""
          ? "empty-valid"
          : typeof value === "string" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value),
    );
  return `architecture ${field("architecture")} · bitness ${field("bitness")} · model ${
    field("model")
  } · platform ${field("platformVersion")} · wow64 ${field("wow64")}`;
}

async function capturePageBefore() {
  const environment = {
    secureContext: supported(isSecureContext),
    crossOriginIsolated: supported(crossOriginIsolated),
    visibilityState: supported(document.visibilityState),
    timeOrigin: supported(performance.timeOrigin, { scope: "page-monotonic-time-origin" }),
    collectedNow: supported(performance.now(), { scope: "page-monotonic-milliseconds" }),
  };
  const uaClientHints = await captureUaClientHints(navigator);
  return {
    retention: "In-memory for this displayed result only; never uploaded or stored by this page.",
    compatibility: {
      userAgent: supported(navigator.userAgent, {
        caveat: "Raw compatibility string; not exact hardware identity.",
      }),
      platform: supported(navigator.platform, {
        caveat: "Legacy compatibility hint; may be reduced or spoofed.",
      }),
    },
    environment,
    machineHints: {
      uaExposedLogicalProcessors: positiveNumberHint(
        navigator,
        "hardwareConcurrency",
        "navigator.hardwareConcurrency is not exposed.",
      ),
      approximateDeviceMemoryGiB: positiveNumberHint(
        navigator,
        "deviceMemory",
        "navigator.deviceMemory is not exposed; no RAM value is inferred.",
      ),
      uaClientHints,
    },
    display: {
      viewport: supported({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }),
      refreshEstimate: await measureRefreshEstimate(
        requestAnimationFrame.bind(globalThis),
        cancelAnimationFrame.bind(globalThis),
      ),
    },
    memory: {
      legacyChromiumHeapBefore: captureLegacyChromiumHeap(performance),
      userAgentSpecificBefore: unavailable(
        "not-observed",
        "Not launched before scored work because this non-cancellable API may coordinate garbage collection and outlive a timeout.",
      ),
    },
  };
}

function capturePageAfter() {
  return {
    collectedNow: supported(performance.now(), { scope: "page-monotonic-milliseconds" }),
    visibilityState: supported(document.visibilityState),
    legacyChromiumHeapAfter: captureLegacyChromiumHeap(performance),
    userAgentSpecificAfter: unavailable(
      "not-observed",
      "Not launched in the repeatable live runner because this non-cancellable API may coordinate garbage collection and overlap a later scored run.",
    ),
  };
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
    "Status: exploratory. This tab supplies no independent fresh-launch pairs, so its values stay outside the accepted corpus and paired interval.";

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

  const machine = document.createElement("section");
  const machineTitle = document.createElement("h3");
  machineTitle.textContent = "Browser hints, memory and responsiveness";
  machine.append(machineTitle);
  const hints = data.pageEvidence.before.machineHints;
  const memory = data.pageEvidence.before.memory;
  const after = data.pageEvidence.after;
  const refresh = data.pageEvidence.before.display.refreshEstimate;
  const responsiveness = data.pageEvidence.responsiveness.longAnimationFrames;
  appendDefinition(machine, [
    [
      "UA-exposed logical processors",
      typedText(
        hints.uaExposedLogicalProcessors,
        (value) => `${value} · browser-exposed concurrency, not a physical CPU inventory`,
      ),
    ],
    [
      "Approximate device memory",
      typedText(
        hints.approximateDeviceMemoryGiB,
        (value) =>
          `${value} GiB bucket · coarse Chromium hint, not exact installed or available RAM`,
      ),
    ],
    ["UA Client Hints", uaChText(hints.uaClientHints)],
    ["Raw compatibility platform", typedText(data.pageEvidence.before.compatibility.platform)],
    [
      "Observed refresh",
      typedText(
        refresh,
        (value) =>
          `${
            value.estimatedHz.toFixed(2)
          } Hz estimate from ${value.observedIntervals} animation-frame intervals`,
      ),
    ],
    ["Legacy Chromium JS heap before", heapText(memory.legacyChromiumHeapBefore)],
    ["Legacy Chromium JS heap after", heapText(after.legacyChromiumHeapAfter)],
    [
      "UA-specific memory before",
      typedText(
        memory.userAgentSpecificBefore,
        (value) => `${value.bytes.toLocaleString()} estimated bytes`,
      ),
    ],
    [
      "UA-specific memory after",
      typedText(
        after.userAgentSpecificAfter,
        (value) => `${value.bytes.toLocaleString()} estimated bytes`,
      ),
    ],
    [
      "Wasm linear memory buffer",
      typedText(
        data.wasmLinearMemory,
        (value) =>
          `${value.beforeScoredBytes.toLocaleString()} before / ${value.afterScoredBytes.toLocaleString()} after scored work`,
      ),
    ],
    [
      "Long animation frames",
      typedText(
        responsiveness,
        (value) =>
          `${value.observedCount} observed · ${value.retainedCount} retained (cap ${value.maximumRetainedEntries}) · ${value.droppedEntries} dropped · max ${
            value.maxDurationMs === null ? "not observed" : `${value.maxDurationMs.toFixed(1)} ms`
          }`,
      ),
    ],
    [
      "Heavy diagnostics",
      "This page cannot observe CPU model, physical cores, host RAM, Chrome RSS/PSS, CDP metrics, heap profiles, or Wasm tier traces. Separate diagnostic launches collect those fields.",
    ],
  ]);
  const raw = document.createElement("details");
  const rawSummary = document.createElement("summary");
  rawSummary.textContent = "Raw in-memory provenance JSON";
  const rawPre = document.createElement("pre");
  rawPre.className = "raw-provenance";
  rawPre.textContent = JSON.stringify(
    {
      pageEvidence: data.pageEvidence,
      workerEvidence: {
        resourceTiming: data.resourceTiming,
        wasmLinearMemory: data.wasmLinearMemory,
      },
    },
    null,
    2,
  );
  raw.append(rawSummary, rawPre);
  machine.append(raw);

  const lifecycle = document.createElement("section");
  const lifecycleTitle = document.createElement("h3");
  lifecycleTitle.textContent = "First-use lifecycle · excluded from scored samples";
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
  appendTable(
    timing,
    "Absolute durations from this tab; the accepted corpus computes paired ratios",
    [
      "Variant",
      "First scored",
      "Median",
      "p95",
      "Samples",
    ],
    [
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
    ],
  );
  appendTable(
    timing,
    "Complete scored trajectory",
    ["Iteration", "JavaScript", "Linear Wasm"],
    data.js.samples.map((value, index) => [index + 1, ms(value), ms(data.wasm.samples[index])]),
  );

  resultContent.append(disclosure, correctness, provenance, machine, lifecycle, timing);
  results.hidden = false;
  results.focus?.();
}

function executeRun(iterations, order, serviceWorkerControlled) {
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
    worker.postMessage({ iterations, order, serviceWorkerControlled });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  results.hidden = true;
  resultContent.replaceChildren();
  phases.replaceChildren();
  progress.value = 0;
  let responsiveness;
  try {
    const data = new FormData(form);
    const iterations = boundedIterations(data.get("iterations"));
    const order = String(data.get("order"));
    addPhase("Reading browser-exposed fields into memory…");
    const before = await capturePageBefore();
    responsiveness = startResponsivenessObservation(globalThis);
    const serviceWorkerControlled = navigator.serviceWorker?.controller != null;
    const result = await executeRun(iterations, order, serviceWorkerControlled);
    responsiveness.stop();
    result.pageEvidence = {
      before,
      after: await capturePageAfter(),
      responsiveness: {
        supportedEntryTypes: responsiveness.supportedEntryTypes,
        longAnimationFrames: responsiveness.snapshot(),
      },
    };
    renderResult(result);
    addPhase("Pair complete. The result remains in this tab and was not uploaded or saved.");
  } catch (error) {
    status.textContent = `Run blocked: ${
      error instanceof Error ? error.message : "Unknown error."
    }`;
  } finally {
    responsiveness?.stop();
    button.disabled = false;
  }
});
