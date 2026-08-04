// M2: Worker creation, clone/transfer/shared-memory, and 1/2/4/N scaling workloads.
// Measures the overhead of Web Worker lifecycle and message passing at scale.
// These are diagnostic cells — they isolate boundary and scaling costs.

export const WORKER_SCALES = [1, 2, 4, 8] as const;
export const MESSAGES_PER_SCALE = 500;
export const WARMUP_MESSAGES = 50;

// ── Inline worker source ──
// Minimal worker that echoes back the message token.
const WORKER_SOURCE = `self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg?.type === "echo") {
    self.postMessage({ type: "echo-reply", token: msg.token, payload: msg.payload });
  } else if (msg?.type === "echo-transfer") {
    const buf = msg.payload;
    self.postMessage({ type: "echo-reply", token: msg.token, payload: buf }, [buf]);
  } else if (msg?.type === "ping") {
    self.postMessage({ type: "pong", token: msg.token });
  }
});
`;

let workerFilePath: string | null = null;

async function ensureWorkerFile(): Promise<string> {
  if (workerFilePath) return `file://${workerFilePath}`;
  workerFilePath = await Deno.makeTempFile({ suffix: "-worker.mjs" });
  await Deno.writeTextFile(workerFilePath, WORKER_SOURCE);
  return `file://${workerFilePath}`;
}

async function cleanupWorkerFile(): Promise<void> {
  if (workerFilePath) {
    try {
      await Deno.remove(workerFilePath);
    } catch { /* ok */ }
    workerFilePath = null;
  }
}

// ── Types ──

export type ScalingResult = {
  scale: number;
  test: string;
  iterations: number;
  totalMs: number;
  meanMs: number;
  p50Ms: number;
  p99Ms: number;
  valid: boolean;
};

export type WorkerScalingReport = {
  results: ScalingResult[];
  sharedArrayBufferAvailable: boolean;
  crossOriginIsolated: boolean;
  hardwareConcurrency: number;
};

// ── Measurement helpers ──

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
}

async function measureRoundTrip(
  worker: Worker,
  test: string,
  scale: number,
  iterations: number,
  buildMessage: (i: number) => { type: string; token: number; payload?: unknown },
  transferList?: (msg: { payload?: unknown }) => Transferable[],
): Promise<ScalingResult> {
  // Warmup
  for (let i = 0; i < WARMUP_MESSAGES; i++) {
    await new Promise<void>((resolve) => {
      const token = i;
      const handler = (e: MessageEvent) => {
        if (e.data?.token === token) {
          worker.removeEventListener("message", handler);
          resolve();
        }
      };
      worker.addEventListener("message", handler);
      const msg = buildMessage(i);
      worker.postMessage(msg, transferList ? transferList(msg) : []);
    });
  }

  // Measure
  const samples: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const token = i + WARMUP_MESSAGES;
      const handler = (e: MessageEvent) => {
        if (e.data?.token === token) {
          worker.removeEventListener("message", handler);
          resolve();
        }
      };
      worker.addEventListener("message", handler);
      const msg = buildMessage(i);
      worker.postMessage(msg, transferList ? transferList(msg) : []);
    });
    samples[i] = performance.now() - start;
  }

  samples.sort((a, b) => a - b);
  const totalMs = samples.reduce((a, b) => a + b, 0);
  return {
    scale,
    test,
    iterations,
    totalMs,
    meanMs: totalMs / iterations,
    p50Ms: percentile(samples, 0.5),
    p99Ms: percentile(samples, 0.99),
    valid: Number.isFinite(totalMs) && totalMs > 0,
  };
}

// ── Worker scaling suite ──

