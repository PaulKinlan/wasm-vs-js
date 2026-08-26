// Measurement model — the vocabulary every benchmark page reports in.
//
// Before this module the suite produced one "speedup ratio" per page that
// silently mixed three different things: the time to spawn a worker and fetch
// a .wasm, the time to run the kernel, and the time to drive a rendered DOM.
// On ml-dense-mlp that produced 1.31x from the worker lane and 2.04x from the
// kernel lane for the same algorithm, with no way for a reader to tell which
// question either number answered.
//
// Every measurement now carries a scope. Ratios are only ever computed between
// two measurements in the same scope; `ratio()` refuses anything else.

/**
 * @typedef {Object} Summary
 * @property {string | null} scope
 * @property {string} label
 * @property {string} note
 * @property {number} n
 * @property {number} minMs
 * @property {number} maxMs
 * @property {number} meanMs
 * @property {number} p50Ms
 * @property {number | null} p90Ms
 * @property {number | null} p99Ms
 * @property {number} stdDevMs
 * @property {number | null} madMs
 * @property {{ lowMs: number, highMs: number } | null} ci95
 * @property {number[]} samples
 */

/**
 * @typedef {Object} RatioResult
 * @property {string} status
 * @property {string} [scope]
 * @property {string | null} [baselineScope]
 * @property {string | null} [candidateScope]
 * @property {number} [value]
 * @property {number | null} [lowRatio]
 * @property {number | null} [highRatio]
 * @property {boolean | null} [separated]
 */

/**
 * A PerformanceResourceTiming, or the subset of it these helpers read.
 * @typedef {Object} ResourceLike
 * @property {string} [name]
 * @property {string} [deliveryType]
 * @property {number} [startTime]
 * @property {number} [duration]
 * @property {number} [transferSize]
 * @property {number} [decodedBodySize]
 */

/**
 * The four scopes a measurement can belong to. Ordered from "what the user
 * pays once" to "what the user pays every time".
 */
export const SCOPES = {
  delivery: {
    id: "delivery",
    label: "Delivery",
    short: "Delivery",
    question: "What reaches the browser, and what does it cost before any work happens?",
    includes: "Network transfer, decode, Wasm compile, instantiate, module evaluation.",
    excludes: "Algorithm execution.",
    unit: "ms (once per page load)",
    recurring: false,
  },
  kernel: {
    id: "kernel",
    label: "Kernel compute",
    short: "Compute",
    question: "How fast is the algorithm itself, once everything is loaded and warm?",
    includes: "The computational core only, called in-page on a pre-instantiated engine.",
    excludes: "Worker dispatch, structured clone, network, validation, DOM.",
    unit: "ms per invocation",
    recurring: true,
  },
  pipeline: {
    id: "pipeline",
    label: "Task pipeline",
    short: "Pipeline",
    question: "What does one complete task cost in the shape an app would actually run it?",
    includes:
      "Worker dispatch, argument serialization, compute, result transfer, oracle validation.",
    excludes: "Rendering.",
    unit: "ms per task",
    recurring: true,
  },
  domJourney: {
    id: "domJourney",
    label: "Real-DOM journey",
    short: "Real DOM",
    question: "What does driving a rendered UI through this engine cost?",
    includes: "Everything in the pipeline plus real DOM mutation, layout and paint in an iframe.",
    excludes: "Nothing — this is the full user-visible journey.",
    unit: "ms per journey",
    recurring: true,
  },
};

export const SCOPE_ORDER = ["delivery", "kernel", "pipeline", "domJourney"];

/**
 * A scope is comparable to itself and nothing else.
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @returns {boolean}
 */
export function sameScope(a, b) {
  return Boolean(a) && Boolean(b) && a === b;
}

// ── Statistics ────────────────────────────────────────────────────────────

/** @param {number[]} values @returns {number[]} */
function sortedCopy(values) {
  return [...values].sort((a, b) => a - b);
}

/**
 * Nearest-rank percentile on an already-sorted array. p in [0,1].
 * @param {number[]} sorted
 * @param {number} p
 * @returns {number | null}
 */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/**
 * Distribution-free 95% confidence interval for the median (order statistics,
 * normal approximation to the binomial). Returns null below n=6, where the
 * interval would span the whole sample and mean nothing.
 * @param {number[]} sorted
 * @returns {{ lowMs: number, highMs: number } | null}
 */
