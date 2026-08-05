// M4 Results Explorer: client-side UI for browsing benchmark run records.
// Fetches from /v1/runs and /v1/summaries with URL hash-backed filters.
// No winner copy or colour-only status — inspection surface only.

const API_BASE = "/v1";

// ── State ──

const state = {
  benchmark: "",
  target: "",
  cache: "",
  limit: 50,
  page: 0,
};

// ── URL hash sync ──

function readHashFilters() {
  const hash = self.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  state.benchmark = params.get("benchmark") ?? "";
  state.target = params.get("target") ?? "";
  state.cache = params.get("cache") ?? "";
  const limit = Number(params.get("limit"));
  if (Number.isFinite(limit) && limit >= 1 && limit <= 100) state.limit = limit;
  const page = Number(params.get("page"));
  if (Number.isFinite(page) && page >= 0) state.page = page;
}

function writeHashFilters() {
  const params = new URLSearchParams();
  if (state.benchmark) params.set("benchmark", state.benchmark);
  if (state.target) params.set("target", state.target);
  if (state.cache) params.set("cache", state.cache);
  params.set("limit", String(state.limit));
  if (state.page > 0) params.set("page", String(state.page));
  self.location.hash = params.toString();
}

// ── API fetch helpers ──

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { accept: "application/json" } });
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
  return resp.json();
}

// ── Rendering ──

function renderError(container, msg) {
  container.innerHTML = `<p class="error-notice">${msg}</p>`;
}

