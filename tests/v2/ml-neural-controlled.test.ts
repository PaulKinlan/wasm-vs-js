import {
  assert,
  assertEquals,
  boundCheck,
  checkFiniteAndZero,
  digestOf,
  emptyPhaseTimings,
  gemm,
  GemmJsRunner,
  gemmReference,
  gemmWasm,
  GemmWasmRunner,
  mlp,
  mlpJsLayerOutputs,
  mlpReference,
  mlpWasm,
  mlpWasmLayerOutputs,
  MlpWasmRunner,
  timedPhase,
} from "./ml-neural-shared.ts";

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
