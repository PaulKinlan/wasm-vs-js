import { renderResultInspectability } from "./inspectability.js";

const cellsBody = document.querySelector("#cells");
const trajectories = document.querySelector("#trajectories");
const runsContainer = document.querySelector("#runs");
const metrics = document.querySelector("#metrics");
const cacheFilter = document.querySelector("#cache-filter");
const loadStatus = document.querySelector("#load-status");
const claimStatus = document.querySelector("#claim-status");
let summary;
let serverMode = "local-m1-pilot";

function ms(value) {
  return typeof value === "number" ? `${value.toFixed(3)} ms` : "unavailable";
}

function textCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
}

function renderMetrics(data) {
  const values = [data.runCount, data.pairedBlockCount, "sum-u32", "Controlled"];
  [...metrics.querySelectorAll("dd")].forEach((item, index) => item.textContent = values[index]);
  claimStatus.textContent = data.claimStatus === "no-runs"
    ? serverMode === "public-read-only"
      ? "Accepted performance corpus: none."
      : "Local run records: none."
    : data.truncated
    ? `Local pilots: newest ${data.runCount} of ${data.sourceRunCount}. Accepted corpus: none.`
    : `Local pilot records: ${data.runCount}. Accepted corpus: none.`;
}

function renderCells(data) {
  const cache = cacheFilter.value;
  const cells = data.cells.filter((cell) => cache === "all" || cell.cacheState === cache);
  cellsBody.replaceChildren();
  if (cells.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "No local records match this cache state.";
    row.append(cell);
    cellsBody.append(row);
    return;
  }
  for (const cell of cells) {
    const row = document.createElement("tr");
    textCell(row, `${cell.variantId} (${cell.target})`);
    textCell(row, cell.cacheState);
    textCell(row, cell.freshLaunchCount);
    textCell(row, cell.sampleCount);
    textCell(row, ms(cell.firstIterationMedianMs));
    textCell(row, ms(cell.medianMs));
    textCell(row, ms(cell.p95Ms));
    const state = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status pilot";
    badge.textContent = "pilot only";
    state.append(badge);
    row.append(state);
    cellsBody.append(row);
  }
}

function renderTrajectories(data) {
  trajectories.replaceChildren();
  const series = data.cells.flatMap((cell) =>
    cell.trajectories.map((trajectory) => ({ ...trajectory, variantId: cell.variantId }))
  );
  if (series.length === 0) {
    trajectories.append(
      Object.assign(document.createElement("p"), { textContent: "No trajectories recorded." }),
    );
    return;
  }
  for (const trajectory of series) {
    const article = document.createElement("article");
    article.className = "trajectory";
    const title = document.createElement("h3");
    title.textContent = `${trajectory.variantId} · ${trajectory.runId}`;
    const list = document.createElement("ol");
    list.setAttribute(
      "aria-label",
      "Complete scored post-calibration iteration durations; first scored iteration is crimson",
    );
    const max = Math.max(...trajectory.samples.map((sample) => sample.durationMs), 0.001);
    for (const sample of trajectory.samples) {
      const item = document.createElement("li");
      item.style.setProperty("--bar", `${Math.max(2, sample.durationMs / max * 100)}%`);
      const label = document.createElement("span");
      label.textContent = `Iteration ${sample.iteration}: ${ms(sample.durationMs)}${
        sample.valid ? "" : " excluded"
      }`;
      item.append(label);
      list.append(item);
    }
    article.append(title, list);
    trajectories.append(article);
  }
}

function metricAvailability(metric) {
  const state = metric.availability.state;
  if (state === "supported") return `${metric.value} ${metric.unit}`;
  return `${state}: ${metric.availability.reason}${
    metric.availability.detail ? ` (${metric.availability.detail})` : ""
  }`;
}

function renderRuns(data) {
  runsContainer.replaceChildren();
  if (data.runs.length === 0) {
    runsContainer.append(
      Object.assign(document.createElement("p"), { textContent: "No local records." }),
    );
    return;
  }
  for (const run of data.runs) {
    const details = document.createElement("details");
    const heading = document.createElement("summary");
    heading.textContent = `${run.variant.id} · ${run.variant.cacheState} · ${run.runId}`;
    const content = document.createElement("div");
    content.className = "run-detail";
    const facts = document.createElement("dl");
    const rows = [
      ["Correctness", `${run.correctness.status}: ${run.correctness.detail}`],
      ["Work", JSON.stringify(run.correctness.workCounters)],
      ["Build", `${run.build.sourceCommit} · ${run.build.artifacts[0].sha256}`],
      [
        "Footprint",
        `${run.build.footprint.rawBytes} raw / ${run.build.footprint.gzipBytes} gzip / ${run.build.footprint.brotliBytes} Brotli bytes`,
      ],
      [
        "Browser",
        `${run.environment.browser.name} ${run.environment.browser.version} · ${run.environment.browser.engine}`,
      ],
      ["Launch", `${run.environment.freshLaunchId} · profile ${run.environment.profileId}`],
      ["Pair", run.environment.pairedBlockId],
      ["Payload", run.payloadSha256],
    ];
    for (const [term, description] of rows) {
      facts.append(
        Object.assign(document.createElement("dt"), { textContent: term }),
        Object.assign(document.createElement("dd"), { textContent: description }),
      );
    }
    const metricHeading = document.createElement("h3");
    metricHeading.textContent = "Metric availability";
    const metricList = document.createElement("ul");
    for (const metric of run.metrics) {
      metricList.append(Object.assign(document.createElement("li"), {
        textContent: `${metric.metric} — ${metricAvailability(metric)} [${metric.comparability}]`,
      }));
    }
    const inspectability = document.createElement("div");
    renderResultInspectability(inspectability, run);
    const rawHeading = document.createElement("h3");
    rawHeading.textContent = "Raw record";
    const raw = document.createElement("pre");
    raw.textContent = JSON.stringify(run, null, 2);
    content.append(facts, metricHeading, metricList, inspectability, rawHeading, raw);
    details.append(heading, content);
    runsContainer.append(details);
  }
}

function updateUrl() {
  const url = new URL(location.href);
  if (cacheFilter.value === "all") url.searchParams.delete("cache");
  else url.searchParams.set("cache", cacheFilter.value);
  history.replaceState(null, "", url);
}

cacheFilter.addEventListener("change", () => {
  updateUrl();
  renderCells(summary);
});

async function load() {
  try {
    const requested = new URL(location.href).searchParams.get("cache");
    if (["validation", "cold", "warm"].includes(requested)) cacheFilter.value = requested;
    const healthResponse = await fetch("/healthz", { cache: "no-store" });
    if (!healthResponse.ok) throw new Error(`health returned ${healthResponse.status}`);
    serverMode = (await healthResponse.json()).mode;
    const response = await fetch("/api/summary", { cache: "no-store" });
    if (!response.ok) throw new Error(`summary returned ${response.status}`);
    summary = await response.json();
    renderMetrics(summary);
    renderCells(summary);
    renderTrajectories(summary);
    renderRuns(summary);
    loadStatus.textContent = serverMode === "public-read-only"
      ? "Public read-only view loaded. Published performance run records: 0."
      : `Loaded ${summary.runCount} immutable local run records.`;
  } catch (error) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "Local evidence could not be loaded.";
    row.append(cell);
    cellsBody.replaceChildren(row);
    loadStatus.textContent = `Load failed: ${error.message}`;
  }
}

await load();
