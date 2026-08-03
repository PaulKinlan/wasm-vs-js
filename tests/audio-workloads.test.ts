import wabtFactory from "wabt";
import { assert, assertEquals } from "./assert.ts";
import { canonicalF32Fields, sha256Hex } from "../benchmarks/audio-shared/canonical.ts";
import {
  AUDIO_FROZEN_HASHES,
  AUDIO_MEMORY_PAGES,
  type AudioSlug,
} from "../benchmarks/audio-shared/constants.ts";
import { assertCompleteOutput } from "../benchmarks/audio-shared/oracle.ts";
import { FFT_SIZE, generateInput, generateTwiddleTable } from "../benchmarks/audio-fft/workload.ts";
import {
  generateSignal as generateFirSignal,
  generateTaps,
} from "../benchmarks/audio-fir/workload.ts";
import {
  FRAME_SIZE,
  generateSignal as generateStftSignal,
  hannWindow,
} from "../benchmarks/audio-stft/workload.ts";
import { AUDIO_COUNTERS, prepareAudioHarness } from "../lib/audio-workloads.ts";

const slugs: AudioSlug[] = ["audio-fft", "audio-fir", "audio-stft"];
const literalHashes = {
  "audio-fft": {
    inputSha256: "56a844c73dbb33c2ac426ce012b0d953f54270c8acd1bc90a4b058147a810ee0",
    outputSha256: "8394fb237d8e085dcee070c9c1835bdaa831f6f6cec5c84aff50e85180fa0cd9",
  },
  "audio-fir": {
    inputSha256: "b90d5d472e7f58e18d544f32dbc7449143608939f4a8c18641d6e7eae1752b56",
    outputSha256: "e4b89ba6d65fa9ac3aa5f1b30da32343e54cc81a9ee9d6f84eaf8b38e823fb5f",
  },
  "audio-stft": {
    inputSha256: "324551444ff689a77c896f413421b1c65a41577389d48b5709558f138319d617",
    outputSha256: "a9f31f5ddc547961586f7f0b7cecd746f47897e82d6ecd697778d6ce53107fc8",
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
    const jsHarness = await prepareAudioHarness(slug, "javascript");
    const jsFirst = await jsHarness.runIteration();
    const jsSecond = await jsHarness.runIteration(jsFirst.output);
    assertSameF32(jsSecond.output, jsFirst.output, `${slug} JavaScript reset`);

    const wasmHarness = await prepareAudioHarness(slug, "wasm-linear", wasmBytes);
    const wasmFirst = await wasmHarness.runIteration(jsFirst.output);
    const wasmSecond = await wasmHarness.runIteration(jsFirst.output);
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
        if (phase !== "render") assert(typeof duration === "number" && duration >= 0);
      }
      assert(result.oracleMetrics.finite === true);
    }

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

Deno.test("complete-output gate rejects a finite one-component corruption", async () => {
  const harness = await prepareAudioHarness("audio-fft", "javascript");
  const result = await harness.runIteration();
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
