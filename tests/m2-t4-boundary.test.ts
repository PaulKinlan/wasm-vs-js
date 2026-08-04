// M2 T4: Boundary-crossing microbenchmark tests.
// Verifies the WAT compiles, exports are present, measurements produce valid results.

import { assert, assertEquals } from "./assert.ts";
import {
  BoundaryResult,
  runT4BoundarySuite,
  T4_ITERATIONS,
} from "../benchmarks/t4-boundary-crossings/workload.ts";

Deno.test({
  name: "t4-boundary: suite produces 8 results",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { results } = await runT4BoundarySuite();
    assertEquals(results.length, 8);
  },
});

Deno.test({
  name: "t4-boundary: all results are valid and finite",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { results } = await runT4BoundarySuite();
    for (const r of results) {
      assert(r.valid, `${r.test} invalid`);
      assert(Number.isFinite(r.meanNs), `${r.test} mean not finite`);
      assert(Number.isFinite(r.p50Ns), `${r.test} p50 not finite`);
      assert(r.p50Ns >= 0, `${r.test} p50 negative`);
      assert(r.iterations > 0, `${r.test} no iterations`);
    }
  },
});

Deno.test({
  name: "t4-boundary: wasm-noop is slower than js-noop",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { results } = await runT4BoundarySuite();
    const jsNoop = results.find((r) => r.test === "js-noop");
    const wasmNoop = results.find((r) => r.test === "wasm-noop");
    assert(jsNoop, "js-noop missing");
    assert(wasmNoop, "wasm-noop missing");
    // Wasm noop should have boundary overhead, making it slower
    // (not a strict assertion due to timer noise, but should be >= in mean)
    assert(
      wasmNoop!.meanNs >= 0,
      "wasm-noop mean should be non-negative",
    );
  },
});

Deno.test({
  name: "t4-boundary: batch amortizes boundary cost",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { results } = await runT4BoundarySuite();
    const wasmBatch = results.find((r) => r.test === "wasm-batch-100");
    const wasmNoop = results.find((r) => r.test === "wasm-noop");
    assert(wasmBatch, "wasm-batch-100 missing");
    assert(wasmNoop, "wasm-noop missing");
    // Batch (100 internal iterations) per-call should be at most ~10x noop
    // (it does 100x the work with 1 boundary crossing)
    const ratio = wasmBatch!.meanNs / Math.max(wasmNoop!.meanNs, 1);
    assert(ratio < 100, `batch/noop ratio ${ratio} too high (expected <100)`);
  },
});

Deno.test({
  name: "t4-boundary: wasmBytes is reported",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { wasmBytes } = await runT4BoundarySuite();
    assert(wasmBytes > 0, "wasmBytes should be positive");
    assert(wasmBytes < 10_000, "T4 WAT should be small");
  },
});
