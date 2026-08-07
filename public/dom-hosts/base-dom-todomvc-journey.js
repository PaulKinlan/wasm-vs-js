// Real-DOM TodoMVC benchmark host for the iframe orchestration bridge.
//
// This is the "demos that actually run" piece of Paul's vision: instead of the
// engine-only worker simulation, this host renders an actual TodoMVC UI into
// the DOM and applies the frozen 150-command trace to it with real DOM APIs
// (createElement/appendChild/classList/focus), measuring the full journey for
// the JS engine vs the Wasm engine.
//
// Honest boundaries (documented in docs/dom-orchestration.md):
// - The engine run (state machine -> 150 typed commands) is the JS-vs-Wasm
//   computation under test; the DOM application is a shared JS host for both
//   targets, so the comparison isolates engine compute while the measured
//   iteration includes real DOM mutation (layout/paint not forced, subject to
//   the environment).
// - The engine self-verifies its canonical final state before returning; the
//   host additionally verifies the rendered DOM's item/completion counts.
// - Numbers are exploratory in-browser measurements, not corpus evidence.

import { computeStats, planDomOperations, summarizePlan } from "./todomvc-ops.js";

const WORKLOAD = "base-dom-todomvc-journey";
const REGISTRATION_ROUTE = `/data/${WORKLOAD}.v1.json`;
const REQUIRED_ROUTES = Object.freeze([
  "/data/workloads.v1.json",
  "/benchmarks/base/dom-todomvc-journey/engine.js",
  "/benchmarks/base/dom-todomvc-journey/fixture.js",
  "/artifacts/base-dom-todomvc-journey/runtime.js",
  "/artifacts/base-dom-todomvc-journey/todomvc.wasm",
  "/artifacts/base-dom-todomvc-journey/fixture.json",
  "/artifacts/base-dom-todomvc-journey/output-manifest.json",
  "/artifacts/base-dom-todomvc-journey/build-manifest.json",
]);

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(route) {
  const response = await fetch(route, { cache: "no-store" });
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Fetch + hash-verify the exact pinned package, mirroring the worker's loader
// so the bytes that drive execution are the bytes that are hashed.
async function loadExactPackage() {
  const registrationBytes = await fetchBytes(REGISTRATION_ROUTE);
  const registration = JSON.parse(new TextDecoder().decode(registrationBytes));
  const byRoute = new Map(registration.artifacts.map((artifact) => [artifact.route, artifact]));
  byRoute.set(registration.fixture.route, registration.fixture);
  byRoute.set(registration.oracle.route, registration.oracle);
  const fetched = new Map();
  for (const route of REQUIRED_ROUTES) {
    const expected = route === "/data/workloads.v1.json"
      ? { sha256: registration.frozenCatalog.sha256 }
      : byRoute.get(route);
    if (!expected) throw new Error(`registration omits ${route}`);
    const bytes = await fetchBytes(route);
    if (await sha256(bytes) !== expected.sha256) {
      throw new Error(`raw byte hash mismatch: ${route}`);
    }
    fetched.set(route, bytes);
  }
  const build = JSON.parse(new TextDecoder().decode(
    fetched.get("/artifacts/base-dom-todomvc-journey/build-manifest.json"),
  ));
  if (build.sourceCommit !== registration.sourceCommit || build.sourceCommit.length !== 40) {
    throw new Error("accepted source root mismatch");
  }
  return { fetched, registration };
}

async function importModule(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "text/javascript" }));
  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Real-DOM TodoMVC host ──────────────────────────────────────────────────

