import wabtFactory from "wabt";
import { assert, assertEquals } from "./assert.ts";
import { canonicalF32Bytes, sha256Hex } from "../benchmarks/audio-shared/canonical.ts";
import { AUDIO_MEMORY_PAGES, type AudioSlug } from "../benchmarks/audio-shared/constants.ts";
import { generatePinnedF64Reference } from "../benchmarks/audio-shared/reference.ts";
import { AUDIO_COUNTERS, prepareAudioHarness } from "../lib/audio-workloads.ts";

const slug: AudioSlug = "audio-fft";
const literalHashes = {
  inputSha256: "f312693f97034ff558b541f771564e9adcc077174d84202351199e3d18fc8b01",
  outputSha256: "f6285cd3244f76eed0a041f30dbfa43ef8dc49012ec92b77514edc569aadad6e",
  referenceSha256: "0432b81e06b48343754d26ae074cad984524cdbeb73bea0ba0539d8a726b9498",
};

async function compile(): Promise<Uint8Array> {
  const wabt = await wabtFactory();
  const path = `benchmarks/${slug}/${slug}.wat`;
  const parsed = wabt.parseWat(path, await Deno.readTextFile(path), {
    exceptions: false,
    threads: false,
    simd: false,
    bulk_memory: false,
    memory64: false,
  });
  parsed.resolveNames();
  parsed.validate();
  const binary = parsed.toBinary({
    canonicalize_lebs: true,
    relocatable: false,
    write_debug_names: false,
  });
  parsed.destroy();
  return new Uint8Array(binary.buffer);
}

function assertSameF32(actual: Float32Array, expected: Float32Array, label: string): void {
  assertEquals(actual.length, expected.length);
  for (let index = 0; index < actual.length; index++) {
    if (!Object.is(actual[index], expected[index]) && actual[index] !== expected[index]) {
      throw new Error(`${label} differs at ${index}: ${actual[index]} != ${expected[index]}`);
    }
  }
}

Deno.test("controlled audio-fft harness gates complete output, structural oracles, exact work, phases, and reset", async () => {
  const wasmBytes = await compile();
  const reference = generatePinnedF64Reference(slug);
  assertEquals(
    await sha256Hex(canonicalF32Bytes(reference)),
    literalHashes.referenceSha256,
  );
  const jsHarness = await prepareAudioHarness(slug, "javascript");
  const jsFirst = await jsHarness.runIteration(reference);
  const jsSecond = await jsHarness.runIteration(reference, jsFirst.output);
  assertSameF32(jsSecond.output, jsFirst.output, `${slug} JavaScript reset`);

  const wasmHarness = await prepareAudioHarness(slug, "wasm-linear", wasmBytes);
  const wasmFirst = await wasmHarness.runIteration(reference, jsFirst.output);
  const wasmSecond = await wasmHarness.runIteration(reference, jsFirst.output);
  assertSameF32(wasmFirst.output, jsFirst.output, `${slug} JS/Wasm semantics`);
  assertSameF32(wasmSecond.output, wasmFirst.output, `${slug} Wasm reset`);

  for (const result of [jsFirst, jsSecond, wasmFirst, wasmSecond]) {
    assertEquals(result.inputSha256, literalHashes.inputSha256);
    assertEquals(result.outputSha256, literalHashes.outputSha256);
    assertEquals(result.counters, AUDIO_COUNTERS[slug]);
    assertEquals(Object.keys(result.phasesMs), [
      "load",
      "initialize",
      "transfer",
      "compute",
      "validation",
      "render",
      "end-to-end",
    ]);
    assertEquals(result.phasesMs.render, null);
    for (const [phase, duration] of Object.entries(result.phasesMs)) {
      if (duration !== null) assert(typeof duration === "number" && duration >= 0, phase);
    }
    assert(result.oracleChecks["complete-output-bound"].metrics.finite === true);
    assertEquals(
      result.oracleChecks["complete-output-bound"].metrics.comparedComponents,
      reference.length,
    );
  }
  assertEquals(jsFirst.iterationKind, "cold");
  assertEquals(jsSecond.iterationKind, "warm");
  assert(typeof jsFirst.phasesMs.load === "number");
  assert(typeof jsFirst.phasesMs.initialize === "number");
  assertEquals(jsSecond.phasesMs.load, null);
  assertEquals(jsSecond.phasesMs.initialize, null);
  assertEquals(
    jsSecond.phasesMs["end-to-end"],
    jsSecond.phasesMs.transfer! + jsSecond.phasesMs.compute!,
  );
  assertEquals(wasmFirst.iterationKind, "cold");
  assertEquals(wasmSecond.iterationKind, "warm");
  assertEquals(wasmSecond.phasesMs.load, null);
  assertEquals(wasmSecond.phasesMs.initialize, null);

  const instance = await WebAssembly.instantiate(
    await WebAssembly.compile(Uint8Array.from(wasmBytes)),
  );
  const memory = instance.exports.memory as WebAssembly.Memory;
  assertEquals(memory.buffer.byteLength, AUDIO_MEMORY_PAGES[slug] * 65_536);
  let growthRejected = false;
  try {
    memory.grow(1);
  } catch (error) {
    growthRejected = error instanceof RangeError;
  }
  assert(growthRejected, `${slug} memory growth was not rejected`);
});
