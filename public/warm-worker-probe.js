// Symmetric Warm Worker Probe — Host Coordinator & Scope Report Renderer
//
// Measures steady-state Web Worker round-trips (`postMessage` -> warm compute ->
// `onmessage`) where BOTH JavaScript and Track A linear/WAT WebAssembly keep their
// module and `WebAssembly.Instance` warm across every iteration (`wasmInstantiateCount = 1`).
//
// Why this exists alongside the Contract Worker (`pipeline` scope):
// 45 of 49 contract workers re-fetch or re-instantiate `.wasm` inside `onmessage`
// on every task to self-attest artifact hashes, and worker source bytes are
// hash-pinned by committed provenance manifests (`docs/worker-lifecycle-audit.md`).
// Rather than editing frozen contract workers, this additive probe runs one
// reusable module worker against the page's multi-language manifest and reports
// cached-instance worker latency in its own dedicated scope (`warmWorker`).

import { fmtBytes, fmtMs, fmtRatio, ratio, summarize } from "./measurement-model.js";
import { icon, sourceToGitHubUrl } from "./benchmark-report.js";

export const WARM_WORKER_SCOPE_ID = "warmWorker";

export const WARM_WORKER_SCOPE_META = {
  id: WARM_WORKER_SCOPE_ID,
  label: "Symmetric Warm Worker Scope (Cached WebAssembly.Instance)",
  short: "Warm Worker",
  question:
    "What does one postMessage → warm execution → onmessage round-trip cost when both JavaScript and WebAssembly keep a cached instance warm in a persistent worker?",
  includes:
    "Main-thread postMessage, structured-clone dispatch, warm worker kernel execution, and onmessage completion on one reused module worker (1 WebAssembly.Instance across all N tasks).",
  excludes:
    "Per-task .wasm no-store re-fetch, SHA-256 bundle attestation, per-message WebAssembly.instantiate(), and DOM rendering.",
  unit: "ms per postMessage round-trip",
  recurring: true,
};

const TRACK_A_LINEAR_PRIORITY = ["c", "rs", "cpp", "wat", "asc", "as"];
const DEFAULT_IPC_WARMUP_PAIRS = 2;
const SLOW_CALL_THRESHOLD_MS = 250;

/**
 * HTML-escape user or manifest strings before interpolation.
 * @param {unknown} s
 * @returns {string}
 */
function esc(s) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/**
 * Identify Track B engines so Track A and Track B never mix in the warm-worker probe.
 * @param {any} item
 * @returns {boolean}
 */
export function isTrackBEngineCandidate(item) {
  if (!item) return false;
  if (item.track === "B") return true;
  const k = String(item.key || "").toLowerCase();
  const l = String(item.label || item.language || "").toLowerCase();
  return k.includes("-ikj") || k.includes("-tiled") || k.includes("-simd") ||
    k.includes("-opt") || k.includes("-o2") || k.includes("-o3") || k.includes("-o4") ||
    l.includes("track b") || l.includes("simd") || l.includes("optimized") ||
    l.includes("reassociated") || l.includes("i/k/j") || l.includes("tiled");
}

/**
 * Select the fastest Track A linear/WAT `.wasm` engine from a manifest.
 * Uses observed in-tab `multilangResults` medians when available; otherwise
 * falls back to deterministic Track A compiler order (`c`, `rs`, `cpp`, `wat`, `asc`).
 *
 * @param {any} manifest
 * @param {any} [multilangResults]
 * @returns {any | null}
 */