export async function runWorkerScalingSuite(): Promise<WorkerScalingReport> {
  const results: ScalingResult[] = [];
  const workerURL = await ensureWorkerFile();

  for (const scale of WORKER_SCALES) {
    // Create N workers
    const workers: Worker[] = [];
    for (let i = 0; i < scale; i++) {
      workers.push(new Worker(workerURL, { type: "module" }));
    }

    // Test 1: Single-worker ping-pong baseline (always worker[0])
    results.push(
      await measureRoundTrip(
        workers[0],
        "ping-pong",
        scale,
        MESSAGES_PER_SCALE,
        (i) => ({ type: "ping", token: i }),
      ),
    );

    // Test 2: Small payload (32 bytes) round-trip
    results.push(
      await measureRoundTrip(
        workers[0],
        "echo-32b",
        scale,
        MESSAGES_PER_SCALE,
        (i) => ({ type: "echo", token: i, payload: new ArrayBuffer(32) }),
      ),
    );

    // Test 3: Large payload (64KB) with structured clone
    results.push(
      await measureRoundTrip(
        workers[0],
        "echo-64kb-clone",
        scale,
        MESSAGES_PER_SCALE,
        (i) => ({ type: "echo", token: i, payload: new ArrayBuffer(65536) }),
      ),
    );

    // Test 4: Large payload (64KB) with transfer
    results.push(
      await measureRoundTrip(
        workers[0],
        "echo-64kb-transfer",
        scale,
        MESSAGES_PER_SCALE,
        (i) => ({ type: "echo-transfer", token: i, payload: new ArrayBuffer(65536) }),
        (msg) => msg.payload ? [msg.payload as ArrayBuffer] : [],
      ),
    );

    // Test 5: Round-robin across all N workers (scaling cost)
    if (scale > 1) {
      const samples: number[] = [];
      const roundRobinIters = Math.floor(MESSAGES_PER_SCALE / scale);
      for (let i = 0; i < roundRobinIters; i++) {
        const w = workers[i % scale];
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const handler = (e: MessageEvent) => {
            if (e.data?.type === "pong") {
              w.removeEventListener("message", handler);
              resolve();
            }
          };
          w.addEventListener("message", handler);
          w.postMessage({ type: "ping", token: i });
        });
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      const totalMs = samples.reduce((a, b) => a + b, 0);
      results.push({
        scale,
        test: "round-robin",
        iterations: samples.length,
        totalMs,
        meanMs: totalMs / samples.length,
        p50Ms: percentile(samples, 0.5),
        p99Ms: percentile(samples, 0.99),
        valid: Number.isFinite(totalMs) && totalMs > 0,
      });
    }

    // Cleanup workers
    for (const w of workers) w.terminate();
  }

  // Clean up blob URL
  await cleanupWorkerFile();

  // Probe capabilities
  const sharedArrayBufferAvailable = typeof SharedArrayBuffer !== "undefined";
  const crossOriginIsolated = typeof self !== "undefined" &&
    (self as unknown as Record<string, unknown>).crossOriginIsolated === true;
  const hardwareConcurrency = navigator?.hardwareConcurrency ??
    (self as unknown as Record<string, unknown>)?.hardwareConcurrency ?? 1;

  return {
    results,
    sharedArrayBufferAvailable,
    crossOriginIsolated,
    hardwareConcurrency: Number(hardwareConcurrency),
  };
}

// ── Worker creation timing ──

export async function measureWorkerCreation(count: number): Promise<ScalingResult> {
  const workerURL = await ensureWorkerFile();
  const samples: number[] = [];

  for (let i = 0; i < count; i++) {
    const start = performance.now();
    const w = new Worker(workerURL, { type: "module" });
    // Wait for worker to be ready (first pong)
    await new Promise<void>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "pong") {
          w.removeEventListener("message", handler);
          resolve();
        }
      };
      w.addEventListener("message", handler);
      w.postMessage({ type: "ping", token: 0 });
    });
    samples.push(performance.now() - start);
    w.terminate();
  }

  await cleanupWorkerFile();
  samples.sort((a, b) => a - b);
  const totalMs = samples.reduce((a, b) => a + b, 0);

  return {
    scale: 1,
    test: `worker-creation-${count}x`,
    iterations: count,
    totalMs,
    meanMs: totalMs / count,
    p50Ms: percentile(samples, 0.5),
    p99Ms: percentile(samples, 0.99),
    valid: Number.isFinite(totalMs) && totalMs > 0,
  };
}
