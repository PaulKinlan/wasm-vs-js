import { assert, assertEquals } from "./assert.ts";
import { LocalRunStore } from "../lib/run-store.ts";
import { createHandler } from "../server.ts";
import { ratio, summarize } from "../public/measurement-model.js";
import { toCsv } from "../public/benchmark-report.js";
import { buildExplorerRows, explorerCsvRecords } from "../public/unified-runner.js";
import {
  isTrackBEngineCandidate,
  renderWarmWorkerScopeHtml,
  runWarmWorkerProbe,
  selectFastestTrackALinearEngine,
  WARM_WORKER_SCOPE_ID,
} from "../public/warm-worker-probe.js";
import {
  handleWarmWorkerMessage,
  initializeWarmWorkerState,
} from "../public/warm-worker-probe-worker.js";

const STOCK_PHRASES = [
  "in today's rapidly evolving landscape",
  "in the realm of",
  "when it comes to",
  "at its core",
  "let's dive into",
  "it's worth noting that",
  "it's important to note that",
  "a testament to",
  "not just ",
  "not only ",
  "this is where ",
  "whether you're ",
  "despite ongoing challenges",
  "looking ahead",
  "in conclusion",
  "overall",
  "ultimately",
  "i hope this helps",
];

async function withLocalServer<T>(fn: (origin: string) => Promise<T>): Promise<T> {
  const tempDir = await Deno.makeTempDir();
  try {
    const store = new LocalRunStore(tempDir);
    await store.initialize();
    const handler = createHandler(store, "local");
    const server = Deno.serve({ port: 0, hostname: "127.0.0.1", handler });
    const addr = server.addr as Deno.NetAddr;
    const origin = `http://127.0.0.1:${addr.port}`;
    try {
      return await fn(origin);
    } finally {
      await server.shutdown();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

Deno.test("warm-worker-probe assets serve HTTP 200 over generated routes", async () => {
  const handler = createHandler(null, "public");
  for (const route of ["/warm-worker-probe.js", "/warm-worker-probe-worker.js"]) {
    const res = await handler(new Request(`http://127.0.0.1${route}`));
    const text = await res.text();
    assertEquals(res.status, 200, `${route} did not return HTTP 200`);
    assert(
      (res.headers.get("content-type") ?? "").includes("text/javascript"),
      `${route} must serve text/javascript`,
    );
    assert(text.length > 200, `${route} body unexpectedly short`);
  }
});

Deno.test("selectFastestTrackALinearEngine picks fastest Track A linear/WAT engine and excludes Track B", async () => {
  const gemmManifest = JSON.parse(
    await Deno.readTextFile("public/benchmarks/multilang-wasm/ml-gemm.manifest.json"),
  );
  // Even if Track B SIMD (`c-ikj-simd` = 0.18 ms) and `js-opt` (0.65 ms) are faster,
  // Track A selection must strictly choose among Track A linear/WAT engines (`rs` = 0.82 ms).
  const chosen = selectFastestTrackALinearEngine(gemmManifest, {
    gemm: [
      { key: "js", medianMs: 1.55, track: "A" },
      { key: "js-opt", medianMs: 0.65, track: "B" },
      { key: "wat", medianMs: 1.12, track: "A" },
      { key: "c", medianMs: 0.91, track: "A" },
      { key: "c-ikj-simd", medianMs: 0.18, track: "B" },
      { key: "rs", medianMs: 0.82, track: "A" },
      { key: "dart", medianMs: 0.50, track: "A" },
    ],
  });
  assert(chosen !== null);
  assertEquals(chosen.key, "rs");
  assertEquals(isTrackBEngineCandidate(chosen), false);

  const fallbackChosen = selectFastestTrackALinearEngine(gemmManifest, null);
  assert(fallbackChosen !== null);
  assertEquals(fallbackChosen.key, "c");
  assertEquals(isTrackBEngineCandidate(fallbackChosen), false);
});

Deno.test("real module Web Worker reuses 1 WebAssembly.Instance across N messages on sum-u32, ml-gemm, audio-fir, and numeric-polybench-panel", async () => {
  const manifests = [
    {
      path: "/benchmarks/multilang-wasm/sum-u32.manifest.json",
      expectedWorkloadId: "multilang-wasm",
      preferredWasmKey: "wat",
    },
    {
      path: "/benchmarks/multilang-wasm/ml-gemm.manifest.json",
      expectedWorkloadId: "ml.gemm.v1",
      preferredWasmKey: "c",
    },
    {
      path: "/benchmarks/multilang-wasm/audio-fir.manifest.json",
      expectedWorkloadId: "audio.fir.v1",
      preferredWasmKey: "c",
    },
    {
      path: "/benchmarks/multilang-wasm/numeric-polybench-panel.manifest.json",
      expectedWorkloadId: "numeric.polybench-panel.v1",
      preferredWasmKey: "rs",
    },
  ];

  const timedIterations = 6;
  const ipcWarmups = 2;

  await withLocalServer(async (origin) => {
    for (const item of manifests) {
      const res = await runWarmWorkerProbe(item.path, {
        iterations: timedIterations,
        ipcWarmupRuns: ipcWarmups,
        preferredWasmKey: item.preferredWasmKey,
        origin,
        workerUrl: `${origin}/warm-worker-probe-worker.js`,
      });

      assertEquals(
        res.status,
        "ok",
        `${item.path} failed: ${res.reason ?? "unknown error"}`,
      );
      assertEquals(res.workloadId, item.expectedWorkloadId);
      assertEquals(res.wasmKey, item.preferredWasmKey);
      assertEquals(
        isTrackBEngineCandidate({ key: res.wasmKey, label: res.wasmEngineLabel }),
        false,
      );

      // Core reuse invariant: 1 fetch and 1 WebAssembly.Instance across all warm-ups + N messages.
      assertEquals(
        res.wasmFetchCount,
        1,
        `${item.path} expected 1 .wasm fetch, got ${res.wasmFetchCount}`,
      );
      assertEquals(
        res.wasmInstantiateCount,
        1,
        `${item.path} expected 1 WebAssembly.Instance across N messages, got ${res.wasmInstantiateCount}`,
      );
      assertEquals(res.jsTaskCount, ipcWarmups + timedIterations);
      assertEquals(res.wasmTaskCount, ipcWarmups + timedIterations);

      // Oracle verification invariant.
      assertEquals(res.oracleVerified, true);
      assert(
        /^0x[0-9a-f]{8}$/i.test(String(res.oracleDigest ?? "")),
        `${item.path} expected 32-bit FNV-1a/sum hex oracle digest, got ${res.oracleDigest}`,
      );

      // Scoped timing summaries.
      assert(res.timings !== null);
      assertEquals(res.timings.jsRoundTrip?.n, timedIterations);
      assertEquals(res.timings.wasmRoundTrip?.n, timedIterations);
      assertEquals(res.timings.jsRoundTrip?.scope, WARM_WORKER_SCOPE_ID);
      assertEquals(res.timings.wasmRoundTrip?.scope, WARM_WORKER_SCOPE_ID);
      assert(res.timings.jsRoundTrip!.ci95 !== null, "n=6 must yield a 95% CI");
      assert(res.timings.wasmRoundTrip!.ci95 !== null, "n=6 must yield a 95% CI");
      assertEquals(res.timings.roundTripRatio.status, "ok");
      assertEquals(res.timings.roundTripRatio.scope, WARM_WORKER_SCOPE_ID);
    }
  });
});

Deno.test("oracle disagreement is rejected before timing and publishes zero timing data", async () => {
  await withLocalServer(async (origin) => {
    const sumManifest = JSON.parse(
      await Deno.readTextFile("public/benchmarks/multilang-wasm/sum-u32.manifest.json"),
    );

    let caught: Error | null = null;
    try {
      await initializeWarmWorkerState({
        manifest: sumManifest,
        preferredWasmKey: "wat",
        origin,
        adapterOverride: {
          kernels: ["sum"],
          build() {
            return {
              js: { sum: () => 0x11111111 },
              wat: { sum: () => 0x22222222 },
            };
          },
        },
      });
    } catch (err) {
      caught = err instanceof Error ? err : new Error(String(err));
    }
    assert(caught !== null, "diverging JS and Wasm outputs must throw during init");
    assert(caught!.message.includes("warm worker engines disagree"));
  });

  // Verify host coordinator maps oracleMismatch -> correctness-failure with timings: null.
  class DivergingOracleMockWorker extends EventTarget {
    postMessage(msg: { token: string; type: string }) {
      queueMicrotask(() => {
        if (msg.type === "init") {
          this.dispatchEvent(
            new MessageEvent("message", {
              data: {
                token: msg.token,
                ok: false,
                type: "error",
                oracleMismatch: true,
                unavailable: false,
                message: "unit.test: engines disagree — js=11111111 c=22222222",
              },
            }),
          );
        }
      });
    }
    terminate() {}
  }

  const probeRes = await runWarmWorkerProbe("/benchmarks/multilang-wasm/sum-u32.manifest.json", {
    WorkerImpl: DivergingOracleMockWorker as unknown as typeof Worker,
  });
  assertEquals(probeRes.status, "correctness-failure");
  assertEquals(probeRes.timings, null);

  const html = renderWarmWorkerScopeHtml(probeRes);
  assert(html.includes('data-warm-worker-probe="correctness-failure"'));
  assert(html.includes("Correctness gate rejected timing"));
  assert(!html.includes("<table"), "correctness failure must never render a timing table");
});

Deno.test("graceful fallback when Worker is absent or kernel requires main-thread globals", async () => {
  // 1. Missing Worker constructor.
  const noWorkerRes = await runWarmWorkerProbe("/benchmarks/multilang-wasm/ml-gemm.manifest.json", {
    WorkerImpl: null,
  });
  assertEquals(noWorkerRes.status, "unavailable");
  assertEquals(noWorkerRes.timings, null);

  // 2. Kernel adapter touching main-thread `document` inside worker init.
  await withLocalServer(async (origin) => {
    const sumManifest = JSON.parse(
      await Deno.readTextFile("public/benchmarks/multilang-wasm/sum-u32.manifest.json"),
    );
    let mainThreadErr: Error | null = null;
    try {
      await initializeWarmWorkerState({
        manifest: sumManifest,
        preferredWasmKey: "wat",
        origin,
        adapterOverride: {
          kernels: ["sum"],
          build() {
            // Simulate a DOM-bound adapter referencing document in a worker.
            const doc = (globalThis as Record<string, unknown>).document as {
              createElement: (tag: string) => unknown;
            };
            doc.createElement("div");
            return {};
          },
        },
      });
    } catch (err) {
      mainThreadErr = err instanceof Error ? err : new Error(String(err));
    }
    assert(mainThreadErr !== null);

    // 3. Unknown / non-worker manifest via real Worker round-trip degrades without throwing.
    const unavailReply = await handleWarmWorkerMessage({
      token: "t-unavail",
      type: "init",
      manifest: {
        workloadId: "dom.nonexistent-main-thread-only.v1",
        kernels: ["dom_op"],
        engines: [{ key: "js", kind: "js" }],
      },
      origin,
    });
    assertEquals(unavailReply.ok, false);
    assertEquals(unavailReply.unavailable, true);
    assertEquals(unavailReply.oracleMismatch, false);

    const realWorkerFallback = await runWarmWorkerProbe(
      "/benchmarks/multilang-wasm/does-not-exist.manifest.json",
      {
        origin,
        workerUrl: `${origin}/warm-worker-probe-worker.js`,
      },
    );
    assertEquals(realWorkerFallback.status, "unavailable");
    assertEquals(realWorkerFallback.timings, null);

    const fallbackHtml = renderWarmWorkerScopeHtml(realWorkerFallback);
    assert(fallbackHtml.includes('data-warm-worker-probe="unavailable"'));
    assert(fallbackHtml.includes("unavailable"));
    assert(!fallbackHtml.includes("<table"));
  });
});

Deno.test("Symmetric Warm Worker Scope renders contrast callout, isolates scopes, and passes CSP + prose gates", async () => {
  const jsWarm = summarize([1.52, 1.49, 1.51, 1.50, 1.53, 1.50], {
    scope: WARM_WORKER_SCOPE_ID,
    label: "JavaScript (Warm Worker)",
  });
  const wasmWarm = summarize([0.88, 0.86, 0.87, 0.89, 0.87, 0.88], {
    scope: WARM_WORKER_SCOPE_ID,
    label: "C / Wasm (Cached WebAssembly.Instance)",
  });
  const jsInner = summarize([1.41, 1.40, 1.42, 1.41, 1.40, 1.41], {
    scope: "warmWorkerInner",
    label: "JavaScript (Warm Worker)",
  });
  const wasmInner = summarize([0.78, 0.77, 0.78, 0.79, 0.78, 0.78], {
    scope: "warmWorkerInner",
    label: "C / Wasm (Cached WebAssembly.Instance)",
  });
  const pipeJs = summarize([22.4, 22.1, 22.8, 22.3, 22.5, 22.2], {
    scope: "pipeline",
    label: "JavaScript",
  });
  const pipeWasm = summarize([19.6, 19.4, 19.9, 19.5, 19.7, 19.6], {
    scope: "pipeline",
    label: "WebAssembly",
  });

  // Cross-scope ratio between Contract Worker (`pipeline`) and Warm Worker (`warmWorker`)
  // must always be refused as `cross-scope`.
  assertEquals(ratio(pipeJs, wasmWarm).status, "cross-scope");

  const mockProbe = {
    status: "ok",
    reason: null,
    manifestPath: "/benchmarks/multilang-wasm/ml-gemm.manifest.json",
    workloadId: "ml.gemm.v1",
    primaryKernel: "gemm",
    kernelLabel: "strict-f32 GEMM — 128×128×128 product",
    jsLabel: "JavaScript (Warm Worker)",
    jsSource: "/benchmarks/v2/ml-gemm/workload.js",
    jsGitHubUrl:
      "https://github.com/PaulKinlan/wasm-vs-js/blob/main/benchmarks/v2/ml-gemm/workload.js",
    wasmKey: "c",
    wasmEngineLabel: "C / Wasm",
    wasmLabel: "C / Wasm (Cached WebAssembly.Instance)",
    wasmToolchain: "clang --target=wasm32 -O3 -nostdlib",
    wasmSource: "/benchmarks/multilang-wasm/ml-gemm/gemm.c",
    wasmGitHubUrl:
      "https://github.com/PaulKinlan/wasm-vs-js/blob/main/benchmarks/multilang-wasm/ml-gemm/gemm.c",
    wasmBinaryUrl: "/artifacts/multilang-wasm-benchmark/gemm_c.wasm",
    wasmBytes: 982,
    wasmFetchMs: 1.4,
    wasmInitMs: 0.6,
    workerInitWallMs: 8.2,
    oracleVerified: true,
    oracleDigest: "0x65d28759",
    wasmFetchCount: 1,
    wasmInstantiateCount: 1,
    jsTaskCount: 8,
    wasmTaskCount: 8,
    ipcWarmupRuns: 2,
    timedRuns: 6,
    reducedSampleCount: null,
    timings: {
      jsRoundTrip: jsWarm,
      wasmRoundTrip: wasmWarm,
      jsInnerCompute: jsInner,
      wasmInnerCompute: wasmInner,
      roundTripRatio: ratio(jsWarm, wasmWarm),
      jsRoundTripSamples: [1.52, 1.49, 1.51, 1.50, 1.53, 1.50],
      wasmRoundTripSamples: [0.88, 0.86, 0.87, 0.89, 0.87, 0.88],
      jsInnerComputeSamples: [1.41, 1.40, 1.42, 1.41, 1.40, 1.41],
      wasmInnerComputeSamples: [0.78, 0.77, 0.78, 0.79, 0.78, 0.78],
    },
  };

  const primaryStats = {
    jsStats: { pipelineSummary: pipeJs, samples: pipeJs!.samples, outputDigest: "0x65d28759" },
    wasmStats: {
      pipelineSummary: pipeWasm,
      samples: pipeWasm!.samples,
      outputDigest: "0x65d28759",
    },
  };
  const catalogSpec = {
    workerLifecycleClass: "asymmetric-wasm-cold-per-task",
    workerScriptUrl: "/benchmarks/ml-gemm/neural-gemm-worker.js",
    perTaskWasmInstantiate: true,
  };

  const renderedHtml = renderWarmWorkerScopeHtml(mockProbe, {
    primaryStats,
    catalogSpec,
    workloadSlug: "ml-gemm",
  });

  assert(renderedHtml.includes("Symmetric Warm Worker Scope (Cached WebAssembly.Instance)"));
  assert(renderedHtml.includes('data-warm-worker-probe="ready"'));
  assert(renderedHtml.includes('data-wasm-instantiations="1"'));
  assert(renderedHtml.includes('data-warm-worker-contrast="1"'));
  assert(renderedHtml.includes("asymmetric-wasm-cold-per-task"));
  assert(renderedHtml.includes("neural-gemm-worker.js"));
  assert(renderedHtml.includes("0x65d28759"));
  assert(
    !/\sstyle=/i.test(renderedHtml),
    "rendered HTML must not contain inline style= attributes",
  );
  assert(!/<script/i.test(renderedHtml), "rendered HTML must not contain inline <script> tags");

  const byScope = buildExplorerRows({
    primaryStats,
    multilangResults: null,
    warmWorkerResults: mockProbe,
    domResults: null,
    manifest: null,
    catalogSpec,
  });
  assertEquals(byScope.warmWorker.length, 2);
  assertEquals(byScope.warmWorker[0].track, "A");
  assertEquals(byScope.warmWorker[1].track, "A");

  const csv = toCsv(explorerCsvRecords(byScope));
  assert(csv.includes('"warmWorker"'));
  assert(csv.includes('"0x65d28759"'));

  // Static hygiene check over owned JS modules and rendered HTML.
  for (
    const path of [
      "public/warm-worker-probe.js",
      "public/warm-worker-probe-worker.js",
      "public/unified-runner.js",
    ]
  ) {
    const raw = await Deno.readTextFile(path);
    const lower = raw.toLocaleLowerCase();
    assert(!/\sstyle=/i.test(raw), `${path} contains forbidden inline style= attribute`);
    assert(!lower.includes("wasm wins"), `${path} contains forbidden 'Wasm wins' copy`);
    assert(
      !lower.includes("benchmark winner"),
      `${path} contains forbidden 'benchmark winner' copy`,
    );
    for (const phrase of STOCK_PHRASES) {
      assert(!lower.includes(phrase), `${path} contains stock AI phrase: ${phrase}`);
    }
    for (
      const forbiddenSurface of [
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "sendBeacon",
        "XMLHttpRequest",
        "WebSocket",
      ]
    ) {
      assert(
        !raw.includes(forbiddenSurface),
        `${path} contains forbidden surface: ${forbiddenSurface}`,
      );
    }
  }
  const lowerHtml = renderedHtml.toLocaleLowerCase();
  for (const phrase of STOCK_PHRASES) {
    assert(
      !lowerHtml.includes(phrase),
      `rendered warm-worker HTML contains stock phrase: ${phrase}`,
    );
  }
});
