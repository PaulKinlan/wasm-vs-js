import { generateInput, INPUT_LENGTH, sumU32 } from "../benchmarks/sum-u32/workload.js";

const ORACLE = 145_417_951;
const INPUT_BYTES = INPUT_LENGTH * Uint32Array.BYTES_PER_ELEMENT;
const form = document.querySelector("#runner-form");
const status = document.querySelector("#status");
const phases = document.querySelector("#phases");
const primeButton = document.querySelector("#prime");
const runButton = document.querySelector("#run");
let primed = false;

function phase(message) {
  const item = document.createElement("li");
  item.textContent = message;
  phases.append(item);
  status.textContent = message;
}

function parseEnvironment(text) {
  const value = JSON.parse(text);
  const requiredStrings = [
    "suiteCommit",
    "sourceCommit",
    "os",
    "kernel",
    "architecture",
    "hardware",
    "automation",
    "automationProtocol",
    "profileId",
    "freshLaunchId",
    "pairedBlockId",
  ];
  for (const key of requiredStrings) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      throw new Error(`environment.${key} is required`);
    }
  }
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.suiteCommit)) {
    throw new Error("environment.suiteCommit must be an exact Git OID");
  }
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.sourceCommit)) {
    throw new Error("environment.sourceCommit must be an exact Git OID");
  }
  if (!value.browser || typeof value.browser !== "object") throw new Error("browser is required");
  for (const key of ["name", "version", "engine"]) {
    if (typeof value.browser[key] !== "string" || !value.browser[key]) {
      throw new Error(`environment.browser.${key} is required`);
    }
  }
  if (
    typeof value.browser.headless !== "boolean" || !Array.isArray(value.browser.launchArguments)
  ) {
    throw new Error("browser headless and launchArguments are required");
  }
  for (const key of ["physicalCores", "logicalCores", "ramBytes"]) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 1) throw new Error(`${key} is invalid`);
  }
  if (!(value.refreshHz > 0)) throw new Error("refreshHz is invalid");
  return value;
}

function assertUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new Error("lone surrogate denied");
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new Error("lone surrogate denied");
  }
}

function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number denied");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) throw new Error("sparse array denied");
    }
    if (Object.keys(value).length !== value.length) throw new Error("array property denied");
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("non-JSON value denied");
  }
  return `{${
    Object.keys(value).sort().map((key) => {
      assertUnicode(key);
      return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
    }).join(",")
  }}`;
}

async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function outputHash(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return await sha256Hex(bytes);
}

function randomId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_")
    .replaceAll("=", "");
  return `${prefix}_${encoded}`;
}

function timerCalibration() {
  let quantum = Infinity;
  let previous = performance.now();
  for (let index = 0; index < 20_000; index += 1) {
    const current = performance.now();
    const delta = current - previous;
    if (delta > 0 && delta < quantum) quantum = delta;
    previous = current;
  }
  const start = performance.now();
  for (let index = 0; index < 100_000; index += 1) performance.now();
  const callOverheadMs = (performance.now() - start) / 100_000;
  if (!Number.isFinite(quantum)) throw new Error("timer quantum unavailable");
  return { quantumMs: quantum, callOverheadMs };
}

function timeBatch(run, batchSize) {
  const start = performance.now();
  let output = 0;
  for (let index = 0; index < batchSize; index += 1) output = run();
  return { durationMs: performance.now() - start, output };
}

function calibrateBatch(jsRun, wasmRun, timer) {
  let batchSize = 1;
  const minimum = Math.max(timer.quantumMs * 100, timer.callOverheadMs * 100, 8);
  while (batchSize < 4096) {
    const js = timeBatch(jsRun, batchSize);
    const wasm = timeBatch(wasmRun, batchSize);
    if (js.durationMs >= minimum && wasm.durationMs >= minimum) return batchSize;
    batchSize *= 2;
  }
  throw new Error("fixed batch could not exceed timer floor");
}

function resourceEntries() {
  return performance.getEntriesByType("resource").filter((entry) =>
    entry.name.includes("sum-u32") || entry.name.includes("workload.js")
  ).map((entry) => ({
    name: new URL(entry.name).pathname,
    startTime: entry.startTime,
    duration: entry.duration,
    transferSize: entry.transferSize,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
    nextHopProtocol: entry.nextHopProtocol,
  }));
}

