import wabtFactory from "wabt";
import { assert, assertEquals } from "./assert.ts";
import {
  canonicalF32Bytes,
  canonicalF32Fields,
  sha256Hex,
} from "../benchmarks/audio-shared/canonical.ts";
import {
  AUDIO_FROZEN_HASHES,
  AUDIO_MEMORY_PAGES,
  type AudioSlug,
} from "../benchmarks/audio-shared/constants.ts";
import { assertCompleteOutput } from "../benchmarks/audio-shared/oracle.ts";
import {
  generatePinnedF64Reference,
  scalarDftF64Reference,
  stftF64Reference,
} from "../benchmarks/audio-shared/reference.ts";
import {
  FFT_SIZE,
  fftRadix2,
  generateInput,
  generateTwiddleTable,
} from "../benchmarks/audio-fft/workload.ts";
import {
  generateSignal as generateFirSignal,
  generateTaps,
} from "../benchmarks/audio-fir/workload.ts";
import {
  FRAME_SIZE,
  generateSignal as generateStftSignal,
  hannWindow,
  stft,
} from "../benchmarks/audio-stft/workload.ts";
import { AUDIO_COUNTERS, prepareAudioHarness } from "../lib/audio-workloads.ts";

const slugs: AudioSlug[] = ["audio-fft", "audio-fir", "audio-stft"];
const literalHashes = {
  "audio-fft": {
    inputSha256: "f312693f97034ff558b541f771564e9adcc077174d84202351199e3d18fc8b01",
    outputSha256: "f6285cd3244f76eed0a041f30dbfa43ef8dc49012ec92b77514edc569aadad6e",
    referenceSha256: "0432b81e06b48343754d26ae074cad984524cdbeb73bea0ba0539d8a726b9498",
  },
  "audio-fir": {
    inputSha256: "b90d5d472e7f58e18d544f32dbc7449143608939f4a8c18641d6e7eae1752b56",
    outputSha256: "e4b89ba6d65fa9ac3aa5f1b30da32343e54cc81a9ee9d6f84eaf8b38e823fb5f",
    referenceSha256: "3146faf58d2eecd43b74d4297fcc575b0a688cb2e2b2d9ab1b1c9f3d1e21a564",
  },
  "audio-stft": {
    inputSha256: "dfabd66f9e5272f76915165b663cb6c5cb37896454eb6ac02ea13d2f241f326a",
    outputSha256: "b06a278c83d9eeff309fafd64b617a54e958665e2ef2d498194da6c1e75d97ba",
    referenceSha256: "3bae7479e79489d8f97d07bcbd31439e338f7f7f2978d6acfc2cc46cb8412d7a",
  },
};