export function medianCi95(sorted) {
  const n = sorted.length;
  if (n < 6) return null;
  const half = 1.959963985 * Math.sqrt(n) / 2;
  const lo = Math.max(0, Math.ceil(n / 2 - half) - 1);
  const hi = Math.min(n - 1, Math.floor(n / 2 + half));
  return { lowMs: sorted[lo], highMs: sorted[hi] };
}

/**
 * Summarize a sample of durations. Everything downstream reads these fields;
 * nothing downstream re-derives statistics from raw samples.
 *
 * `null` is returned for an empty sample rather than a zero — an absent
 * measurement is never numerically indistinguishable from an instant one.
 *
 * @param {number[] | null | undefined} samples
 * @param {{ scope?: string | null, label?: string, note?: string }} [options]
 * @returns {Summary | null}
 */
export function summarize(samples, { scope = null, label = "", note = "" } = {}) {
  const clean = (samples ?? []).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (clean.length === 0) return null;
  const sorted = sortedCopy(clean);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
  const p50 = /** @type {number} */ (percentile(sorted, 0.5));
  const absDev = sortedCopy(sorted.map((v) => Math.abs(v - p50)));
  return {
    scope: scope ?? null,
    label,
    note,
    n,
    minMs: sorted[0],
    maxMs: sorted[n - 1],
    meanMs: mean,
    p50Ms: p50,
    p90Ms: percentile(sorted, 0.9),
    p99Ms: percentile(sorted, 0.99),
    stdDevMs: Math.sqrt(variance),
    // Median absolute deviation: robust spread, unmoved by a single GC pause.
    madMs: percentile(absDev, 0.5),
    ci95: medianCi95(sorted),
    samples: sorted,
  };
}

/**
 * Ratio of a baseline summary to a candidate summary, within one scope.
 *
 * Returns `{ status: "cross-scope" }` rather than a number when the two
 * summaries measure different things — the defect this module exists to stop.
 * The interval is the ratio of the two medians' CI bounds, so a ratio whose
 * interval spans 1.0 is reported as `separated: false` and must not be called
 * a win.
 *
 * @param {Summary | null | undefined} baseline
 * @param {Summary | null | undefined} candidate
 * @returns {RatioResult}
 */
export function ratio(baseline, candidate) {
  if (!baseline || !candidate) return { status: "unavailable" };
  if (!sameScope(baseline.scope, candidate.scope)) {
    return {
      status: "cross-scope",
      baselineScope: baseline.scope,
      candidateScope: candidate.scope,
    };
  }
  if (!(candidate.p50Ms > 0)) return { status: "unavailable" };
  const value = baseline.p50Ms / candidate.p50Ms;
  let lo = null, hi = null, separated = null;
  if (baseline.ci95 && candidate.ci95 && candidate.ci95.highMs > 0) {
    lo = baseline.ci95.lowMs / candidate.ci95.highMs;
    hi = baseline.ci95.highMs / candidate.ci95.lowMs;
    separated = lo > 1 || hi < 1;
  }
  return { status: "ok", scope: baseline.scope, value, lowRatio: lo, highRatio: hi, separated };
}

// ── Delivery cost and break-even ──────────────────────────────────────────

/**
 * Amortized total time to perform `invocations` tasks: pay the one-off
 * delivery cost once, then the recurring per-invocation cost.
 * @param {number | null | undefined} deliveryMs
 * @param {number | null | undefined} perInvocationMs
 * @param {number} invocations
 * @returns {number | null}
 */
export function amortizedTotalMs(deliveryMs, perInvocationMs, invocations) {
  if (typeof perInvocationMs !== "number" || !Number.isFinite(perInvocationMs)) return null;
  const fixed = typeof deliveryMs === "number" && Number.isFinite(deliveryMs) ? deliveryMs : 0;
  return fixed + perInvocationMs * invocations;
}

/**
 * The number a team actually needs: how many invocations before the candidate
 * (usually Wasm — slower to deliver, faster to run) overtakes the baseline.
 *
 * `status` is explicit about the three ways this can fail to be a number:
 *   "never"      — the candidate is not faster per invocation, so it never wins
 *   "immediate"  — the candidate delivers no slower AND runs faster: wins at 1
 *   "unavailable"— a required measurement is missing
 *
 * @param {{ baselineDeliveryMs?: number | null, baselinePerMs?: number | null,
 *           candidateDeliveryMs?: number | null, candidatePerMs?: number | null }} input
 * @returns {{ status: string, invocations?: number, perSavingMs?: number, extraFixedMs?: number }}
 */
