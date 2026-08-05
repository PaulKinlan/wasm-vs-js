export const ORACLE = 145_417_951;
export const MIN_ITERATIONS = 1;
export const MAX_ITERATIONS = 100;
export const MAX_BATCH_SIZE = 4096;
const DIGEST_SEED = 0x811c9dc5;
const DIGEST_MULTIPLIER = 0x01000193;

export async function yieldToMain() {
  if (globalThis.scheduler && typeof globalThis.scheduler.yield === "function") {
    await globalThis.scheduler.yield();
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function boundedIterations(value) {
  const iterations = Number(value);
  if (
    !Number.isSafeInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS
  ) {
    throw new Error(`Iterations must be an integer from ${MIN_ITERATIONS} to ${MAX_ITERATIONS}.`);
  }
  return iterations;
}

function foldOutput(digest, output, index) {
  return (Math.imul(digest ^ (output >>> 0), DIGEST_MULTIPLIER) + index) >>> 0;
}

export function expectedBatchDigest(batchSize) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error("Batch size is outside the bounded range.");
  }
  let digest = DIGEST_SEED;
  for (let index = 0; index < batchSize; index += 1) {
    digest = foldOutput(digest, ORACLE, index);
  }
  return digest;
}

export function timeBatch(execute, batchSize) {
  const expectedDigest = expectedBatchDigest(batchSize);
  const start = performance.now();
  let digest = DIGEST_SEED;
  let allCorrect = true;
  for (let index = 0; index < batchSize; index += 1) {
    const output = execute();
    allCorrect = allCorrect && output === ORACLE;
    digest = foldOutput(digest, output, index);
  }
  return {
    durationMs: performance.now() - start,
    digest,
    expectedDigest,
    allCorrect,
    invocations: batchSize,
  };
}

function validBatch(batch) {
  return batch.allCorrect && batch.digest === batch.expectedDigest &&
    batch.invocations >= 1;
}

export async function calibrateBatch(jsRun, wasmRun, timerQuantumMs, yieldTask = yieldToMain) {
  const minimumDurationMs = Math.max(timerQuantumMs * 100, 8);
  for (let batchSize = 1; batchSize <= MAX_BATCH_SIZE; batchSize *= 2) {
    const js = timeBatch(jsRun, batchSize);
    const wasm = timeBatch(wasmRun, batchSize);
    if (!validBatch(js) || !validBatch(wasm)) {
      throw new Error("Calibration output changed from the frozen oracle.");
    }
    if (js.durationMs >= minimumDurationMs && wasm.durationMs >= minimumDurationMs) {
      return { batchSize, minimumDurationMs };
    }
    await yieldTask();
  }
  throw new Error("A bounded batch could not exceed the timer floor.");
}

/**
 * @param {{
 *   jsRun: () => number,
 *   wasmRun: () => number,
 *   batchSize: number,
 *   iterations: number,
 *   order: "js-first" | "wasm-first",
 *   onProgress?: (progress: { variant: string, iteration: number, completed: number }) => void,
 *   yieldTask?: () => Promise<void>
 * }} options
 */
export async function runScoredPair({
  jsRun,
  wasmRun,
  batchSize,
  iterations,
  order,
  onProgress = (_progress) => {},
  yieldTask = yieldToMain,
}) {
  const count = boundedIterations(iterations);
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error("Batch size is outside the bounded range.");
  }
  if (order !== "js-first" && order !== "wasm-first") throw new Error("Unknown order.");
  const samples = { javascript: [], wasm: [] };
  const sequence = order === "js-first"
    ? [["javascript", jsRun], ["wasm", wasmRun]]
    : [["wasm", wasmRun], ["javascript", jsRun]];
  for (let iteration = 0; iteration < count; iteration += 1) {
    for (const [variant, execute] of sequence) {
      onProgress({
        variant,
        iteration,
        completed: samples.javascript.length + samples.wasm.length,
      });
      const sample = timeBatch(execute, batchSize);
      if (!validBatch(sample)) {
        throw new Error(`${variant} output changed during scored iteration ${iteration + 1}.`);
      }
      samples[variant].push(sample.durationMs);
      await yieldTask();
    }
  }
  return samples;
}

function quantile(sorted, probability) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

export function summarizeSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.some((value) => !(value >= 0))) {
    throw new Error("Valid samples are required.");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    count: sorted.length,
    medianMs: quantile(sorted, 0.5),
    p95Ms: quantile(sorted, 0.95),
    firstScoredMs: samples[0],
    samples: [...samples],
  };
}

export function fixedWorkCounters(inputLength, inputBytes, batchSize) {
  if (
    !Number.isSafeInteger(inputLength) || inputLength < 1 || !Number.isSafeInteger(inputBytes) ||
    inputBytes < 1
  ) {
    throw new Error("Fixed work dimensions are invalid.");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error("Batch size is invalid.");
  }
  return {
    items: inputLength * batchSize,
    inputBytes: inputBytes * batchSize,
    additions: inputLength * batchSize,
    loads: inputLength * batchSize,
    boundaryCrossings: batchSize,
  };
}

// Cold-start phase helpers (pure, deno-testable).

// Derive the network phase of a cold start from a Resource Timing-style entry:
// fetchStart -> responseEnd per Resource Timing semantics. This is the
// same-origin HTTP portion of the transfer, separate from the manual fetch()
// wrapper duration (which also includes reading the body). Unsupported or
// malformed entries are typed "unavailable" with a reason — never zero.
export function networkPhaseFromEntry(entry) {
  if (!entry || typeof entry.fetchStart !== "number" || typeof entry.responseEnd !== "number") {
    return {
      status: "unavailable",
      reason: "No Resource Timing entry retained for this asset.",
    };
  }
  const ms = entry.responseEnd - entry.fetchStart;
  if (!Number.isFinite(ms) || ms < 0) {
    return {
      status: "unavailable",
      reason: "Resource Timing entry had a non-finite or negative network duration.",
    };
  }
  return { status: "supported-value", ms, scope: "same-origin-resource-timing" };
}

// Build the cold-start phase breakdown map used by the report renderers and the
// results explorer. Every phase is either a number (ms) or a typed unavailable
// object { status, reason }. Pure and deterministic for testing.
export function coldStartBreakdown({
  manifestTransferMs,
  manifestNetwork,
  jsTransferMs,
  jsNetwork,
  wasmTransferMs,
  wasmNetwork,
  wasmCompileMs,
  wasmInstantiateMs,
  jsFirstExecuteMs,
  wasmFirstExecuteMs,
} = {}) {
  return {
    manifest: { transferMs: manifestTransferMs ?? null, network: manifestNetwork ?? null },
    javascript: { transferMs: jsTransferMs ?? null, network: jsNetwork ?? null },
    wasm: {
      transferMs: wasmTransferMs ?? null,
      network: wasmNetwork ?? null,
      compileMs: wasmCompileMs ?? null,
      instantiateMs: wasmInstantiateMs ?? null,
    },
    firstExecuteMs: { javascript: jsFirstExecuteMs ?? null, wasm: wasmFirstExecuteMs ?? null },
  };
}
