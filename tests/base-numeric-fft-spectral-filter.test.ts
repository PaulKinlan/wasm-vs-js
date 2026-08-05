import Ajv2020Module from "ajv2020";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import wabtFactory from "wabt";
import { sha256Hex } from "../lib/canonical.ts";
import {
  loadNumericFftBundle,
  NumericFftBundle,
  validateNumericFftSemantics,
} from "../lib/numeric-fft-spectral-filter-validation.ts";
import {
  expectedCounters,
  generateFixture,
  generateGains,
  generateSignal,
  generateTwiddles,
  generateWindow,
  runPipelineJs,
  runPipelineWasm,
  SAMPLE_COUNT,
} from "../benchmarks/base/numeric-fft-spectral-filter/workload.js";
import {
  completeOutputSha256,
  runIndependentF64Oracle,
  validateAgainstOracle,
} from "../benchmarks/base/numeric-fft-spectral-filter/reference.ts";
import { createHandler } from "../server.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile(schema: unknown): Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

function directDftPipeline(
  signal: Float32Array,
  window: Float32Array,
  gains: Float32Array,
): Float64Array {
  const n = signal.length;
  const spectrum = new Float64Array(n * 2);
  for (let k = 0; k < n; k += 1) {
    for (let sample = 0; sample < n; sample += 1) {
      const value = Number(signal[sample]) * Number(window[sample]);
      const angle = (-2 * Math.PI * k * sample) / n;
      spectrum[k * 2] += value * Math.cos(angle);
      spectrum[k * 2 + 1] += value * Math.sin(angle);
    }
    spectrum[k * 2] *= gains[k];
    spectrum[k * 2 + 1] *= gains[k];
  }
  const output = new Float64Array(n * 2);
  for (let sample = 0; sample < n; sample += 1) {
    for (let k = 0; k < n; k += 1) {
      const angle = (2 * Math.PI * k * sample) / n;
      output[sample * 2] += spectrum[k * 2] * Math.cos(angle) -
        spectrum[k * 2 + 1] * Math.sin(angle);
      output[sample * 2 + 1] += spectrum[k * 2] * Math.sin(angle) +
        spectrum[k * 2 + 1] * Math.cos(angle);
    }
    output[sample * 2] /= n;
    output[sample * 2 + 1] /= n;
  }
  return output;
}

async function compileWat(): Promise<Uint8Array> {
  const wabt = await wabtFactory();
  const source = await Deno.readTextFile(
    "benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat",
  );
  const parsed = wabt.parseWat("numeric-fft-spectral-filter.wat", source, {
    exceptions: false,
    threads: false,
    simd: false,
    bulk_memory: false,
    memory64: false,
  });
  parsed.resolveNames();
  parsed.validate();
  const binary = parsed.toBinary({ canonicalize_lebs: true, write_debug_names: false });
  parsed.destroy();
  return new Uint8Array(binary.buffer);
}

Deno.test("frozen catalog bytes remain unchanged and supplemental registration binds the exact base ID", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  const publicCatalog = await Deno.readFile("public/data/workloads.v1.json");
  const frozenHash = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
  assertEquals(await sha256Hex(catalog), frozenHash);
  assertEquals(await sha256Hex(publicCatalog), frozenHash);
  const registration = JSON.parse(
    await Deno.readTextFile("catalog/base-implementations/numeric.fft-spectral-filter.v1.json"),
  );
  assertEquals(registration.frozenCatalog.entryId, "numeric.fft-spectral-filter.v1");
  assertEquals(registration.frozenCatalog.sha256, frozenHash);
  assertEquals(registration.fixedWork.samples, SAMPLE_COUNT);
  assertEquals(registration.fixedWork.butterflies, 20_971_520);
  assertEquals(registration.authoritativePerformanceEvidence, false);
});

