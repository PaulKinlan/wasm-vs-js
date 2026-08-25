// Benchmark report rendering — scope-segmented tables and SVG charts.
//
// The rendering rules this module exists to enforce:
//   * one table per measurement scope, each with its own baseline and ratio;
//   * no ratio between measurements from different scopes;
//   * a missing measurement renders as an em dash, never as a zero or a
//     substituted neighbouring statistic;
//   * charts are SVG with real axes, so a 2 ms bar and a 200 ms bar are
//     visibly different;
//   * icons are inline SVG, never emoji.

import {
  amortizedTotalMs,
  breakEven,
  classifyDelivery,
  fetchDurationMs,
  fmtBytes,
  fmtMs,
  fmtRatio,
  ratio,
  SCOPE_ORDER,
  SCOPES,
} from "./measurement-model.js";

// ── Icons ─────────────────────────────────────────────────────────────────

const ICON_PATHS = {
  cache:
    "M4 7h16M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M8 11h8",
  network:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3",
  warn: "M12 4l8.7 15H3.3L12 4zm0 6v4m0 3v.5",
  check: "M4 12.5l5 5L20 6.5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 5v.5m0 3.5v5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4.5V12l3.5 2",
};

/** @param {string} name @param {string} [cls] */
export function icon(name, cls = "") {
  const d = ICON_PATHS[name];
  if (!d) return "";
  return `<svg class="wvj-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ` +
    `focusable="false"><path d="${d}"/></svg>`;
}

/** @param {string} s */
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// ── Charts ────────────────────────────────────────────────────────────────

/** Round a value up to a readable axis maximum (1, 2, 2.5 or 5 × 10^n). */
function niceMax(value) {
  if (!(value > 0)) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const frac = value / base;
  const step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return step * base;
}

function axisTicks(max, count = 4) {
  const out = [];
  for (let i = 0; i <= count; i++) out.push((max / count) * i);
  return out;
}

/**
 * Horizontal bar chart with a real linear axis, gridlines, and 95% CI
 * whiskers where the sample supports an interval.
 *
 * The previous chart mapped every bar through `Math.max(5, pct)` into a 9px
 * hairline track, so a 2 ms bar and a 76 ms bar looked the same. Bars here are
 * proportional and labelled outside the bar, so a short bar stays readable.
 *
 * @param {{ label: string, valueMs: number|null, lowMs?: number|null,
 *           highMs?: number|null, kind?: string }[]} rows
 * @param {{ title?: string, caption?: string, scale?: "auto"|"linear"|"log" }} [opts]
 */