export function selectFastestTrackALinearEngine(manifest, multilangResults = null) {
  if (!manifest || !Array.isArray(manifest.engines)) return null;
  const primaryKernel = manifest.kernels?.[0] ?? null;
  const candidates = manifest.engines.filter((e) => {
    if (!e || e.kind !== "linear" || isTrackBEngineCandidate(e)) return false;
    if (primaryKernel && Array.isArray(e.kernels) && !e.kernels.includes(primaryKernel)) {
      return false;
    }
    return true;
  });
  if (candidates.length === 0) return null;

  const kernelRows =
    primaryKernel && multilangResults && Array.isArray(multilangResults[primaryKernel])
      ? multilangResults[primaryKernel]
      : [];
  if (kernelRows.length > 0) {
    /** @type {{ engine: any, ms: number }[]} */
    const measured = [];
    for (const engine of candidates) {
      const row = kernelRows.find((r) => r && r.key === engine.key && !isTrackBEngineCandidate(r));
      const ms = typeof row?.medianMs === "number"
        ? row.medianMs
        : (typeof row?.summary?.p50Ms === "number" ? row.summary.p50Ms : null);
      if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) {
        measured.push({ engine, ms });
      }
    }
    if (measured.length > 0) {
      measured.sort((a, b) => a.ms - b.ms);
      return measured[0].engine;
    }
  }

  for (const key of TRACK_A_LINEAR_PRIORITY) {
    const matched = candidates.find((e) => e.key === key);
    if (matched) return matched;
  }
  return candidates[0];
}

let nextProbeToken = 1;

/**
 * Send one request to the warm-worker probe and settle on matching token response.
 *
 * @param {Worker} worker
 * @param {Record<string, any>} payload
 * @param {number} timeoutMs
 * @param {string} phaseLabel
 * @returns {Promise<{ wallMs: number, data: any }>}
 */
function postProbeMessage(worker, payload, timeoutMs, phaseLabel) {
  return new Promise((resolve, reject) => {
    const token = `wwp-${nextProbeToken++}`;
    let settled = false;
    const startTime = performance.now();

    /**
     * @param {(v: any) => void} settleFn
     * @param {any} value
     */
    const finish = (settleFn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      settleFn(value);
    };

    const timer = setTimeout(() => {
      const elapsed = Math.round(performance.now() - startTime);
      finish(
        reject,
        new Error(
          `warm-worker ${phaseLabel} timed out after ${timeoutMs} ms (${elapsed} ms elapsed)`,
        ),
      );
    }, timeoutMs);

    /** @param {MessageEvent} event */
    const onMessage = (event) => {
      const msg = event.data;
      if (!msg || msg.token !== token) return;
      finish(resolve, { wallMs: performance.now() - startTime, data: msg });
    };

    /** @param {ErrorEvent} err */
    const onError = (err) => {
      if (typeof err?.preventDefault === "function") err.preventDefault();
      finish(reject, new Error(err?.message || "warm-worker runtime error event"));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ ...payload, token });
  });
}

/**
 * Run the symmetric warm-worker probe for a multi-language manifest.
 *
 * Spawns ONE module Web Worker, initializes JS + one Track A `.wasm` instance up front,
 * verifies oracle agreement once before timing, runs untimed IPC warm-ups, and records
 * `N` balanced paired `postMessage` -> warm compute -> `onmessage` round-trips.
 *
 * Degrades cleanly (`status: "unavailable"`) when Workers are absent or when a kernel
 * adapter requires main-thread globals (`document`, `window`, etc.). Rejects timing
 * (`status: "correctness-failure"`) if oracle verification fails.
 *
 * @param {string} manifestPath
 * @param {{
 *   iterations?: number,
 *   ipcWarmupRuns?: number,
 *   manifest?: any,
 *   multilangResults?: any,
 *   preferredWasmKey?: string | null,
 *   workerUrl?: string | null,
 *   origin?: string | null,
 *   timeoutMs?: number,
 *   onStatus?: (msg: string) => void,
 *   WorkerImpl?: typeof Worker | null,
 * }} [options]
 */
