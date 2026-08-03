import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "../assert.ts";
import {
  assertRepetitions,
  boundCheck,
  checkFiniteAndZero,
  digestOf,
  emptyPhaseTimings,
  GemmJsRunner,
  gemmReference,
  gemmStructuralChecks,
  GemmWasmRunner,
  gemmWorkCounters,
  mlpJsLayerOutputs,
  MlpJsRunner,
  mlpReference,
  mlpStructuralChecks,
  mlpWasmLayerOutputs,
  MlpWasmRunner,
  mlpWorkCounters,
  timedPhase,
} from "../../lib/v2/neural.ts";
import { validateProposalProvenanceSemantics } from "../../benchmarks/v2/shared/provenance-contract.js";
import * as gemm from "../../benchmarks/v2/ml-gemm/workload.js";
import * as mlp from "../../benchmarks/v2/ml-dense-mlp/workload.js";
import {
  frozenExp,
  frozenTanh,
  geluFrozenF64,
} from "../../benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js";
import {
  allocationsCreated,
  resetAllocationCount,
} from "../../benchmarks/v2/shared/allocations.js";
import { verifyManifestEvidence } from "../../lib/v2/manifest-evidence.ts";

type ValidationError = { instancePath?: string; message?: string };
type Validator = ((value: unknown) => boolean) & { errors?: ValidationError[] | null };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

const gemmWasm = await Deno.readFile("artifacts/v2/ml-gemm/ml-gemm.wasm");
const mlpWasm = await Deno.readFile("artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm");
const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));

const gemmFixture = JSON.parse(
  await Deno.readTextFile("artifacts/v2/ml-gemm/fixture-manifest.json"),
);
const mlpFixture = JSON.parse(
  await Deno.readTextFile("artifacts/v2/ml-dense-mlp/fixture-manifest.json"),
);

async function instantiate(bytes: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(bytes as Uint8Array<ArrayBuffer>);
  return instance.exports as unknown as {
    memory: WebAssembly.Memory;
    gemm_f32?: (a: number, b: number, c: number, m: number, n: number, k: number) => void;
    linear_f32?: (x: number, w: number, b: number, y: number, batch: number, width: number) => void;
    gelu_f32?: (ptr: number, len: number) => void;
    exp_f64?: (x: number) => number;
    tanh_f64?: (x: number) => number;
  };
}

Deno.test("ml-gemm fixture is deterministic and matches the frozen manifest", async () => {
  const first = gemm.generateInput();
  const second = gemm.generateInput();
  assertEquals(await digestOf(first.a), await digestOf(second.a));
  assertEquals(await digestOf(first.a), gemmFixture.tensors.a.sha256);
  assertEquals(await digestOf(first.b), gemmFixture.tensors.b.sha256);
  assertEquals(await digestOf(first.c0), gemmFixture.tensors.c0.sha256);
});

Deno.test("ml-dense-mlp fixture is deterministic and matches the frozen manifest", async () => {
  const first = mlp.generateInput();
  const second = mlp.generateInput();
  assertEquals(await digestOf(first.x), await digestOf(second.x));
  assertEquals(await digestOf(first.x), mlpFixture.tensors.x.sha256);
  assertEquals(await digestOf(first.w), mlpFixture.tensors.w.sha256);
  assertEquals(await digestOf(first.bias), mlpFixture.tensors.bias.sha256);
});

Deno.test("independent hand-computed GEMM oracle holds exactly in both targets", async () => {
  // 2x2 product with initial C; every value is an exact binary fraction, so
  // the expected result is exact by construction, with no implementation-
  // generated digest involved. C[0][0] = 0.125 + 0.5*2 + 0.25*0.5 = 1.25;
  // C[0][1] = -0.5 + 0.5*(-1) + 0.25*3 = -0.25;
  // C[1][0] = 1 + 1.5*2 + (-0.75)*0.5 = 3.625;
  // C[1][1] = 0.25 + 1.5*(-1) + (-0.75)*3 = -3.5.
  const a = new Float32Array([0.5, 0.25, 1.5, -0.75]);
  const b = new Float32Array([2, -1, 0.5, 3]);
  const c0 = new Float32Array([0.125, -0.5, 1, 0.25]);
  const expected = [1.25, -0.25, 3.625, -3.5];
  const c = new Float32Array(c0);
  gemm.gemmMatrixF32(a, b, c0, c, 2, 2, 2);
  assertEquals([...c], expected);

  const exports = await instantiate(gemmWasm);
  const view = new Float32Array(exports.memory.buffer);
  view.set(a, 0);
  view.set(b, 4);
  view.set(c0, 8);
  exports.gemm_f32!(0, 16, 32, 2, 2, 2);
  assertEquals([...view.slice(8, 12)], expected);
});