export function barChartSvg(rows, { title = "", caption = "", scale = "auto" } = {}) {
  const usable = rows.filter((r) => typeof r.valueMs === "number" && Number.isFinite(r.valueMs));
  if (usable.length === 0) return "";
  const rawMax = Math.max(...usable.map((r) => Math.max(r.valueMs, r.highMs ?? 0)));
  const rawMin = Math.min(...usable.map((r) => r.valueMs));
  // A linear axis is unreadable when one engine is 30x another: Dart/WasmGC at
  // 73 ms next to C at 2.4 ms squashed every fast engine into the same stub.
  // Above a 25x spread the axis goes logarithmic, and the caption says so.
  const useLog = scale === "log" ||
    (scale === "auto" && rawMin > 0 && rawMax / rawMin >= 25);
  const max = useLog ? rawMax : niceMax(rawMax);
  const logMin = useLog ? 10 ** Math.floor(Math.log10(rawMin)) : 0;
  const rowH = 30;
  const labelW = 168;
  const valueW = 96;
  const padTop = 26;
  const padBottom = 30;
  const plotW = 420;
  const width = labelW + plotW + valueW;
  const height = padTop + rows.length * rowH + padBottom;
  const x = (v) => {
    if (!useLog) return labelW + (v / max) * plotW;
    const clamped = Math.max(v, logMin);
    const span = Math.log10(max) - Math.log10(logMin);
    return labelW + ((Math.log10(clamped) - Math.log10(logMin)) / span) * plotW;
  };

  const ticks = useLog
    ? (() => {
      const out = [];
      for (let t = logMin; t <= max * 1.0001; t *= 10) out.push(t);
      if (out[out.length - 1] < max) out.push(max);
      return out;
    })()
    : axisTicks(max);

  const grid = ticks.map((t) =>
    `<line class="wvj-grid" x1="${x(t).toFixed(1)}" y1="${padTop - 8}" ` +
    `x2="${x(t).toFixed(1)}" y2="${padTop + rows.length * rowH}"/>` +
    `<text class="wvj-axis-label" x="${x(t).toFixed(1)}" ` +
    `y="${padTop + rows.length * rowH + 16}" text-anchor="middle">${
      t === 0 ? "0" : fmtMs(t, t < 10 ? 1 : 0)
    }</text>`
  ).join("");

  const bars = rows.map((r, i) => {
    const y = padTop + i * rowH;
    const cy = y + rowH / 2;
    const labelEl = `<text class="wvj-bar-label" x="${labelW - 10}" y="${cy}" ` +
      `text-anchor="end" dominant-baseline="middle">${esc(r.label)}</text>`;
    if (typeof r.valueMs !== "number" || !Number.isFinite(r.valueMs)) {
      return labelEl +
        `<text class="wvj-bar-value wvj-absent" x="${labelW + 6}" y="${cy}" ` +
        `dominant-baseline="middle">not measured</text>`;
    }
    const w = Math.max(1.5, x(r.valueMs) - labelW);
    const barH = 15;
    const kind = r.kind ? ` wvj-bar-${r.kind}` : "";
    let whisker = "";
    if (typeof r.lowMs === "number" && typeof r.highMs === "number" && r.highMs > r.lowMs) {
      const x1 = x(r.lowMs), x2 = x(r.highMs);
      whisker =
        `<line class="wvj-ci" x1="${x1.toFixed(1)}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${cy}"/>` +
        `<line class="wvj-ci" x1="${x1.toFixed(1)}" y1="${cy - 4}" x2="${x1.toFixed(1)}" y2="${
          cy + 4
        }"/>` +
        `<line class="wvj-ci" x1="${x2.toFixed(1)}" y1="${cy - 4}" x2="${x2.toFixed(1)}" y2="${
          cy + 4
        }"/>`;
    }
    return labelEl +
      `<rect class="wvj-bar${kind}" x="${labelW}" y="${cy - barH / 2}" width="${
        w.toFixed(1)
      }" height="${barH}" rx="2"><title>${esc(r.label)}: ${fmtMs(r.valueMs)}</title></rect>` +
      whisker +
      `<text class="wvj-bar-value" x="${(labelW + plotW + 8).toFixed(1)}" y="${cy}" ` +
      `dominant-baseline="middle">${fmtMs(r.valueMs)}</text>`;
  }).join("");

  const scaleNote = useLog
    ? "Logarithmic axis: the fastest and slowest engines here differ by more than 25x, " +
      "which a linear axis renders as one long bar and several stubs."
    : "";
  const fullCaption = [caption, scaleNote].filter(Boolean).join(" ");

  return `<figure class="wvj-chart">` +
    (title ? `<figcaption class="wvj-chart-title">${esc(title)}</figcaption>` : "") +
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${
      esc(title || "bar chart")
    }" preserveAspectRatio="xMinYMin meet">${grid}${bars}</svg>` +
    (fullCaption ? `<p class="wvj-chart-caption">${esc(fullCaption)}</p>` : "") +
    `</figure>`;
}

/**
 * Amortization chart: cumulative time against invocation count for each
 * engine, so the crossing point where a slower-to-deliver engine overtakes
 * JavaScript is visible rather than asserted.
 *
 * @param {{ label: string, deliveryMs: number|null, perMs: number|null, kind?: string }[]} series
 * @param {{ maxInvocations?: number, title?: string, caption?: string }} [opts]
 */