Deno.test("closed numeric FFT schemas and semantic gates reject contract mutations", async () => {
  const bundle = await loadNumericFftBundle();
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemaFiles = {
    registration: "numeric-fft-spectral-filter-registration.schema.json",
    fixture: "numeric-fft-spectral-filter-fixture-manifest.schema.json",
    output: "numeric-fft-spectral-filter-output-manifest.schema.json",
    build: "numeric-fft-spectral-filter-build-manifest.schema.json",
    record: "numeric-fft-spectral-filter-validation-record.schema.json",
  } as const;
  const validators = Object.fromEntries(
    await Promise.all(
      Object.entries(schemaFiles).map(async ([name, file]) => {
        const schema = JSON.parse(await Deno.readTextFile(`schemas/${file}`));
        assert(schema.additionalProperties === false, `${file} is not closed`);
        return [name, ajv.compile(schema)];
      }),
    ),
  ) as Record<keyof typeof schemaFiles, Validator>;

  for (const name of ["registration", "fixture", "output", "build"] as const) {
    assert(validators[name](bundle[name]), `${name}: ${JSON.stringify(validators[name].errors)}`);
  }
  for (const variantId of ["js-controlled", "wasm-linear-controlled"]) {
    assert(
      validators.record(bundle.records[variantId]),
      `${variantId}: ${JSON.stringify(validators.record.errors)}`,
    );
  }
  const semantic = await validateNumericFftSemantics(bundle);
  assert(semantic.ok, semantic.errors.join("; "));

  const schemaMutations: Array<{
    label: string;
    validator: Validator;
    value: Record<string, unknown>;
  }> = [];
  const extra = structuredClone(bundle.registration);
  extra.unreviewed = true;
  schemaMutations.push({
    label: "extra property",
    validator: validators.registration,
    value: extra,
  });
  const missing = structuredClone(bundle.fixture);
  delete missing.rights;
  schemaMutations.push({ label: "missing field", validator: validators.fixture, value: missing });
  const wrongType = structuredClone(bundle.output);
  (wrongType.completeOutput as Record<string, unknown>).components = "2097152";
  schemaMutations.push({ label: "wrong type", validator: validators.output, value: wrongType });
  for (const { label, validator, value } of schemaMutations) {
    assert(!validator(value), `schema accepted ${label}`);
  }
  for (const variantId of ["js-controlled", "wasm-linear-controlled"]) {
    const wrongCounter = structuredClone(bundle.records[variantId]);
    (wrongCounter.counters as Record<string, number>)["boundary-crossings"] += 1;
    assert(!validators.record(wrongCounter), `${variantId} schema accepted counter mutation`);
  }

  const semanticMutations: Array<{
    label: string;
    mutate: (value: NumericFftBundle) => void;
  }> = [
    {
      label: "identity",
      mutate: (value) => {
        value.registration.registrationId = "numeric-fft-spectral-filter-controlled-v2";
      },
    },
    {
      label: "hash",
      mutate: (value) => {
        value.fixture.fixtureSha256 = "0".repeat(64);
      },
    },
    {
      label: "counter",
      mutate: (value) => {
        const variants = value.output.variants as Record<string, Record<string, unknown>>;
        (variants["js-controlled"].counters as Record<string, number>).butterflies += 1;
      },
    },
    {
      label: "provenance",
      mutate: (value) => {
        value.records["wasm-linear-controlled"].buildManifest =
          "/artifacts/numeric-fft-spectral-filter/unreviewed.json";
      },
    },
  ];
  for (const { label, mutate } of semanticMutations) {
    const poisoned = structuredClone(bundle);
    mutate(poisoned);
    const rejected = await validateNumericFftSemantics(poisoned, { requireLocalFiles: false });
    assert(!rejected.ok, `semantic validator accepted ${label} contradiction`);
  }
});

Deno.test("controlled JS and material Wasm match for small transforms and adversarial inputs", async () => {
  const wasm = await compileWat();
  for (const n of [2, 4, 8, 16, 32, 64]) {
    const fixture = generateFixture(n, 0x12345678);
    const cases = [
      fixture.signal,
      Float32Array.from({ length: n }, (_, index) => index === 0 ? 1 : 0),
      Float32Array.from({ length: n }, (_, index) => index === (n >>> 1) ? -1 : 0),
      Float32Array.from({ length: n }, (_, index) => index % 2 === 0 ? 1 : -1),
      new Float32Array(n),
    ];
    for (const signal of cases) {
      const js = runPipelineJs(signal, fixture.window, fixture.twiddles, fixture.gains);
      const linearWasm = await runPipelineWasm(
        wasm,
        signal,
        fixture.window,
        fixture.twiddles,
        fixture.gains,
      );
      assertEquals(linearWasm, js);
      const reference = runIndependentF64Oracle(
        signal,
        fixture.window,
        fixture.twiddles,
        fixture.gains,
      );
      assert(validateAgainstOracle(js, reference).passed);
      if (n <= 32) {
        const direct = directDftPipeline(signal, fixture.window, fixture.gains);
        assert(validateAgainstOracle(js, direct).passed, `direct-DFT mismatch at n=${n}`);
      }
    }
  }
});

