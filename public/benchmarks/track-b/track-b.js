// Track B page — renders public/data/track-b.v1.json.
//
// Every count here is derived from the shipped multi-language manifests by
// scripts/build-track-b-registry.ts. Nothing on this page is authored by hand,
// including the empty state: when no Track B variant exists, the page says so
// and shows the Track A baselines a variant would attach to.
//
// Spec: docs/track-b-optimizations.md

const REGISTRY = "/data/track-b.v1.json";
const SPEC_URL = "https://github.com/PaulKinlan/wasm-vs-js/blob/main/docs/track-b-optimizations.md";

const ENGINE_LABELS = {
  js: "JavaScript",
  wat: "WAT",
  asc: "AssemblyScript",
  c: "C",
  cpp: "C++",
  rs: "Rust",
  dart: "Dart/WasmGC",
  kt: "Kotlin",
};

const EQUIVALENCE_DETAIL = {
  "bit-identical": "Reproduces the pinned oracle exactly.",
  "reassociated":
    "Reorders floating-point accumulation; verified against the pinned oracle within a declared tolerance.",
};

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function summaryCard(label, value, detail) {
  return `<div class="decision-card">
    <h4>${esc(label)}</h4>
    <p class="decision-number">${esc(String(value))}</p>
    <p class="decision-detail">${esc(detail)}</p>
  </div>`;
}

function engineChip(key) {
  return `<span class="tb-engine">${esc(ENGINE_LABELS[key] ?? key)}</span>`;
}

function workloadCell(workload) {
  const name = workload.title ?? workload.workloadId;
  const label = workload.route ? `<a href="${esc(workload.route)}">${esc(name)}</a>` : esc(name);
  return `<td><div class="tb-workload">${label}</div>
    <code class="tb-id">${esc(workload.workloadId)}</code></td>`;
}

function variantCell(workload) {
  if (workload.variants.length === 0) {
    return `<td class="cov-no"><span class="tb-none">none built</span></td>`;
  }
  const items = workload.variants.map((v) => {
    const deviation = v.equivalence === "reassociated"
      ? `<dd class="tb-deviation">max ${esc(String(v.maxUlpDeviation))} ULP,
          declared tolerance ${esc(String(v.declaredTolerance))}</dd>`
      : "";
    return `<dt><code>${esc(v.key)}</code>
        <span class="tb-badge tb-${esc(v.equivalence)}">${esc(v.equivalence)}</span>
        <span class="tb-vs">vs <code>${esc(v.baseline)}</code></span></dt>
      <dd>${esc(v.optimizationLog)}</dd>${deviation}`;
  });
  return `<td class="cov-yes"><dl class="tb-variants">${items.join("")}</dl></td>`;
}

function row(workload) {
  return `<tr>
    ${workloadCell(workload)}
    <td class="tb-baselines">${workload.baselineEngines.map(engineChip).join("")}</td>
    ${variantCell(workload)}
  </tr>`;
}

function emptyStateNote(summary) {
  return `<div class="tb-empty">
    <h3>No Track B variant exists yet</h3>
    <p>
      All ${esc(String(summary.baselineEngineRows))} engine rows across
      ${esc(String(summary.workloads))} multi-language manifests are Track A baselines:
      one algorithm, byte-identical inputs, no target-specific substitution. Every
      language is built at a single fixed optimization setting — C and C++ at
      <code>-O3</code>, Rust at <code>-O</code>, AssemblyScript at <code>-O3</code>, and
      Dart with no <code>-O</code> flag, which leaves dart2wasm at its default
      <code>-O1</code>.
    </p>
    <p>
      The builder has no second configuration for any language: no
      <code>-msimd128</code>, no <code>-C target-feature</code>, no LTO, and no Binaryen
      <code>wasm-opt</code> pass. Until a variant lands, this table reports the
      baselines a Track B variant would attach to.
    </p>
    <p class="muted">
      Variant naming, the three output-equivalence classes, and the optimization-log
      requirements are specified in
      <a class="commit-link" href="${SPEC_URL}">docs/track-b-optimizations.md</a>.
    </p>
  </div>`;
}

export async function initTrackB(selector) {
  const root = document.querySelector(selector);
  if (!root) throw new Error(`Track B root ${selector} not found`);

  const resp = await fetch(REGISTRY, { cache: "no-store" });
  if (!resp.ok) throw new Error(`registry unavailable (${resp.status})`);
  const data = await resp.json();
  const s = data.summary;

  const parts = [
    `<div class="decision-grid">`,
    summaryCard(
      "Workloads",
      s.workloads,
      "Multi-language manifests that could carry a Track B variant.",
    ),
    summaryCard(
      "Track A engine rows",
      s.baselineEngineRows,
      "Controlled baselines across every manifest.",
    ),
    summaryCard(
      "Track B variants",
      s.variantRows,
      `${s.bitIdenticalVariants} bit-identical, ${s.reassociatedVariants} reassociated.`,
    ),
    summaryCard(
      "Workloads with a variant",
      `${s.workloadsWithVariants}/${s.workloads}`,
      "A variant is counted only once it is built and verified against the pinned oracle.",
    ),
    `</div>`,
  ];

  if (s.variantRows === 0) parts.push(emptyStateNote(s));

  parts.push(
    `<table class="data-matrix tb-table">
      <caption>Track A baselines and Track B variants per workload</caption>
      <thead><tr>
        <th scope="col">Workload</th>
        <th scope="col">Track A baselines</th>
        <th scope="col">Track B variants</th>
      </tr></thead>
      <tbody>${data.workloads.map(row).join("")}</tbody>
    </table>`,
  );

  if (s.variantRows > 0) {
    parts.push(
      `<dl class="tb-legend">${
        data.equivalenceClasses.map((c) =>
          `<dt><span class="tb-badge tb-${esc(c)}">${esc(c)}</span></dt>
           <dd>${esc(EQUIVALENCE_DETAIL[c] ?? "")}</dd>`
        ).join("")
      }</dl>`,
    );
  }

  root.innerHTML = parts.join("");
  root.hidden = false;
}

// Self-initializing: the page CSP is `script-src 'self'` with no
// 'unsafe-inline', so the bootstrap cannot live in an inline <script>.
initTrackB("#track-b-root").catch((error) => {
  const root = document.querySelector("#track-b-root");
  if (!root) return;
  root.hidden = false;
  root.textContent = `Track B failed to load: ${error.message}`;
});
