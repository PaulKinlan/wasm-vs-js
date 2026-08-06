// Unified "Run Everything" flow contract (Paul directive 2026-08-06):
// ONE run control sequences the primary JS-vs-Wasm stage, then the
// multi-language comparison (all engines), then the Track B optimized
// variants — consistently across benchmark pages.
import { assert, assertEquals } from "./assert.ts";
import { composedStagePlan } from "../public/unified-runner.js";
import { shouldAutoBindMultilang } from "../public/multilang-runner.js";

Deno.test("composedStagePlan: detects the primary stage from workload or demo", () => {
  assertEquals(composedStagePlan({ workload: "ml-gemm" }).primary, true);
  assertEquals(composedStagePlan({ demo: "audio-fft" }).primary, true);
  assertEquals(composedStagePlan({}).primary, false);
});

Deno.test("composedStagePlan: passes through the multilang manifest when present", () => {
  const plan = composedStagePlan({
    workload: "ml-gemm",
    multilangManifest: "/benchmarks/multilang-wasm/ml-gemm.manifest.json",
  });
  assertEquals(plan.multilangManifest, "/benchmarks/multilang-wasm/ml-gemm.manifest.json");
  assertEquals(composedStagePlan({ workload: "x" }).multilangManifest, null);
});

Deno.test("composedStagePlan: passes through the Track B section when present", () => {
  const plan = composedStagePlan({ workload: "ml-gemm", trackBRoot: "#track-b-root" });
  assertEquals(plan.trackBRoot, "#track-b-root");
  assertEquals(composedStagePlan({ workload: "x" }).trackBRoot, null);
});

Deno.test("composedStagePlan: full plan for a page with all three stages", () => {
  assertEquals(
    composedStagePlan({
      workload: "ml-gemm",
      multilangManifest: "/m.json",
      trackBRoot: "#track-b-root",
    }),
    {
      primary: true,
      multilangManifest: "/m.json",
      trackBRoot: "#track-b-root",
      libcmp: false,
      libcmpEngines: [],
    },
  );
});

Deno.test("shouldAutoBindMultilang: skips binding on pages with the composed primary runner", () => {
  // The unified runner marks data-unified-runner-active; the multilang runner
  // must then NOT bind a second control (the composed flow sequences it).
  assertEquals(
    shouldAutoBindMultilang({ unifiedRunnerActive: true, multilangManifest: "/m.json" }),
    false,
  );
});

Deno.test("shouldAutoBindMultilang: binds on standalone multilang pages (hub)", () => {
  assertEquals(
    shouldAutoBindMultilang({ multilangManifest: "/m.json" }),
    true,
  );
  assertEquals(shouldAutoBindMultilang({}), false);
});

Deno.test("shouldAutoBindMultilang: multilang manifest is required", () => {
  assertEquals(
    shouldAutoBindMultilang({ unifiedRunnerActive: false }),
    false,
  );
});

Deno.test("contract: one control runs every stage on a composed page", () => {
  // A page that loads the unified runner (primary) AND has a multilang
  // manifest is a composed page: the primary control drives everything and the
  // multilang runner must not double-bind.
  const pageMeta = {
    unifiedRunnerActive: true,
    multilangManifest: "/benchmarks/multilang-wasm/ml-gemm.manifest.json",
  };
  const plan = composedStagePlan({
    workload: "ml-gemm",
    multilangManifest: pageMeta.multilangManifest,
    trackBRoot: "#track-b-root",
  });
  assert(plan.primary, "primary stage must run");
  assert(plan.multilangManifest, "multilang stage must run");
  assert(plan.trackBRoot, "track-b stage must run");
  assert(!shouldAutoBindMultilang(pageMeta), "no second control");
});

Deno.test("composedStagePlan: detects the library-comparison stage from the page attribute", () => {
  const plan = composedStagePlan({ workload: "archive-zip-workspace-v1", libcmp: true });
  assertEquals(plan.libcmp, true);
  assertEquals(composedStagePlan({ workload: "x" }).libcmp, false);
});

Deno.test("composedStagePlan: passes through the declared library engines", () => {
  const engines = [
    {
      key: "js",
      label: "JavaScript engine",
      source: "/benchmarks/v1/archive-zip-workspace/engine.js",
    },
    {
      key: "wasm",
      label: "WebAssembly engine",
      source: "/benchmarks/v1/archive-zip-workspace/archive_zip.c",
    },
  ];
  const plan = composedStagePlan({
    workload: "archive-zip-workspace-v1",
    libcmp: true,
    libcmpEngines: engines,
  });
  assertEquals(plan.libcmpEngines.length, 2);
  assertEquals(plan.libcmpEngines[0].key, "js");
  assertEquals(plan.libcmpEngines[1].key, "wasm");
  // non-array input is coerced to an empty list (invalid JSON -> no stage)
  assertEquals(composedStagePlan({ workload: "x", libcmpEngines: "garbage" }).libcmpEngines, []);
});
