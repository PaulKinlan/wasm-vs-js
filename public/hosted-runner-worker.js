import {
  calibrateBatch,
  fixedWorkCounters,
  ORACLE,
  runScoredPair,
  summarizeSamples,
} from "./hosted-runner-core.js";

const INPUT_LENGTH = 65_536;
const INPUT_BYTES = INPUT_LENGTH * Uint32Array.BYTES_PER_ELEMENT;
const INPUT_SHA256 = "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7";
const WASM_SHA256 = "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d";
let started = false;

function phase(message) {
  globalThis.postMessage({ type: "phase", message });
}

function timerQuantum() {
  let quantum = Infinity;
  let previous = performance.now();
  for (let index = 0; index < 20_000; index += 1) {
    const current = performance.now();
    const delta = current - previous;
    if (delta > 0 && delta < quantum) quantum = delta;
    previous = current;
  }
  if (!Number.isFinite(quantum)) throw new Error("Timer quantum is unavailable.");
  return quantum;
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function timedBytes(url) {
  const start = performance.now();
  const response = await fetch(url, { cache: "default", credentials: "omit" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  const value = await response.arrayBuffer();
  return { value, bytes: value.byteLength, durationMs: performance.now() - start };
}

function duration(execute) {
  const start = performance.now();
  const output = execute();
  return { output, durationMs: performance.now() - start };
}

function cacheDisclosure() {
  const routes = [
    "/benchmarks/sum-u32/workload.js",
    "/artifacts/sum-u32/sum-u32.wasm",
  ];
  const entries = routes.map((route) =>
    performance.getEntriesByName(`${location.origin}${route}`, "resource").at(-1)
  );
  if (entries.some((entry) => !entry)) {
    return "Browser-managed HTTP cache; complete Resource Timing entries were unavailable.";
  }
  const transferBytes = entries.reduce((total, entry) => total + entry.transferSize, 0);
  return transferBytes === 0
    ? "Browser-managed HTTP cache; Resource Timing reported zero transfer bytes, but cache state is not attested."
    : `Browser-managed HTTP cache; Resource Timing reported ${transferBytes} transfer bytes for JS and Wasm. Cold/warm state is not attested.`;
}

async function executeRun(iterations, order) {
  phase("Fetching the build manifest as exact bytes…");
  const manifestFetch = await timedBytes("/artifacts/sum-u32/build-manifest.json");
  let start = performance.now();
  const manifest = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(manifestFetch.value),
  );
  const manifestDecodeParseMs = performance.now() - start;
  if (manifest.input.sha256 !== INPUT_SHA256) {
    throw new Error("Published input hash does not match the frozen workload.");
  }

  phase("Fetching and hashing the exact JavaScript workload bytes…");
  const jsFetch = await timedBytes("/benchmarks/sum-u32/workload.js");
  start = performance.now();
  const jsSha256 = await sha256Hex(jsFetch.value);
  const jsHashVerifyMs = performance.now() - start;
  if (jsSha256 !== manifest.variants["js-controlled"].sha256) {
    throw new Error("Published JavaScript bytes do not match the build manifest.");
  }

  phase("Importing only the verified JavaScript bytes…");
  const jsBlobUrl = URL.createObjectURL(new Blob([jsFetch.value], { type: "text/javascript" }));
  let workload;
  let jsVerifiedModuleImportMs;
  try {
    start = performance.now();
    workload = await import(jsBlobUrl);
    jsVerifiedModuleImportMs = performance.now() - start;
  } finally {
    URL.revokeObjectURL(jsBlobUrl);
  }
  if (
    workload.INPUT_LENGTH !== INPUT_LENGTH || typeof workload.generateInput !== "function" ||
    typeof workload.sumU32 !== "function"
  ) {
    throw new Error("Verified JavaScript module exports do not match the workload contract.");
  }

  phase("Fetching, hashing, compiling, and instantiating the linear-Wasm artifact…");
  const wasmFetch = await timedBytes("/artifacts/sum-u32/sum-u32.wasm");
  start = performance.now();
  const wasmSha256 = await sha256Hex(wasmFetch.value);
  const wasmHashVerifyMs = performance.now() - start;
  if (
    wasmSha256 !== WASM_SHA256 || wasmSha256 !== manifest.variants["wasm-linear-controlled"].sha256
  ) {
    throw new Error("Published Wasm hash does not match the build manifest.");
  }
  start = performance.now();
  const module = await WebAssembly.compile(wasmFetch.value);
  const wasmCompileMs = performance.now() - start;
  start = performance.now();
  const instance = await WebAssembly.instantiate(module);
  const wasmInstantiateMs = performance.now() - start;

  start = performance.now();
  const input = workload.generateInput();
  const inputGenerateMs = performance.now() - start;
  const inputSha256 = await sha256Hex(new Uint8Array(input.buffer));
  if (inputSha256 !== INPUT_SHA256) {
    throw new Error("Generated input hash does not match the frozen workload.");
  }
  if (instance.exports.memory.buffer.byteLength < input.byteLength) {
    throw new Error("Wasm linear memory is too small.");
  }
  start = performance.now();
  new Uint32Array(instance.exports.memory.buffer, 0, input.length).set(input);
  const inputCopyMs = performance.now() - start;

  const jsRun = () => workload.sumU32(input);
  const wasmRun = () => instance.exports.sum_u32(0, input.length) >>> 0;
  phase("Checking complete outputs before any scored timing…");
  const jsFirst = duration(jsRun);
  const wasmFirst = duration(wasmRun);
  if (
    jsFirst.output !== ORACLE || wasmFirst.output !== ORACLE || jsFirst.output !== wasmFirst.output
  ) {
    throw new Error("Correctness gate failed; no scored timing was collected.");
  }

  phase("Calibrating a bounded fixed-work batch outside the scored samples…");
  const calibration = await calibrateBatch(jsRun, wasmRun, timerQuantum());
  const work = fixedWorkCounters(INPUT_LENGTH, INPUT_BYTES, calibration.batchSize);

  phase("Recording complete scored trajectories in the dedicated worker…");
  const samples = await runScoredPair({
    jsRun,
    wasmRun,
    batchSize: calibration.batchSize,
    iterations,
    order,
    onProgress: ({ variant, iteration, completed }) => {
      globalThis.postMessage({ type: "progress", variant, iteration, completed });
    },
  });

  return {
    capturedAt: new Date().toISOString(),
    order,
    iterations,
    cache: cacheDisclosure(),
    batchSize: calibration.batchSize,
    work,
    manifest,
    jsSha256,
    wasmSha256,
    lifecycle: {
      manifestTransferMs: manifestFetch.durationMs,
      manifestBytes: manifestFetch.bytes,
      manifestDecodeParseMs,
      jsTransferMs: jsFetch.durationMs,
      jsBytes: jsFetch.bytes,
      jsHashVerifyMs,
      jsVerifiedModuleImportMs,
      jsModuleParseMs: {
        status: "unavailable",
        reason:
          "Standard browser APIs do not isolate module parse duration from import and evaluation.",
      },
      jsModuleEvaluationMs: {
        status: "unavailable",
        reason:
          "Standard browser APIs do not isolate module evaluation duration from import and parse.",
      },
      wasmTransferMs: wasmFetch.durationMs,
      wasmBytes: wasmFetch.bytes,
      wasmHashVerifyMs,
      wasmCompileMs,
      wasmInstantiateMs,
      inputGenerateMs,
      inputCopyMs,
      jsFirstExecuteMs: jsFirst.durationMs,
      wasmFirstExecuteMs: wasmFirst.durationMs,
    },
    js: summarizeSamples(samples.javascript),
    wasm: summarizeSamples(samples.wasm),
  };
}

/** @param {MessageEvent<{ iterations: number, order: string }>} event */
globalThis.onmessage = async (event) => {
  if (started) return;
  started = true;
  try {
    const result = await executeRun(event.data.iterations, event.data.order);
    globalThis.postMessage({ type: "complete", result });
  } catch (error) {
    globalThis.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown worker error.",
    });
  } finally {
    globalThis.close();
  }
};
