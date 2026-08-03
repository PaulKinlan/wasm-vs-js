import Ajv2020Module from "ajv2020";
import wabtFactory from "wabt";
import { assert, assertEquals } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import {
  CONTRACT,
  counters,
  generateFixture,
  interleaveBytes,
  IR,
  processJavaScript,
} from "../benchmarks/base/audio-webaudio-effects/workload.js";
import {
  compareReference,
  processReference,
} from "../benchmarks/base/audio-webaudio-effects/reference.js";
import { processWasm } from "../benchmarks/base/audio-webaudio-effects/wasm.js";

let compiled: Promise<WebAssembly.Instance> | undefined;
function compileWasm() {
  compiled ??= (async () => {
    const wabt = await wabtFactory();
    const parsed = wabt.parseWat(
      "audio-webaudio-effects.wat",
      await Deno.readTextFile(
        "benchmarks/base/audio-webaudio-effects/audio-webaudio-effects.wat",
      ),
      { exceptions: false, threads: false, simd: false, bulk_memory: false, memory64: false },
    );
    parsed.resolveNames();
    parsed.validate();
    const generated = new Uint8Array(
      parsed.toBinary({ canonicalize_lebs: true, write_debug_names: false }).buffer,
    );
    parsed.destroy();
    const bytes = new Uint8Array(generated.byteLength);
    bytes.set(generated);
    return await WebAssembly.instantiate(new WebAssembly.Module(bytes.buffer));
  })();
  return compiled;
}

Deno.test("frozen v1 catalog bytes remain unchanged", async () => {
  const bytes = await Deno.readFile("catalog/workloads.v1.json");
  assertEquals(
    await sha256Hex(bytes),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  const catalog = JSON.parse(new TextDecoder().decode(bytes));
  const entry = catalog.entries.find((value: { id: string }) => value.id === CONTRACT.entryId);
  assert(entry);
  assertEquals(entry.fixedWork.description, "60 s stereo in fixed 128-sample blocks.");
  assertEquals(entry.status, "proposed");
});

Deno.test("fixture freezes impulse, DC/threshold, sweep, noise, stereo and IR", () => {
  const fixture = generateFixture();
  assertEquals(fixture.left.length, 2_880_000);
  assertEquals(fixture.right.length, 2_880_000);
  assertEquals(fixture.left[0], 1);
  assertEquals(fixture.right[0], -0.75);
  assertEquals(fixture.left[1], Math.fround(0.1));
  assertEquals(fixture.left[12_000], Math.fround(0.25));
  assertEquals(fixture.left[24_000], Math.fround(0.3));
  assertEquals(fixture.left[36_000], Math.fround(-0.2));
  assert(fixture.left[48_000] !== 0);
  assert(fixture.left[528_000] !== 0);
  assertEquals(IR.length, 16);
  assertEquals(CONTRACT.blocks, 22_500);
});

for (
  const [name, frames] of [
    ["impulse", 1],
    ["DC and threshold", 36_001],
    ["block boundary", 257],
  ] as const
) {
  Deno.test(`${name} differential: JS and material Wasm match every sample`, async () => {
    const fixture = generateFixture(frames);
    const js = processJavaScript(fixture);
    const wasm = processWasm(await compileWasm(), fixture);
    assertEquals(js.left.length, frames + 15);
    for (const side of ["left", "right"] as const) {
      for (let index = 0; index < js[side].length; index++) {
        assert(
          Object.is(js[side][index], wasm[side][index]),
          `${side} mismatch at ${index}: ${js[side][index]} / ${wasm[side][index]}`,
        );
      }
    }
    const oracle = compareReference(js, processReference(fixture));
    assertEquals(oracle.violations, 0);
    assertEquals(oracle.nonFinite, 0);
  });
}

Deno.test({
  name: "complete 60 second chain matches every JS/Wasm output byte and f64 oracle",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const fixture = generateFixture();
    const js = processJavaScript(fixture);
    const wasm = processWasm(await compileWasm(), fixture);
    const jsBytes = interleaveBytes(js);
    const wasmBytes = interleaveBytes(wasm);
    assertEquals(jsBytes.byteLength, 23_040_120);
    assertEquals(await sha256Hex(jsBytes), await sha256Hex(wasmBytes));
    for (let index = 0; index < jsBytes.length; index++) {
      assertEquals(jsBytes[index], wasmBytes[index]);
    }
    const oracle = compareReference(js, processReference(fixture));
    assertEquals(oracle.violations, 0);
    assertEquals(oracle.nonFinite, 0);
    assert(oracle.maxAbsolute <= oracle.absoluteTolerance);
  },
});