async function memoryMetric(runId) {
  const capturedAt = new Date().toISOString();
  if (!("measureUserAgentSpecificMemory" in performance)) {
    return {
      id: `${runId}-memory`,
      metric: "page-attributable-memory",
      availability: { state: "unavailable", reason: "api-absent" },
      scope: "page-agent-clusters",
      comparability: "within-browser-only",
      provenance: { source: "page-api", capturedAt },
    };
  }
  if (!crossOriginIsolated) {
    return {
      id: `${runId}-memory`,
      metric: "page-attributable-memory",
      availability: { state: "blocked", reason: "not-cross-origin-isolated" },
      scope: "page-agent-clusters",
      comparability: "within-browser-only",
      provenance: { source: "page-api", capturedAt },
    };
  }
  try {
    const result = await performance.measureUserAgentSpecificMemory();
    return {
      id: `${runId}-memory`,
      metric: "page-attributable-memory",
      availability: { state: "supported" },
      value: result.bytes,
      unit: "bytes",
      scope: "page-agent-clusters",
      comparability: "within-browser-only",
      provenance: { source: "page-api", capturedAt },
    };
  } catch (error) {
    return {
      id: `${runId}-memory`,
      metric: "page-attributable-memory",
      availability: { state: "blocked", reason: "security-error", detail: error.name },
      scope: "page-agent-clusters",
      comparability: "within-browser-only",
      provenance: { source: "page-api", capturedAt },
    };
  }
}

function baseRun({ env, manifest, variant, cacheState, batchSize, outputSha256, iterations }) {
  const runId = randomId(variant === "js-controlled" ? "js" : "wasm");
  const target = variant === "js-controlled" ? "javascript" : "wasm-linear";
  const variantBuild = manifest.variants[variant];
  const artifactName = target === "javascript"
    ? "benchmarks/sum-u32/workload.js"
    : "public/artifacts/sum-u32/sum-u32.wasm";
  return {
    schemaVersion: 1,
    runId,
    capturedAt: new Date().toISOString(),
    suite: { version: "0.1.0-m1-pilot", commit: env.suiteCommit, collectorVersion: "0.1.0" },
    benchmark: {
      id: "sum-u32",
      version: 1,
      tier: "T2",
      inputManifestSha256: manifest.input.sha256,
    },
    variant: { id: variant, target, track: "controlled", cacheState },
    build: {
      sourceRepository: manifest.sourceRepository,
      sourceCommit: env.sourceCommit,
      sourceSha256: manifest.sourceSha256,
      artifacts: [{ name: artifactName, sha256: variantBuild.sha256 }],
      lockfiles: manifest.lockfiles,
      command: manifest.build.command,
      toolchains: manifest.build.toolchains,
      flags: manifest.build.flags,
      footprint: variantBuild.footprint,
    },
    environment: {
      browser: env.browser,
      os: env.os,
      kernel: env.kernel,
      architecture: env.architecture,
      hardware: env.hardware,
      physicalCores: env.physicalCores,
      logicalCores: env.logicalCores,
      ramBytes: env.ramBytes,
      ...(env.deviceModel ? { deviceModel: env.deviceModel } : {}),
      automation: env.automation,
      automationProtocol: env.automationProtocol,
      profileId: env.profileId,
      freshLaunchId: env.freshLaunchId,
      pairedBlockId: env.pairedBlockId,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      refreshHz: env.refreshHz,
      ...(env.powerThermal ? { powerThermal: env.powerThermal } : {}),
    },
    conditions: {
      secureContext: isSecureContext,
      crossOriginIsolated,
      serviceWorker: navigator.serviceWorker?.controller ? "controlled" : "none",
      network: env.network || "local-http",
      throttling: env.throttling || "none",
      profilerEnabled: false,
      randomSeed: env.randomSeed || env.pairedBlockId,
      orderIndex: env.orderIndex,
    },
    capabilities: {
      performanceObserver: "PerformanceObserver" in window,
      supportedEntryTypes: globalThis.PerformanceObserver?.supportedEntryTypes?.join(",") || "",
      wasm: typeof WebAssembly === "object",
      logicalWasmMemoryBytes: target === "wasm-linear" ? INPUT_BYTES : null,
      measurementBatchSize: batchSize,
      requestedIterations: iterations,
      pilot: true,
    },
    correctness: {
      status: "passed",
      outputSha256,
      detail: `Exact oracle ${ORACLE}; ${batchSize} complete sums per measured sample.`,
      workCounters: {
        items: INPUT_LENGTH * batchSize,
        "input-bytes": INPUT_BYTES * batchSize,
        additions: INPUT_LENGTH * batchSize,
        loads: INPUT_LENGTH * batchSize,
        "boundary-crossings": batchSize,
      },
    },
    samples: [],
    metrics: [],
    failures: [],
    rawRefs: [],
  };
}