export async function createTodomvcHost() {
  const { fetched } = await loadExactPackage();
  const runtime = await importModule(fetched.get("/artifacts/base-dom-todomvc-journey/runtime.js"));
  const fixture = await importModule(
    fetched.get("/benchmarks/base/dom-todomvc-journey/fixture.js"),
  );
  const encoded = runtime.encodeActionTrace();
  const labels = fixture.generateLabels();
  const editedLabels = fixture.editedLabels ?? {};
  const plan = planDomOperations(encoded, labels, editedLabels);
  const planSummary = summarizePlan(plan);
  if (
    planSummary.add !== 100 || planSummary.toggle !== 34 || planSummary.filter !== 3 ||
    planSummary.remove !== 10 || planSummary.edit !== 3
  ) {
    throw new Error(`plan shape drifted: ${JSON.stringify(planSummary)}`);
  }

  const todomvcWasmBytes = fetched.get(
    "/artifacts/base-dom-todomvc-journey/todomvc.wasm",
  );

  // ── The rendered TodoMVC UI (real DOM) ──
  function createUi() {
    const root = document.createElement("div");
    root.id = "wvj-todomvc-host";
    root.className = "wvj-todomvc-app";
    const input = document.createElement("input");
    input.id = "wvj-todo-input";
    input.setAttribute("type", "text");
    root.append(input);
    const list = document.createElement("ul");
    list.id = "wvj-todo-list";
    root.append(list);
    const footer = document.createElement("div");
    footer.id = "wvj-todo-footer";
    const filterAll = document.createElement("a");
    filterAll.id = "wvj-filter-all";
    filterAll.href = "#/";
    const filterActive = document.createElement("a");
    filterActive.id = "wvj-filter-active";
    filterActive.href = "#/active";
    const filterCompleted = document.createElement("a");
    filterCompleted.id = "wvj-filter-completed";
    filterCompleted.href = "#/completed";
    footer.append(filterAll, filterActive, filterCompleted);
    root.append(footer);
    document.body.append(root);
    return { root, list, filterAll, filterActive, filterCompleted };
  }

  function selectFilter(ui, filterState) {
    ui.filterAll.classList.remove("selected");
    ui.filterActive.classList.remove("selected");
    ui.filterCompleted.classList.remove("selected");
    if (filterState === 0) ui.filterAll.classList.add("selected");
    else if (filterState === 1) ui.filterActive.classList.add("selected");
    else ui.filterCompleted.classList.add("selected");
    ui.root.dataset.filter = String(filterState);
  }

  function resetUi(ui, filterState) {
    ui.list.replaceChildren();
    selectFilter(ui, filterState);
  }

  function applyOp(ui, item) {
    const { op, id } = item;
    if (op === "add") {
      const li = document.createElement("li");
      li.className = "wvj-todo";
      li.dataset.id = String(id);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "wvj-toggle";
      checkbox.setAttribute("aria-label", `Toggle ${item.label}`);
      const label = document.createElement("label");
      label.className = "wvj-label";
      label.textContent = item.label;
      const destroy = document.createElement("button");
      destroy.className = "wvj-destroy";
      destroy.setAttribute("aria-label", `Remove ${item.label}`);
      li.append(checkbox, label, destroy);
      ui.list.append(li);
      return;
    }
    const li = ui.list.querySelector(`li[data-id="${id}"]`);
    if (!li && op !== "filter") return;
    if (op === "toggle") {
      li.classList.toggle("completed", item.value);
      const checkbox = li.querySelector(".wvj-toggle");
      if (checkbox) checkbox.checked = item.value;
      return;
    }
    if (op === "edit") {
      const label = li.querySelector(".wvj-label");
      if (label) label.textContent = item.label;
      const edit = li.querySelector(".wvj-edit");
      if (item.focus === 1 && edit) edit.focus();
      return;
    }
    if (op === "remove") {
      li.remove();
      return;
    }
    if (op === "filter") {
      // A filter never wipes the list — it updates the selected filter and
      // hides/shows the existing items (matching real TodoMVC behavior).
      selectFilter(ui, item.value);
      for (const child of ui.list.querySelectorAll("li[data-id]")) {
        const completed = child.classList.contains("completed");
        if (item.value === 1 && completed) child.classList.add("wvj-hidden");
        else if (item.value === 2 && !completed) child.classList.add("wvj-hidden");
        else child.classList.remove("wvj-hidden");
      }
    }
  }

  // Multi-language engines (c/cpp/rs/dart) drive the SAME real DOM: the
  // state-machine engine computes the model, the shared host applies the
  // frozen trace to the rendered UI (Paul directive 2026-08-07: measure the
  // WASM->JS->DOM interaction for every language).
  async function runMultilangEngineOnce(engineKey) {
    const { runKernelOnce } = await import("/multilang-runner.js");
    await runKernelOnce(
      "/benchmarks/multilang-wasm/base-dom-todomvc-journey.manifest.json",
      "todomvc_engine",
      engineKey,
    );
  }

  // One iteration: reset the UI, run the chosen engine, apply the full
  // command stream to the real DOM, measure the whole journey, verify counts.
  async function runIteration(target, ui) {
    const start = performance.now();
    resetUi(ui, 0);
    const engineStart = performance.now();
    const result = target === "wasm"
      ? runtime.runWasm(await runtime.instantiateTodoWasm(todomvcWasmBytes), encoded)
      : target === "js"
      ? runtime.runJavaScript(encoded)
      : (await runMultilangEngineOnce(target), { summary: "multi-language engine" });
    const engineMs = performance.now() - engineStart;
    for (const item of plan) applyOp(ui, item);
    const totalMs = performance.now() - start;

    // The engine already self-verified its canonical summary (90 alive /
    // 30 completed / filter ALL). Verify the rendered DOM matches.
    const items = [...ui.list.querySelectorAll("li[data-id]")];
    const alive = items.length;
    const completed = items.filter((li) => li.classList.contains("completed")).length;
    if (alive !== 90 || completed !== 30) {
      throw new Error(`rendered DOM drift: ${alive} items, ${completed} completed`);
    }
    return { totalMs, engineMs, summary: result.summary };
  }

  async function run({ iterations, targets, onProgress = () => {} }) {
    const ui = createUi();
    try {
      const consoleErrors = [];
      const onError = (event) => {
        if (event && (event.message || event.error)) {
          consoleErrors.push(event.message || String(event.error));
        }
      };
      globalThis.addEventListener("error", onError);
      const perTarget = {};
      try {
        for (const target of targets) {
          const samples = [];
          let lastDetail = null;
          for (let i = 0; i < iterations; i += 1) {
            const iteration = await runIteration(target, ui);
            samples.push(iteration.totalMs);
            lastDetail = { engineMs: iteration.engineMs, summary: iteration.summary };
            onProgress({ target, iteration: i + 1, total: iterations });
          }
          perTarget[target] = { ...computeStats(samples), detail: lastDetail };
        }
      } finally {
        globalThis.removeEventListener("error", onError);
      }
      return {
        perTarget,
        consoleErrors,
        detail: {
          workload: WORKLOAD,
          mode: "real-dom-iframe",
          renderedDom: true,
          engine: "js|wasm (state machine) + shared JS DOM host",
          note:
            "Exploratory in-browser measurement; engine compute is the JS-vs-Wasm comparison, DOM application is shared JS. Layout/paint not forced.",
        },
      };
    } finally {
      // Keep the final rendered DOM visible after a successful run so
      // the user can inspect it. Errors still clean up to avoid stale state.
    }
  }

  return { run };
}
