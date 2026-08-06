// Pure, DOM-free tests for the iframe real-DOM host modules.
//
// The hosts render real DOM (browser-only); these tests verify the pieces
// that run identically in Deno: each host module exports the bridge's
// createTodomvcHost(), the workload action generators produce their frozen
// shapes, and the JS vs wasm-linear engine pairs are DETERMINISTIC (stable
// across runs). Engine equivalence is recorded as a finding: several of
// these DOM engines genuinely diverge between the js and wasm-linear
// variants (the repo never asserted their equivalence) — the hosts surface
// that divergence in the result payload instead of hiding it.

import { assertEquals } from "./assert.ts";
import * as grid from "../public/benchmarks/dom-grid-movement/engine.js";
import * as keyedList from "../public/benchmarks/dom-keyed-list-mutation/engine.js";
import * as nestedTree from "../public/benchmarks/dom-nested-tree-mutation/engine.js";
import * as tableSort from "../public/benchmarks/dom-table-sort-filter-pagination/engine.js";
import * as formValidation from "../public/benchmarks/dom-dependent-form-validation/engine.js";
import * as virtualized from "../public/benchmarks/dom-virtualized-scrolling/engine.js";

const HOST_MODULES = [
  "../public/dom-hosts/dom-grid-movement-host.js",
  "../public/dom-hosts/dom-keyed-list-mutation-host.js",
  "../public/dom-hosts/dom-nested-tree-mutation-host.js",
  "../public/dom-hosts/dom-table-sort-filter-pagination-host.js",
  "../public/dom-hosts/dom-dependent-form-validation-host.js",
  "../public/dom-hosts/dom-virtualized-scrolling-host.js",
] as const;

for (const mod of HOST_MODULES) {
  Deno.test(`dom orchestration: ${mod.split("/").pop()} exports createTodomvcHost`, async () => {
    const host = await import(mod);
    assertEquals(typeof host.createTodomvcHost, "function");
  });
}

// ── Determinism + equivalence finding per workload ─────────────────────────

function enginePair(
  label: string,
  generate: () => unknown[],
  runJs: (a: unknown[]) => Record<string, unknown>,
  runWasm: (a: unknown[]) => Record<string, unknown>,
  length: number,
) {
  Deno.test(`dom orchestration: ${label} frozen stream (${length}) + deterministic engines`, () => {
    const actions = generate();
    assertEquals(actions.length, length);
    const js1 = JSON.stringify(runJs(actions));
    const js2 = JSON.stringify(runJs(actions));
    const wasm1 = JSON.stringify(runWasm(actions));
    const wasm2 = JSON.stringify(runWasm(actions));
    if (js1 !== js2) throw new Error(`${label} JS engine not deterministic`);
    if (wasm1 !== wasm2) throw new Error(`${label} wasm engine not deterministic`);
  });
}

enginePair("grid-movement", grid.generateGridActions, grid.runGridMovementJS, grid.runGridMovementWasm, 3600);
enginePair("keyed-list", keyedList.generateKeyedListActions, keyedList.runKeyedListMutationJS, keyedList.runKeyedListMutationWasm, 2000);
enginePair("nested-tree", nestedTree.generateNestedTreeActions, nestedTree.runNestedTreeMutationJS, nestedTree.runNestedTreeMutationWasm, 1200);
enginePair("table-sort", tableSort.generateTableActions, tableSort.runTableSortFilterJS, tableSort.runTableSortFilterWasm, 120);
enginePair("form-validation", formValidation.generateFormActions, formValidation.runFormValidationJS, formValidation.runFormValidationWasm, 240);
enginePair("virtualized-scrolling", virtualized.generateScrollActions, virtualized.runVirtualizedScrollingJS, virtualized.runVirtualizedScrollingWasm, 1800);

// Record the equivalence finding (the host factory surfaces this in the
// detail payload). This documents the current state — it does NOT assert
// equality where the engines genuinely diverge.
Deno.test("dom orchestration: engine equivalence status (finding record)", () => {
  const findings = [
    ["grid-movement", grid.runGridMovementJS(grid.generateGridActions()), grid.runGridMovementWasm(grid.generateGridActions())],
    ["keyed-list", keyedList.runKeyedListMutationJS(keyedList.generateKeyedListActions()), keyedList.runKeyedListMutationWasm(keyedList.generateKeyedListActions())],
    ["nested-tree", nestedTree.runNestedTreeMutationJS(nestedTree.generateNestedTreeActions()), nestedTree.runNestedTreeMutationWasm(nestedTree.generateNestedTreeActions())],
    ["table-sort", tableSort.runTableSortFilterJS(tableSort.generateTableActions()), tableSort.runTableSortFilterWasm(tableSort.generateTableActions())],
    ["form-validation", formValidation.runFormValidationJS(formValidation.generateFormActions()), formValidation.runFormValidationWasm(formValidation.generateFormActions())],
    ["virtualized-scrolling", virtualized.runVirtualizedScrollingJS(virtualized.generateScrollActions()), virtualized.runVirtualizedScrollingWasm(virtualized.generateScrollActions())],
  ] as const;
  const diverging = findings.filter(([, js, wasm]) => JSON.stringify(js) !== JSON.stringify(wasm)).map(([label]) => label);
  // Deterministic engines are required; equivalence is recorded (divergence is
  // expected for several workloads and is surfaced by the hosts, not asserted).
  console.log(`dom-orchestration finding: engine-pair equivalence diverges for: ${diverging.join(", ") || "none"}`);
});
