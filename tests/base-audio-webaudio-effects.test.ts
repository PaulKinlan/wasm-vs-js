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

let compiled: Promise<{ bytes: Uint8Array; instance: WebAssembly.Instance }> | undefined;
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
    const instance = await WebAssembly.instantiate(new WebAssembly.Module(bytes.buffer));
    return { bytes, instance };
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
    const wasm = processWasm((await compileWasm()).instance, fixture);
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
    const wasm = processWasm((await compileWasm()).instance, fixture);
    const jsCounts = counters(CONTRACT.frames, "javascript", js.observations);
    const wasmCounts = counters(CONTRACT.frames, "wasm-linear", wasm.observations);
    assertEquals(jsCounts["blocks-per-channel"], 22_500);
    assertEquals(jsCounts["block-invocations"], 45_000);
    assertEquals(jsCounts["state-carry-boundaries"], 44_998);
    assertEquals(jsCounts["tail-flush-invocations"], 2);
    assertEquals(wasmCounts["blocks-per-channel"], 22_500);
    assertEquals(wasmCounts["block-invocations"], 45_000);
    assertEquals(wasmCounts["state-carry-boundaries"], 44_998);
    assertEquals(wasmCounts["boundary-crossings"], 45_002);
    const jsBytes = interleaveBytes(js);
    const wasmBytes = interleaveBytes(wasm);
    assertEquals(jsBytes.byteLength, 23_040_120);
    const outputHash = await sha256Hex(jsBytes);
    assertEquals(outputHash, await sha256Hex(wasmBytes));
    for (let index = 0; index < jsBytes.length; index++) {
      assertEquals(jsBytes[index], wasmBytes[index]);
    }
    const oracle = compareReference(js, processReference(fixture));
    assertEquals(oracle.violations, 0);
    assertEquals(oracle.nonFinite, 0);
    assert(oracle.maxAbsolute <= oracle.absoluteTolerance);
    const manifest = JSON.parse(
      await Deno.readTextFile(
        "public/artifacts/base-audio-webaudio-effects-v1/output-manifest.json",
      ),
    );
    const jsEvidence = JSON.parse(
      await Deno.readTextFile(
        "public/evidence/base/audio-webaudio-effects-v1/javascript-controlled.json",
      ),
    );
    const wasmEvidence = JSON.parse(
      await Deno.readTextFile(
        "public/evidence/base/audio-webaudio-effects-v1/wasm-linear-controlled.json",
      ),
    );
    assertEquals(manifest.jsSha256, outputHash);
    assertEquals(manifest.wasmSha256, outputHash);
    assertEquals(jsEvidence.completeOutputSha256, outputHash);
    assertEquals(wasmEvidence.completeOutputSha256, outputHash);
    assertEquals(jsEvidence.counters, jsCounts);
    assertEquals(wasmEvidence.counters, wasmCounts);
  },
});

Deno.test("counters are derived from observed block calls, state carries and tail calls", async () => {
  const fixture = generateFixture(257);
  const jsOutput = processJavaScript(fixture);
  const wasmOutput = processWasm((await compileWasm()).instance, fixture);
  const js = counters(257, "javascript", jsOutput.observations);
  const wasm = counters(257, "wasm-linear", wasmOutput.observations);
  assertEquals(js["blocks-per-channel"], 3);
  assertEquals(js["block-invocations"], 6);
  assertEquals(js["state-carry-boundaries-per-channel"], 2);
  assertEquals(js["state-carry-boundaries"], 4);
  assertEquals(js["tail-flush-invocations"], 2);
  assertEquals(js["tail-flush-frames"], 30);
  assertEquals(js["boundary-crossings"], 0);
  assertEquals(wasm["blocks-per-channel"], 3);
  assertEquals(wasm["block-invocations"], 6);
  assertEquals(wasm["state-carry-boundaries"], 4);
  assertEquals(wasm["boundary-crossings"], 8);
  let rejectedCalculatedClaim = false;
  try {
    counters(257, "javascript", { ...jsOutput.observations, blockInvocations: 1 });
  } catch (error) {
    rejectedCalculatedClaim = error instanceof Error &&
      error.message.includes("observed execution does not satisfy");
  }
  assert(rejectedCalculatedClaim, "unobserved/calculated block claims must be rejected");
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

Deno.test("artifact is byte-identical to a fresh canonical WAT compilation", async () => {
  const fresh = (await compileWasm()).bytes;
  const committed = await Deno.readFile(
    "public/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
  );
  assertEquals(await sha256Hex(fresh), await sha256Hex(committed));
  assertEquals([...fresh], [...committed]);
});

Deno.test("build manifest source graph is byte-exact at its recorded Git commit", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile(
      "public/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
    ),
  );
  for (const source of manifest.sources) {
    const committed = await new Deno.Command("git", {
      args: ["show", `${manifest.sourceCommit}:${source.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(committed.success, `source missing at commit: ${source.path}`);
    assertEquals(await sha256Hex(committed.stdout), source.sha256);
    assertEquals(committed.stdout.byteLength, source.bytes);
  }
});

Deno.test("all generated package records satisfy the fully closed exact schema", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/audio-webaudio-effects-base.schema.json"),
  );
  const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
    Ajv2020Module;
  const validate = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false }).compile(schema);
  const paths = [
    "catalog/base-implementations/audio.webaudio-effects.v1.json",
    "public/artifacts/base-audio-webaudio-effects-v1/fixture-manifest.json",
    "public/artifacts/base-audio-webaudio-effects-v1/output-manifest.json",
    "public/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
    "public/evidence/base/audio-webaudio-effects-v1/javascript-controlled.json",
    "public/evidence/base/audio-webaudio-effects-v1/wasm-linear-controlled.json",
  ];
  const records = new Map<string, Record<string, unknown>>();
  for (const path of paths) {
    const value = JSON.parse(await Deno.readTextFile(path));
    records.set(path, value);
    assert(validate(value), `${path}: ${JSON.stringify(validate.errors)}`);
  }

  const registration = records.get(paths[0])!;
  const fixture = records.get(paths[1])!;
  const output = records.get(paths[2])!;
  const build = records.get(paths[3])!;
  const evidence = records.get(paths[4])!;
  const negatives = [
    { ...structuredClone(registration), implementation: {} },
    { ...structuredClone(registration), artifacts: {} },
    { ...structuredClone(fixture), inputBytes: 0 },
    { ...structuredClone(fixture), unexpected: true },
    { ...structuredClone(output), checkpoints: [] },
    { ...structuredClone(output), bytes: 1 },
    { ...structuredClone(build), artifact: {} },
    { ...structuredClone(build), sources: [] },
    { ...structuredClone(evidence), oracle: {} },
    { ...structuredClone(evidence), counters: {} },
    { ...structuredClone(evidence), authoritativePerformanceEvidence: true },
  ];
  for (const [index, value] of negatives.entries()) {
    assert(!validate(value), `negative ${index} unexpectedly satisfied the package schema`);
  }
});

Deno.test("supplemental source routes are explicit and frozen-catalog-independent", async () => {
  const server = (await Deno.readTextFile("server.ts")) +
    (await Deno.readTextFile("routes.generated.ts"));
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
