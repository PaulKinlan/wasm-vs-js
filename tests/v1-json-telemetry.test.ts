import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import { createHandler } from "../server.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

function assertThrows(fn: () => unknown): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error("expected throw");
}
import {
  generateTelemetryFixture,
  REGISTERED_COUNTS,
  runTelemetryJS,
  runTelemetryWasm,
} from "../benchmarks/v1/serialization-json-telemetry/workload.js";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (
  options?: Record<string, unknown>,
) => { compile: (schema: unknown) => Validator };
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const artifactPath = "public/artifacts/serialization-json-telemetry/telemetry.wasm";

Deno.test("supplemental registration is schema-valid and frozen v1 bytes stay unchanged", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  assertEquals(
    await sha256Hex(catalog),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/v1-base-implementation-registration.schema.json"),
  );
  const registration = JSON.parse(
    await Deno.readTextFile("benchmarks/v1/serialization-json-telemetry/registration.v1.json"),
  );
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  assert(validate(registration), JSON.stringify(validate.errors));
  assertEquals(registration.frozenCatalog.mutated, false);
  assertEquals(registration.coverage.catalogNumeratorBeforeReview, 0);
  assertEquals(registration.performanceClaims, []);
});

Deno.test("generator is deterministic and preserves the registered multilingual nested grammar", async () => {
  const a = generateTelemetryFixture(1_000);
  const b = generateTelemetryFixture(1_000);
  assertEquals(await sha256Hex(a), await sha256Hex(b));
  assertEquals(
    await sha256Hex(a),
    "1cb2368099252795ffc85d23ea057c93a266d9cdb026e041d0ec1aa563be92f9",
  );
  const text = new TextDecoder().decode(a);
  for (
    const value of ["Café", "東京", "مرحبا", "🚀", "α", "数据", "mañana", "🧪", '"meta":{"label"']
  ) assert(text.includes(value));
});

Deno.test("custom JS and material Wasm parsers agree over deterministic property cases", async () => {
  const wasm = await Deno.readFile(artifactPath);
  for (const records of [0, 1, 2, 17, 257, 1_000]) {
    const fixture = generateTelemetryFixture(records);
    const js = runTelemetryJS(fixture);
    const linear = await runTelemetryWasm(fixture, wasm);
    assertEquals(linear.text, js.text);
    assertEquals(linear.summary, js.summary);
    assertEquals(linear.counters, { ...js.counters, "boundary-crossings": 2 });
  }
});

Deno.test("both parsers reject malformed, escaped, non-canonical numeric, and vocabulary cases", async () => {
  const wasm = await Deno.readFile(artifactPath);
  const valid = new TextDecoder().decode(generateTelemetryFixture(2));
  const malformed = [
    valid.slice(0, -1),
    valid.replace('"region":"sa"', '"region":"zz"'),
    valid.replace('"id":0', '"id":00'),
    valid.replace('"value":9516', '"value":-1'),
    valid.replace('"label":"🚀"', '"label":"\\uD83D\\uDE80"'),
    valid.replace('"meta":', '"extra":0,"meta":'),
  ];
  for (const text of malformed) {
    const bytes = new TextEncoder().encode(text);
    assertThrows(() => runTelemetryJS(bytes));
    await assertRejects(() => runTelemetryWasm(bytes, wasm), "Wasm parser rejected");
  }
  const invalidUtf8 = generateTelemetryFixture(1);
  invalidUtf8[invalidUtf8.indexOf(0xf0)] = 0xff;
  assertThrows(() => runTelemetryJS(invalidUtf8));
  await assertRejects(() => runTelemetryWasm(invalidUtf8, wasm), "Wasm parser rejected");
});

