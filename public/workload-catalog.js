const list = document.querySelector("#catalog-list");
const statusLine = document.querySelector("#catalog-status-line");
const domainTotals = document.querySelector("#domain-totals");
const query = document.querySelector("#catalog-query");
const priority = document.querySelector("#catalog-priority");
const domain = document.querySelector("#catalog-domain");
const status = document.querySelector("#catalog-status");

// Verified against the playground card routes (2026-08-04): every entry serves
// HTTP 200. Workloads without a playground demo are intentionally absent — they
// render the no-demo badge instead of a broken link.
const WORKLOAD_DEMO_ROUTES = {
  // Frozen v1 catalog workloads with playground demos (23).
  "archive.zip-workspace.v1": "/benchmarks/archive-zip-workspace-v1/",
  "audio.webaudio-effects.v1": "/benchmarks/base/audio-webaudio-effects-v1/",
  "cad.mesh-repair.v1": "/benchmarks/cad-mesh-repair-v1/",
  "cad.parametric-bracket.v1": "/demos/cad-parametric-bracket/",
  "crypto.authenticated-stream.v1": "/benchmarks/crypto-authenticated-stream/",
  "crypto.file-integrity.v1": "/demos/crypto.file-integrity.v1/",
  "database.olap-chart.v1": "/benchmarks/database-olap-chart/",
  "database.sqlite-notebook.v1": "/benchmarks/database-sqlite-notebook-v1/",
  "document.pdf-viewer.v1": "/benchmarks/document-pdf-viewer-v1/",
  "dom.todomvc-journey.v1": "/benchmarks/base-dom-todomvc-journey/",
  "dom.virtualized-grid.v1": "/benchmarks/dom-virtualized-grid-v1/",
  "game.ecs-frame-update.v1": "/demos/game-ecs-frame-update/",
  "graphics.cpu-path-tracer.v1": "/benchmarks/graphics-cpu-path-tracer-v1/",
  "graphics.gltf-viewer.v1": "/benchmarks/base-gltf-viewer/",
  "ml.keyword-spotting.v1": "/benchmarks/ml-keyword-spotting-v1/",
  "ml.numeric-kernels.v1": "/benchmarks/ml-numeric-kernels-v1/",
  "network.pcap-decode.v1": "/demos/network.pcap-decode.v1/",
  "numeric.fft-spectral-filter.v1": "/benchmarks/numeric-fft-spectral-filter-v1/",
  "numeric.polybench-panel.v1": "/demos/numeric.polybench-panel.v1/",
  "serialization.json-telemetry.v1": "/demos/serialization.json-telemetry.v1/",
  "serialization.protobuf-gateway.v1": "/benchmarks/serialization-protobuf-gateway/",
  "server.ssr-template.v1": "/demos/server.ssr-template.v1/",
  "simulation.nbody-cloth.v1": "/demos/simulation-nbody-cloth/",
  "simulation.rigid-body-2d.v1": "/benchmarks/simulation-rigid-body-2d-v1/",
  "text.gc-document-edit.v1": "/demos/text.gc-document-edit.v1/",
  "text.regex-log-scan.v1": "/demos/base/text.regex-log-scan.v1/",
  "tooling.c-to-wasm-compile.v1": "/benchmarks/tooling-c-to-wasm-compile-v1/",
  // v2 proposal workloads with playground demos (14).
  "audio.fft.v1": "/benchmarks/audio-fft/",
  "audio.fir.v1": "/benchmarks/audio-fir/",
  "audio.stft.v1": "/benchmarks/audio-stft/",
  "dom.dependent-form-validation.v1": "/benchmarks/dom-dependent-form-validation/",
  "dom.grid-movement.v1": "/benchmarks/dom-grid-movement/",
  "dom.keyed-list-mutation.v1": "/benchmarks/dom-keyed-list-mutation/",
  "dom.vdom-diff-patch.v1": "/benchmarks/vdom-diff-patch-demo/",
  "game.canvas-arcade.v1": "/demos/game-canvas-arcade/",
  "game.canvas-entity-pathfinding.v1": "/demos/game-canvas-entity-pathfinding/",
  "game.dom-tactics-grid.v1": "/demos/game-dom-tactics-grid/",
  "image.editing-pipeline.v1": "/benchmarks/image-editing-demo/",
  "image.flood-fill.v1": "/benchmarks/image-flood-fill-demo/",
  "ml.dense-mlp.v1": "/benchmarks/ml-dense-mlp/",
  "ml.gemm.v1": "/benchmarks/ml-gemm/",
  "text.diff-patch.v1": "/demos/text.diff-patch.v1/",
  "text.markdown-cms.v1": "/demos/text.markdown-cms.v1/",
  "text.regex-engine-duel.v1": "/benchmarks/regex-automata-duel-demo/",
};