export function breakEven(
  { baselineDeliveryMs, baselinePerMs, candidateDeliveryMs, candidatePerMs },
) {
  const nums = [baselinePerMs, candidatePerMs];
  if (nums.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
    return { status: "unavailable" };
  }
  const baseFixed = Number.isFinite(baselineDeliveryMs) ? baselineDeliveryMs : 0;
  const candFixed = Number.isFinite(candidateDeliveryMs) ? candidateDeliveryMs : 0;
  const perSaving = baselinePerMs - candidatePerMs;
  const extraFixed = candFixed - baseFixed;
  if (perSaving <= 0) {
    return { status: "never", perSavingMs: perSaving, extraFixedMs: extraFixed };
  }
  if (extraFixed <= 0) {
    return {
      status: "immediate",
      invocations: 1,
      perSavingMs: perSaving,
      extraFixedMs: extraFixed,
    };
  }
  return {
    status: "ok",
    invocations: Math.ceil(extraFixed / perSaving),
    perSavingMs: perSaving,
    extraFixedMs: extraFixed,
  };
}

// ── Resource timing ───────────────────────────────────────────────────────

/**
 * Classify one PerformanceResourceTiming entry's delivery.
 *
 * The previous heuristic was `transferSize === 0 && decodedBodySize > 0 ||
 * duration < 2`, which labelled every fast request a cache hit. Only the
 * spec-defined signals are used here: `deliveryType` where the browser
 * provides it, then transfer/decoded sizes. A request that cannot be
 * classified is reported as "unknown", never guessed.
 * @param {ResourceLike | null | undefined} entry
 * @returns {{ kind: string, label: string }}
 */
export function classifyDelivery(entry) {
  if (!entry) return { kind: "unknown", label: "unknown" };
  if (entry.deliveryType === "cache") return { kind: "cache", label: "Disk/memory cache" };
  if (entry.deliveryType === "navigational-prefetch") {
    return { kind: "prefetch", label: "Prefetch cache" };
  }
  const transfer = entry.transferSize;
  const decoded = entry.decodedBodySize;
  if (typeof transfer !== "number" || typeof decoded !== "number") {
    return { kind: "unknown", label: "unknown (opaque timing)" };
  }
  // A cross-origin resource without Timing-Allow-Origin reports zeros for
  // both. That is opacity, not a cache hit.
  if (transfer === 0 && decoded === 0) {
    return { kind: "opaque", label: "opaque (no Timing-Allow-Origin)" };
  }
  if (transfer === 0 && decoded > 0) return { kind: "cache", label: "Disk/memory cache" };
  // A 304 carries headers but no body.
  if (transfer > 0 && decoded > 0 && transfer < decoded * 0.1 && transfer < 1024) {
    return { kind: "revalidated", label: "Revalidated (304)" };
  }
  return { kind: "network", label: "Network" };
}

/**
 * Resources whose fetch *started* inside [startMs, endMs].
 *
 * Attribution used to be a substring match on the URL, so `findResource("c")`
 * matched almost every request on the page. A timed window is the only honest
 * way to say "this run caused this request".
 * @param {ResourceLike[] | null | undefined} entries
 * @param {number} startMs
 * @param {number} endMs
 * @returns {ResourceLike[]}
 */
export function resourcesInWindow(entries, startMs, endMs) {
  return (entries ?? []).filter((e) =>
    typeof e.startTime === "number" && e.startTime >= startMs && e.startTime <= endMs
  );
}

/**
 * Total network cost of a set of resource entries, split by delivery kind.
 * `wallMs` is the union of the fetch intervals rather than their sum, because
 * concurrent requests overlap and summing them overstates the cost.
 * @param {ResourceLike[] | null | undefined} entries
 * @returns {{ count: number, transferBytes: number, decodedBytes: number,
 *             cacheHits: number, networkFetches: number, wallMs: number }}
 */
/**
 * Split delivered bytes by what the byte actually is.
 *
 * A worker fetches its JavaScript module graph and its .wasm in the same
 * window, so a single byte total cannot answer "what does choosing Wasm add".
 * The engines are separated by resource kind instead: the .wasm is what the
 * Wasm path adds, and the algorithm's own JavaScript is what the JavaScript
 * path costs. Fixtures, manifests and anything else both paths load are
 * reported separately rather than being folded into either side.
 *
 * @param {Array<{name?: string, decodedBodySize?: number, transferSize?: number}> |
 *          null | undefined} entries
 */
