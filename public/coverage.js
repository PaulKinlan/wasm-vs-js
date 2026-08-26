// Coverage page — renders public/data/coverage.v1.json.
//
// Every number here is derived from the shipped pages and manifests by
// scripts/build-coverage.ts. Nothing on this page is authored by hand.

import { SCOPE_ORDER, SCOPES } from "./measurement-model.js";
import { icon } from "./benchmark-report.js";

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

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function cell(present) {
  return present
    ? `<td class="cov-yes" title="measured">${icon("check")}<span class="sr-only">yes</span></td>`
    : `<td class="cov-no" title="no artifact">—</td>`;
}

function summaryCard(label, value, detail) {
  return `<div class="decision-card">
    <h4>${esc(label)}</h4>
    <p class="decision-number">${esc(String(value))}</p>
    <p class="decision-detail">${esc(detail)}</p>
  </div>`;
}

async function main() {
  const resp = await fetch("/data/coverage.v1.json", { cache: "no-store" });
  if (!resp.ok) {
    document.querySelector("#coverage-summary").textContent =
      `Coverage data unavailable (${resp.status}).`;
    return;
  }
  const data = await resp.json();
  const engines = data.targetEngines;
  const pages = data.pages;
  const s = data.summary;

  document.querySelector("#scope-glossary").innerHTML = SCOPE_ORDER.map((id) => {
    const sc = SCOPES[id];
    return `<div><dt>${esc(sc.label)}</dt><dd>${esc(sc.question)}
      <br><small class="muted"><strong>Counts:</strong> ${esc(sc.includes)}
      <strong>Excludes:</strong> ${esc(sc.excludes)}</small></dd></div>`;
  }).join("");

  document.querySelector("#coverage-summary").innerHTML = [
    summaryCard(
      "Pages",
      s.pages,
      `${s.distinctWorkloads} distinct workloads across ${s.pages} routes.`,
    ),
    summaryCard(
      "With a kernel comparison",
      `${s.withMultilang}/${s.pages}`,
      "Pages that ship a multi-language manifest, so a kernel-scope comparison is possible.",
    ),
    summaryCard(
      "All seven languages",
      `${s.fullyCovered}/${s.pages}`,
      `Pages measuring every one of ${engines.length}: ${
        engines.map((e) => ENGINE_LABELS[e] ?? e).join(", ")
      }.`,
    ),
    summaryCard(
      "With a real-DOM stage",
      `${s.withDomStage}/${s.pages}`,
      "Pages that drive a rendered UI through real DOM APIs rather than computing a model.",
    ),
    summaryCard(
      "Duplicate routes",
      s.duplicates,
      "Routes serving a workload another route already serves.",
    ),
    summaryCard(
      "Pages that measure nothing",
      s.unmeasuredPages,
      "Pages that show a workload running without timing it. Most have a twin under " +
        "/benchmarks/ that does.",
    ),
    summaryCard(
      "On a bespoke runner",
      s.bespokeRunnerPages,
      "Pages that time their workload through their own runner rather than the standard one, " +
        "so they get no scope separation, confidence intervals or break-even analysis.",
    ),
  ].join("");

  // Language matrix.
  document.querySelector("#engine-matrix-head").innerHTML = `<tr>
    <th scope="col">Page</th>
    ${engines.map((e) => `<th scope="col">${esc(ENGINE_LABELS[e] ?? e)}</th>`).join("")}
    <th scope="col">Missing</th>
  </tr>`;
  const withMl = pages.filter((p) => p.engines.length > 0);
  document.querySelector("#engine-matrix-body").innerHTML = withMl.map((p) =>
    `<tr>
      <th scope="row"><a href="${esc(p.route)}">${esc(p.title)}</a>
        <br><small class="muted"><code>${esc(p.route)}</code></small></th>
      ${engines.map((e) => cell(p.engines.includes(e))).join("")}
      <td>${
      p.missingEngines.length === 0
        ? "<strong>complete</strong>"
        : esc(p.missingEngines.map((e) => ENGINE_LABELS[e] ?? e).join(", "))
    }</td>
    </tr>`
  ).join("") +
    (pages.length > withMl.length
      ? `<tr><th scope="row" colspan="${engines.length + 2}"><em>${
        pages.length - withMl.length
      } pages ship no multi-language manifest and have no kernel-scope evidence.</em></th></tr>`
      : "");

  // Scope matrix.
  document.querySelector("#scope-matrix-head").innerHTML = `<tr>
    <th scope="col">Page</th>
    ${SCOPE_ORDER.map((id) => `<th scope="col">${esc(SCOPES[id].label)}</th>`).join("")}
  </tr>`;
  document.querySelector("#scope-matrix-body").innerHTML = pages.map((p) =>
    `<tr>
      <th scope="row"><a href="${esc(p.route)}">${esc(p.title)}</a></th>
      ${SCOPE_ORDER.map((id) => cell(p.scopes.includes(id))).join("")}
    </tr>`
  ).join("");

  // Duplicates.
  const dupes = pages.filter((p) => p.duplicateOf);
  document.querySelector("#dupes-intro").textContent = dupes.length === 0
    ? "No route duplicates another. Every workload is served from one page."
    : `${dupes.length} routes serve a workload that another route already serves. Each pair means ` +
      "two pages to keep in step, and two places a fix has to land.";
  document.querySelector("#dupes-body").innerHTML = dupes.map((p) =>
    `<tr>
      <td><a href="${esc(p.route)}"><code>${esc(p.route)}</code></a>${
      p.measured ? "" : ' <span class="muted">(measures nothing)</span>'
    }</td>
      <td>${esc(p.slug)}</td>
      <td><a href="${esc(p.duplicateOf)}"><code>${esc(p.duplicateOf)}</code></a></td>
    </tr>`
  ).join("");

  // Pages that time their workload through a runner of their own.
  const bespokeHost = document.querySelector("#bespoke-body");
  if (bespokeHost) {
    const bespoke = pages.filter((p) => p.measured && !p.standardRunner);
    bespokeHost.innerHTML = bespoke.map((p) =>
      `<tr>
        <td><a href="${esc(p.route)}"><code>${esc(p.route)}</code></a></td>
        <td>${esc(p.title)}</td>
        <td>${
        p.engines.length > 0
          ? `${p.engines.length} languages, kernel scope only`
          : '<span class="muted">no kernel comparison either</span>'
      }</td>
      </tr>`
    ).join("");
    document.querySelector("#bespoke-intro").textContent = bespoke.length === 0
      ? "Every measured page uses the standard runner."
      : `${bespoke.length} pages time their workload through a runner of their own. They report ` +
        "whatever their own runner reports — no scope separation, no confidence intervals, no " +
        "break-even analysis, and no shared definition of what 'warm' means.";
  }

  // Pages with no runner at all, whether or not they duplicate another route.
  const unmeasured = pages.filter((p) => !p.measured);
  const host = document.querySelector("#unmeasured-body");
  if (host) {
    host.innerHTML = unmeasured.map((p) => {
      const twin = pages.find((o) => o.pathKey === p.pathKey && o.measured);
      return `<tr>
        <td><a href="${esc(p.route)}"><code>${esc(p.route)}</code></a></td>
        <td>${esc(p.title)}</td>
        <td>${
        twin
          ? `<a href="${esc(twin.route)}"><code>${esc(twin.route)}</code></a>`
          : '<span class="muted">none — this workload has no measured page</span>'
      }</td>
      </tr>`;
    }).join("");
    document.querySelector("#unmeasured-intro").textContent = unmeasured.length === 0
      ? "Every page measures its workload."
      : `${unmeasured.length} pages show a workload running without loading the runner. ` +
        `${
          unmeasured.filter((p) => pages.some((o) => o.pathKey === p.pathKey && o.measured))
            .length
        } of them have a measured twin; the rest produce no timing evidence anywhere.`;
  }
}

main().catch((err) => {
  const el = document.querySelector("#coverage-summary");
  if (el) el.textContent = `Coverage page failed: ${err.message}`;
});