export async function runWarmWorkerProbe(manifestPath, options = {}) {
  const {
    iterations = 30,
    ipcWarmupRuns = DEFAULT_IPC_WARMUP_PAIRS,
    manifest = null,
    multilangResults = null,
    preferredWasmKey = null,
    workerUrl = null,
    origin = null,
    timeoutMs = 60000,
    onStatus = () => {},
    WorkerImpl = typeof globalThis.Worker === "function" ? globalThis.Worker : null,
  } = options;

  const fallbackWorkloadId = String(manifest?.workloadId ?? "");
  if (!manifestPath && !manifest) {
    return {
      status: "unavailable",
      reason: "No multi-language manifest specified for warm-worker probe",
      manifestPath: "",
      workloadId: fallbackWorkloadId,
      timings: null,
    };
  }

  if (typeof WorkerImpl !== "function") {
    return {
      status: "unavailable",
      reason: "Web Worker constructor is unavailable in this runtime",
      manifestPath,
      workloadId: fallbackWorkloadId,
      timings: null,
    };
  }

  const resolvedPreferredKey = preferredWasmKey ??
    selectFastestTrackALinearEngine(manifest, multilangResults)?.key ??
    null;

  const resolvedWorkerUrl = workerUrl ??
    (origin
      ? `${origin.replace(/\/$/, "")}/warm-worker-probe-worker.js`
      : "/warm-worker-probe-worker.js");

  const inferredOrigin = origin ??
    (/^https?:\/\//i.test(resolvedWorkerUrl)
      ? new URL(resolvedWorkerUrl).origin
      : (typeof globalThis.location?.origin === "string" &&
          globalThis.location.origin !== "null"
        ? globalThis.location.origin
        : null));

  /** @type {Worker | null} */
  let worker = null;
  try {
    worker = new WorkerImpl(resolvedWorkerUrl, { type: "module" });
  } catch (err) {
    return {
      status: "unavailable",
      reason: err instanceof Error ? err.message : String(err),
      manifestPath,
      workloadId: fallbackWorkloadId,
      timings: null,
    };
  }

  try {
    onStatus("initializing cached WebAssembly.Instance in reusable worker…");
    const initReply = await postProbeMessage(
      worker,
      {
        type: "init",
        manifestPath,
        manifest,
        preferredWasmKey: resolvedPreferredKey,
        origin: inferredOrigin,
      },
      timeoutMs,
      "init",
    );

    const initData = initReply.data;
    if (!initData?.ok) {
      if (initData?.oracleMismatch) {
        return {
          status: "correctness-failure",
          reason: initData.message || "Oracle verification failed inside warm worker",
          manifestPath,
          workloadId: fallbackWorkloadId,
          timings: null,
        };
      }
      return {
        status: "unavailable",
        reason: initData?.message || "Kernel adapter cannot execute inside a Web Worker",
        manifestPath,
        workloadId: fallbackWorkloadId,
        timings: null,
      };
    }

    const singleCallMaxMs = Math.max(
      Number(initData.coldJsComputeMs) || 0,
      Number(initData.coldWasmComputeMs) || 0,
    );
    const requestedRuns = Math.max(1, Math.floor(iterations));
    const timedRuns = singleCallMaxMs > SLOW_CALL_THRESHOLD_MS && requestedRuns > 5
      ? 5
      : requestedRuns;
    const reducedSampleCount = timedRuns < requestedRuns
      ? {
        requested: requestedRuns,
        taken: timedRuns,
        reason: `single kernel call took ${
          fmtMs(singleCallMaxMs)
        } (> ${SLOW_CALL_THRESHOLD_MS} ms)`,
      }
      : null;

    // Warm up the postMessage / MessagePort channel before recording timed samples.
    for (let w = 0; w < ipcWarmupRuns; w++) {
      const jsWarm = await postProbeMessage(
        worker,
        { type: "run", target: "js" },
        timeoutMs,
        `IPC warm-up js ${w + 1}`,
      );
      if (!jsWarm.data?.ok) {
        return {
          status: "unavailable",
          reason: jsWarm.data?.message || "Warm worker JS warm-up failed",
          manifestPath,
          workloadId: initData.workloadId,
          timings: null,
        };
      }
      const wasmWarm = await postProbeMessage(
        worker,
        { type: "run", target: "wasm" },
        timeoutMs,
        `IPC warm-up wasm ${w + 1}`,
      );
      if (!wasmWarm.data?.ok) {
        return {
          status: "unavailable",
          reason: wasmWarm.data?.message || "Warm worker Wasm warm-up failed",
          manifestPath,
          workloadId: initData.workloadId,
          timings: null,
        };
      }
    }

    /** @type {number[]} */
    const jsRoundTripSamples = [];
    /** @type {number[]} */
    const wasmRoundTripSamples = [];
    /** @type {number[]} */
    const jsInnerComputeSamples = [];
    /** @type {number[]} */
    const wasmInnerComputeSamples = [];

    // Balanced alternating pair order (`js`->`wasm` on even blocks, `wasm`->`js` on odd blocks).
    for (let i = 0; i < timedRuns; i++) {
      const pairOrder = i % 2 === 0 ? ["js", "wasm"] : ["wasm", "js"];
      for (const target of pairOrder) {
        const res = await postProbeMessage(
          worker,
          { type: "run", target },
          timeoutMs,
          `steady ${target} ${i + 1}/${timedRuns}`,
        );
        if (!res.data?.ok) {
          return {
            status: "unavailable",
            reason: res.data?.message || `Warm worker ${target} iteration ${i + 1} failed`,
            manifestPath,
            workloadId: initData.workloadId,
            timings: null,
          };
        }
        if (target === "wasm") {
          wasmRoundTripSamples.push(res.wallMs);
          if (typeof res.data.computeMs === "number" && Number.isFinite(res.data.computeMs)) {
            wasmInnerComputeSamples.push(res.data.computeMs);
          }
        } else {
          jsRoundTripSamples.push(res.wallMs);
          if (typeof res.data.computeMs === "number" && Number.isFinite(res.data.computeMs)) {
            jsInnerComputeSamples.push(res.data.computeMs);
          }
        }
      }
      onStatus(`measured ${i + 1}/${timedRuns} warm round-trip pairs…`);
    }

    const statsReply = await postProbeMessage(worker, { type: "stats" }, timeoutMs, "stats");
    const finalStats = statsReply.data ?? {};

    const jsLabel = `${initData.jsLabel || "JavaScript"} (Warm Worker)`;
    const wasmLabel = `${initData.wasmLabel || "WebAssembly"} (Cached WebAssembly.Instance)`;

    const jsRoundTrip = summarize(jsRoundTripSamples, {
      scope: WARM_WORKER_SCOPE_ID,
      label: jsLabel,
    });
    const wasmRoundTrip = summarize(wasmRoundTripSamples, {
      scope: WARM_WORKER_SCOPE_ID,
      label: wasmLabel,
    });
    const jsInnerCompute = summarize(jsInnerComputeSamples, {
      scope: "warmWorkerInner",
      label: jsLabel,
    });
    const wasmInnerCompute = summarize(wasmInnerComputeSamples, {
      scope: "warmWorkerInner",
      label: wasmLabel,
    });
    const roundTripRatio = ratio(jsRoundTrip, wasmRoundTrip);

    return {
      status: "ok",
      reason: null,
      manifestPath,
      workloadId: String(initData.workloadId),
      primaryKernel: String(initData.primaryKernel),
      kernelLabel: String(initData.kernelLabel),
      jsLabel,
      jsSource: initData.jsSource ?? null,
      jsGitHubUrl: initData.jsSource ? sourceToGitHubUrl(initData.jsSource) : null,
      wasmKey: String(initData.wasmKey),
      wasmEngineLabel: String(initData.wasmLabel || initData.wasmKey),
      wasmLabel,
      wasmToolchain: String(initData.wasmToolchain || "wasm32 linear memory"),
      wasmSource: initData.wasmSource ?? null,
      wasmGitHubUrl: initData.wasmSource ? sourceToGitHubUrl(initData.wasmSource) : null,
      wasmBinaryUrl: initData.wasmBinaryUrl ?? null,
      wasmBytes: typeof initData.wasmBytes === "number" ? initData.wasmBytes : null,
      wasmFetchMs: typeof initData.wasmFetchMs === "number" ? initData.wasmFetchMs : 0,
      wasmInitMs: typeof initData.wasmInitMs === "number" ? initData.wasmInitMs : 0,
      workerInitWallMs: initReply.wallMs,
      oracleVerified: Boolean(initData.oracleVerified),
      oracleDigest: String(initData.oracleDigest || "oracle-verified"),
      wasmFetchCount: Number(finalStats.wasmFetchCount ?? initData.wasmFetchCount ?? 1),
      wasmInstantiateCount: Number(
        finalStats.wasmInstantiateCount ?? initData.wasmInstantiateCount ?? 1,
      ),
      jsTaskCount: Number(finalStats.jsTaskCount ?? ipcWarmupRuns + timedRuns),
      wasmTaskCount: Number(finalStats.wasmTaskCount ?? ipcWarmupRuns + timedRuns),
      ipcWarmupRuns,
      timedRuns,
      reducedSampleCount,
      timings: {
        jsRoundTrip,
        wasmRoundTrip,
        jsInnerCompute,
        wasmInnerCompute,
        roundTripRatio,
        jsRoundTripSamples,
        wasmRoundTripSamples,
        jsInnerComputeSamples,
        wasmInnerComputeSamples,
      },
    };
  } catch (err) {
    return {
      status: "unavailable",
      reason: err instanceof Error ? err.message : String(err),
      manifestPath,
      workloadId: fallbackWorkloadId,
      timings: null,
    };
  } finally {
    worker.terminate();
  }
}