export function amortizationChartSvg(series, {
  maxInvocations = 0,
  title = "",
  caption = "",
} = {}) {
  const usable = series.filter((s) => typeof s.perMs === "number" && Number.isFinite(s.perMs));
  if (usable.length < 2) return "";

  const base = usable.find((s) => s.kind === "js") ?? usable[0];
  // Pick an x-range that actually contains every crossing, with headroom.
  let n = maxInvocations;
  if (!n) {
    let furthest = 10;
    for (const s of usable) {
      if (s === base) continue;
      const be = breakEven({
        baselineDeliveryMs: base.deliveryMs,
        baselinePerMs: base.perMs,
        candidateDeliveryMs: s.deliveryMs,
        candidatePerMs: s.perMs,
      });
      if (be.status === "ok" && be.invocations) furthest = Math.max(furthest, be.invocations);
    }
    n = Math.max(10, Math.ceil(furthest * 2));
  }

  const maxY = niceMax(
    Math.max(...usable.map((s) => amortizedTotalMs(s.deliveryMs, s.perMs, n) ?? 0)),
  );
  const padL = 66, padR = 132, padT = 24, padB = 40;
  const plotW = 380, plotH = 220;
  const width = padL + plotW + padR;
  const height = padT + plotH + padB;
  const px = (i) => padL + (i / n) * plotW;
  const py = (v) => padT + plotH - (v / maxY) * plotH;

  const gridY = axisTicks(maxY).map((t) =>
    `<line class="wvj-grid" x1="${padL}" y1="${py(t).toFixed(1)}" x2="${padL + plotW}" y2="${
      py(t).toFixed(1)
    }"/>` +
    `<text class="wvj-axis-label" x="${padL - 8}" y="${py(t).toFixed(1)}" text-anchor="end" ` +
    `dominant-baseline="middle">${t === 0 ? "0" : fmtMs(t, 0)}</text>`
  ).join("");

  const gridX = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const i = Math.round(n * f);
    return `<line class="wvj-grid" x1="${px(i).toFixed(1)}" y1="${padT}" x2="${
      px(i).toFixed(1)
    }" y2="${padT + plotH}"/>` +
      `<text class="wvj-axis-label" x="${px(i).toFixed(1)}" y="${
        padT + plotH + 16
      }" text-anchor="middle">${i}</text>`;
  }).join("");

  const lines = usable.map((s, idx) => {
    const y0 = amortizedTotalMs(s.deliveryMs, s.perMs, 0) ?? 0;
    const y1 = amortizedTotalMs(s.deliveryMs, s.perMs, n) ?? 0;
    const cls = `wvj-line wvj-series-${idx % 7}${s.kind === "js" ? " wvj-line-base" : ""}`;
    const label = `<text class="wvj-series-label wvj-series-text-${idx % 7}" x="${
      padL + plotW + 8
    }" y="${py(y1).toFixed(1)}" dominant-baseline="middle">${esc(s.label)}</text>`;
    return `<line class="${cls}" x1="${px(0).toFixed(1)}" y1="${py(y0).toFixed(1)}" x2="${
      px(n).toFixed(1)
    }" y2="${py(y1).toFixed(1)}"><title>${esc(s.label)}</title></line>` + label;
  }).join("");

  // Mark each crossing against the baseline.
  const markers = usable.map((s) => {
    if (s === base) return "";
    const be = breakEven({
      baselineDeliveryMs: base.deliveryMs,
      baselinePerMs: base.perMs,
      candidateDeliveryMs: s.deliveryMs,
      candidatePerMs: s.perMs,
    });
    if (be.status !== "ok" || !be.invocations || be.invocations > n) return "";
    const cx = px(be.invocations);
    const cy = py(amortizedTotalMs(s.deliveryMs, s.perMs, be.invocations) ?? 0);
    return `<circle class="wvj-crossing" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4">` +
      `<title>${esc(s.label)} overtakes ${
        esc(base.label)
      } at ${be.invocations} invocations</title>` +
      `</circle>`;
  }).join("");

  return `<figure class="wvj-chart wvj-chart-wide">` +
    (title ? `<figcaption class="wvj-chart-title">${esc(title)}</figcaption>` : "") +
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${
      esc(title || "amortization chart")
    }" preserveAspectRatio="xMinYMin meet">` +
    gridY + gridX + lines + markers +
    `<text class="wvj-axis-title" x="${padL + plotW / 2}" y="${
      height - 6
    }" text-anchor="middle">invocations after page load</text>` +
    `</svg>` +
    (caption ? `<p class="wvj-chart-caption">${esc(caption)}</p>` : "") +
    `</figure>`;
}

// ── Tables ────────────────────────────────────────────────────────────────

function ciCell(summary) {
  if (!summary) return "—";
  const p50 = fmtMs(summary.p50Ms);
  if (!summary.ci95) return `${p50}<br><small class="muted">n=${summary.n}, no interval</small>`;
  return `${p50}<br><small class="muted">95% CI ${fmtMs(summary.ci95.lowMs)} – ${
    fmtMs(summary.ci95.highMs)
  } · n=${summary.n}</small>`;
}

