import {
  createJavaScriptGridExecution,
  createWasmGridExecution,
  instantiateGridWasm,
  VARIANTS,
} from "/benchmarks/base/dom-virtualized-grid/engine.js";

const ACTIONS = 300;
const ACTION_BYTES = 16;
const ACTION_OFFSET = 64 + 100_000 * 16;
const EVENT_CADENCE_MS = 100;
const TRACE_DURATION_MS = 30_000;
let pendingAck = null;

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function fetchBytes(path) {
  const started = performance.now();
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const transferStarted = performance.now();
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    loadMs: performance.now() - started,
    transferMs: performance.now() - transferStarted,
  };
}

function waitUntil(deadline) {
  return new Promise((resolve) => {
    const tick = () => {
      const remaining = deadline - performance.now();
      if (remaining <= 0) resolve();
      else setTimeout(tick, Math.min(remaining, 25));
    };
    tick();
  });
}

function waitForAck(token, actionIndex) {
  return new Promise((resolve, reject) => {
    if (pendingAck) return reject(new Error("Trace acknowledgment overlapped"));
    pendingAck = { token, actionIndex, resolve };
  });
}

async function runTrace(token, variantId) {
  const loadStarted = performance.now();
  const manifestResource = await fetchBytes(
    "/artifacts/dom-virtualized-grid-v1/build-manifest.json",
  );
  const manifest = JSON.parse(new TextDecoder().decode(manifestResource.bytes));
  const fixtureResource = await fetchBytes("/artifacts/dom-virtualized-grid-v1/fixture.bin");
  const fixture = fixtureResource.bytes;
  if (await sha256(fixture) !== manifest.artifacts.fixture.sha256) {
    throw new Error("Fixture raw-byte hash mismatch");
  }

  let wasm = null;
  let wasmResource = null;
  let instantiateMs = 0;
  if (variantId === "wasm-linear-controlled") {
    wasmResource = await fetchBytes("/artifacts/dom-virtualized-grid-v1/grid.wasm");
    if (await sha256(wasmResource.bytes) !== manifest.artifacts.wasm.sha256) {
      throw new Error("Wasm raw-byte hash mismatch");
    }
    const instantiateStarted = performance.now();
    wasm = await instantiateGridWasm(wasmResource.bytes);
    instantiateMs = performance.now() - instantiateStarted;
  }
  const loadMs = performance.now() - loadStarted;
  const transferMs = manifestResource.transferMs + fixtureResource.transferMs +
    (wasmResource?.transferMs ?? 0);
  const preparationStarted = performance.now();
  const execution = variantId === "js-controlled"
    ? createJavaScriptGridExecution(fixture)
    : createWasmGridExecution(wasm, fixture);
  let computeMs = performance.now() - preparationStarted;
  const fixtureView = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const buildManifestSha256 = await sha256(manifestResource.bytes);
  const actualOffsetsMs = [];
  const scrollOffsetsCssPx = [];
  let scrollOffset = 0;

  self.postMessage({
    type: "prepared",
    token,
    phases: { loadMs, transferMs, instantiateMs },
  });

  const traceStarted = performance.now();
  for (let actionIndex = 0; actionIndex < ACTIONS; actionIndex += 1) {
    const scheduledOffsetMs = actionIndex * EVENT_CADENCE_MS;
    await waitUntil(traceStarted + scheduledOffsetMs);
    const computeStarted = performance.now();
    const step = execution.next();
    computeMs += performance.now() - computeStarted;
    if (step.done || step.value.actionIndex !== actionIndex) {
      throw new Error("Controlled target omitted an interleaved trace event");
    }
    const batch = step.value.commands;
    if (batch.length < 6 || batch[batch.length - 6] !== 7) {
      throw new Error("Controlled target omitted an event layout terminator");
    }
    const at = ACTION_OFFSET + actionIndex * ACTION_BYTES;
    const eventType = fixtureView.getUint32(at + 4, true);
    const a = fixtureView.getUint32(at + 8, true);
    const filteredLength = batch[batch.length - 1];
    if (eventType === 0) {
      scrollOffset = Math.min(a, Math.max(0, filteredLength - 20) * 24);
    } else if (eventType === 1) {
      scrollOffset = 0;
    }
    const actualOffsetMs = performance.now() - traceStarted;
    actualOffsetsMs.push(actualOffsetMs);
    scrollOffsetsCssPx.push(scrollOffset);
    const acknowledged = waitForAck(token, actionIndex);
    self.postMessage({
      type: "event",
      token,
      actionIndex,
      eventType,
      scheduledOffsetMs,
      actualOffsetMs,
      scrollOffset,
      commands: batch.buffer,
    }, [batch.buffer]);
    await acknowledged;
  }
  await waitUntil(traceStarted + TRACE_DURATION_MS);
  const finishStarted = performance.now();
  const completed = execution.next();
  computeMs += performance.now() - finishStarted;
  if (!completed.done) throw new Error("Controlled target did not complete after 300 events");
  self.postMessage({
    type: "complete",
    token,
    result: { ...completed.value, commands: undefined, buildManifestSha256 },
    phases: { loadMs, transferMs, instantiateMs, computeMs },
    trace: {
      durationMs: performance.now() - traceStarted,
      scheduledDurationMs: TRACE_DURATION_MS,
      eventCadenceMs: EVENT_CADENCE_MS,
      scheduledOffsetsMs: Array.from({ length: ACTIONS }, (_, index) => index * EVENT_CADENCE_MS),
      actualOffsetsMs,
      scrollOffsetsCssPx,
    },
  });
}

self.onmessage = ({ data }) => {
  if (!data || !Number.isSafeInteger(data.token)) return;
  if (data.type === "ack") {
    if (
      pendingAck && pendingAck.token === data.token && pendingAck.actionIndex === data.actionIndex
    ) {
      const { resolve } = pendingAck;
      pendingAck = null;
      resolve();
    }
    return;
  }
  if (data.type !== "start") return;
  const { token, variantId } = data;
  if (!VARIANTS.includes(variantId)) {
    self.postMessage({ type: "error", token, message: "Target is not in the fixed allowlist." });
    return;
  }
  (async () => {
    try {
      if (Number.isInteger(data.holdMs) && data.holdMs > 0 && data.holdMs <= 1000) {
        await new Promise((resolve) => setTimeout(resolve, data.holdMs));
      }
      await runTrace(token, variantId);
    } catch (error) {
      pendingAck = null;
      self.postMessage({
        type: "error",
        token,
        message: error instanceof Error ? error.message : "Worker failed.",
      });
    }
  })();
};
