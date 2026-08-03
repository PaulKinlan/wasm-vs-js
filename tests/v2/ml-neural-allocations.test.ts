import {
  allocationsCreated,
  assert,
  emptyPhaseTimings,
  frozenExp,
  frozenTanh,
  geluFrozenF64,
  gemm,
  GemmJsRunner,
  gemmReference,
  gemmStructuralChecks,
  gemmWasm,
  GemmWasmRunner,
  mlp,
  mlpJsLayerOutputs,
  MlpJsRunner,
  mlpReference,
  mlpStructuralChecks,
  mlpWasm,
  mlpWasmLayerOutputs,
  MlpWasmRunner,
  resetAllocationCount,
  timedPhase,
} from "./ml-neural-shared.ts";

Deno.test("allocation counter is operative: exact initialization counts, zero compute allocations", async () => {
  // Scope: workload-owned typed-array buffers, views, and objects routed
  // through benchmarks/v2/shared/allocations.js. Engine internals are
  // opaque and out of scope by definition (documented there and in the
  // workloads' counter comments). This test measures, not infers.

  // Fixture creation (outside repetition): 3 tensors + generator views per
  // workload. Every scoped allocation is counted, wherever it occurs.
  resetAllocationCount();
  const { a, b, c0 } = gemm.generateInput();
  assert(
    allocationsCreated() === 16,
    "ml-gemm fixture allocations (3 tensors + 12 views + result object)",
  );
  resetAllocationCount();
  const { x, w, bias } = mlp.generateInput();
  assert(
    allocationsCreated() === 22,
    "ml-dense-mlp fixture allocations (3 tensors + 18 views + result object)",
  );

  // Module evaluation creates exactly one workload-owned buffer: the frozen
  // power table. Measured via cache-busted dynamic import (real evaluation).
  resetAllocationCount();
  await import(
    new URL(
      `../../benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js?init=${Date.now()}`,
      import.meta.url,
    ).href
  );
  assert(
    allocationsCreated() === 4,
    "module init allocations (EXP_COEFFS + table + ArrayBuffer + DataView)",
  );

  // JS GEMM: prepare = 4 buffers + 1 runner object; transfer = 0;
  // run(2) = 0 (compute and reset allocate nothing).
  resetAllocationCount();
  const gemmJs = GemmJsRunner.prepare(emptyPhaseTimings());
  assert(allocationsCreated() === 5, "ml-gemm js initialize allocations");
  resetAllocationCount();
  gemmJs.transfer(a, b, c0);
  assert(allocationsCreated() === 0, "ml-gemm js transfer allocations");
  resetAllocationCount();
  gemmJs.run(2);
  assert(allocationsCreated() === 0, "ml-gemm js compute allocations");

  // Wasm GEMM: prepare = 1 runner object; transfer = 3 memory views;
  // run(2) = 2 Uint8Array views per reset x 2 = 4, compute 0.
  resetAllocationCount();
  const gemmWasmRunner = await GemmWasmRunner.prepare(gemmWasm, a, b, c0, emptyPhaseTimings());
  assert(allocationsCreated() === 1, "ml-gemm wasm initialize allocations");
  resetAllocationCount();
  gemmWasmRunner.transfer();
  assert(allocationsCreated() === 3, "ml-gemm wasm transfer allocations");
  resetAllocationCount();
  gemmWasmRunner.run(2);
  assert(allocationsCreated() === 4, "ml-gemm wasm run allocations (reset views only)");

  // JS MLP: prepare = 6 buffers + 1 runner object; transfer = 0; run(2) = 0.
  resetAllocationCount();
  const mlpJs = MlpJsRunner.prepare(emptyPhaseTimings());
  assert(allocationsCreated() === 7, "ml-dense-mlp js initialize allocations");
  resetAllocationCount();
  mlpJs.transfer(x, w, bias);
  assert(allocationsCreated() === 0, "ml-dense-mlp js transfer allocations");
  resetAllocationCount();
  mlpJs.run(2);
  assert(allocationsCreated() === 0, "ml-dense-mlp js compute allocations");

  // Wasm MLP: prepare = 1 runner object + 3 transfer views; run(2) = 0.
  resetAllocationCount();
  const mlpWasmRunner = await MlpWasmRunner.prepare(mlpWasm, x, w, bias, emptyPhaseTimings());
  assert(allocationsCreated() === 4, "ml-dense-mlp wasm prepare+transfer allocations");
  resetAllocationCount();
  mlpWasmRunner.run(2);
  assert(allocationsCreated() === 0, "ml-dense-mlp wasm compute allocations");

  // Direct workload entry points: zero allocations per call.
  resetAllocationCount();
  const c = new Float32Array(c0.length);
  gemm.gemmControlled(a, b, c0, c);
  const scratchA = new Float32Array(mlp.MLP_BATCH * mlp.WIDTH);
  const scratchB = new Float32Array(mlp.MLP_BATCH * mlp.WIDTH);
  const y = new Float32Array(mlp.MLP_BATCH * mlp.WIDTH);
  mlp.mlpControlled(x, w, bias, scratchA, scratchB, y);
  assert(allocationsCreated() === 0, "workload entry-point compute allocations");

  // Frozen transcendentals: zero allocations per evaluation.
  resetAllocationCount();
  for (const v of [-3.25, -0.5, 0.75, 2.25, 709.0, -708.0]) {
    frozenExp(v);
    frozenTanh(v);
    geluFrozenF64(v);
  }
  assert(allocationsCreated() === 0, "frozen transcendental allocations");
  resetAllocationCount();
});