Deno.test("independent hand-computed MLP oracle holds exactly in both targets", async () => {
  // batch 2, width 2, one hidden layer plus projection. Hidden pre-
  // activations are 24, -24, 0, 0: GELU saturates to exactly 24, 0, 0, 0.
  // Projection: [0.25 + 24*0.5, -0.5 + 24*(-0.25)] = [12.25, -6.5] and
  // [0.25, -0.5] for the zero row. All values are exact binary fractions.
  const x = new Float32Array([0.5, -0.25, 0, 0]);
  const w = new Float32Array([
    48,
    -48,
    0,
    0, // hidden weights
    0.5,
    -0.25,
    0.125,
    1, // projection weights
  ]);
  const bias = new Float32Array([0, 0, 0.25, -0.5]);
  const scratchA = new Float32Array(4);
  const scratchB = new Float32Array(4);
  const y = new Float32Array(4);
  mlp.mlpControlled(x, w, bias, scratchA, scratchB, y, { batch: 2, width: 2, hiddenLayers: 1 });
  assertEquals([...y], [12.25, -6.5, 0.25, -0.5]);

  const exports = await instantiate(mlpWasm);
  const view = new Float32Array(exports.memory.buffer);
  view.set(x, 0); // x: bytes 0-15
  view.set(w, 4); // w: bytes 16-47
  view.set(bias, 12); // bias: bytes 48-63
  exports.linear_f32!(0, 16, 48, 64, 2, 2); // hidden -> scratch at byte 64
  exports.gelu_f32!(64, 4);
  exports.linear_f32!(64, 32, 56, 80, 2, 2); // projection -> y at byte 80
  assertEquals([...view.slice(20, 24)], [12.25, -6.5, 0.25, -0.5]);
});

Deno.test("frozen f64 exp and tanh match Math across the full reachable domain", async () => {
  // Swept to +-18.1: $tanh_f64 saturates outside |x| >= 9.011, so the
  // reachable $exp_f64 domain is (-18.022, 18.022); the sweep covers it
  // with margin. The same sweep verifies the JavaScript frozen module
  // against Math (frozen-vs-ideal accuracy, independent of the targets).
  const exports = await instantiate(mlpWasm);
  let maxExp = 0;
  let maxTanh = 0;
  let maxExpJs = 0;
  let maxTanhJs = 0;
  for (let step = -724; step <= 724; step += 1) {
    const x = step / 40;
    const expDiff = Math.abs(exports.exp_f64!(x) - Math.exp(x)) / Math.exp(x);
    if (expDiff > maxExp) maxExp = expDiff;
    const expDiffJs = Math.abs(frozenExp(x) - Math.exp(x)) / Math.exp(x);
    if (expDiffJs > maxExpJs) maxExpJs = expDiffJs;
    const tanhDiff = Math.abs(exports.tanh_f64!(x) - Math.tanh(x)) /
      Math.max(Math.abs(Math.tanh(x)), 1e-300);
    if (Math.abs(x) < 8.9 && tanhDiff > maxTanh) maxTanh = tanhDiff;
    const tanhDiffJs = Math.abs(frozenTanh(x) - Math.tanh(x)) /
      Math.max(Math.abs(Math.tanh(x)), 1e-300);
    if (Math.abs(x) < 8.9 && tanhDiffJs > maxTanhJs) maxTanhJs = tanhDiffJs;
  }
  assert(maxExp < 1e-12, `wasm exp max relative deviation ${maxExp}`);
  assert(maxTanh < 1e-12, `wasm tanh max relative deviation ${maxTanh}`);
  assert(maxExpJs < 1e-12, `js exp max relative deviation ${maxExpJs}`);
  assert(maxTanhJs < 1e-12, `js tanh max relative deviation ${maxTanhJs}`);
});

