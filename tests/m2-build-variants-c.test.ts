// M2: Named build variants tests — C kernels at different optimization levels.
import { assert, assertEquals } from "./assert.ts";
import {
  BUILD_CONFIGS,
  DEFAULT_VARIANT,
  runBuildVariantSuite,
} from "../benchmarks/build-variants-c/workload.ts";

Deno.test({
  name: "build-variants-c: suite compiles all 6 variants",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    assertEquals(report.builds.length, BUILD_CONFIGS.length);
  },
});

Deno.test({
  name: "build-variants-c: all variants compile successfully",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    for (const build of report.builds) {
      assert(build.valid, `${build.variant} failed: ${build.error ?? "unknown"}`);
      assert(build.wasmBytes > 0, `${build.variant} zero-size binary`);
      assert(build.wasmSha256.length === 64, `${build.variant} missing SHA-256`);
      assert(build.buildCommand.includes("clang"), `${build.variant} missing clang command`);
      assert(build.clangVersion.length > 0, `${build.variant} missing clang version`);
    }
  },
});

Deno.test({
  name: "build-variants-c: -Oz produces smaller binary than -O3 for sum-u32",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    const o3 = report.builds.find((b) => b.variant === "sum-u32-O3");
    const oz = report.builds.find((b) => b.variant === "sum-u32-Oz");
    assert(o3, "missing sum-u32-O3");
    assert(oz, "missing sum-u32-Oz");
    assert(
      oz!.wasmBytes <= o3!.wasmBytes,
      `-Oz (${oz!.wasmBytes}B) should be <= -O3 (${o3!.wasmBytes}B)`,
    );
  },
});

Deno.test({
  name: "build-variants-c: -O0 and -O3 produce different binaries",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    const o0 = report.builds.find((b) => b.variant === "sum-u32-O0");
    const o3 = report.builds.find((b) => b.variant === "sum-u32-O3");
    assert(o0, "missing sum-u32-O0");
    assert(o3, "missing sum-u32-O3");
    assert(
      o0!.wasmSha256 !== o3!.wasmSha256,
      "-O0 and -O3 should produce different binaries",
    );
  },
});

Deno.test({
  name: "build-variants-c: SIMD variant differs from scalar",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    const scalar = report.builds.find((b) => b.variant === "dot-f32-O3");
    const simd = report.builds.find((b) => b.variant === "dot-f32-O3-simd128");
    assert(scalar, "missing dot-f32-O3");
    assert(simd, "missing dot-f32-O3-simd128");
    // SIMD binary should differ from scalar (different instructions)
    assert(
      scalar!.wasmSha256 !== simd!.wasmSha256,
      "SIMD variant should produce different binary than scalar",
    );
    assert(
      simd!.buildCommand.includes("-msimd128"),
      "SIMD variant command must include -msimd128",
    );
  },
});

Deno.test({
  name: "build-variants-c: all sum-u32 variants produce same output (correctness)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    assert(report.correctnessPassed, "correctness check failed across variants");
  },
});

Deno.test({
  name: "build-variants-c: default variant is sum-u32-O3",
  fn() {
    assertEquals(DEFAULT_VARIANT, "sum-u32-O3");
  },
});

Deno.test({
  name: "build-variants-c: each variant records exact build command and clang version",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runBuildVariantSuite();
    for (const build of report.builds) {
      assert(
        build.buildCommand.startsWith("clang --target=wasm32"),
        `${build.variant} missing clang target`,
      );
      assert(build.clangVersion.includes("clang"), `${build.variant} clang version missing`);
    }
  },
});
