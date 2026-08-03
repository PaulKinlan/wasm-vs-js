import {
  assert,
  assertEquals,
  assertRepetitions,
  boundCheck,
  digestOf,
  emptyPhaseTimings,
  gemm,
  GemmJsRunner,
  gemmReference,
  gemmWasm,
  GemmWasmRunner,
  gemmWorkCounters,
  mlp,
  mlpJsLayerOutputs,
  MlpJsRunner,
  mlpReference,
  MlpWasmRunner,
  mlpWorkCounters,
  timedPhase,
} from "./ml-neural-shared.ts";

Deno.test("work counters are exact per target and repetitions are validated", async () => {
  assertEquals(gemmWorkCounters("javascript"), {
    batch: 4,
    "output-elements": 1048576,
    "multiply-accumulates": 536870912,
    loads: 1074790400,
    stores: 1048576,
    "tensor-bytes": 12582912,
    allocations: 0,
    "boundary-crossings": 0,
  });
  assertEquals(gemmWorkCounters("wasm-linear")["boundary-crossings"], 4);
  assertEquals(mlpWorkCounters("javascript"), {
    layers: 9,
    "output-elements": 147456,
    "multiply-accumulates": 75497472,
    "activation-evaluations": 131072,
    "tensor-bytes": 9521152,
    "scratch-bytes": 131072,
    allocations: 0,
    "boundary-crossings": 0,
  });
  assertEquals(mlpWorkCounters("wasm-linear")["boundary-crossings"], 17);

  for (const bad of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    let threw = false;
    try {
      assertRepetitions(bad);
    } catch {
      threw = true;
    }
    assert(threw, `repetitions ${bad} accepted`);
  }

  const { a, b, c0 } = gemm.generateInput();
  const jsRunner = GemmJsRunner.prepare(emptyPhaseTimings());
  jsRunner.transfer(a, b, c0);
  let rejected = false;
  try {
    jsRunner.run(1.5);
  } catch {
    rejected = true;
  }
  assert(rejected, "fractional repetitions accepted by JS runner");
  const wasmRunner = await GemmWasmRunner.prepare(gemmWasm, a, b, c0, emptyPhaseTimings());
  wasmRunner.transfer();
  rejected = false;
  try {
    wasmRunner.run(0);
  } catch {
    rejected = true;
  }
  assert(rejected, "zero repetitions accepted by Wasm runner");

  // Two repetitions with reset between them reproduce the single-repetition
  // output exactly (the reset interface restores initial C).
  jsRunner.run(1);
  const single = jsRunner.output().slice();
  jsRunner.run(2);
  assertEquals(await digestOf(jsRunner.output()), await digestOf(single));
});

