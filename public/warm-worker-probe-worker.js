// Symmetric Warm Worker Probe — Reusable Module Web Worker
//
// Initializes ONE JavaScript callable and ONE Track A linear/WAT WebAssembly.Instance
// up front per workload manifest, verifies oracle output agreement once before timing,
// warms up both engines in worker memory, and then serves N steady-state
// postMessage -> warm execution -> onmessage round-trips with zero per-task
// .wasm fetches, zero SHA-256 re-hashing, and zero re-instantiations.

import {
  fnv1aBytes,
  getLastAgreementRecord,
  isTrackBEngine,
  KERNEL_ADAPTERS,
  resolveEngineSource,
  TOOLCHAIN_COMMANDS,
} from "./multilang-runner.js";

/**
 * @typedef {Object} WarmWorkerState
 * @property {string} workloadId
 * @property {string} manifestPath
 * @property {string} primaryKernel
 * @property {string} kernelLabel
 * @property {Function} jsFn
 * @property {Function} wasmFn
 * @property {string} jsLabel
 * @property {string | null} jsSource
 * @property {string} wasmKey
 * @property {string} wasmLabel
 * @property {string} wasmToolchain
 * @property {string | null} wasmSource
 * @property {string | null} wasmBinaryUrl
 * @property {number} wasmBytes
 * @property {number} wasmFetchMs
 * @property {number} wasmInitMs
 * @property {number} coldJsComputeMs
 * @property {number} coldWasmComputeMs
 * @property {boolean} oracleVerified
 * @property {string} oracleDigest
 * @property {number} wasmFetchCount
 * @property {number} wasmInstantiateCount
 * @property {number} jsTaskCount
 * @property {number} wasmTaskCount
 * @property {{ js: number, wasm: number }} warmupRuns
 */

/** @type {WarmWorkerState | null} */
let activeState = null;

const TRACK_A_LINEAR_PRIORITY = ["c", "rs", "cpp", "wat", "asc", "as"];
const NATIVE_FETCH = globalThis.fetch.bind(globalThis);

/**
 * Resolve root-relative paths against an explicit origin or worker module URL.
 * Allows the identical module worker to run in browsers and local HTTP test harnesses.
 *
 * @param {string} pathOrUrl
 * @param {string | null} [origin]
 * @returns {string}
 */
export function resolveWorkerAssetUrl(pathOrUrl, origin = null) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = origin ||
    (typeof self !== "undefined" && self.location?.origin && self.location.origin !== "null"
      ? self.location.origin
      : import.meta.url);
  return new URL(pathOrUrl, base).href;
}

/**
 * Ensure root-relative `fetch("/...")` calls inside shared kernel adapters resolve
 * against `origin` when executed inside non-browser module workers.
 *
 * @param {string | null} origin
 * @param {() => Promise<any>} fn
 */
async function withOriginScopedFetch(origin, fn) {
  if (!origin) return await fn();
  const prevFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return NATIVE_FETCH(resolveWorkerAssetUrl(input, origin), init);
    }
    return NATIVE_FETCH(input, init);
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = prevFetch;
  }
}

/**
 * Invoke a synchronous or asynchronous kernel callable.
 * @param {Function} fn
 */
async function invokeCallable(fn) {
  const out = fn();
  return out && typeof out.then === "function" ? await out : out;
}

/**
 * Derive a deterministic digest string when a callable returns a scalar or typed array.
 * Returns null when the callable mutates memory in-place without returning a value
 * (those kernels verify agreement via `requireEngineAgreement` or inline oracle checks).
 *
 * @param {any} value
 * @returns {string | null}
 */
export function normalizeDirectOutputDigest(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
  }
  if (typeof value === "bigint") {
    return `0x${BigInt.asUintN(64, value).toString(16).padStart(16, "0")}`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    return /^[0-9a-f]{64}$/i.test(trimmed) ? `sha256:${trimmed.toLowerCase()}` : trimmed;
  }
  if (value instanceof Uint8Array) {
    return `0x${fnv1aBytes(value).toString(16).padStart(8, "0")}`;
  }
  if (ArrayBuffer.isView(value)) {
    const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `0x${fnv1aBytes(view).toString(16).padStart(8, "0")}`;
  }
  return null;
}