function renderMatrix(container, summaries) {
  if (!summaries || summaries.totalRuns === 0) {
    container.innerHTML = "<p>No runs collected yet.</p>";
    return;
  }

  const benchmarks = Object.keys(summaries.benchmarkCounts ?? {}).sort();
  const targets = Object.keys(summaries.targetCounts ?? {}).sort();

  if (benchmarks.length === 0 || targets.length === 0) {
    container.innerHTML = "<p>No matrix data available.</p>";
    return;
  }

  // Build matrix table
  let html = '<table class="data-matrix"><thead><tr><th scope="col">Workload</th>';
  for (const t of targets) {
    html += `<th scope="col">${escapeHtml(t)}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const b of benchmarks) {
    html += `<tr><th scope="row">${escapeHtml(b)}</th>`;
    for (const t of targets) {
      const count = summaries.benchmarkCounts?.[b] ?? 0;
      const targetCount = summaries.targetCounts?.[t] ?? 0;
      // Show count if both benchmark and target have data
      const label = count > 0 && targetCount > 0 ? String(count) : "—";
      html += `<td class="matrix-cell">${label}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  html += `<p class="matrix-note">${summaries.totalRuns} total run${
    summaries.totalRuns === 1 ? "" : "s"
  } across ${benchmarks.length} workload${
    benchmarks.length === 1 ? "" : "s"
  } and ${targets.length} target${targets.length === 1 ? "" : "s"}.</p>`;
  container.innerHTML = html;
}

function renderRuns(container, data) {
  if (!data.runs || data.runs.length === 0) {
    container.innerHTML = "<p>No runs match the current filters.</p>";
    return;
  }

  let html = '<table class="data-runs"><thead><tr>';
  html += '<th scope="col">Run ID</th>';
  html += '<th scope="col">Workload</th>';
  html += '<th scope="col">Target</th>';
  html += '<th scope="col">Cache</th>';
  html += '<th scope="col">Correctness</th>';
  html += '<th scope="col">Captured</th>';
  html += "</tr></thead><tbody>";

  for (const run of data.runs) {
    const correctness = run.correctness?.status ?? "unknown";
    const correctnessClass = correctness === "passed"
      ? "status-passed"
      : correctness === "failed"
      ? "status-failed"
      : "status-unknown";
    html += `<tr class="run-row" data-run-id="${escapeHtml(run.runId)}" tabindex="0">`;
    html += `<td><code>${escapeHtml(run.runId)}</code></td>`;
    html += `<td>${escapeHtml(run.benchmark?.id ?? "?")}</td>`;
    html += `<td>${escapeHtml(run.variant?.target ?? "?")}</td>`;
    html += `<td>${escapeHtml(run.variant?.cacheState ?? "?")}</td>`;
    html += `<td class="${correctnessClass}">${escapeHtml(correctness)}</td>`;
    html += `<td>${escapeHtml(run.capturedAt ?? "?")}</td>`;
    html += "</tr>";
  }

  html += "</tbody></table>";
  html += `<p class="runs-meta">${data.runs.length} of ${data.total ?? "?"} run${
    (data.total ?? 0) === 1 ? "" : "s"
  }${data.truncated ? " (truncated)" : ""}.</p>`;
  container.innerHTML = html;

  // Attach click handlers for run detail
  container.querySelectorAll(".run-row").forEach((row) => {
    const runId = row.dataset.runId;
    const open = () => openRunDetail(runId);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

function renderDetail(container, run) {
  const sections = [
    {
      label: "Run identity",
      data: {
        runId: run.runId,
        capturedAt: run.capturedAt,
        payloadSha256: run.payloadSha256?.slice(0, 16) + "…",
      },
    },
    { label: "Benchmark", data: run.benchmark },
    { label: "Variant", data: run.variant },
    {
      label: "Build",
      data: {
        sourceCommit: run.build?.sourceCommit?.slice(0, 12),
        sourceSha256: run.build?.sourceSha256?.slice(0, 16) + "…",
      },
    },
    {
      label: "Environment",
      data: {
        browser: run.environment?.browser?.name,
        os: run.environment?.os,
        architecture: run.environment?.architecture,
      },
    },
    { label: "Correctness", data: run.correctness },
    { label: "Conditions", data: run.conditions },
    { label: "Metrics", data: run.metrics },
  ];

  let html = '<dl class="detail-facts">';
  for (const section of sections) {
    if (!section.data) continue;
    html += `<dt>${escapeHtml(section.label)}</dt>`;
    html += `<dd><pre>${escapeHtml(JSON.stringify(section.data, null, 2))}</pre></dd>`;
  }
  html += "</dl>";

  // First-use lifecycle breakdown (present only in hosted-runner retained runs).
  if (run.lifecycle && typeof run.lifecycle === "object") {
    const lc = run.lifecycle;
    const cell = (value) => {
      if (value && typeof value === "object") {
        if (value.status === "unavailable") return `${value.status}: ${value.reason}`;
        if (value.status === "supported-value" && typeof value.ms === "number") {
          return `${value.ms.toFixed(3)} ms`;
        }
      }
      if (typeof value === "number") return `${value.toFixed(3)} ms`;
      return "not collected";
    };
    const rows = [
      ["Manifest transfer", lc.manifestTransferMs],
      ["Manifest network (Resource Timing)", lc.manifestNetworkMs],
      ["JS transfer", lc.jsTransferMs],
      ["JS network (Resource Timing)", lc.jsNetworkMs],
      ["Wasm transfer", lc.wasmTransferMs],
      ["Wasm network (Resource Timing)", lc.wasmNetworkMs],
      ["Wasm compile", lc.wasmCompileMs],
      ["Wasm instantiate", lc.wasmInstantiateMs],
      ["First JS execute", lc.jsFirstExecuteMs],
      ["First Wasm execute", lc.wasmFirstExecuteMs],
    ];
    html += "<h3>First-use lifecycle breakdown</h3>";
    html += '<table class="data-samples"><thead><tr>';
    html += '<th scope="col">Phase</th><th scope="col">Duration / availability</th>';
    html += "</tr></thead><tbody>";
    for (const [label, value] of rows) {
      html += `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(cell(value))}</td></tr>`;
    }
    html += "</tbody></table>";
  } else {
    html +=
      '<p class="detail-note">No first-use lifecycle breakdown in this record — the M3 reporting ' +
      "schema does not retain phase timings. Run the workload in the browser playground or the " +
      "/run hosted journey to see transfer / compile / instantiate / first-execute phases.</p>";
  }

  // Raw samples
  if (run.samples && Array.isArray(run.samples)) {
    html += `<h3>Samples (${run.samples.length})</h3>`;
    html += '<table class="data-samples"><thead><tr>';
    html += '<th scope="col">Iteration</th>';
    html += '<th scope="col">Phase</th>';
    html += '<th scope="col">Duration (ms)</th>';
    html += '<th scope="col">Valid</th>';
    html += "</tr></thead><tbody>";
    for (const s of run.samples) {
      html += `<tr><td>${s.iteration}</td><td>${
        escapeHtml(s.phase)
      }</td><td>${s.durationMs}</td><td>${s.valid ? "yes" : "no"}</td></tr>`;
    }
    html += "</tbody></table>";
  }

  container.innerHTML = html;
}

function renderSummary(container, summary) {
  if (!summary || summary.totalRuns === 0) {
    container.innerHTML = "<p>No runs collected.</p>";
    return;
  }

  let html = '<dl class="summary-grid">';
  html += `<div><dt>Total runs</dt><dd>${summary.totalRuns}</dd></div>`;

  const benchmarks = Object.entries(summary.benchmarkCounts ?? {}).sort((a, b) => b[1] - a[1]);
  for (const [id, count] of benchmarks) {
    html += `<div><dt>${escapeHtml(id)}</dt><dd>${count} run${count === 1 ? "" : "s"}</dd></div>`;
  }

  const targets = Object.entries(summary.targetCounts ?? {}).sort((a, b) => b[1] - a[1]);
  for (const [id, count] of targets) {
    html += `<div><dt>${escapeHtml(id)}</dt><dd>${count} run${count === 1 ? "" : "s"}</dd></div>`;
  }

  html += "</dl>";
  container.innerHTML = html;
}

// ── Actions ──

async function openRunDetail(runId) {
  const detailSection = document.getElementById("detail-section");
  const detailContainer = document.getElementById("detail-container");
  detailSection.hidden = false;
  detailContainer.innerHTML = '<p class="loading-notice">Loading run detail…</p>';
  detailSection.scrollIntoView({ behavior: "smooth" });

  try {
    const run = await fetchJson(`${API_BASE}/runs/${encodeURIComponent(runId)}`);
    renderDetail(detailContainer, run);
  } catch (e) {
    renderError(detailContainer, e instanceof Error ? e.message : "Failed to load run");
  }
}

async function loadAll() {
  // Sync filter UI from state
  document.getElementById("filter-benchmark").value = state.benchmark;
  document.getElementById("filter-target").value = state.target;
  document.getElementById("filter-cache").value = state.cache;
  document.getElementById("filter-limit").value = String(state.limit);

  const matrixEl = document.getElementById("results-matrix");
  const runsEl = document.getElementById("results-runs");
  const summaryEl = document.getElementById("summary-container");

  // Fetch summaries
  try {
    const summary = await fetchJson(`${API_BASE}/summaries`);
    renderMatrix(matrixEl, summary);
    renderSummary(summaryEl, summary);

    // Populate benchmark filter from real data
    const select = document.getElementById("filter-benchmark");
    const benchmarks = Object.keys(summary.benchmarkCounts ?? {}).sort();
    for (const b of benchmarks) {
      if (!select.querySelector(`option[value="${b}"]`)) {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        select.append(opt);
      }
    }
  } catch (_e) {
    renderError(matrixEl, "KV store unavailable. Run with Deno KV enabled.");
    renderError(summaryEl, "Summary unavailable.");
  }

  // Fetch runs with filters
  try {
    const params = new URLSearchParams();
    params.set("limit", String(state.limit));
    if (state.benchmark) params.set("benchmark", state.benchmark);
    const data = await fetchJson(`${API_BASE}/runs?${params}`);

    // Apply client-side filters for target and cache (not yet server-side)
    let filtered = data.runs ?? [];
    if (state.target) {
      filtered = filtered.filter((r) => r.variant?.target === state.target);
    }
    if (state.cache) {
      filtered = filtered.filter((r) => r.variant?.cacheState === state.cache);
    }

    renderRuns(runsEl, { ...data, runs: filtered });
  } catch (_e) {
    renderError(runsEl, "Failed to load runs. KV store may be unavailable.");
  }
}

// ── Init ──

function initExplorer() {
  readHashFilters();

  // Filter form
  document.getElementById("results-filter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.benchmark = document.getElementById("filter-benchmark").value;
    state.target = document.getElementById("filter-target").value;
    state.cache = document.getElementById("filter-cache").value;
    state.limit = Number(document.getElementById("filter-limit").value);
    writeHashFilters();
    loadAll();
  });

  // Clear button
  document.getElementById("filter-clear").addEventListener("click", () => {
    state.benchmark = "";
    state.target = "";
    state.cache = "";
    state.limit = 50;
    state.page = 0;
    writeHashFilters();
    loadAll();
  });

  // Detail close
  document.getElementById("detail-close").addEventListener("click", () => {
    document.getElementById("detail-section").hidden = true;
  });

  // Hash change listener
  self.addEventListener("hashchange", () => {
    readHashFilters();
    loadAll();
  });

  loadAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initExplorer);
} else {
  initExplorer();
}

// ── Utils ──

function escapeHtml(str) {
  if (typeof str !== "string") str = String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
