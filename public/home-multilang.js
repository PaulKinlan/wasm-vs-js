// Home-page Multi-language comparison runner — the same frozen sum-u32 kernel
// across 7 engines, measured in this tab via the shared multilang-runner.
const MANIFEST = "/benchmarks/multilang-wasm/sum-u32.manifest.json";
const form = document.querySelector("#multilang-form");
const iterationsSelect = document.querySelector("#multilang-iterations");
const startBtn = document.querySelector("#multilang-start");
const cancelBtn = document.querySelector("#multilang-cancel");
const statusEl = document.querySelector("#multilang-status");
const reportingEl = document.querySelector("#multilang-reporting");

let cancelled = false;
let running = false;

async function run() {
  if (running) return;
  running = true;
  cancelled = false;
  startBtn.disabled = true;
  cancelBtn.disabled = false;
  reportingEl.hidden = true;
  try {
    const { runMultilangComparison } = await import("/multilang-runner.js");
    const iterations = Number(iterationsSelect.value);
    const results = await runMultilangComparison(MANIFEST, {
      iterations,
      onStatus: (message) => {
        statusEl.textContent = message;
      },
      shouldCancel: () => cancelled,
      reportingEl,
    });
    statusEl.textContent = "✓ Multi-language comparison complete.";
  } catch (error) {
    statusEl.textContent = cancelled
      ? "Comparison cancelled."
      : `Multi-language comparison failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
  } finally {
    running = false;
    startBtn.disabled = false;
    cancelBtn.disabled = true;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  run();
});
cancelBtn.addEventListener("click", () => {
  cancelled = true;
});