Deno.test("frozen transcendental guards and NaN policy are aligned across targets", async () => {
  const exports = await instantiate(mlpWasm);
  // Guard behaviour: identical frozen semantics in both targets.
  assertEquals(exports.exp_f64!(709.8), Infinity);
  assertEquals(frozenExp(709.8), Infinity);
  assertEquals(exports.exp_f64!(-708.5), 0);
  assertEquals(frozenExp(-708.5), 0);
  // NaN propagates in both targets; the Wasm kernel must not trap.
  assert(Number.isNaN(exports.exp_f64!(NaN)), "wasm exp(NaN) did not propagate");
  assert(Number.isNaN(frozenExp(NaN)), "js exp(NaN) did not propagate");
  assert(Number.isNaN(exports.tanh_f64!(NaN)), "wasm tanh(NaN) did not propagate");
  assert(Number.isNaN(frozenTanh(NaN)), "js tanh(NaN) did not propagate");
  const geluView = new Float32Array(exports.memory.buffer, 0, 1);
  geluView[0] = NaN;
  exports.gelu_f32!(0, 1);
  assert(Number.isNaN(geluView[0]), "wasm gelu(NaN) trapped or changed policy");
  const jsGelu = new Float32Array([NaN]);
  mlp.geluInPlace(jsGelu);
  assert(Number.isNaN(jsGelu[0]), "js gelu(NaN) changed policy");
});

Deno.test("frozen GELU is bit-identical across JS and Wasm for every probed finite value", async () => {
  // The controlled semantics is ONE frozen algorithm: the JavaScript frozen
  // module and the Wasm kernel implement identical IEEE 754 operation
  // order, so the f32 outputs must be bit-identical, not merely close.
  // Includes the adversarial probe from independent review
  // (-5.411375522613525, where a previous revision diverged to +0 vs
  // -1.18e-8) plus saturation edges, denormals, and extremes.
  const exports = await instantiate(mlpWasm);
  const view = new Float32Array(exports.memory.buffer);
  const probes: number[] = [-5.411375522613525];
  for (let step = -2000; step <= 2000; step += 1) probes.push(step * 0.004);
  for (const x of [9.011, -9.011, 5.157878875732422, -5.157878875732422]) probes.push(x);
  for (const x of [3.4e38, -3.4e38, 1e-38, -1e-38, 1e-45, -1e-45, 0]) probes.push(x);
  const jsOut = new Float32Array(probes.length);
  for (let index = 0; index < probes.length; index += 1) {
    jsOut[index] = Math.fround(geluFrozenF64(Math.fround(probes[index]))) + 0;
  }
  view.set(jsOut.map((_, index) => Math.fround(probes[index])), 0);
  exports.gelu_f32!(0, probes.length);
  const wasmOut = view.slice(0, probes.length);
  const jsBits = new Uint32Array(jsOut.buffer);
  const wasmBits = new Uint32Array(wasmOut.buffer, wasmOut.byteOffset, probes.length);
  for (let index = 0; index < probes.length; index += 1) {
    assert(
      jsBits[index] === wasmBits[index],
      `gelu bit mismatch at ${probes[index]}: js ${jsOut[index]} wasm ${wasmOut[index]}`,
    );
  }
});

