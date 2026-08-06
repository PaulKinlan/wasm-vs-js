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
import * as gridEngine from "../benchmarks/base/dom-virtualized-grid/engine.js";
import {
  materializeActions as materializeGridActions,
  replayReference as replayGridReference,
} from "../public/dom-hosts/dom-virtualized-grid-host.js";

const HOST_MODULES = [
  "../public/dom-hosts/dom-grid-movement-host.js",
  "../public/dom-hosts/dom-keyed-list-mutation-host.js",
  "../public/dom-hosts/dom-nested-tree-mutation-host.js",
  "../public/dom-hosts/dom-table-sort-filter-pagination-host.js",
  "../public/dom-hosts/dom-dependent-form-validation-host.js",
  "../public/dom-hosts/dom-virtualized-scrolling-host.js",
  "../public/dom-hosts/dom-virtualized-grid-host.js",
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

enginePair(
  "grid-movement",
  grid.generateGridActions,
  grid.runGridMovementJS,
  grid.runGridMovementWasm,
  3600,
);
enginePair(
  "keyed-list",
  keyedList.generateKeyedListActions,
  keyedList.runKeyedListMutationJS,
  keyedList.runKeyedListMutationWasm,
  2000,
);
enginePair(
  "nested-tree",
  nestedTree.generateNestedTreeActions,
  nestedTree.runNestedTreeMutationJS,
  nestedTree.runNestedTreeMutationWasm,
  1200,
);
enginePair(
  "table-sort",
  tableSort.generateTableActions,
  tableSort.runTableSortFilterJS,
  tableSort.runTableSortFilterWasm,
  120,
);
enginePair(
  "form-validation",
  formValidation.generateFormActions,
  formValidation.runFormValidationJS,
  formValidation.runFormValidationWasm,
  240,
);
enginePair(
  "virtualized-scrolling",
  virtualized.generateScrollActions,
  virtualized.runVirtualizedScrollingJS,
  virtualized.runVirtualizedScrollingWasm,
  1800,
);

// ── Virtualized Data Grid (the host's materialize + plain-data replay) ─────

Deno.test("dom orchestration: virtualized-grid host materializes the frozen 300-action trace", () => {
  const fixture = gridEngine.generateFixture();
  const actions = materializeGridActions(gridEngine, fixture);
  assertEquals(actions.length, 300);
  // Deterministic across materializations.
  const again = materializeGridActions(gridEngine, fixture);
  assertEquals(JSON.stringify(actions), JSON.stringify(again));
  // Each action carries a non-empty command batch ending in the layout terminator.
  for (const action of actions) {
    if (!(action.commands instanceof Uint32Array) || action.commands.length < 6) {
      throw new Error("action commands malformed");
    }
    if (action.commands[action.commands.length - 6] !== 7) {
      throw new Error("action commands omit the layout terminator");
    }
  }
});

Deno.test("dom orchestration: virtualized-grid plain-data replay matches the command stream", () => {
  const fixture = gridEngine.generateFixture();
  const actions = materializeGridActions(gridEngine, fixture);
  const reference = replayGridReference(actions);
  // Sanity: the frozen trace exercises every command family at least once.
  assertEquals(reference.physicalCreates > 0, true);
  assertEquals(reference.physicalPlacements > 0, true);
  assertEquals(reference.layoutReads, actions.length);
  assertEquals(reference.mountedCount > 0, true);
});

Deno.test("dom orchestration: virtualized-grid js and wasm engines are deterministic and equivalent", async () => {
  const fixture = gridEngine.generateFixture();
  const js1 = JSON.stringify(gridEngine.normalizeForEquivalence(gridEngine.runJavaScript(fixture)));
  const js2 = JSON.stringify(gridEngine.normalizeForEquivalence(gridEngine.runJavaScript(fixture)));
  assertEquals(js1, js2);
  const wasmBytes = await Deno.readFile("public/artifacts/dom-virtualized-grid-v1/grid.wasm");
  const exports = await gridEngine.instantiateGridWasm(wasmBytes);
  const wasm1 = JSON.stringify(
    gridEngine.normalizeForEquivalence(gridEngine.runWasm(exports, fixture)),
  );
  const wasm2 = JSON.stringify(
    gridEngine.normalizeForEquivalence(gridEngine.runWasm(exports, fixture)),
  );
  assertEquals(wasm1, wasm2);
  if (js1 !== wasm1) throw new Error("virtualized-grid js and wasm summaries must match");
});

// Record the equivalence finding (the host factory surfaces this in the
// detail payload). This documents the current state — it does NOT assert
// equality where the engines genuinely diverge.
Deno.test("dom orchestration: engine equivalence status (finding record)", () => {
  const findings = [
    [
      "grid-movement",
      grid.runGridMovementJS(grid.generateGridActions()),
      grid.runGridMovementWasm(grid.generateGridActions()),
    ],
    [
      "keyed-list",
      keyedList.runKeyedListMutationJS(keyedList.generateKeyedListActions()),
      keyedList.runKeyedListMutationWasm(keyedList.generateKeyedListActions()),
    ],
    [
      "nested-tree",
      nestedTree.runNestedTreeMutationJS(nestedTree.generateNestedTreeActions()),
      nestedTree.runNestedTreeMutationWasm(nestedTree.generateNestedTreeActions()),
    ],
    [
      "table-sort",
      tableSort.runTableSortFilterJS(tableSort.generateTableActions()),
      tableSort.runTableSortFilterWasm(tableSort.generateTableActions()),
    ],
    [
      "form-validation",
      formValidation.runFormValidationJS(formValidation.generateFormActions()),
      formValidation.runFormValidationWasm(formValidation.generateFormActions()),
    ],
    [
      "virtualized-scrolling",
      virtualized.runVirtualizedScrollingJS(virtualized.generateScrollActions()),
      virtualized.runVirtualizedScrollingWasm(virtualized.generateScrollActions()),
    ],
  ] as const;
  const diverging = findings.filter(([, js, wasm]) => JSON.stringify(js) !== JSON.stringify(wasm))
    .map(([label]) => label);
  // Deterministic engines are required; equivalence is recorded (divergence is
  // expected for several workloads and is surfaced by the hosts, not asserted).
  console.log(
    `dom-orchestration finding: engine-pair equivalence diverges for: ${
      diverging.join(", ") || "none"
    }`,
  );
});