async function recordPair({ env, cacheState, order, iterations }) {
  performance.clearMarks();
  performance.clearMeasures();
  const manifestResponse = await fetch("/artifacts/sum-u32/build-manifest.json");
  if (!manifestResponse.ok) throw new Error("build manifest unavailable");
  const manifest = await manifestResponse.json();
  if (
    manifest.input.sha256 !== "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7"
  ) {
    throw new Error("input manifest mismatch");
  }

  performance.mark("wasm:fetch:start");
  const wasmResponse = await fetch("/artifacts/sum-u32/sum-u32.wasm");
  if (!wasmResponse.ok) throw new Error("Wasm artifact unavailable");
  const wasmBytes = await wasmResponse.arrayBuffer();
  performance.mark("wasm:fetch:end");
  performance.mark("wasm:compile:start");
  const wasmModule = await WebAssembly.compile(wasmBytes);
  performance.mark("wasm:compile:end");
  performance.mark("wasm:instantiate:start");
  const wasmInstance = await WebAssembly.instantiate(wasmModule);
  performance.mark("wasm:instantiate:end");
  const wasmExports = wasmInstance.exports;

  performance.mark("input:generate:start");
  const input = generateInput();
  performance.mark("input:generate:end");
  const inputHash = await sha256Hex(new Uint8Array(input.buffer));
  if (inputHash !== manifest.input.sha256) throw new Error("generated input mismatch");
  if (wasmExports.memory.buffer.byteLength < input.byteLength) {
    throw new Error("Wasm memory too small");
  }
  performance.mark("wasm:input-copy:start");
  new Uint32Array(wasmExports.memory.buffer, 0, input.length).set(input);
  performance.mark("wasm:input-copy:end");
  const jsRun = () => sumU32(input);
  const wasmRun = () => wasmExports.sum_u32(0, input.length) >>> 0;

  phase("Validating complete outputs and fixed work before timing…");
  performance.mark("js:first-output:start");
  const jsOutput = jsRun();
  performance.mark("js:first-output:end");
  performance.mark("wasm:first-output:start");
  const wasmOutput = wasmRun();
  performance.mark("wasm:first-output:end");
  if (jsOutput !== ORACLE || wasmOutput !== ORACLE || jsOutput !== wasmOutput) {
    throw new Error(`correctness gate failed: JS ${jsOutput}, Wasm ${wasmOutput}`);
  }
  const outputSha256 = await outputHash(ORACLE);
  if (outputSha256 !== manifest.oracle.outputSha256) throw new Error("oracle hash mismatch");
  const timer = timerCalibration();
  const batchSize = calibrateBatch(jsRun, wasmRun, timer);
  const runByVariant = {
    "js-controlled": baseRun({
      env,
      manifest,
      variant: "js-controlled",
      cacheState,
      batchSize,
      outputSha256,
      iterations,
    }),
    "wasm-linear-controlled": baseRun({
      env,
      manifest,
      variant: "wasm-linear-controlled",
      cacheState,
      batchSize,
      outputSha256,
      iterations,
    }),
  };
  const runners = { "js-controlled": jsRun, "wasm-linear-controlled": wasmRun };
  const sequence = order === "wasm-first"
    ? ["wasm-linear-controlled", "js-controlled"]
    : ["js-controlled", "wasm-linear-controlled"];

  for (const variant of sequence) {
    phase(`Recording ${variant} first iteration and full trajectory…`);
    const run = runByVariant[variant];
    const execute = runners[variant];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      performance.mark(`${variant}:${iteration}:start`);
      const sample = timeBatch(execute, batchSize);
      performance.mark(`${variant}:${iteration}:end`);
      performance.measure(
        `${variant}:${iteration}`,
        `${variant}:${iteration}:start`,
        `${variant}:${iteration}:end`,
      );
      if (sample.output !== ORACLE) throw new Error(`${variant} output changed during timing`);
      run.samples.push({ iteration, phase: "execute", durationMs: sample.durationMs, valid: true });
    }
  }

  const now = new Date().toISOString();
  const marks = Object.fromEntries(
    [
      "input:generate",
      "wasm:fetch",
      "wasm:compile",
      "wasm:instantiate",
      "wasm:input-copy",
      "js:first-output",
      "wasm:first-output",
    ].map((name) => [
      name,
      performance.measure(name, `${name}:start`, `${name}:end`).duration,
    ]),
  );
  for (const run of Object.values(runByVariant)) {
    run.metrics.push(
      {
        id: `${run.runId}-timer-quantum`,
        metric: "timer-quantum",
        availability: { state: "supported" },
        value: timer.quantumMs,
        unit: "ms",
        scope: "window",
        comparability: "cross-browser-with-conditions",
        provenance: { source: "performance-timeline", capturedAt: now },
      },
      {
        id: `${run.runId}-timer-call-overhead`,
        metric: "timer-call-overhead",
        availability: { state: "supported" },
        value: timer.callOverheadMs,
        unit: "ms",
        scope: "window",
        comparability: "cross-browser-with-conditions",
        provenance: { source: "performance-timeline", capturedAt: now },
      },
      {
        id: `${run.runId}-resources`,
        metric: "resource-timing",
        availability: { state: "supported" },
        value: resourceEntries(),
        unit: "json",
        scope: "network-request",
        comparability: "cross-browser-with-conditions",
        provenance: { source: "performance-timeline", capturedAt: now },
      },
      await memoryMetric(run.runId),
    );
  }
  const jsRunRecord = runByVariant["js-controlled"];
  const wasmRunRecord = runByVariant["wasm-linear-controlled"];
  for (const [metric, value] of Object.entries(marks)) {
    const targetRun = metric.startsWith("js:") ? jsRunRecord : wasmRunRecord;
    if (metric === "input:generate") {
      for (const run of [jsRunRecord, wasmRunRecord]) {
        run.metrics.push(lifecycleMetric(run.runId, metric, value, now));
      }
      continue;
    }
    targetRun.metrics.push(lifecycleMetric(targetRun.runId, metric, value, now));
  }

  function lifecycleMetric(runId, metric, value, capturedAt) {
    return {
      id: `${runId}-${metric.replace(":", "-")}`,
      metric,
      availability: { state: "supported" },
      value,
      unit: "ms",
      scope: "window",
      comparability: "cross-browser-standardized",
      provenance: { source: "performance-timeline", capturedAt },
    };
  }

  for (const run of Object.values(runByVariant)) {
    run.payloadSha256 = await sha256Hex(canonicalize(run));
  }
  return sequence.map((variant) => runByVariant[variant]);
}