Deno.test("independent non-saturated GELU oracle (60-digit decimal reference)", async () => {
  // Expected values computed with 80-digit Decimal arithmetic (range-reduced
  // exp series) in CPython, independent of both targets and of Math.tanh;
  // truncated to 17 significant digits, asserted with 1e-9 tolerance.
  const points = [
    { p: -3.25, expected: -1.56862714474746810e-3 },
    { p: -2.5, expected: -1.50842660899985778e-2 },
    { p: -1.75, expected: -7.02046176587486611e-2 },
    { p: -1.0, expected: -1.58808009391723283e-1 },
    { p: -0.5, expected: -1.54285990174856073e-1 },
    { p: -0.125, expected: -5.62828013757766118e-2 },
    { p: 0.25, expected: 1.49675350701685002e-1 },
    { p: 0.75, expected: 5.79960555165620313e-1 },
    { p: 1.5, expected: 1.39957157698023294e+0 },
    { p: 2.25, expected: 2.22279867010271140e+0 },
    { p: 3.5, expected: 3.49938380234462634e+0 },
  ];
  const exports = await instantiate(mlpWasm);
  const view = new Float32Array(exports.memory.buffer);
  for (const { p, expected } of points) {
    const js = geluFrozenF64(p);
    const rel = Math.abs(js - expected) / Math.max(Math.abs(expected), 1e-300);
    assert(rel < 1e-9, `js frozen gelu(${p}) = ${js}, expected ${expected}`);
    view[0] = Math.fround(p);
    exports.gelu_f32!(0, 1);
    // f32 quantization alone contributes up to ~4e-8 relative at these
    // magnitudes; algorithmic equivalence to the f64 frozen path is asserted
    // bit-exactly by the cross-target bit-identity test above.
    const relWasm = Math.abs(view[0] - expected) / Math.max(Math.abs(expected), 1e-300);
    assert(relWasm < 1e-6, `wasm frozen gelu(${p}) = ${view[0]}, expected ${expected}`);
  }
});

Deno.test("ml-gemm controlled targets satisfy every oracle check against stored bounds", async () => {
  const { a, b, c0 } = gemm.generateInput();
  const referenceBytes = new Float64Array(
    (await Deno.readFile("artifacts/v2/ml-gemm/reference.f64")).buffer,
  );
  const bound = new Float32Array((await Deno.readFile("artifacts/v2/ml-gemm/bounds.f32")).buffer);

  // Re-derived reference matches the stored one (pinned reference check).
  const derived = gemmReference(a, b, c0);
  assertEquals(await digestOf(derived.reference), await digestOf(referenceBytes));
  assertEquals(await digestOf(derived.bound), await digestOf(bound));

  const jsRunner = GemmJsRunner.prepare(emptyPhaseTimings());
  jsRunner.transfer(a, b, c0);
  jsRunner.run(1);
  const wasmRunner = await GemmWasmRunner.prepare(gemmWasm, a, b, c0, emptyPhaseTimings());
  wasmRunner.transfer();
  wasmRunner.run(1);

  for (const [label, out] of [["js", jsRunner.output()], ["wasm", wasmRunner.output()]] as const) {
    const { maxBoundRatio } = boundCheck(out, referenceBytes, bound);
    assert(maxBoundRatio < 1, `${label} bound ratio ${maxBoundRatio}`);
    const health = checkFiniteAndZero(out);
    assert(health.finite, `${label} non-finite output (NaN policy reject)`);
    assert(health.negativeZeroFree, `${label} negative zero leaked (normalize-positive)`);
  }
});

