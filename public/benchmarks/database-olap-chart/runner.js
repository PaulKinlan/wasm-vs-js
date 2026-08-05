const form = document.querySelector("#olap-controls");
const start = document.querySelector("#olap-start");
const cancel = document.querySelector("#olap-cancel");
const target = document.querySelector("#olap-target");
const query = document.querySelector("#olap-query");
const status = document.querySelector("#olap-status");
const result = document.querySelector("#olap-result");
const chart = document.querySelector("#olap-chart");
let worker = null;
let timer = null;
let token = 0;
let lastResult = null;

function cleanup() {
  clearTimeout(timer);
  timer = null;
  worker?.terminate();
  worker = null;
}
function finishError(message) {
  token += 1;
  cleanup();
  status.textContent = message;
  result.textContent = "No result was accepted.";
  start.disabled = false;
  cancel.disabled = true;
}
function render(model) {
  chart.replaceChildren();
  const max = Math.max(1, ...model.bins.map((bin) => bin.count));
  for (const bin of model.bins) {
    const bar = document.createElement("div");
    bar.textContent = `Category ${bin.category}: ${bin.count} rows`;
    bar.style.inlineSize = `${Math.max(8, (bin.count / max) * 100)}%`;
    bar.style.borderInlineStart = "0.5rem solid currentColor";
    bar.style.padding = "0.25rem";
    chart.append(bar);
  }
  chart.setAttribute(
    "aria-label",
    `Query ${model.query + 1}: ${model.matchedRows} matched rows across 16 category bins`,
  );
}
function display() {
  if (!lastResult) return;
  const model = lastResult.chartModels[Number(query.value)];
  render(model);
  result.textContent = JSON.stringify(
    {
      workloadId: lastResult.workloadId,
      variantId: lastResult.variantId,
      digest: lastResult.digest,
      counters: lastResult.counters,
      displayedChartModel: model,
      validation: lastResult.validation,
    },
    null,
    2,
  );
}
query.addEventListener("change", display);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  token += 1;
  const acceptedToken = token;
  cleanup();
  lastResult = null;
  worker = new Worker("/benchmarks/database-olap-chart/worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    if (!data || acceptedToken !== token || data.token !== acceptedToken) return;
    if (data.type === "error") return finishError(data.message);
    if (data.type !== "result") return;
    cleanup();
    if (
      !data.result?.validation?.exactArtifactHashes ||
      !data.result.validation.fullOutputValidated ||
      !data.result.validation.countersValidated ||
      !data.result.validation.crossTargetValidated ||
      !data.result.validation.oracleValidated ||
      !data.result.validation.allFiveModelsValidated
    ) return finishError("The worker returned without the complete correctness gate.");
    lastResult = data.result;
    status.textContent = "Complete. Artifact hashes, both targets, and all five models passed.";
    start.disabled = false;
    cancel.disabled = true;
    display();
  };
  worker.onerror = () => {
    if (acceptedToken === token) finishError("The worker stopped unexpectedly.");
  };
  worker.postMessage({ type: "start", token: acceptedToken, variantId: target.value });
  status.textContent = "Running all five queries in a fresh worker…";
  result.textContent = "Waiting for exact validation.";
  start.disabled = true;
  cancel.disabled = false;
  timer = setTimeout(
    () => finishError("Timed out after 15 seconds; the owned worker was terminated."),
    15_000,
  );
});
cancel.addEventListener(
  "click",
  () => finishError("Cancelled; late output from the invalidated token is ignored."),
);
self.addEventListener("pagehide", () => {
  token += 1;
  cleanup();
});