async function upload(run) {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: canonicalize(run),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "run storage failed");
  return result;
}

primeButton.addEventListener("click", async () => {
  primeButton.disabled = true;
  try {
    await Promise.all([
      fetch("/artifacts/sum-u32/sum-u32.wasm", { cache: "force-cache" }).then((response) =>
        response.arrayBuffer()
      ),
      fetch("/benchmarks/sum-u32/workload.js", { cache: "force-cache" }).then((response) =>
        response.text()
      ),
    ]);
    primed = true;
    phase("Exact versioned JavaScript and Wasm assets are primed for a warm run.");
  } catch (error) {
    status.textContent = `Prime failed: ${error.message}`;
  } finally {
    primeButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  phases.replaceChildren();
  runButton.disabled = true;
  try {
    const data = new FormData(form);
    const env = parseEnvironment(data.get("environment"));
    const cacheState = data.get("cacheState");
    if (cacheState === "cold" && env.coldProfileAttested !== true) {
      throw new Error(
        "cold runs require coldProfileAttested:true from the owned fresh-profile launcher",
      );
    }
    if (cacheState === "warm" && !primed) {
      throw new Error("prime the exact assets before a warm run");
    }
    const order = data.get("order");
    const iterations = Number(data.get("iterations"));
    env.orderIndex = order === "js-first" ? 0 : 1;
    phase("Loading exact build and validating input manifest…");
    const runs = await recordPair({ env, cacheState, order, iterations });
    for (const run of runs) {
      phase(`Storing immutable ${run.variant.id} record ${run.runId}…`);
      await upload(run);
    }
    phase("Pair stored. Open the results explorer to inspect every sample and provenance field.");
  } catch (error) {
    status.textContent = `Run denied: ${error.message}`;
  } finally {
    runButton.disabled = false;
  }
});
