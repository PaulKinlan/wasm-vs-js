import {
  createJavaScriptGridExecution,
  createWasmGridExecution,
  GRID_TRACE_LIFECYCLE,
  instantiateGridWasm,
  validateGridTraceLifecycle,
  VARIANTS,
} from "/benchmarks/base/dom-virtualized-grid/engine.js";

const ACTIONS = 300;
const ACTION_BYTES = 16;
const ACTION_OFFSET = 64 + 100_000 * 16;
let pendingAck = null;

function epochNow() {
  return performance.timeOrigin + performance.now();
}

function recordSpan(spans, label, startedEpochMs) {
  const endedEpochMs = epochNow();
  spans.push({ label, startedEpochMs, endedEpochMs, durationMs: endedEpochMs - startedEpochMs });
}

async function measuredAsync(spans, label, operation) {
  const startedEpochMs = epochNow();
  try {
    return await operation();
  } finally {
    recordSpan(spans, label, startedEpochMs);
  }
}

function measuredSync(spans, label, operation) {
  const startedEpochMs = epochNow();
  try {
    return operation();
  } finally {
    recordSpan(spans, label, startedEpochMs);
  }
}

function phaseDuration(spans) {
  return spans.reduce((total, span) => total + span.durationMs, 0);
}

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function fetchBytes(path, phases) {
  const response = await measuredAsync(
    phases.load.spans,
    `${path}:request`,
    async () => {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`${path} returned ${response.status}`);
      return response;
    },
  );
  return await measuredAsync(
    phases.transfer.spans,
    `${path}:body`,
    async () => new Uint8Array(await response.arrayBuffer()),
  );
}

function waitUntil(deadline) {
  return new Promise((resolve) => {
    const tick = () => {
      const remaining = deadline - performance.now();
      if (remaining <= 0) resolve();
      else setTimeout(tick, Math.min(remaining, 10));
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
  const phases = {
    load: { spans: [] },
    transfer: { spans: [] },
    instantiate: { spans: [] },
    compute: { spans: [] },
  };
  const manifestBytes = await fetchBytes(
    "/artifacts/dom-virtualized-grid-v1/build-manifest.json",
    phases,
  );
  const manifestText = measuredSync(
    phases.transfer.spans,
    "build-manifest:decode",
    () => new TextDecoder().decode(manifestBytes),
  );
  const manifest = measuredSync(
    phases.load.spans,
    "build-manifest:parse",
    () => JSON.parse(manifestText),
  );
  const fixture = await fetchBytes("/artifacts/dom-virtualized-grid-v1/fixture.bin", phases);
  const fixtureSha256 = await measuredAsync(
    phases.load.spans,
    "fixture:sha256",
    () => sha256(fixture),
  );
  if (fixtureSha256 !== manifest.artifacts.fixture.sha256) {
    throw new Error("Fixture raw-byte hash mismatch");
  }

  let wasm = null;
  if (variantId === "wasm-linear-controlled") {
    const wasmBytes = await fetchBytes("/artifacts/dom-virtualized-grid-v1/grid.wasm", phases);
    const wasmSha256 = await measuredAsync(
      phases.load.spans,
      "wasm:sha256",
      () => sha256(wasmBytes),
    );
    if (wasmSha256 !== manifest.artifacts.wasm.sha256) {
      throw new Error("Wasm raw-byte hash mismatch");
    }
    wasm = await measuredAsync(
      phases.instantiate.spans,
      "wasm:instantiate",
      () => instantiateGridWasm(wasmBytes),
    );
  }
  const buildManifestSha256 = await measuredAsync(
    phases.load.spans,
    "build-manifest:sha256",
    () => sha256(manifestBytes),
  );
  const execution = measuredSync(
    phases.compute.spans,
    "model:prepare",
    () =>
      variantId === "js-controlled"
        ? createJavaScriptGridExecution(fixture)
        : createWasmGridExecution(wasm, fixture),
  );
  const fixtureView = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const actualOffsetsMs = [];
  const paintAckOffsetsMs = [];
  const scrollOffsetsCssPx = [];
  let scrollOffset = 0;
  let firstEventAt = 0;

  self.postMessage({ type: "prepared", token });

  const traceStarted = performance.now();
  for (let actionIndex = 0; actionIndex < ACTIONS; actionIndex += 1) {
    const scheduledOffsetMs = actionIndex * GRID_TRACE_LIFECYCLE.cadenceMs;
    const deadline = traceStarted + scheduledOffsetMs;
    await waitUntil(deadline);
    const step = measuredSync(
      phases.compute.spans,
      `model:event:${actionIndex}`,
      () => execution.next(),
    );
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
    if (actionIndex === 0) {
      firstEventAt = performance.now();
    }
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
    paintAckOffsetsMs.push(performance.now() - traceStarted);
  }
  const completed = measuredSync(phases.compute.spans, "model:finish", () => execution.next());
  if (!completed.done) throw new Error("Controlled target did not complete after 300 events");
  const completionAfterFirstSlotMs = performance.now() - firstEventAt;
  validateGridTraceLifecycle(actualOffsetsMs, completionAfterFirstSlotMs);
  for (const phase of Object.values(phases)) phase.durationMs = phaseDuration(phase.spans);
  self.postMessage({
    type: "complete",
    token,
    result: { ...completed.value, commands: undefined, buildManifestSha256 },
    workerPhases: phases,
    trace: {
      slots: ACTIONS,
      scheduledSpanMs: GRID_TRACE_LIFECYCLE.lastSlotOffsetMs,
      eventCadenceMs: GRID_TRACE_LIFECYCLE.cadenceMs,

      intervalBoundsMs: [],
      completionBoundsAfterFirstSlotMs: [
        GRID_TRACE_LIFECYCLE.minimumCompletionAfterFirstSlotMs,
        GRID_TRACE_LIFECYCLE.maximumCompletionAfterFirstSlotMs,
      ],
      completionAfterFirstSlotMs,
      scheduledOffsetsMs: Array.from(
        { length: ACTIONS },
        (_, index) => index * GRID_TRACE_LIFECYCLE.cadenceMs,
      ),
      actualOffsetsMs,
      paintAckOffsetsMs,
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
  if (data.type !== "start" && data.type !== "run") return;
  const token = data.token;
  let variantId = data.variantId || data.target || "js-controlled";
  if (variantId === "javascript" || variantId === "js") variantId = "js-controlled";
  if (variantId === "wasm" || variantId === "wasm-linear") variantId = "wasm-linear-controlled";
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
