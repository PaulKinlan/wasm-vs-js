import {
  addFormats,
  Ajv2020,
  assert,
  assertEquals,
  catalog,
  checkFiniteAndZero,
  digestOf,
  frozenExp,
  frozenTanh,
  geluFrozenF64,
  gemm,
  gemmFixture,
  gemmWasm,
  instantiate,
  mlp,
  mlpFixture,
  mlpWasm,
  validateProposalProvenanceSemantics,
  verifyManifestEvidence,
} from "./ml-neural-shared.ts";

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

Deno.test("NaN policy rejects non-finite values and zero policy detects -0", () => {
  const poisoned = new Float32Array([1, NaN, 2]);
  assert(!checkFiniteAndZero(poisoned).finite, "NaN accepted");
  const negativeZero = new Float32Array([1, -0, 2]);
  assert(!checkFiniteAndZero(negativeZero).negativeZeroFree, "-0 accepted");
  const clean = new Float32Array([1, 0, 2]);
  const health = checkFiniteAndZero(clean);
  assert(health.finite && health.negativeZeroFree, "clean input rejected");
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