export function splitDeliveryBytes(entries) {
  let wasmBytes = 0, scriptBytes = 0, sharedBytes = 0;
  let wasmTransfer = 0, scriptTransfer = 0;
  for (const entry of entries ?? []) {
    const name = String(entry?.name ?? "").split("?")[0];
    const decoded = typeof entry?.decodedBodySize === "number" ? entry.decodedBodySize : 0;
    const transfer = typeof entry?.transferSize === "number" ? entry.transferSize : 0;
    if (/\.wasm$/i.test(name)) {
      wasmBytes += decoded;
      wasmTransfer += transfer;
    } else if (/\.(m?js)$/i.test(name)) {
      scriptBytes += decoded;
      scriptTransfer += transfer;
    } else {
      sharedBytes += decoded;
    }
  }
  return { wasmBytes, scriptBytes, sharedBytes, wasmTransfer, scriptTransfer };
}

export function networkCost(entries) {
  const list = entries ?? [];
  let transferBytes = 0, decodedBytes = 0, cacheHits = 0, networkFetches = 0;
  const intervals = [];
  for (const e of list) {
    transferBytes += typeof e.transferSize === "number" ? e.transferSize : 0;
    decodedBytes += typeof e.decodedBodySize === "number" ? e.decodedBodySize : 0;
    const kind = classifyDelivery(e).kind;
    if (kind === "cache") cacheHits++;
    else if (kind === "network") networkFetches++;
    if (typeof e.startTime === "number" && typeof e.duration === "number" && e.duration > 0) {
      intervals.push([e.startTime, e.startTime + e.duration]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let wallMs = 0, curStart = null, curEnd = null;
  for (const [s, en] of intervals) {
    if (curStart === null) {
      curStart = s;
      curEnd = en;
    } else if (s <= curEnd) {
      curEnd = Math.max(curEnd, en);
    } else {
      wallMs += curEnd - curStart;
      curStart = s;
      curEnd = en;
    }
  }
  if (curStart !== null) wallMs += curEnd - curStart;
  return { count: list.length, transferBytes, decodedBytes, cacheHits, networkFetches, wallMs };
}

// ── Contamination ─────────────────────────────────────────────────────────

/**
 * What fraction of a timed region was network?
 *
 * A pipeline median that is 94% network is not a statement about JavaScript or
 * WebAssembly, and a reader is entitled to see that before reading the ratio.
 */
export function contamination(timedMs, networkWallMs) {
  if (typeof timedMs !== "number" || !(timedMs > 0)) return { status: "unavailable" };
  const net = typeof networkWallMs === "number" && networkWallMs > 0 ? networkWallMs : 0;
  const fraction = Math.min(1, net / timedMs);
  // Below 2% the notice rendered as "0% of the window was network", which
  // reads as a warning about nothing. That is clean.
  let severity = "clean";
  if (fraction >= 0.5) severity = "dominated";
  else if (fraction >= 0.15) severity = "material";
  else if (fraction >= 0.02) severity = "minor";
  return { status: "ok", fraction, networkWallMs: net, timedMs, severity };
}

/**
 * Human-facing formatting helpers, shared so every table agrees.
 * @param {number | null | undefined} value
 * @param {number} [digits]
 * @returns {string}
 */
export function fmtMs(value, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(digits)} s`;
  if (value < 0.01 && value > 0) return `${(value * 1000).toFixed(1)} µs`;
  return `${value.toFixed(digits)} ms`;
}

/** @param {number | null | undefined} value @returns {string} */
/**
 * A resource fetch duration, or null when the browser did not report one.
 *
 * Chrome reports `responseEnd` before `startTime` for worker script loads
 * (initiatorType "other"), producing a negative duration — the delivery table
 * printed "-2.46 ms" for every worker fetch. A non-positive duration is a
 * missing measurement, not a fast one.
 * @param {ResourceLike | null | undefined} entry
 * @returns {number | null}
 */
export function fetchDurationMs(entry) {
  const d = entry?.duration;
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null;
}

/** @param {number | null | undefined} value @returns {string} */
export function fmtBytes(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
  if (value === 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

/** @param {RatioResult | null | undefined} r @returns {string} */
export function fmtRatio(r) {
  if (!r || r.status !== "ok") return "—";
  const base = `${r.value.toFixed(2)}×`;
  if (r.separated === false) return `${base} (not separated)`;
  return base;
}