Deno.test("ml-dense-mlp controlled targets satisfy per-layer oracle checks", async () => {
  const { x, w, bias } = mlp.generateInput();
  const referenceBytes = new Float64Array(
    (await Deno.readFile("artifacts/v2/ml-dense-mlp/reference.f64")).buffer,
  );
  const boundBytes = new Float32Array(
    (await Deno.readFile("artifacts/v2/ml-dense-mlp/bounds.f32")).buffer,
  );
  const layerSize = mlp.MLP_BATCH * mlp.WIDTH;
  // This test validates the oracle helpers themselves; the trajectory and
  // derivation are wrapped explicitly in a validation phase (helper
  // validation, not phase evidence).
  const helperTimings = emptyPhaseTimings();
  const derived = await timedPhase(
    helperTimings,
    "validation",
    () => mlpReference(x, w, bias, mlpJsLayerOutputs(x, w, bias)),
  );
  assert(helperTimings.validation > 0, "oracle derivation untimed");
  const derivedRefBytes = new Float64Array(mlp.LAYERS * layerSize);
  derived.references.forEach((layer, index) => derivedRefBytes.set(layer, index * layerSize));
  assertEquals(await digestOf(derivedRefBytes), await digestOf(referenceBytes));

  const wasmRunner = await MlpWasmRunner.prepare(mlpWasm, x, w, bias, emptyPhaseTimings());
  // The JS trajectory and every derived per-layer bound/finite/signed-zero
  // validation run inside an explicit validation phase (helper validation,
  // not phase evidence).
  const jsLayers = await timedPhase(
    helperTimings,
    "validation",
    () => mlpJsLayerOutputs(x, w, bias),
  );
  const wasmLayers = await timedPhase(
    helperTimings,
    "validation",
    () => mlpWasmLayerOutputs(wasmRunner.exports),
  );
  await timedPhase(helperTimings, "validation", () => {
    for (let layer = 0; layer < mlp.LAYERS; layer += 1) {
      const reference = referenceBytes.subarray(layer * layerSize, (layer + 1) * layerSize);
      const bound = boundBytes.subarray(layer * layerSize, (layer + 1) * layerSize);
      for (const [label, out] of [["js", jsLayers[layer]], ["wasm", wasmLayers[layer]]] as const) {
        const { maxBoundRatio } = boundCheck(out, reference, bound);
        assert(maxBoundRatio < 1, `layer ${layer} ${label} bound ratio ${maxBoundRatio}`);
        const health = checkFiniteAndZero(out);
        assert(health.finite, `layer ${layer} ${label} non-finite`);
        assert(health.negativeZeroFree, `layer ${layer} ${label} negative zero`);
      }
    }
  });
});

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

Deno.test("NaN policy rejects non-finite values and zero policy detects -0", () => {
  const poisoned = new Float32Array([1, NaN, 2]);
  assert(!checkFiniteAndZero(poisoned).finite, "NaN accepted");
  const negativeZero = new Float32Array([1, -0, 2]);
  assert(!checkFiniteAndZero(negativeZero).negativeZeroFree, "-0 accepted");
  const clean = new Float32Array([1, 0, 2]);
  const health = checkFiniteAndZero(clean);
  assert(health.finite && health.negativeZeroFree, "clean input rejected");
});

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

Deno.test("proposal result records validate against the real JSON schema and provenance semantics", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/workload-result-v2-proposal.schema.json"),
  );
  const validateSchema = ajv.compile(schema);
  for (const slug of ["ml-gemm", "ml-dense-mlp"]) {
    for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
      const record = JSON.parse(
        await Deno.readTextFile(`artifacts/v2/${slug}/${variant}.result.json`),
      );
      assertEquals(record.workload.benchmarkSlug, slug);
      assert(
        validateSchema(record),
        `${slug}/${variant} schema: ${JSON.stringify(validateSchema.errors)}`,
      );
      const result = await validateProposalProvenanceSemantics(record, catalog, {
        repoRoot: ".",
        expectedSourceCommit: record.source.commit,
        requireLocalFiles: true,
      });
      assert(result.ok, `${slug}/${variant}: ${result.errors.join("; ")}`);
    }
  }
});

