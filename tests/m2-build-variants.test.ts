// M2 Track B: Named build variant tests.
// Verifies all variants compile, produce valid binaries, and export correctly.

import { assert, assertEquals } from "./assert.ts";
import {
  BUILD_VARIANTS,
  getSumU32Wat,
  runBuildVariantSuite,
} from "../benchmarks/build-variants/workload.ts";

Deno.test({
  name: "build-variants: suite produces results for all configured variants",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    assertEquals(report.results.length, BUILD_VARIANTS.length);
  },
});

Deno.test({
  name: "build-variants: all variants compile and export sum_u32",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    for (const r of report.results) {
      assert(r.valid, `variant ${r.variant} did not produce valid binary`);
      assert(
        r.exportedFunctions.includes("sum_u32"),
        `variant ${r.variant} missing sum_u32 export`,
      );
    }
  },
});

Deno.test({
  name: "build-variants: default variant is smallest",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    const defaultVariant = report.results.find((r) => r.variant === "default");
    const debugVariant = report.results.find((r) => r.variant === "debug-names");
    assert(defaultVariant, "missing default variant");
    assert(debugVariant, "missing debug-names variant");
    // Debug names should be larger than default (canonical)
    assert(
      debugVariant!.wasmBytes >= defaultVariant!.wasmBytes,
      `debug-names (${debugVariant!.wasmBytes}B) should be >= default (${
        defaultVariant!.wasmBytes
      }B)`,
    );
  },
});

Deno.test({
  name: "build-variants: relocatable variant is larger than default",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    const defaultVariant = report.results.find((r) => r.variant === "default");
    const relocatableVariant = report.results.find((r) => r.variant === "relocatable");
    assert(relocatableVariant, "missing relocatable variant");
    // Relocatable adds relocation entries, increasing size
    assert(
      relocatableVariant!.wasmBytes >= defaultVariant!.wasmBytes,
      `relocatable (${relocatableVariant!.wasmBytes}B) should be >= default (${
        defaultVariant!.wasmBytes
      }B)`,
    );
  },
});

Deno.test({
  name: "build-variants: non-canonical-lebs is larger than default",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    const defaultVariant = report.results.find((r) => r.variant === "default");
    const nonCanonical = report.results.find((r) => r.variant === "non-canonical-lebs");
    assert(nonCanonical, "missing non-canonical-lebs variant");
    // Non-canonical LEB128 uses more bytes for the same values
    assert(
      nonCanonical!.wasmBytes >= defaultVariant!.wasmBytes,
      `non-canonical-lebs (${nonCanonical!.wasmBytes}B) should be >= default (${
        defaultVariant!.wasmBytes
      }B)`,
    );
  },
});

Deno.test({
  name: "build-variants: WAT source is sum-u32",
  fn() {
    const wat = getSumU32Wat();
    assert(wat.includes("sum_u32"), "WAT should export sum_u32");
    assert(wat.includes("memory"), "WAT should export memory");
  },
});

Deno.test({
  name: "build-variants: 4 variants configured",
  fn() {
    assertEquals(BUILD_VARIANTS.length, 4);
    assertEquals(BUILD_VARIANTS.map((v) => v.name), [
      "default",
      "debug-names",
      "non-canonical-lebs",
      "relocatable",
    ]);
  },
});