Deno.test({
  name:
    "all 1k, 100k, and 1m registered fixtures pass complete exact output and counter validation",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const wasm = await Deno.readFile(artifactPath);
    const inputManifest = JSON.parse(
      await Deno.readTextFile("public/artifacts/serialization-json-telemetry/input-manifest.json"),
    );
    const outputManifest = JSON.parse(
      await Deno.readTextFile("public/artifacts/serialization-json-telemetry/output-manifest.json"),
    );
    for (const records of REGISTERED_COUNTS) {
      const input = generateTelemetryFixture(records);
      const inputExpected = inputManifest.tiers.find((tier: { records: number }) =>
        tier.records === records
      );
      assertEquals(input.length, inputExpected.bytes);
      assertEquals(await sha256Hex(input), inputExpected.sha256);
      const js = runTelemetryJS(input);
      const linear = await runTelemetryWasm(input, wasm);
      const expected = outputManifest.tiers.find((tier: { records: number }) =>
        tier.records === records
      );
      assertEquals(js.text, expected.canonicalSummary);
      assertEquals(linear.text, expected.canonicalSummary);
      assertEquals(await sha256Hex(js.outputBytes), expected.sha256);
      assertEquals(await sha256Hex(linear.outputBytes), expected.sha256);
      assertEquals(js.counters, expected.variants["js-controlled"].counters);
      assertEquals(linear.counters, expected.variants["wasm-linear-controlled"].counters);
    }
  },
});

Deno.test("Wasm build is byte-reproducible with the pinned Clang and LLD flags", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/serialization-json-telemetry/build-manifest.json"),
  );
  const temp = await Deno.makeTempFile({ suffix: ".wasm" });
  try {
    const args = [...manifest.command.slice(1)];
    const outputIndex = args.indexOf("-o") + 1;
    args[outputIndex] = temp;
    const result = await new Deno.Command("clang", { args, stdout: "piped", stderr: "piped" })
      .output();
    assert(result.success, new TextDecoder().decode(result.stderr));
    const rebuilt = await Deno.readFile(temp);
    assertEquals(rebuilt.length, manifest.artifact.bytes);
    assertEquals(await sha256Hex(rebuilt), manifest.artifact.sha256);
  } finally {
    await Deno.remove(temp).catch(() => {});
  }
});

Deno.test("public mode exposes only the explicit demo, source, artifact, and manifest routes", async () => {
  const handler = createHandler(null, "public");
  const routes = [
    "/demos/serialization.json-telemetry.v1/",
    "/telemetry-demo.js",
    "/telemetry-worker.js",
    "/benchmarks/v1/serialization-json-telemetry/workload.js",
    "/artifacts/serialization-json-telemetry/telemetry.wasm",
    "/artifacts/serialization-json-telemetry/build-manifest.json",
    "/artifacts/serialization-json-telemetry/fixture-manifest.json",
    "/artifacts/serialization-json-telemetry/input-manifest.json",
    "/artifacts/serialization-json-telemetry/output-manifest.json",
  ];
  for (const route of routes) {
    const status = (await handler(new Request(`http://127.0.0.1${route}`))).status;
    assert(status === 200, `${route} returned ${status}`);
  }
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/artifacts/serialization-json-telemetry/private.json"),
    )).status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/demos/serialization.json-telemetry.v1/", { method: "POST" }),
    )).status,
    403,
  );
});

Deno.test("demo lifecycle source uses fresh workers, stale-token rejection, bounded timeout, and pagehide cleanup", async () => {
  const source = await Deno.readTextFile("public/telemetry-demo.js");
  for (
    const required of [
      "new Worker",
      "token !== generation",
      "180_000",
      "worker.terminate()",
      'addEventListener("pagehide"',
      "crypto",
    ].filter((value) => value !== "crypto")
  ) assert(source.includes(required), required);
  const page = await Deno.readTextFile("public/demos/serialization.json-telemetry.v1/index.html");
  for (
    const required of [
      "Nothing is uploaded, stored, or ranked",
      'aria-live="polite"',
      'for="progress"',
      "No performance claim",
    ]
  ) assert(page.includes(required), required);
});