function element(name, text, className) {
  const node = document.createElement(name);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function addDefinition(listNode, term, value) {
  const wrapper = element("div");
  wrapper.append(element("dt", term), element("dd", value));
  listNode.append(wrapper);
}

function addList(section, title, values) {
  const heading = element("h4", title);
  const valuesList = element("ul");
  for (const value of values) valuesList.append(element("li", value));
  section.append(heading, valuesList);
}

function renderEntry(entry) {
  const card = element("article", undefined, "catalog-card");
  const header = element("header", undefined, "catalog-card-header");
  const title = element("h3", entry.title);
  const badges = element("p", undefined, "catalog-badges");
  for (const value of [entry.priority, entry.status, entry.class, entry.domain]) {
    badges.append(element("span", value));
  }
  header.append(title, badges, element("code", entry.id));
  const story = element("p", entry.story);
  const work = element("p");
  work.append(
    element("strong", "Fixed work: "),
    document.createTextNode(entry.fixedWork.description),
  );
  const details = element("details");
  details.append(element("summary", "Inspect oracle, modes, phases, rights, and blockers"));
  const body = element("div", undefined, "catalog-detail-grid");

  const contract = element("section");
  contract.append(element("h4", "Oracle and equivalence"));
  const oracle = element("dl", undefined, "compact-definitions");
  addDefinition(oracle, "Oracle", entry.oracle.kind);
  addDefinition(oracle, "Equivalence", entry.oracle.equivalenceClass);
  addDefinition(oracle, "Algorithm family", entry.oracle.algorithmFamily);
  contract.append(oracle, element("p", entry.oracle.description));

  const modes = element("section");
  modes.append(element("h4", "Target applicability"));
  const modeList = element("dl", undefined, "compact-definitions");
  for (const [name, item] of Object.entries(entry.applicability)) {
    addDefinition(modeList, name, item.applicability);
  }
  modes.append(modeList);

  const phaseSection = element("section");
  phaseSection.append(element("h4", "Lifecycle phases"));
  const phaseList = element("dl", undefined, "compact-definitions");
  for (const [name, value] of Object.entries(entry.phases)) addDefinition(phaseList, name, value);
  phaseSection.append(phaseList);

  const inputs = element("section");
  inputs.append(element("h4", "Inputs and rights"));
  for (const input of entry.inputs) {
    inputs.append(element("p", input.description));
    const inputList = element("dl", undefined, "compact-definitions");
    addDefinition(inputList, "Fixture", input.fixtureState);
    addDefinition(inputList, "Rights", input.rightsStatus);
    addDefinition(inputList, "Provenance", input.provenanceStatus);
    addDefinition(inputList, "License", input.licenseSpdx);
    addDefinition(inputList, "Redistribution", input.redistribution);
    addDefinition(inputList, "Hash", input.sha256 ?? "not frozen");
    inputs.append(inputList);
  }

  const engineering = element("section");
  addList(engineering, "Memory concerns", entry.memoryConcerns);
  addList(engineering, "Boundary concerns", entry.boundaryConcerns);
  addList(engineering, "Known blockers", entry.blockers);

  const prior = element("section");
  prior.append(element("h4", "Prior art and toolchains"));
  const priorList = element("ul");
  for (const source of entry.priorArt) {
    const item = element("li");
    const link = element("a", source.name);
    link.href = source.source;
    item.append(link, document.createTextNode(` — ${source.toolchain}; ${source.licenseSpdx}`));
    priorList.append(item);
  }
  prior.append(priorList);
  body.append(contract, modes, phaseSection, inputs, engineering, prior);
  details.append(body);

  const actions = element("div", undefined, "catalog-actions");
  const route = WORKLOAD_DEMO_ROUTES[entry.id];
  if (route) {
    const runBtn = element("a", "⚡ Run Benchmark Demo", "btn-run-catalog");
    runBtn.href = route;
    actions.append(runBtn);
  } else {
    const blockedBadge = element(
      "span",
      "📋 Proposal — no demo yet",
      "badge-blocked-catalog",
    );
    actions.append(blockedBadge);
  }

  card.append(header, story, work, actions, details);
  return card;
}

function countBy(entries, key) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry[key], (counts.get(entry[key]) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

try {
  const response = await fetch("/data/workloads.v1.json", { credentials: "omit" });
  if (!response.ok) throw new Error(`catalog request returned ${response.status}`);
  const catalog = await response.json();
  if (catalog.publishedCount !== 38 || catalog.entries.length !== 38) {
    throw new Error("catalog denominator does not reconcile to 38");
  }
  const params = new URLSearchParams(location.search);
  const domains = countBy(catalog.entries, "domain");
  for (const [name] of domains) {
    const option = element("option", name);
    option.value = name;
    domain.append(option);
  }
  query.value = params.get("q") ?? "";
  priority.value = params.get("priority") ?? "all";
  domain.value = params.get("domain") ?? "all";
  status.value = params.get("status") ?? "all";
  if (!priority.value) priority.value = "all";
  if (!domain.value) domain.value = "all";
  if (!status.value) status.value = "all";

  const domainList = element("dl", undefined, "domain-counts");
  for (const [name, count] of domains) addDefinition(domainList, name, String(count));
  domainTotals.append(domainList);

  const term = query.value.trim().toLocaleLowerCase();
  const visible = catalog.entries.filter((entry) => {
    const haystack = `${entry.id} ${entry.title} ${entry.story} ${entry.domain}`
      .toLocaleLowerCase();
    return (!term || haystack.includes(term)) &&
      (priority.value === "all" || entry.priority === priority.value) &&
      (domain.value === "all" || entry.domain === domain.value) &&
      (status.value === "all" || entry.status === status.value);
  });
  list.replaceChildren(...visible.map(renderEntry));
  const demoCount = visible.filter((entry) => WORKLOAD_DEMO_ROUTES[entry.id]).length;
  statusLine.textContent =
    `Showing ${visible.length} of ${catalog.entries.length} workloads. Proposed: ${
      catalog.entries.filter((entry) => entry.status === "proposed").length
    }. With runnable demos: ${demoCount}. Accepted into the frozen corpus: ${catalog.implementationCoverage.implementedCatalogEntries} of 38 (acceptance has not run yet — demos are not accepted evidence).`;
} catch (error) {
  statusLine.textContent = `Catalog unavailable: ${
    error instanceof Error ? error.message : "unknown error"
  }`;
}