Deno.test("pinned build reproduces byte-identical artifacts AND result records", async () => {
  // Fail closed: the reproducibility gate requires the pinned toolchain,
  // exactly like the build itself. Running the gate on any other Deno is a
  // gate failure, never a skip-pass.
  const PINNED = "2.9.0";
  if (Deno.version.deno !== PINNED) {
    throw new Error(
      `pinned toolchain violation: reproducibility gate requires Deno ${PINNED}, found ${Deno.version.deno}`,
    );
  }
  const paths = [
    "artifacts/v2/ml-gemm/ml-gemm.wasm",
    "artifacts/v2/ml-gemm/fixture-manifest.json",
    "artifacts/v2/ml-gemm/input-manifest.json",
    "artifacts/v2/ml-gemm/output-manifest.json",
    "artifacts/v2/ml-gemm/reference.f64",
    "artifacts/v2/ml-gemm/bounds.f32",
    "artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm",
    "artifacts/v2/ml-dense-mlp/fixture-manifest.json",
    "artifacts/v2/ml-dense-mlp/input-manifest.json",
    "artifacts/v2/ml-dense-mlp/output-manifest.json",
    "artifacts/v2/ml-dense-mlp/reference.f64",
    "artifacts/v2/ml-dense-mlp/bounds.f32",
  ];
  const recordPaths = [
    "artifacts/v2/ml-gemm/js-controlled.result.json",
    "artifacts/v2/ml-gemm/wasm-linear-controlled.result.json",
    "artifacts/v2/ml-dense-mlp/js-controlled.result.json",
    "artifacts/v2/ml-dense-mlp/wasm-linear-controlled.result.json",
  ];
  const before: string[] = [];
  for (const path of [...paths, ...recordPaths]) before.push(await sha256File(path));
  const record = JSON.parse(
    await Deno.readTextFile("artifacts/v2/ml-gemm/js-controlled.result.json"),
  );
  const baseArgs = [
    "run",
    "--allow-read=.",
    "--allow-write=artifacts",
    "--allow-env=WASM_VS_JS_COMMIT",
    "--allow-run",
    "scripts/build-v2-neural.ts",
  ];
  for (const mode of ["artifacts", "records"]) {
    const command = new Deno.Command(Deno.execPath(), {
      args: [...baseArgs, mode],
      env: { WASM_VS_JS_COMMIT: record.source.commit },
      stdout: "piped",
      stderr: "piped",
    });
    const result = await command.output();
    if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  }
  const allPaths = [...paths, ...recordPaths];
  for (let index = 0; index < allPaths.length; index += 1) {
    assertEquals(await sha256File(allPaths[index]), before[index]);
  }
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

Deno.test("JS compute paths perform zero per-repetition semantic allocations", async () => {
  // The exact allocations: 0 counter is structural. Guard every known
  // allocation source in the measured compute path at source level:
  // typed-array views (subarray/slice), default-object parameters,
  // per-call BigInt construction, and fresh typed arrays inside compute
  // functions. generateInput may allocate (fixture creation, outside
  // repetition); module-level init in frozen-transcendentals.js may
  // allocate (one-time load, outside repetition).
  for (
    const sourcePath of [
      "benchmarks/v2/ml-gemm/workload.js",
      "benchmarks/v2/ml-dense-mlp/workload.js",
    ]
  ) {
    const source = await Deno.readTextFile(sourcePath);
    const marker = "export function generateInput";
    const start = source.indexOf(marker);
    assert(start >= 0, `${sourcePath} missing generateInput`);
    const end = source.indexOf("\n}\n", start);
    assert(end > start, `${sourcePath} malformed generateInput`);
    const computeSource = source.slice(0, start) + source.slice(end + 3);
    for (
      const pattern of [
        /\.subarray\(/,
        /\.slice\(/,
        /BigInt\(/,
        /= \{\}\)/,
        /new (Float32Array|Float64Array|ArrayBuffer|DataView)\(/,
      ]
    ) {
      assert(
        !pattern.test(computeSource),
        `${sourcePath} compute path allocates via ${pattern}`,
      );
    }
  }

  // The frozen transcendental module: no BigInt anywhere, and no typed-array
  // construction inside the exported (measured) function bodies — only the
  // one-time module-init table may allocate.
  const frozen = await Deno.readTextFile(
    "benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js",
  );
  assert(!/BigInt\(/.test(frozen), "frozen-transcendentals calls BigInt (per-call allocation)");
  for (const name of ["frozenExp", "frozenTanh", "geluFrozenF64", "pow2Exact"]) {
    const marker = `function ${name}`;
    const start = frozen.indexOf(marker);
    assert(start >= 0, `frozen-transcendentals missing ${name}`);
    const bodyEnd = frozen.indexOf("\n}\n", start);
    assert(bodyEnd > start, `frozen-transcendentals malformed ${name}`);
    const body = frozen.slice(start, bodyEnd);
    assert(
      !/new (Float32Array|Float64Array|ArrayBuffer|DataView|Array)\(/.test(body),
      `${name} allocates per call`,
    );
  }
});

Deno.test("records-mode evidence verification rejects omissions, duplicates, and mutations", async () => {
  // Negative mutation testing: an unmutated manifest passes; every targeted
  // mutation is rejected before any record could be marked passed.
  for (const slug of ["ml-gemm", "ml-dense-mlp"]) {
    const entry = catalog.entries.find((candidate: { id: string }) =>
      candidate.id === (slug === "ml-gemm" ? "ml.gemm.v1" : "ml.dense-mlp.v1")
    );
    const valid = JSON.parse(
      await Deno.readTextFile(`artifacts/v2/${slug}/output-manifest.json`),
    );
    // Positive control.
    verifyManifestEvidence(slug, entry, JSON.parse(JSON.stringify(valid)));

    const expectReject = (label: string, mutate: (m: Record<string, unknown>) => void) => {
      const mutated = JSON.parse(JSON.stringify(valid));
      mutate(mutated);
      let rejected = false;
      try {
        verifyManifestEvidence(slug, entry, mutated);
      } catch {
        rejected = true;
      }
      assert(rejected, `${slug}: mutation not rejected: ${label}`);
    };

    const variantIds = ["js-controlled", "wasm-linear-controlled"];
    expectReject("missing finite-values structural entry", (m) => {
      const checks = (m.structuralChecks as Record<string, { id: string }[]>)["js-controlled"];
      const index = checks.findIndex((check) => check.id === "finite-values");
      checks.splice(index, 1);
    });
    expectReject("duplicate structural id", (m) => {
      const checks = (m.structuralChecks as Record<string, { id: string; passed: boolean }[]>)[
        "wasm-linear-controlled"
      ];
      checks.push({ id: checks[0].id, passed: true });
    });
    expectReject("missing variant structural checks", (m) => {
      delete (m.structuralChecks as Record<string, unknown>)["wasm-linear-controlled"];
    });
    expectReject("structural check marked failed", (m) => {
      (m.structuralChecks as Record<string, { passed: boolean }[]>)["js-controlled"][0].passed =
        false;
    });
    expectReject("phase attestation value mismatch", (m) => {
      (m.phases as Record<string, Record<string, string>>)["js-controlled"].load = "separate";
    });
    expectReject("phase attestation key missing", (m) => {
      delete (m.phases as Record<string, Record<string, string>>)["js-controlled"].render;
    });
    expectReject("phase attestation extra key", (m) => {
      (m.phases as Record<string, Record<string, string>>)["js-controlled"].bogus = "measured";
    });
    expectReject("missing variant phase attestation", (m) => {
      delete (m.phases as Record<string, unknown>)["wasm-linear-controlled"];
    });
    expectReject("bound ratio at 1", (m) => {
      if (m.boundChecks) {
        (m.boundChecks as Record<string, { maxBoundRatio: number }>)["js-controlled"]
          .maxBoundRatio = 1;
      } else {
        (m.layerChecks as { js: { maxBoundRatio: number } }[])[0].js.maxBoundRatio = 1;
      }
    });
    expectReject("counter value mutated", (m) => {
      const counters = (m.counters as Record<string, Record<string, number>>)["js-controlled"];
      counters[Object.keys(counters)[0]] += 1;
    });
    expectReject("counter id missing", (m) => {
      const counters = (m.counters as Record<string, Record<string, number>>)["js-controlled"];
      delete counters[Object.keys(counters)[0]];
    });
    expectReject("oracle check id omitted", (m) => {
      (m.oracleChecks as string[]).pop();
    });
    expectReject("duplicate oracle check id", (m) => {
      (m.oracleChecks as string[]).push((m.oracleChecks as string[])[0]);
    });
    // Top-level falsey wrong-typed mutations must reject exactly like
    // truthy ones (presence/type checks, never truthiness).
    for (const falsey of [null, false, 0, ""]) {
      expectReject(`structuralChecks = ${JSON.stringify(falsey)}`, (m) => {
        (m as Record<string, unknown>).structuralChecks = falsey;
      });
      expectReject(`phases = ${JSON.stringify(falsey)}`, (m) => {
        (m as Record<string, unknown>).phases = falsey;
      });
      expectReject(`counters = ${JSON.stringify(falsey)}`, (m) => {
        (m as Record<string, unknown>).counters = falsey;
      });
      expectReject(`oracleChecks = ${JSON.stringify(falsey)}`, (m) => {
        (m as Record<string, unknown>).oracleChecks = falsey;
      });
    }
    if (slug === "ml-gemm") {
      for (const falsey of [null, false, 0, ""]) {
        expectReject(`gemm crossTarget = ${JSON.stringify(falsey)}`, (m) => {
          (m as Record<string, unknown>).crossTarget = falsey;
        });
        expectReject(`gemm boundChecks = ${JSON.stringify(falsey)}`, (m) => {
          (m as Record<string, unknown>).boundChecks = falsey;
        });
      }
    } else {
      for (const falsey of [null, false, 0, ""]) {
        expectReject(`mlp boundChecks = ${JSON.stringify(falsey)}`, (m) => {
          (m as Record<string, unknown>).boundChecks = falsey;
        });
        expectReject(`mlp crossTarget = ${JSON.stringify(falsey)}`, (m) => {
          (m as Record<string, unknown>).crossTarget = falsey;
        });
        expectReject(`mlp layerChecks = ${JSON.stringify(falsey)}`, (m) => {
          (m as Record<string, unknown>).layerChecks = falsey;
        });
      }
    }
    expectReject("extra bogus variant in structuralChecks", (m) => {
      (m.structuralChecks as Record<string, unknown>)["bogus-variant"] = [];
    });
    expectReject("extra bogus variant in phases", (m) => {
      (m.phases as Record<string, unknown>)["bogus-variant"] = {};
    });
    expectReject("extra bogus variant in counters", (m) => {
      (m.counters as Record<string, unknown>)["bogus-variant"] = {};
    });
    if (slug === "ml-gemm") {
      expectReject("missing per-variant bound evidence", (m) => {
        delete (m.boundChecks as Record<string, unknown>)["wasm-linear-controlled"];
      });
      expectReject("extra bound evidence key", (m) => {
        (m.boundChecks as Record<string, unknown>)["bogus"] = {
          maxBoundRatio: 0,
          maxDeviation: 0,
        };
      });
      expectReject("missing maxDeviation in bound result", (m) => {
        delete (m.boundChecks as Record<string, Record<string, unknown>>)["js-controlled"]
          .maxDeviation;
      });
      expectReject("extra field in bound result", (m) => {
        (m.boundChecks as Record<string, Record<string, unknown>>)["js-controlled"].extra = 1;
      });
      expectReject("extra field in gemm crossTarget", (m) => {
        (m.boundChecks as Record<string, Record<string, unknown>>).crossTarget.extra = 1;
      });
    } else {
      expectReject("incomplete per-layer bound evidence", (m) => {
        (m.layerChecks as unknown[]).pop();
      });
      expectReject("missing crossTarget bound evidence", (m) => {
        delete (m as { crossTarget?: unknown }).crossTarget;
      });
      expectReject("duplicate/out-of-order layer id", (m) => {
        (m.layerChecks as { layer: number }[])[3].layer = 2;
      });
      expectReject("wrong layer id", (m) => {
        (m.layerChecks as { layer: number }[])[0].layer = 99;
      });
      expectReject("extra per-layer field", (m) => {
        (m.layerChecks as Record<string, unknown>[])[0].extra = { maxBoundRatio: 0 };
      });
      expectReject("missing per-layer wasm field", (m) => {
        delete (m.layerChecks as Record<string, unknown>[])[0].wasm;
      });
      expectReject("missing per-layer maxDeviation", (m) => {
        delete (m.layerChecks as Record<string, Record<string, unknown>>[])[0].js.maxDeviation;
      });
      expectReject("extra field in mlp crossTarget", (m) => {
        (m as { crossTarget: Record<string, unknown> }).crossTarget.extra = 1;
      });
    }
    assert(variantIds.length === 2);
  }
});

async function sha256File(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