Deno.test("catalog structural oracle checks hold on the committed fixture for both targets", async () => {
  const { a, b, c0 } = gemm.generateInput();
  const gemmRef = gemmReference(a, b, c0);
  const gemmJs = GemmJsRunner.prepare(emptyPhaseTimings());
  gemmJs.transfer(a, b, c0);
  gemmJs.run(1);
  const gemmWasmRunner = await GemmWasmRunner.prepare(gemmWasm, a, b, c0, emptyPhaseTimings());
  gemmWasmRunner.transfer();
  gemmWasmRunner.run(1);
  for (const out of [gemmJs.output(), gemmWasmRunner.output()]) {
    for (const check of gemmStructuralChecks(out, gemmRef.reference, gemmRef.bound)) {
      assert(check.passed, `ml-gemm ${check.id}: ${check.detail}`);
    }
  }

  const { x, w, bias } = mlp.generateInput();
  // Structural-check helper validation: trajectories and oracle derivation
  // are wrapped explicitly in validation phases (not phase evidence).
  const helperTimings = emptyPhaseTimings();
  const mlpRef = await timedPhase(
    helperTimings,
    "validation",
    () => mlpReference(x, w, bias, mlpJsLayerOutputs(x, w, bias)),
  );
  assert(helperTimings.validation > 0, "oracle derivation untimed");
  const mlpWasmRunner = await MlpWasmRunner.prepare(mlpWasm, x, w, bias, emptyPhaseTimings());
  const jsLayers = await timedPhase(
    helperTimings,
    "validation",
    () => mlpJsLayerOutputs(x, w, bias),
  );
  const wasmLayers = await timedPhase(
    helperTimings,
    "validation",
    () => mlpWasmLayerOutputs(mlpWasmRunner.exports),
  );
  // Structural invariant validation is derived validation — inside the
  // same explicit validation phase.
  await timedPhase(helperTimings, "validation", () => {
    for (const layers of [jsLayers, wasmLayers]) {
      for (
        const check of mlpStructuralChecks(layers, mlpRef.references, mlpRef.pres, mlpRef.bounds)
      ) {
        assert(check.passed, `ml-dense-mlp ${check.id}: ${check.detail}`);
      }
    }
  });
});
