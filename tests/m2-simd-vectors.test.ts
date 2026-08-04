// M2 SIMD: f32x4 vector operations test suite.
// Verifies SIMD Wasm compiles, correctness vs scalar, and benchmark validity.

import { assert, assertEquals } from "./assert.ts";
import { runSimdSuite, SIMD_VECTOR_SIZE } from "../benchmarks/simd-vectors/workload.ts";

Deno.test({
  name: "simd-vectors: suite produces 5 benchmark results",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runSimdSuite();
    assertEquals(report.results.length, 5);
  },
});

Deno.test({
  name: "simd-vectors: SIMD dot product matches scalar",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runSimdSuite();
    assert(report.dotCorrectnessPassed, "SIMD dot product does not match scalar");
  },
});

Deno.test({
  name: "simd-vectors: SIMD vecmul matches JS scalar",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runSimdSuite();
    assert(report.vecmulCorrectnessPassed, "SIMD vecmul does not match JS scalar");
  },
});

Deno.test({
  name: "simd-vectors: all results valid and finite",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runSimdSuite();
    for (const r of report.results) {
      assert(r.valid, `${r.test} invalid`);
      assert(Number.isFinite(r.meanMs), `${r.test} mean not finite`);
      assert(r.totalMs > 0, `${r.test} zero time`);
    }
  },
});

Deno.test({
  name: "simd-vectors: wasm bytes reported",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const report = await runSimdSuite();
    assert(report.wasmBytes > 0, "wasm bytes should be positive");
    assert(report.wasmBytes < 5000, "SIMD WAT should be compact");
  },
});

Deno.test({
  name: "simd-vectors: vector size is 1024",
  fn() {
    assertEquals(SIMD_VECTOR_SIZE, 1024);
  },
});