async function compile(slug: AudioSlug): Promise<Uint8Array> {
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

Deno.test("audio descriptors exactly bind accepted v2 identities, parameters, variants, counters, and phases", async () => {
  const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
  for (const slug of slugs) {
    const descriptor = JSON.parse(await Deno.readTextFile(`benchmarks/${slug}/benchmark.json`));
    const entry = catalog.entries.find((candidate: { benchmarkSlug: string }) =>
      candidate.benchmarkSlug === slug
    );
    assert(entry, `catalog entry missing for ${slug}`);
    assertEquals(descriptor.entryId, entry.id);
    assertEquals(descriptor.benchmarkSlug, entry.benchmarkSlug);
    assertEquals(descriptor.title, entry.title);
    assertEquals(descriptor.tier, entry.tier);
    assertEquals(descriptor.class, entry.class);
    assertEquals(descriptor.parameters, entry.input.parameters);
    const identity = (variant: {
      id: string;
      target: string;
      track: string;
      algorithmFamilyId: string;
    }) => ({
      id: variant.id,
      target: variant.target,
      track: variant.track,
      algorithmFamilyId: variant.algorithmFamilyId,
    });
    assertEquals(
      descriptor.variants.map(identity),
      entry.tracks.flatMap((track: {
        track: string;
        variants: Array<{ id: string; target: string; algorithmFamilyId: string }>;
      }) => track.variants.map((variant) => identity({ ...variant, track: track.track }))),
    );
    assertEquals(Object.keys(descriptor.workCounters), entry.work.counters);
    assertEquals(descriptor.workCounters, AUDIO_COUNTERS[slug]);
    assertEquals(descriptor.phases, entry.phases);
    assertEquals(
      descriptor.oracle.checks,
      entry.oracle.checks.map((check: { id: string }) => check.id),
    );
    assertEquals(descriptor.performanceClaims, []);
  }
});

Deno.test("canonical little-endian input and output hashes are independently frozen constants", async () => {
  assertEquals(AUDIO_FROZEN_HASHES, literalHashes);
  const fields: Record<AudioSlug, Float32Array[]> = {
    "audio-fft": [generateInput(), generateTwiddleTable(FFT_SIZE)],
    "audio-fir": [generateFirSignal(), generateTaps()],
    "audio-stft": [
      generateStftSignal(),
      hannWindow(FRAME_SIZE),
      generateTwiddleTable(FRAME_SIZE),
    ],
  };
  for (const slug of slugs) {
    assertEquals(
      await sha256Hex(canonicalF32Fields(fields[slug])),
      literalHashes[slug].inputSha256,
    );
  }
});

Deno.test("controlled audio harness gates complete output, structural oracles, exact work, phases, and reset", async () => {
  for (const slug of slugs) {
    const wasmBytes = await compile(slug);
    const reference = generatePinnedF64Reference(slug);
    assertEquals(
      await sha256Hex(canonicalF32Bytes(reference)),
      literalHashes[slug].referenceSha256,
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
      assertEquals(result.inputSha256, literalHashes[slug].inputSha256);
      assertEquals(result.outputSha256, literalHashes[slug].outputSha256);
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
  }
});

Deno.test("independent f64 gates reject cancellation-heavy and unscaled adversarial fixtures", () => {
  let state = 0x9e3779b9;
  const cancellation = new Float32Array(FFT_SIZE * 2);
  for (let index = 0; index < cancellation.length; index++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    cancellation[index] = Math.fround((state / 0x1_0000_0000) * 2 - 1);
  }
  const cancellationReference = scalarDftF64Reference(cancellation, FFT_SIZE, 1);
  const cancellationOutput = cancellation.slice();
  fftRadix2(cancellationOutput, FFT_SIZE, generateTwiddleTable(FFT_SIZE));
  let fftRejected = false;
  try {
    assertCompleteOutput(cancellationOutput, cancellationReference, 1e-6, 1e-5);
  } catch (error) {
    fftRejected = error instanceof Error && error.message.includes("complete output bound failed");
  }
  assert(fftRejected, "cancellation-heavy FFT fixture unexpectedly passed the f64 gate");

  const scaled = generateStftSignal();
  const unscaled = Float32Array.from(scaled, (value) => Math.fround(value * 8));
  const window = hannWindow(FRAME_SIZE);
  const unscaledReference = stftF64Reference(unscaled, window);
  const unscaledOutput = stft(unscaled);
  let stftRejected = false;
  try {
    assertCompleteOutput(unscaledOutput, unscaledReference, 5e-6, 1e-5);
  } catch (error) {
    stftRejected = error instanceof Error && error.message.includes("complete output bound failed");
  }
  assert(stftRejected, "unscaled STFT fixture unexpectedly passed the f64 gate");
});

Deno.test("complete-output gate rejects a finite one-component corruption", async () => {
  const harness = await prepareAudioHarness("audio-fft", "javascript");
  const result = await harness.runIteration(generatePinnedF64Reference("audio-fft"));
  const corrupted = result.output.slice();
  corrupted[corrupted.length - 1] = Math.fround(corrupted[corrupted.length - 1] + 0.25);
  let rejected = false;
  try {
    assertCompleteOutput(corrupted, result.output, 1e-6, 1e-5);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("complete output bound failed");
  }
  assert(rejected, "complete-output oracle accepted a corrupted final component");
});