Deno.test("exact counters cover blocks, samples, state, MACs, allocations and crossings", () => {
  const js = counters();
  const wasm = counters(CONTRACT.frames, "wasm-linear");
  assertEquals(js["input-frames"], 2_880_000);
  assertEquals(js["input-samples"], 5_760_000);
  assertEquals(js["blocks-128"], 22_500);
  assertEquals(js["output-samples"], 5_760_030);
  assertEquals(js["convolution-macs"], 92_160_480);
  assertEquals(js["state-carry-boundaries"], 22_499);
  assertEquals(js["tail-flush-frames"], 15);
  assertEquals(js.allocations, 6);
  assertEquals(js["boundary-crossings"], 0);
  assertEquals(wasm.allocations, 0);
  assertEquals(wasm["boundary-crossings"], 1);
});

Deno.test("demo is bounded, cancellable, stale-safe, pagehide-safe and non-persistent", async () => {
  const page = await Deno.readTextFile(
    "public/benchmarks/base/audio-webaudio-effects-v1/index.html",
  );
  const runner = await Deno.readTextFile("public/base-audio-effects-demo.js");
  const worker = await Deno.readTextFile("public/base-audio-effects-worker.js");
  assert(page.includes("2,880,000 stereo frames"));
  assert(page.includes("No performance claim."));
  assert(page.includes('role="status"'));
  assert(page.includes('aria-label="Validation phase"'));
  assert(runner.includes("new Worker"));
  assert(runner.includes("worker.terminate"));
  assert(runner.includes("generation !== token"));
  assert(runner.includes('addEventListener("pagehide"'));
  assert(runner.includes("120_000"));
  assert(worker.includes("complete output oracle mismatch"));
  assert(worker.includes("Wasm artifact hash mismatch"));
  for (const source of [page, runner, worker]) {
    for (
      const forbidden of [
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "sendBeacon",
        "WebSocket",
        'method: "POST"',
      ]
    ) {
      assert(!source.includes(forbidden), `forbidden demo surface: ${forbidden}`);
    }
  }
});

Deno.test("generated registration and both correctness records satisfy the closed schema", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/audio-webaudio-effects-base.schema.json"),
  );
  const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
    Ajv2020Module;
  const validate = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false }).compile(schema);
  for (
    const path of [
      "catalog/base-implementations/audio.webaudio-effects.v1.json",
      "public/evidence/base/audio-webaudio-effects-v1/javascript-controlled.json",
      "public/evidence/base/audio-webaudio-effects-v1/wasm-linear-controlled.json",
    ]
  ) {
    const value = JSON.parse(await Deno.readTextFile(path));
    assert(validate(value), `${path}: ${JSON.stringify(validate.errors)}`);
  }
});

Deno.test("supplemental source routes are explicit and frozen-catalog-independent", async () => {
  const server = await Deno.readTextFile("server.ts");
  for (
    const path of [
      "/benchmarks/base/audio-webaudio-effects-v1/",
      "/base-audio-effects-demo.js",
      "/base-audio-effects-worker.js",
      "/benchmarks/base/audio-webaudio-effects/workload.js",
      "/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
    ]
  ) assert(server.includes(path), `missing route ${path}`);
  assert(!server.includes('catalog/workloads.v1.json", Deno.write'));
});