Deno.test({
  name: "full 2^20 pipeline validates every JS and Wasm output component against f64 oracle",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const wasm = await Deno.readFile(
      "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
    );
    const fixture = generateFixture();
    const js = runPipelineJs(fixture.signal, fixture.window, fixture.twiddles, fixture.gains);
    const linearWasm = await runPipelineWasm(
      wasm,
      fixture.signal,
      fixture.window,
      fixture.twiddles,
      fixture.gains,
    );
    let crossTargetMismatches = 0;
    for (let index = 0; index < js.length; index += 1) {
      if (!Object.is(linearWasm[index], js[index])) crossTargetMismatches += 1;
    }
    assertEquals(crossTargetMismatches, 0);
    const reference = runIndependentF64Oracle(
      fixture.signal,
      fixture.window,
      fixture.twiddles,
      fixture.gains,
    );
    const jsOracle = validateAgainstOracle(js, reference);
    const wasmOracle = validateAgainstOracle(linearWasm, reference);
    assert(jsOracle.passed, JSON.stringify(jsOracle));
    assert(wasmOracle.passed, JSON.stringify(wasmOracle));
    assertEquals(await completeOutputSha256(js), await completeOutputSha256(linearWasm));
    assertEquals(expectedCounters(SAMPLE_COUNT, "js-controlled").butterflies, 20_971_520);
    assertEquals(expectedCounters(SAMPLE_COUNT, "wasm-linear-controlled")["boundary-crossings"], 1);
    assertEquals(expectedCounters(SAMPLE_COUNT, "js-controlled")["input-bytes"], 20_971_512);
  },
});

Deno.test("oracle rejects corruption and non-finite output", async () => {
  const n = 32;
  const signal = generateSignal(n);
  const window = generateWindow(n);
  const twiddles = generateTwiddles(n);
  const gains = generateGains(n);
  const reference = runIndependentF64Oracle(signal, window, twiddles, gains);
  const output = runPipelineJs(signal, window, twiddles, gains);
  output[7] += 1;
  assert(validateAgainstOracle(output, reference).violations > 0);
  output[7] = Number.NaN;
  await assertRejects(
    () => Promise.resolve().then(() => validateAgainstOracle(output, reference)),
    "non-finite",
  );
});

Deno.test("demo routes are closed and lifecycle controls are present", async () => {
  const handler = createHandler(null, "public", null);
  for (
    const path of [
      "/benchmarks/numeric-fft-spectral-filter-v1/",
      "/benchmarks/numeric-fft-spectral-filter-v1/demo.js",
      "/benchmarks/numeric-fft-spectral-filter-v1/worker.js",
      "/benchmarks/base/numeric-fft-spectral-filter/workload.js",
      "/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
      "/artifacts/numeric-fft-spectral-filter/build-manifest.json",
      "/artifacts/numeric-fft-spectral-filter/fixture-manifest.json",
      "/artifacts/numeric-fft-spectral-filter/output-manifest.json",
    ]
  ) {
    assert(
      (await handler(new Request(`http://local.test${path}`))).status === 200,
      path,
    );
  }
  assertEquals(
    (await handler(new Request("http://local.test/artifacts/numeric-fft-spectral-filter/unknown")))
      .status,
    404,
  );
  const demo = await Deno.readTextFile(
    "public/benchmarks/numeric-fft-spectral-filter-v1/demo.js",
  );
  for (
    const required of [
      "new Worker",
      "terminate()",
      "token += 1",
      "setTimeout",
      "pagehide",
      "120000",
    ]
  ) {
    assert(demo.includes(required), required);
  }
  const page = await Deno.readTextFile(
    "public/benchmarks/numeric-fft-spectral-filter-v1/index.html",
  );
  assert(page.includes('aria-live="polite"'));
  assert(page.includes("stores and uploads nothing"));
  assert(page.includes("/unified-runner.js"));
  assert(page.includes("Correctness evidence"));
});

Deno.test("generated manifests bind raw fixture fields, complete output and exact source graph", async () => {
  const fixture = JSON.parse(
    await Deno.readTextFile("public/artifacts/numeric-fft-spectral-filter/fixture-manifest.json"),
  );
  const output = JSON.parse(
    await Deno.readTextFile("public/artifacts/numeric-fft-spectral-filter/output-manifest.json"),
  );
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/numeric-fft-spectral-filter/build-manifest.json"),
  );
  assertEquals(fixture.sampleCount, SAMPLE_COUNT);
  for (const field of ["signal", "window", "twiddles", "gains"]) {
    assert(/^[a-f0-9]{64}$/.test(fixture.fields[field].sha256));
  }
  assertEquals(output.completeOutput.components, SAMPLE_COUNT * 2);
  assert(/^[a-f0-9]{64}$/.test(output.completeOutput.sha256));
  assert(/^[a-f0-9]{64}$/.test(output.completeOutput.quantizedSha256));
  assertEquals(output.variants["js-controlled"].counters.butterflies, 20_971_520);
  assertEquals(output.variants["wasm-linear-controlled"].counters["boundary-crossings"], 1);
  assertEquals(build.frozenCatalog.immutability, "byte-for-byte");
  assert(build.fullSourceGraph.length >= 10);
  const artifact = await Deno.readFile(
    "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
  );
  assertEquals(build.variants["wasm-linear-controlled"].artifactSha256, await sha256Hex(artifact));
});