/**
 * One scope, one table, one baseline.
 *
 * @param {{ scopeId: string, rows: { label: string, summary: any, toolchain?: string,
 *           source?: string|null, bytes?: number|null, note?: string }[],
 *           baselineLabel?: string, iterations?: number }} input
 */
export function scopeTableHtml({ scopeId, rows, baselineLabel = "JavaScript", iterations }) {
  const scope = SCOPES[scopeId];
  const present = rows.filter((r) => r.summary);
  if (present.length === 0) return "";
  const baseline = present.find((r) => r.label === baselineLabel) ?? present[0];

  const body = rows.map((r) => {
    const s = r.summary;
    const rr = s && r !== baseline ? ratio(baseline.summary, s) : null;
    const ratioCell = r === baseline
      ? `1.00× <small class="muted">(baseline)</small>`
      : rr && rr.status === "ok"
      ? `<strong>${fmtRatio(rr)}</strong>${
        rr.lowRatio && rr.highRatio
          ? `<br><small class="muted">${rr.lowRatio.toFixed(2)}–${rr.highRatio.toFixed(2)}×</small>`
          : ""
      }`
      : "—";
    const src = r.source
      ? `<a class="commit-link" href="${esc(r.source.startsWith("/") ? r.source : "/" + r.source)}"
           target="_blank" rel="noopener">${esc(r.source.split("/").pop() ?? r.source)}</a>`
      : "";
    return `<tr${r === baseline ? ' class="is-baseline"' : ""}>
      <th scope="row">${esc(r.label)}${
      r.note ? `<br><small class="muted">${esc(r.note)}</small>` : ""
    }</th>
      <td>${src}${
      r.toolchain ? `<div><small><code>${esc(r.toolchain)}</code></small></div>` : ""
    }</td>
      <td class="num">${ciCell(s)}</td>
      <td class="num">${s ? fmtMs(s.minMs) : "—"}</td>
      <td class="num">${s ? fmtMs(s.p90Ms) : "—"}</td>
      <td class="num">${s ? fmtMs(s.maxMs) : "—"}</td>
      <td class="num">${s ? fmtMs(s.madMs) : "—"}</td>
      <td class="num">${r.bytes ? fmtBytes(r.bytes) : "—"}</td>
      <td class="num">${ratioCell}</td>
    </tr>`;
  }).join("");

  return `<div class="scope-block" data-scope="${scopeId}">
    <div class="scope-head">
      <h3 class="scope-title">${esc(scope.label)}</h3>
      <p class="scope-question">${esc(scope.question)}</p>
      <dl class="scope-bounds">
        <div><dt>Counts</dt><dd>${esc(scope.includes)}</dd></div>
        <div><dt>Excludes</dt><dd>${esc(scope.excludes)}</dd></div>
      </dl>
    </div>
    <div class="table-wrap">
      <table class="results-table">
        <caption>${esc(scope.label)} — ${esc(scope.unit)}${
    iterations ? ` · ${iterations} timed samples per engine` : ""
  }</caption>
        <thead><tr>
          <th scope="col">Engine</th>
          <th scope="col">Source &amp; toolchain</th>
          <th scope="col">Median</th>
          <th scope="col">Min</th>
          <th scope="col">p90</th>
          <th scope="col">Max</th>
          <th scope="col">MAD</th>
          <th scope="col">Binary</th>
          <th scope="col">vs ${esc(baseline.label)}</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}

/**
 * The delivery table: what each engine costs before it does any work.
 *
 * @param {{ label: string, entries: any[], compileMs?: number|null,
 *           instantiateMs?: number|null }[]} rows
 */
export function deliveryTableHtml(rows) {
  const withData = rows.filter((r) => (r.entries ?? []).length > 0);
  if (withData.length === 0) return "";
  const body = withData.flatMap((r) =>
    r.entries.map((e, i) => {
      const d = classifyDelivery(e);
      const name = (e.name ?? "").split("/").pop()?.split("?")[0] || e.name;
      return `<tr>
        ${i === 0 ? `<th scope="row" rowspan="${r.entries.length}">${esc(r.label)}</th>` : ""}
        <td><code>${esc(name)}</code></td>
        <td>${icon(d.kind === "cache" ? "cache" : "network")} ${esc(d.label)}</td>
        <td class="num">${fmtBytes(e.transferSize)}</td>
        <td class="num">${fmtBytes(e.decodedBodySize)}</td>
        <td class="num">${
        fetchDurationMs(e) === null
          ? '<span class="muted">not reported</span>'
          : fmtMs(fetchDurationMs(e))
      }</td>
      </tr>`;
    })
  ).join("");
  return `<div class="table-wrap">
    <table class="results-table">
      <caption>Delivery — every resource fetched inside the measured window</caption>
      <thead><tr>
        <th scope="col">Engine</th><th scope="col">Resource</th>
        <th scope="col">Delivery</th><th scope="col">Wire bytes</th>
        <th scope="col">Decoded</th><th scope="col">Fetch</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

// ── Decision panel ────────────────────────────────────────────────────────

/**
 * The panel a principal engineer reads first: for this workload, what does
 * choosing Wasm actually buy, what does it cost up front, and after how many
 * invocations does the trade pay for itself.
 *
 * @param {{ workloadLabel: string,
 *           kernel: { baseline: any, best: any, bestLabel: string } | null,
 *           pipeline: { baseline: any, best: any, bestLabel: string } | null,
 *           delivery: { baselineMs: number|null, candidateMs: number|null,
 *                       candidateBytes: number|null } | null,
 *           contamination?: any }} input
 */
export function decisionPanelHtml(
  { workloadLabel, kernel, pipeline, delivery, contamination: cont },
) {
  const cards = [];

  const kernelRatio = kernel ? ratio(kernel.baseline, kernel.best) : null;
  if (kernelRatio && kernelRatio.status === "ok") {
    const sep = kernelRatio.separated === false;
    cards.push(`<div class="decision-card${sep ? " is-inconclusive" : ""}">
      <h4>${icon(sep ? "warn" : "check")} Algorithm</h4>
      <p class="decision-number">${kernelRatio.value.toFixed(2)}×</p>
      <p class="decision-detail">${esc(kernel.bestLabel)} against JavaScript on the bare kernel${
      sep ? ", but the confidence intervals overlap — treat this as no measured difference" : ""
    }.</p>
    </div>`);
  }

  const pipeRatio = pipeline ? ratio(pipeline.baseline, pipeline.best) : null;
  if (pipeRatio && pipeRatio.status === "ok") {
    cards.push(`<div class="decision-card">
      <h4>${icon("clock")} Whole task</h4>
      <p class="decision-number">${pipeRatio.value.toFixed(2)}×</p>
      <p class="decision-detail">The same comparison once worker dispatch, serialization and
      validation are counted. This is what an application would feel.</p>
    </div>`);
  }

  if (delivery && typeof delivery.candidateBytes === "number") {
    cards.push(`<div class="decision-card">
      <h4>${icon("network")} Up-front cost</h4>
      <p class="decision-number">${fmtBytes(delivery.candidateBytes)}</p>
      <p class="decision-detail">Wasm binary to transfer, plus ${
      fmtMs(delivery.candidateMs)
    } to fetch, compile and instantiate before the first call.</p>
    </div>`);
  }

  const be = kernel && delivery
    ? breakEven({
      baselineDeliveryMs: delivery.baselineMs,
      baselinePerMs: kernel.baseline?.p50Ms,
      candidateDeliveryMs: delivery.candidateMs,
      candidatePerMs: kernel.best?.p50Ms,
    })
    : { status: "unavailable" };

  if (be.status === "ok") {
    cards.push(`<div class="decision-card is-verdict">
      <h4>${icon("check")} Break-even</h4>
      <p class="decision-number">${be.invocations}</p>
      <p class="decision-detail">invocations per page load before ${
      esc(kernel.bestLabel)
    } has repaid its delivery cost. Below that, JavaScript finishes the work sooner.</p>
    </div>`);
  } else if (be.status === "never") {
    cards.push(`<div class="decision-card is-verdict is-inconclusive">
      <h4>${icon("warn")} Break-even</h4>
      <p class="decision-number">never</p>
      <p class="decision-detail">Wasm is not faster per invocation here, so the delivery cost is
      never repaid. JavaScript is the right choice for this workload.</p>
    </div>`);
  } else if (be.status === "immediate") {
    cards.push(`<div class="decision-card is-verdict">
      <h4>${icon("check")} Break-even</h4>
      <p class="decision-number">1</p>
      <p class="decision-detail">Wasm costs no more to deliver and runs faster, so it is ahead from
      the first invocation.</p>
    </div>`);
  }

  let contaminationNote = "";
  if (cont && cont.status === "ok" && cont.severity !== "clean") {
    const pct = (cont.fraction * 100).toFixed(0);
    contaminationNote = `<p class="notice is-${esc(cont.severity)}">${icon("warn")}
      <strong>${pct}% of the task-pipeline window was network.</strong>
      ${
      cont.severity === "dominated"
        ? "The pipeline ratio below is mostly a statement about resource loading, not about either language. Read the kernel scope for the algorithmic comparison."
        : "Read the kernel scope alongside it for the algorithmic comparison."
    }</p>`;
  }

  if (cards.length === 0) return contaminationNote;

  return `<section class="decision-panel" aria-label="Decision summary">
    <h3 class="decision-heading">Should this workload use WebAssembly?</h3>
    <p class="decision-sub">${esc(workloadLabel)} — measured in this browser, this run.</p>
    <div class="decision-grid">${cards.join("")}</div>
    ${contaminationNote}
  </section>`;
}

// ── Scope legend ──────────────────────────────────────────────────────────

/** Explains, once per page, what the four scopes mean and why they differ. */
export function scopeLegendHtml(availableScopes) {
  const list = SCOPE_ORDER.filter((id) => availableScopes.includes(id));
  if (list.length < 2) return "";
  return `<details class="scope-legend">
    <summary>${icon("info")} Why the same workload shows different numbers in each table</summary>
    <p>Each table below times a different amount of work. A ratio is only ever computed inside one
    table — comparing a kernel median against a real-DOM median would be a category error, so the
    runner refuses to do it.</p>
    <dl>${
    list.map((id) => {
      const s = SCOPES[id];
      return `<div><dt>${esc(s.label)}</dt><dd>${esc(s.question)} <em>Counts:</em> ${
        esc(s.includes)
      } <em>Excludes:</em> ${esc(s.excludes)}</dd></div>`;
    }).join("")
  }</dl>
  </details>`;
}

// ── CSV ───────────────────────────────────────────────────────────────────

/**
 * Long-format CSV: one row per (scope, engine, statistic set). Long format is
 * what a spreadsheet or notebook can actually pivot; the previous wide format
 * silently mixed scopes into one "warm median" column.
 */
export function toCsv(records) {
  const header = [
    "scope",
    "scopeLabel",
    "engine",
    "toolchain",
    "n",
    "medianMs",
    "ci95LowMs",
    "ci95HighMs",
    "minMs",
    "p90Ms",
    "maxMs",
    "madMs",
    "binaryBytes",
    "ratioVsBaseline",
    "ratioSeparated",
  ];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(4) : "");
  const lines = [header.join(",")];
  for (const r of records) {
    lines.push([
      q(r.scope),
      q(SCOPES[r.scope]?.label ?? r.scope),
      q(r.label),
      q(r.toolchain ?? ""),
      r.summary?.n ?? "",
      num(r.summary?.p50Ms),
      num(r.summary?.ci95?.lowMs),
      num(r.summary?.ci95?.highMs),
      num(r.summary?.minMs),
      num(r.summary?.p90Ms),
      num(r.summary?.maxMs),
      num(r.summary?.madMs),
      r.bytes ?? "",
      r.ratio && r.ratio.status === "ok" ? r.ratio.value.toFixed(4) : "",
      r.ratio && r.ratio.status === "ok" && r.ratio.separated !== null
        ? String(r.ratio.separated)
        : "",
    ].join(","));
  }
  return lines.join("\n");
}

/** Copy/download controls plus the raw block, wired to `csv`. */
export function csvExportElement(csv, filename) {
  const wrap = document.createElement("div");
  wrap.className = "csv-export";
  wrap.innerHTML = `
    <div class="csv-actions">
      <button type="button" class="csv-copy">Copy CSV</button>
      <button type="button" class="csv-download">Download CSV</button>
    </div>
    <details><summary>Raw data (long format)</summary><pre><code>${esc(csv)}</code></pre></details>
  `;
  wrap.querySelector(".csv-copy")?.addEventListener("click", async (event) => {
    const btn = /** @type {HTMLButtonElement} */ (event.currentTarget);
    try {
      await navigator.clipboard.writeText(csv);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Copy blocked by the browser";
    }
    setTimeout(() => {
      btn.textContent = "Copy CSV";
    }, 2000);
  });
  wrap.querySelector(".csv-download")?.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
  return wrap;
}