Deno.test("phase contract exposes and MEASURES all six phases for ALL FOUR controlled variants", async () => {
  const phases = [
    "load",
    "initialize",
    "transfer",
    "compute",
    "validation",
    "reset",
    "end-to-end",
  ] as const;
  const measured = [
    "load",
    "initialize",
    "transfer",
    "compute",
    "validation",
    "end-to-end",
  ] as const;

  const { a, b, c0 } = gemm.generateInput();
  const gemmRef = gemmReference(a, b, c0);
  const { x, w, bias } = mlp.generateInput();
  // The JS per-layer trajectory and oracle derivation run inside the JS
  // MLP variant's validation phase below (captured forward to the Wasm
  // variant); no controlled trajectory executes outside a validation
  // timer in this test.
  let mlpRef: ReturnType<typeof mlpReference> | undefined;
  const layerSize = mlp.MLP_BATCH * mlp.WIDTH;

  const variants: {
    label: string;
    run: (timings: ReturnType<typeof emptyPhaseTimings>) => Promise<void>;
    rerun: (timings: ReturnType<typeof emptyPhaseTimings>) => Promise<void>;
  }[] = [
    {
      label: "ml-gemm js-controlled",
      run: async (timings) => {
        await timedPhase(timings, "load", async () => {
          await Deno.readFile("benchmarks/v2/ml-gemm/workload.js");
          await import(
            new URL(
              `../../benchmarks/v2/ml-gemm/workload.js?load=${Date.now()}-gemm`,
              import.meta.url,
            ).href
          );
        });
        const runner = GemmJsRunner.prepare(timings);
        runner.transfer(a, b, c0);
        runner.run(1);
        await timedPhase(timings, "validation", () => {
          assert(boundCheck(runner.output(), gemmRef.reference, gemmRef.bound).maxBoundRatio < 1);
        });
      },
      rerun: (timings) => {
        const runner = GemmJsRunner.prepare(timings);
        runner.transfer(a, b, c0);
        runner.run(1);
        return Promise.resolve();
      },
    },
    {
      label: "ml-gemm wasm-linear-controlled",
      run: async (timings) => {
        const bytes = await timedPhase(
          timings,
          "load",
          () => Deno.readFile("artifacts/v2/ml-gemm/ml-gemm.wasm"),
        );
        const runner = await GemmWasmRunner.prepare(bytes, a, b, c0, timings);
        runner.transfer();
        runner.run(1);
        await timedPhase(timings, "validation", () => {
          assert(boundCheck(runner.output(), gemmRef.reference, gemmRef.bound).maxBoundRatio < 1);
        });
      },
      rerun: async (timings) => {
        const bytes = await timedPhase(
          timings,
          "load",
          () => Deno.readFile("artifacts/v2/ml-gemm/ml-gemm.wasm"),
        );
        const runner = await GemmWasmRunner.prepare(bytes, a, b, c0, timings);
        runner.transfer();
        runner.run(1);
      },
    },
    {
      label: "ml-dense-mlp js-controlled",
      run: async (timings) => {
        await timedPhase(timings, "load", async () => {
          await Deno.readFile("benchmarks/v2/ml-dense-mlp/workload.js");
          await import(
            new URL(
              `../../benchmarks/v2/ml-dense-mlp/workload.js?load=${Date.now()}-mlp`,
              import.meta.url,
            ).href
          );
          // The frozen-transcendental dependency must be re-evaluated
          // inside the load phase too (its power-table init is load work).
          await import(
            new URL(
              `../../benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js?load=${Date.now()}-dep`,
              import.meta.url,
            ).href
          );
        });
        const runner = MlpJsRunner.prepare(timings);
        runner.transfer(x, w, bias);
        runner.run(1);
        await timedPhase(timings, "validation", () => {
          mlpRef = mlpReference(x, w, bias, mlpJsLayerOutputs(x, w, bias));
          const reference = mlpRef.references[mlp.LAYERS - 1];
          const bound = mlpRef.bounds[mlp.LAYERS - 1];
          assert(boundCheck(runner.output(), reference, bound).maxBoundRatio < 1);
        });
      },
      rerun: (timings) => {
        const runner = MlpJsRunner.prepare(timings);
        runner.transfer(x, w, bias);
        runner.run(1);
        return Promise.resolve();
      },
    },
    {
      label: "ml-dense-mlp wasm-linear-controlled",
      run: async (timings) => {
        const bytes = await timedPhase(
          timings,
          "load",
          () => Deno.readFile("artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm"),
        );
        const runner = await MlpWasmRunner.prepare(bytes, x, w, bias, timings);
        runner.run(1);
        await timedPhase(timings, "validation", () => {
          if (!mlpRef) throw new Error("JS MLP validation must run first (oracle capture)");
          const reference = mlpRef.references[mlp.LAYERS - 1];
          const bound = mlpRef.bounds[mlp.LAYERS - 1];
          assert(boundCheck(runner.output(), reference, bound).maxBoundRatio < 1);
        });
      },
      rerun: async (timings) => {
        const bytes = await timedPhase(
          timings,
          "load",
          () => Deno.readFile("artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm"),
        );
        const runner = await MlpWasmRunner.prepare(bytes, x, w, bias, timings);
        runner.run(1);
      },
    },
  ];

  for (const { label, run, rerun } of variants) {
    const timings = emptyPhaseTimings();
    for (const phase of phases) {
      assert(Object.hasOwn(timings, phase), `${label}: missing phase ${phase}`);
    }
    await run(timings);
    for (const phase of measured) {
      assert(timings[phase] > 0, `${label}: phase ${phase} not measured (${timings[phase]})`);
    }
    assert(
      timings["end-to-end"] >= timings.compute,
      `${label}: end-to-end ${timings["end-to-end"]} < compute ${timings.compute}`,
    );
    // End-to-end additivity on rerun for EVERY variant: the deltas must
    // satisfy delta(e2e) >= delta(compute) > 0, and validation stays
    // separate (no validation time added by run()).
    const e2eBefore = timings["end-to-end"];
    const computeBefore = timings.compute;
    const validationBefore = timings.validation;
    await rerun(timings);
    const e2eDelta = timings["end-to-end"] - e2eBefore;
    const computeDelta = timings.compute - computeBefore;
    assert(computeDelta > 0, `${label}: rerun added no compute time`);
    assert(
      e2eDelta >= computeDelta,
      `${label}: rerun e2e delta ${e2eDelta} < compute delta ${computeDelta}`,
    );
    assert(timings.validation === validationBefore, `${label}: validation leaked into run()`);
  }
  assert(layerSize > 0);
});