/**
 * Format a median cell with optional 95% order-statistic confidence interval.
 * @param {any} summary
 * @returns {string}
 */
function medianWithCiHtml(summary) {
  if (!summary) return "—";
  const p50 = fmtMs(summary.p50Ms);
  if (!summary.ci95) {
    return `${p50}<br><small class="muted">n=${summary.n}, no interval</small>`;
  }
  return `${p50}<br><small class="muted">95% CI ${fmtMs(summary.ci95.lowMs)} – ${
    fmtMs(summary.ci95.highMs)
  } · n=${summary.n}</small>`;
}

/**
 * Render source + GitHub link cell for a warm-worker row.
 * @param {string | null} src
 * @param {string | null} ghUrl
 * @param {string} lifecycleNote
 * @param {string} toolchain
 * @returns {string}
 */
function sourceLifecycleCellHtml(src, ghUrl, lifecycleNote, toolchain) {
  let linkHtml = "";
  if (src) {
    const cleanHref = src.startsWith("/") ? src : `/${src}`;
    const name = cleanHref.split("/").pop() ?? cleanHref;
    const resolvedGh = ghUrl || sourceToGitHubUrl(cleanHref);
    linkHtml = `<a class="commit-link" href="${esc(cleanHref)}" target="_blank" rel="noopener">${
      esc(name)
    }</a>${
      resolvedGh
        ? ` · <a class="commit-link" href="${
          esc(resolvedGh)
        }" target="_blank" rel="noopener">GitHub</a>`
        : ""
    }`;
  }
  return `${linkHtml ? `<div>${linkHtml}</div>` : ""}` +
    `<div><small><code>${esc(toolchain)}</code></small></div>` +
    `<div><small class="muted">${esc(lifecycleNote)}</small></div>`;
}

/**
 * Render the dedicated "Symmetric Warm Worker Scope (Cached WebAssembly.Instance)"
 * section contrasting cached-instance worker round-trips against the pinned
 * self-attesting contract worker without mixing scopes.
 *
 * @param {any} probeResult
 * @param {{ primaryStats?: any, catalogSpec?: any, workloadSlug?: string }} [context]
 * @returns {string}
 */
export function renderWarmWorkerScopeHtml(
  probeResult,
  { primaryStats = null, catalogSpec = null, workloadSlug = "" } = {},
) {
  if (!probeResult) return "";

  const meta = WARM_WORKER_SCOPE_META;

  if (probeResult.status === "correctness-failure") {
    return `<div class="scope-block" data-scope="${meta.id}" data-warm-worker-probe="correctness-failure">
      <div class="scope-head">
        <h3 class="scope-title">${esc(meta.label)}</h3>
        <p class="scope-question">${esc(meta.question)}</p>
      </div>
      <p class="notice is-dominated">${icon("warn")}
        <strong>Correctness gate rejected timing:</strong> ${esc(probeResult.reason)}.
        Per <code>PLAN.md</code>, a trial that fails oracle agreement publishes no timing numbers.
      </p>
    </div>`;
  }

  if (probeResult.status !== "ok" || !probeResult.timings) {
    return `<div class="scope-block" data-scope="${meta.id}" data-warm-worker-probe="unavailable">
      <div class="scope-head">
        <h3 class="scope-title">${esc(meta.label)}</h3>
        <p class="scope-question">${esc(meta.question)}</p>
      </div>
      <p class="notice">${icon("info")}
        <strong>Symmetric warm-worker probe unavailable on this page:</strong>
        ${esc(probeResult.reason || "kernel requires main-thread capabilities")}.
        Absent worker measurements remain typed <code>unavailable</code> rather than filled from another scope.
      </p>
    </div>`;
  }

  const {
    jsRoundTrip,
    wasmRoundTrip,
    jsInnerCompute,
    wasmInnerCompute,
    roundTripRatio,
  } = probeResult.timings;

  const jsIpcDeltaMs = jsRoundTrip && jsInnerCompute
    ? Math.max(0, jsRoundTrip.p50Ms - jsInnerCompute.p50Ms)
    : null;
  const wasmIpcDeltaMs = wasmRoundTrip && wasmInnerCompute
    ? Math.max(0, wasmRoundTrip.p50Ms - wasmInnerCompute.p50Ms)
    : null;

  const contractJsSummary = primaryStats?.jsStats?.pipelineSummary ?? null;
  const contractWasmSummary = primaryStats?.wasmStats?.pipelineSummary ?? null;
  const lifecycleClass = catalogSpec?.workerLifecycleClass ?? null;
  const contractWorkerUrl = catalogSpec?.workerScriptUrl ?? null;
  const contractWorkerName = contractWorkerUrl
    ? (contractWorkerUrl.split("/").pop() || contractWorkerUrl)
    : (workloadSlug ? `${workloadSlug} contract worker` : "contract worker");

  let contrastNoticeHtml = "";
  if (contractJsSummary || contractWasmSummary) {
    const isColdPerTask = lifecycleClass === "asymmetric-wasm-cold-per-task" ||
      lifecycleClass === "per-task-verified-bundle" ||
      lifecycleClass === "symmetric-cold-isolate";
    const contractBehavior = lifecycleClass === "asymmetric-wasm-cold-per-task"
      ? `keeps its JS ES module warm while re-fetching and re-instantiating .wasm inside onmessage on every task`
      : lifecycleClass === "per-task-verified-bundle"
      ? `re-fetches, SHA-256-verifies, and dynamically imports/instantiates bundles on every task`
      : lifecycleClass === "symmetric-cold-isolate"
      ? `spawns a fresh OS thread and V8 isolate per sample`
      : `runs its own full-contract validation harness`;

    const contractMedians = [
      contractJsSummary ? `JS ${fmtMs(contractJsSummary.p50Ms)}` : null,
      contractWasmSummary ? `Wasm ${fmtMs(contractWasmSummary.p50Ms)}` : null,
    ].filter(Boolean).join(" vs ");

    const warmRatioSummary = roundTripRatio?.status === "ok"
      ? `within-scope JS/Wasm ratio <strong>${fmtRatio(roundTripRatio)}</strong>`
      : "within-scope ratio unavailable";

    contrastNoticeHtml = `<p class="notice" data-warm-worker-contrast="1">${icon("info")}
      <strong>Cached-Instance Warm Worker vs. Self-Attesting Contract Worker:</strong>
      This probe spawned <strong>1</strong> module worker (<code>/warm-worker-probe-worker.js</code>),
      fetched <code>${
      esc((probeResult.wasmBinaryUrl || "").split("/").pop() || "kernel.wasm")
    }</code>
      <strong>${probeResult.wasmFetchCount}×</strong>, created <code>WebAssembly.Instance</code>
      <strong>${probeResult.wasmInstantiateCount}×</strong> across all
      <strong>${probeResult.wasmTaskCount}</strong> Wasm messages, verified oracle digest
      <code>${
      esc(probeResult.oracleDigest)
    }</code> up front, and measured steady-state round-trips of
      <strong>${fmtMs(jsRoundTrip?.p50Ms)}</strong> (JS) vs
      <strong>${fmtMs(wasmRoundTrip?.p50Ms)}</strong> (${
      esc(probeResult.wasmEngineLabel)
    }, ${warmRatioSummary}).
      By contrast, the hash-pinned <strong>Task Pipeline</strong> contract worker
      (<code>${esc(contractWorkerName)}</code>${
      lifecycleClass ? `, class <code>${esc(lifecycleClass)}</code>` : ""
    }) ${contractBehavior}${
      contractMedians ? `, recording ${contractMedians} on its contract fixture` : ""
    }.${
      isColdPerTask
        ? " Comparing those two worker tables reveals how per-task Wasm re-instantiation and SHA-256 attestation shift task latency relative to a persistent warm worker."
        : ""
    }
      Each table computes ratios strictly against its own JavaScript baseline.
      <a class="commit-link" href="/docs/worker-lifecycle-audit.md" target="_blank" rel="noopener">50-test worker lifecycle audit</a> ·
      <a class="commit-link" href="/methodology/#worker-wasm-explained">Worker Wasm methodology →</a>
    </p>`;
  } else {
    contrastNoticeHtml = `<p class="notice" data-warm-worker-contrast="1">${icon("info")}
      <strong>Cached-instance worker verification:</strong>
      <code>/warm-worker-probe-worker.js</code> fetched the Track A <code>.wasm</code> binary
      <strong>${probeResult.wasmFetchCount}×</strong> and instantiated <code>WebAssembly.Instance</code>
      <strong>${probeResult.wasmInstantiateCount}×</strong> across all
      <strong>${probeResult.wasmTaskCount}</strong> Wasm messages (oracle digest
      <code>${esc(probeResult.oracleDigest)}</code> verified before timing).
    </p>`;
  }

  const reducedHtml = probeResult.reducedSampleCount
    ? `<p class="notice">${
      icon("info")
    } Warm-worker sample count reduced from ${probeResult.reducedSampleCount.requested} to ${probeResult.reducedSampleCount.taken} (${
      esc(probeResult.reducedSampleCount.reason)
    }).</p>`
    : "";

  const outDigestShort = probeResult.oracleDigest.length > 18
    ? `${probeResult.oracleDigest.slice(0, 16)}…`
    : probeResult.oracleDigest;
  const outCellHtml = `<code title="Verified pre-timing oracle digest: ${
    esc(probeResult.oracleDigest)
  }">${esc(outDigestShort)}</code>`;

  const wasmBinCellHtml = typeof probeResult.wasmBytes === "number" && probeResult.wasmBytes > 0
    ? (probeResult.wasmBinaryUrl
      ? `<a class="commit-link" href="${
        esc(probeResult.wasmBinaryUrl)
      }" target="_blank" rel="noopener">${fmtBytes(probeResult.wasmBytes)}</a>`
      : fmtBytes(probeResult.wasmBytes))
    : "—";

  const wasmRatioCellHtml = roundTripRatio && roundTripRatio.status === "ok"
    ? `<strong>${fmtRatio(roundTripRatio)}</strong>${
      roundTripRatio.lowRatio && roundTripRatio.highRatio
        ? `<br><small class="muted">${roundTripRatio.lowRatio.toFixed(2)}–${
          roundTripRatio.highRatio.toFixed(2)
        }×</small>`
        : ""
    }`
    : "—";

  const jsLifecycleNote = `reused worker · ${probeResult.jsTaskCount} warm messages · 0 re-imports`;
  const wasmLifecycleNote =
    `reused worker · ${probeResult.wasmInstantiateCount} WebAssembly.Instance across ${probeResult.wasmTaskCount} messages · init ${
      fmtMs(probeResult.wasmInitMs)
    }`;

  const rowsHtml = `
    <tr class="is-baseline">
      <th scope="row">${esc(probeResult.jsLabel)}</th>
      <td>${
    sourceLifecycleCellHtml(
      probeResult.jsSource,
      probeResult.jsGitHubUrl,
      jsLifecycleNote,
      "V8 JIT (warm module in reused worker)",
    )
  }</td>
      <td>${outCellHtml}</td>
      <td class="num">${medianWithCiHtml(jsRoundTrip)}</td>
      <td class="num">${jsInnerCompute ? fmtMs(jsInnerCompute.p50Ms) : "—"}</td>
      <td class="num">${jsIpcDeltaMs !== null ? fmtMs(jsIpcDeltaMs) : "—"}</td>
      <td class="num">${jsRoundTrip ? fmtMs(jsRoundTrip.minMs) : "—"}</td>
      <td class="num">${jsRoundTrip ? fmtMs(jsRoundTrip.p90Ms) : "—"}</td>
      <td class="num">${jsRoundTrip ? fmtMs(jsRoundTrip.maxMs) : "—"}</td>
      <td class="num">${jsRoundTrip ? fmtMs(jsRoundTrip.madMs) : "—"}</td>
      <td class="num">—</td>
      <td class="num">1.00× <small class="muted">(baseline)</small></td>
    </tr>
    <tr>
      <th scope="row">${esc(probeResult.wasmLabel)}</th>
      <td>${
    sourceLifecycleCellHtml(
      probeResult.wasmSource,
      probeResult.wasmGitHubUrl,
      wasmLifecycleNote,
      `${probeResult.wasmToolchain} (cached instance)`,
    )
  }</td>
      <td>${outCellHtml}</td>
      <td class="num">${medianWithCiHtml(wasmRoundTrip)}</td>
      <td class="num">${wasmInnerCompute ? fmtMs(wasmInnerCompute.p50Ms) : "—"}</td>
      <td class="num">${wasmIpcDeltaMs !== null ? fmtMs(wasmIpcDeltaMs) : "—"}</td>
      <td class="num">${wasmRoundTrip ? fmtMs(wasmRoundTrip.minMs) : "—"}</td>
      <td class="num">${wasmRoundTrip ? fmtMs(wasmRoundTrip.p90Ms) : "—"}</td>
      <td class="num">${wasmRoundTrip ? fmtMs(wasmRoundTrip.maxMs) : "—"}</td>
      <td class="num">${wasmRoundTrip ? fmtMs(wasmRoundTrip.madMs) : "—"}</td>
      <td class="num">${wasmBinCellHtml}</td>
      <td class="num">${wasmRatioCellHtml}</td>
    </tr>
  `;

  return `<div class="scope-block" data-scope="${meta.id}" data-warm-worker-probe="ready" data-wasm-instantiations="${probeResult.wasmInstantiateCount}">
    <div class="scope-head">
      <h3 class="scope-title">${esc(meta.label)}</h3>
      <p class="scope-question">${esc(meta.question)}</p>
      <dl class="scope-bounds">
        <div><dt>Counts</dt><dd>${esc(meta.includes)}</dd></div>
        <div><dt>Excludes</dt><dd>${esc(meta.excludes)}</dd></div>
      </dl>
    </div>
    ${contrastNoticeHtml}
    ${reducedHtml}
    <div class="table-wrap">
      <table class="results-table">
        <caption>${esc(meta.label)} — ${
    esc(meta.unit)
  } · ${probeResult.timedRuns} timed samples per engine · ${probeResult.wasmInstantiateCount} WebAssembly.Instance (${
    esc(probeResult.kernelLabel)
  })</caption>
        <thead><tr>
          <th scope="col">Engine</th>
          <th scope="col">Source &amp; worker lifecycle</th>
          <th scope="col">Output</th>
          <th scope="col">Round-trip median</th>
          <th scope="col">In-worker compute</th>
          <th scope="col">IPC dispatch delta</th>
          <th scope="col">Min</th>
          <th scope="col">p90</th>
          <th scope="col">Max</th>
          <th scope="col">MAD</th>
          <th scope="col">Binary</th>
          <th scope="col">vs ${esc(probeResult.jsLabel)}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>`;
}