/**
 * Pick one Track A linear/WAT engine from a manifest.
 * Track B variants are strictly excluded so Track A and Track B never mix.
 *
 * @param {any} manifest
 * @param {string} primaryKernel
 * @param {string | null} [preferredWasmKey]
 */
export function pickTrackALinearEngine(manifest, primaryKernel, preferredWasmKey = null) {
  const engines = Array.isArray(manifest?.engines) ? manifest.engines : [];
  const candidates = engines.filter((e) => {
    if (!e || e.kind !== "linear" || isTrackBEngine(e)) return false;
    if (Array.isArray(e.kernels) && !e.kernels.includes(primaryKernel)) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  if (preferredWasmKey) {
    const matched = candidates.find((e) => e.key === preferredWasmKey);
    if (matched) return matched;
  }
  for (const key of TRACK_A_LINEAR_PRIORITY) {
    const matched = candidates.find((e) => e.key === key);
    if (matched) return matched;
  }
  return candidates[0];
}

/**
 * Classify whether an initialization error represents an oracle correctness mismatch
 * versus an environment/adapter capability limitation (such as main-thread globals).
 *
 * @param {unknown} err
 * @returns {{ oracleMismatch: boolean, message: string }}
 */
function classifyInitError(err) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const oracleMismatch = lower.includes("engines disagree") ||
    lower.includes("agree on ") ||
    lower.includes("mismatch") ||
    lower.includes("fnv drift") ||
    lower.includes("drifted from") ||
    lower.includes("exceeded declaredtolerance");
  return { oracleMismatch, message };
}

/**
 * Initialize a warm JS + cached-instance Wasm pair for a workload manifest.
 * Fetches and instantiates the chosen Track A `.wasm` binary ONCE (`wasmInstantiateCount === 1`).
 *
 * @param {{
 *   manifestPath?: string,
 *   manifest?: any,
 *   preferredWasmKey?: string | null,
 *   warmupMaxRuns?: number,
 *   warmupMinRuns?: number,
 *   warmupBudgetMs?: number,
 *   origin?: string | null,
 *   adapterOverride?: any,
 * }} opts
 * @returns {Promise<WarmWorkerState>}
 */
export async function initializeWarmWorkerState({
  manifestPath = "",
  manifest: providedManifest = null,
  preferredWasmKey = null,
  warmupMaxRuns = 12,
  warmupMinRuns = 3,
  warmupBudgetMs = 150,
  origin = null,
  adapterOverride = null,
}) {
  return await withOriginScopedFetch(origin, async () => {
    let manifest = providedManifest;
    if (!manifest) {
      if (!manifestPath) {
        throw new Error("manifestPath is required to initialize warm worker probe");
      }
      const manifestUrl = resolveWorkerAssetUrl(manifestPath, origin);
      const res = await NATIVE_FETCH(manifestUrl, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Manifest fetch failed (${res.status}) for ${manifestPath}`);
      }
      manifest = await res.json();
    }

    const workloadId = String(manifest?.workloadId ?? "");
    const adapter = adapterOverride ?? KERNEL_ADAPTERS[workloadId];
    if (
      !workloadId || !adapter || !Array.isArray(adapter.kernels) || adapter.kernels.length === 0
    ) {
      throw new Error(
        `No worker-compatible kernel adapter registered for ${workloadId || "manifest"}`,
      );
    }

    const primaryKernel = manifest.kernels?.[0] ?? adapter.kernels[0];
    if (!adapter.kernels.includes(primaryKernel)) {
      throw new Error(`Kernel ${primaryKernel} is not supported by adapter ${workloadId}`);
    }

    const jsEngine = (manifest.engines ?? []).find(
      (e) => (e.key === "js" || e.kind === "js") && !isTrackBEngine(e),
    );
    if (!jsEngine) {
      throw new Error(`Manifest ${workloadId} declares no Track A JavaScript engine`);
    }

    const wasmEngine = pickTrackALinearEngine(manifest, primaryKernel, preferredWasmKey);
    if (!wasmEngine) {
      throw new Error(`Manifest ${workloadId} declares no Track A linear/WAT Wasm engine`);
    }

    let wasmFetchCount = 0;
    let wasmInstantiateCount = 0;

    const base = String(manifest.artifactsBase ?? "/artifacts/multilang-wasm-benchmark");
    const kernelsToWire = Array.isArray(wasmEngine.kernels)
      ? wasmEngine.kernels
      : (Array.isArray(manifest.kernels) && manifest.kernels.length > 0
        ? manifest.kernels
        : [primaryKernel]);

    /** @type {Map<string, { instance: WebAssembly.Instance, bytes: Uint8Array, fetchMs: number, initMs: number, binaryUrl: string }>} */
    const instantiatedByUrl = new Map();
    /** @type {Record<string, any>} */
    const instancesByKernel = {};

    for (const kernel of kernelsToWire) {
      const file = wasmEngine.files?.[kernel] ??
        `${kernel}_${wasmEngine.lang ?? wasmEngine.key}.wasm`;
      const binaryUrl = wasmEngine.url ?? `${base}/${file}`;
      let cached = instantiatedByUrl.get(binaryUrl);
      if (!cached) {
        const resolvedBinUrl = resolveWorkerAssetUrl(binaryUrl, origin);
        const tFetch0 = performance.now();
        const resp = await NATIVE_FETCH(resolvedBinUrl, { cache: "no-store" });
        if (!resp.ok) {
          throw new Error(`Wasm binary ${binaryUrl} returned HTTP ${resp.status}`);
        }
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const fetchMs = performance.now() - tFetch0;
        wasmFetchCount += 1;

        const tInit0 = performance.now();
        const compiled = new WebAssembly.Module(bytes);
        const instance = new WebAssembly.Instance(compiled, { env: { abort: () => {} } });
        const initMs = performance.now() - tInit0;
        wasmInstantiateCount += 1;

        cached = { instance, bytes, fetchMs, initMs, binaryUrl };
        instantiatedByUrl.set(binaryUrl, cached);
      }
      instancesByKernel[kernel] = cached;
    }

    const primaryWasmInst = instancesByKernel[primaryKernel];
    const filteredManifest = {
      ...manifest,
      engines: [jsEngine, wasmEngine],
    };
    const mods = {
      manifest: filteredManifest,
      engines: {
        [wasmEngine.key]: {
          cfg: wasmEngine,
          instances: instancesByKernel,
          bytes: primaryWasmInst.bytes,
          fetchMs: primaryWasmInst.fetchMs,
          initMs: primaryWasmInst.initMs,
          binaryUrl: primaryWasmInst.binaryUrl,
        },
      },
    };

    const callables = await adapter.build(mods);
    const jsFn = callables?.js?.[primaryKernel];
    const wasmFn = callables?.[wasmEngine.key]?.[primaryKernel];
    if (typeof jsFn !== "function" || typeof wasmFn !== "function") {
      throw new Error(
        `Adapter ${workloadId} did not expose both js and ${wasmEngine.key} callables for ${primaryKernel}`,
      );
    }

    // Pre-timing oracle check + cold first-call observation on the initialized pair.
    const tJs0 = performance.now();
    const jsFirstOut = await invokeCallable(jsFn);
    const coldJsComputeMs = performance.now() - tJs0;

    const tWasm0 = performance.now();
    const wasmFirstOut = await invokeCallable(wasmFn);
    const coldWasmComputeMs = performance.now() - tWasm0;

    const agreement = adapterOverride
      ? null
      : (getLastAgreementRecord(`${workloadId} ${primaryKernel}`) ??
        getLastAgreementRecord(workloadId));
    const jsDirectDigest = normalizeDirectOutputDigest(jsFirstOut);
    const wasmDirectDigest = normalizeDirectOutputDigest(wasmFirstOut);

    if (agreement) {
      if (agreement.perEngine.has("js") && agreement.perEngine.has(wasmEngine.key)) {
        const aJs = agreement.perEngine.get("js");
        const aWasm = agreement.perEngine.get(wasmEngine.key);
        if (aJs !== aWasm) {
          throw new Error(
            `${workloadId}: agreement record mismatch (js=${aJs}, ${wasmEngine.key}=${aWasm})`,
          );
        }
      }
    } else if (
      jsDirectDigest !== null && wasmDirectDigest !== null && jsDirectDigest !== wasmDirectDigest
    ) {
      throw new Error(
        `${workloadId}: warm worker engines disagree (${jsDirectDigest} vs ${wasmDirectDigest})`,
      );
    }

    const oracleDigest = agreement?.agreedHex ??
      wasmDirectDigest ??
      jsDirectDigest ??
      "oracle-verified";

    // Bounded in-worker warm-up so both V8 JIT and Wasm tiering stabilize before timed messages.
    let jsWarmups = 0;
    const jsWarmStart = performance.now();
    while (jsWarmups < warmupMaxRuns) {
      await invokeCallable(jsFn);
      jsWarmups += 1;
      if (jsWarmups >= warmupMinRuns && performance.now() - jsWarmStart >= warmupBudgetMs) {
        break;
      }
    }

    let wasmWarmups = 0;
    const wasmWarmStart = performance.now();
    while (wasmWarmups < warmupMaxRuns) {
      await invokeCallable(wasmFn);
      wasmWarmups += 1;
      if (wasmWarmups >= warmupMinRuns && performance.now() - wasmWarmStart >= warmupBudgetMs) {
        break;
      }
    }

    const rawJsSrc = resolveEngineSource(manifest, jsEngine, primaryKernel);
    const rawWasmSrc = resolveEngineSource(manifest, wasmEngine, primaryKernel);
    const jsSource = rawJsSrc ? `/${rawJsSrc.replace(/^\//, "")}` : null;
    const wasmSource = rawWasmSrc ? `/${rawWasmSrc.replace(/^\//, "")}` : null;
    const wasmToolchain = TOOLCHAIN_COMMANDS[wasmEngine.lang ?? wasmEngine.key] ??
      wasmEngine.toolchain ??
      "wasm32 linear memory";

    return {
      workloadId,
      manifestPath,
      primaryKernel,
      kernelLabel: String(manifest.kernelLabel ?? primaryKernel),
      jsFn,
      wasmFn,
      jsLabel: String(jsEngine.label ?? "JavaScript"),
      jsSource,
      wasmKey: String(wasmEngine.key),
      wasmLabel: String(wasmEngine.label ?? wasmEngine.key),
      wasmToolchain: String(wasmToolchain),
      wasmSource,
      wasmBinaryUrl: primaryWasmInst.binaryUrl.startsWith("/")
        ? primaryWasmInst.binaryUrl
        : `/${primaryWasmInst.binaryUrl}`,
      wasmBytes: primaryWasmInst.bytes.byteLength,
      wasmFetchMs: primaryWasmInst.fetchMs,
      wasmInitMs: primaryWasmInst.initMs,
      coldJsComputeMs,
      coldWasmComputeMs,
      oracleVerified: true,
      oracleDigest,
      wasmFetchCount,
      wasmInstantiateCount,
      jsTaskCount: 0,
      wasmTaskCount: 0,
      warmupRuns: { js: jsWarmups, wasm: wasmWarmups },
    };
  });
}

/**
 * Process one message for the symmetric warm-worker protocol and return the response payload.
 *
 * @param {any} msg
 * @returns {Promise<any>}
 */
export async function handleWarmWorkerMessage(msg) {
  const token = msg?.token ?? null;
  const type = msg?.type;

  if (type === "init") {
    try {
      activeState = await initializeWarmWorkerState({
        manifestPath: msg.manifestPath ?? "",
        manifest: msg.manifest ?? null,
        preferredWasmKey: msg.preferredWasmKey ?? null,
        warmupMaxRuns: typeof msg.warmupMaxRuns === "number" ? msg.warmupMaxRuns : 12,
        warmupMinRuns: typeof msg.warmupMinRuns === "number" ? msg.warmupMinRuns : 3,
        warmupBudgetMs: typeof msg.warmupBudgetMs === "number" ? msg.warmupBudgetMs : 150,
        origin: msg.origin ?? null,
      });
      return {
        token,
        ok: true,
        type: "initialized",
        workloadId: activeState.workloadId,
        primaryKernel: activeState.primaryKernel,
        kernelLabel: activeState.kernelLabel,
        jsLabel: activeState.jsLabel,
        jsSource: activeState.jsSource,
        wasmKey: activeState.wasmKey,
        wasmLabel: activeState.wasmLabel,
        wasmToolchain: activeState.wasmToolchain,
        wasmSource: activeState.wasmSource,
        wasmBinaryUrl: activeState.wasmBinaryUrl,
        wasmBytes: activeState.wasmBytes,
        wasmFetchMs: activeState.wasmFetchMs,
        wasmInitMs: activeState.wasmInitMs,
        coldJsComputeMs: activeState.coldJsComputeMs,
        coldWasmComputeMs: activeState.coldWasmComputeMs,
        oracleVerified: activeState.oracleVerified,
        oracleDigest: activeState.oracleDigest,
        wasmFetchCount: activeState.wasmFetchCount,
        wasmInstantiateCount: activeState.wasmInstantiateCount,
        warmupRuns: activeState.warmupRuns,
      };
    } catch (err) {
      activeState = null;
      const { oracleMismatch, message } = classifyInitError(err);
      return {
        token,
        ok: false,
        type: "error",
        unavailable: !oracleMismatch,
        oracleMismatch,
        message,
      };
    }
  }

  if (type === "run") {
    if (!activeState) {
      return {
        token,
        ok: false,
        type: "error",
        message: "Warm worker received 'run' before 'init'",
      };
    }
    const isWasm = msg.target === "wasm";
    const fn = isWasm ? activeState.wasmFn : activeState.jsFn;
    try {
      const t0 = performance.now();
      await invokeCallable(fn);
      const computeMs = performance.now() - t0;
      if (isWasm) {
        activeState.wasmTaskCount += 1;
      } else {
        activeState.jsTaskCount += 1;
      }
      return {
        token,
        ok: true,
        type: "completed",
        target: isWasm ? "wasm" : "js",
        computeMs,
        wasmFetchCount: activeState.wasmFetchCount,
        wasmInstantiateCount: activeState.wasmInstantiateCount,
        jsTaskCount: activeState.jsTaskCount,
        wasmTaskCount: activeState.wasmTaskCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        token,
        ok: false,
        type: "error",
        message,
      };
    }
  }

  if (type === "stats") {
    if (!activeState) {
      return {
        token,
        ok: true,
        type: "stats",
        initialized: false,
        wasmFetchCount: 0,
        wasmInstantiateCount: 0,
        jsTaskCount: 0,
        wasmTaskCount: 0,
      };
    }
    return {
      token,
      ok: true,
      type: "stats",
      initialized: true,
      workloadId: activeState.workloadId,
      primaryKernel: activeState.primaryKernel,
      wasmKey: activeState.wasmKey,
      wasmLabel: activeState.wasmLabel,
      oracleVerified: activeState.oracleVerified,
      oracleDigest: activeState.oracleDigest,
      wasmFetchCount: activeState.wasmFetchCount,
      wasmInstantiateCount: activeState.wasmInstantiateCount,
      jsTaskCount: activeState.jsTaskCount,
      wasmTaskCount: activeState.wasmTaskCount,
    };
  }

  return {
    token,
    ok: false,
    type: "error",
    message: `Unsupported warm-worker message type: ${String(type)}`,
  };
}

const isWorkerGlobalScope = typeof self !== "undefined" &&
  typeof self.postMessage === "function" &&
  typeof globalThis.document === "undefined";

if (isWorkerGlobalScope) {
  self.addEventListener("message", async (event) => {
    const reply = await handleWarmWorkerMessage(event.data);
    self.postMessage(reply);
  });
}
