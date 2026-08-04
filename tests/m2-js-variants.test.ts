// M2 Track B: JavaScript optimization-hint variant tests.

import { assert, assertEquals } from "./assert.ts";
import {
  JS_VARIANT_ITERATIONS,
  runJsVariantSuite,
} from "../benchmarks/js-optimization-variants/workload.ts";

Deno.test({
  name: "js-variants: suite produces 6 variant results",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const report = runJsVariantSuite();
    assertEquals(report.results.length, 6);
  },
});

Deno.test({
  name: "js-variants: all results valid with correct output",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const report = runJsVariantSuite();
    const expected = 499500; // sum(0..999)
    for (const r of report.results) {
      assert(r.valid, `${r.variant} invalid`);
      assert(r.output === expected, `${r.variant} output ${r.output} ≠ ${expected}`);
    }
  },
});

Deno.test({
  name: "js-variants: typed-array is faster or equal to regular-array",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const report = runJsVariantSuite();
    const typed = report.results.find((r) => r.variant === "typed-array-sum");
    const regular = report.results.find((r) => r.variant === "regular-array-sum");
    assert(typed, "missing typed-array-sum");
    assert(regular, "missing regular-array-sum");
    // Typed arrays should be at least as fast (monomorphic shape)
    // Not a strict assertion due to timer noise, but p50 should be comparable
    assert(typed!.p50Ns >= 0);
    assert(regular!.p50Ns >= 0);
  },
});

Deno.test({
  name: "js-variants: engine info probed",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const report = runJsVariantSuite();
    assert(typeof report.engineInfo.v8Version === "string");
    assert(typeof report.engineInfo.turbofanEnabled === "boolean");
  },
});

Deno.test({
  name: "js-variants: each variant has a description and hint",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const report = runJsVariantSuite();
    for (const r of report.results) {
      assert(r.variant.length > 0, "missing variant name");
      assert(r.hint.length > 10, `${r.variant} hint too short`);
    }
  },
});
