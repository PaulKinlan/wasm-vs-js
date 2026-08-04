/// <reference lib="webworker" />
// Per-slug compute half of scripts/build-audio.ts. Each slug's wat compile,
// pinned f64 reference generation, and controlled harness runs are independent
// sync-CPU work; running them on separate worker threads cuts the sequential
// three-slug loop to the slowest single slug. All artifact/manifest WRITES
// stay on the main thread, in the original deterministic order.
import wabtFactory from "wabt";
import { canonicalF32Bytes, sha256Hex } from "../benchmarks/audio-shared/canonical.ts";
import { generatePinnedF64Reference } from "../benchmarks/audio-shared/reference.ts";
import { prepareAudioHarness } from "../lib/audio-workloads.ts";
import { AUDIO_FROZEN_HASHES, type AudioSlug } from "../benchmarks/audio-shared/constants.ts";

export interface SlugResult {
  wasm: Uint8Array;
  referenceBytes: Uint8Array;
  referenceSha256: string;
  jsResult: {
    outputSha256: string;
    oracleChecks: unknown;
    workCounterGate: unknown;
    counters: unknown;
  };
  wasmResult: {
    outputSha256: string;
    oracleChecks: unknown;
    workCounterGate: unknown;
    counters: unknown;
  };
}

self.onmessage = async (event: MessageEvent<{ slug: AudioSlug }>) => {
  const { slug } = event.data;
  const root = new URL("../", import.meta.url);
  const wabt = await wabtFactory();
  const watPath = `benchmarks/${slug}/${slug}.wat`;
  const wat = await Deno.readTextFile(new URL(watPath, root));
  const parsed = wabt.parseWat(`${slug}.wat`, wat, {
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
  const wasm = new Uint8Array(binary.buffer);

  const referenceOutput = generatePinnedF64Reference(slug);
  const referenceBytes = canonicalF32Bytes(referenceOutput);
  const referenceSha256 = await sha256Hex(referenceBytes);
  if (referenceSha256 !== AUDIO_FROZEN_HASHES[slug].referenceSha256) {
    throw new Error(`${slug} pinned f64 reference hash mismatch`);
  }

  const jsHarness = await prepareAudioHarness(slug, "javascript");
  const jsResult = await jsHarness.runIteration(referenceOutput);
  const wasmHarness = await prepareAudioHarness(slug, "wasm-linear", wasm);
  const wasmResult = await wasmHarness.runIteration(referenceOutput, jsResult.output);
  if (jsResult.outputSha256 !== wasmResult.outputSha256) {
    throw new Error(`${slug} strict JS/Wasm semantic hash mismatch`);
  }

  const result: SlugResult = {
    wasm,
    referenceBytes,
    referenceSha256,
    jsResult: {
      outputSha256: jsResult.outputSha256,
      oracleChecks: jsResult.oracleChecks,
      workCounterGate: jsResult.workCounterGate,
      counters: jsResult.counters,
    },
    wasmResult: {
      outputSha256: wasmResult.outputSha256,
      oracleChecks: wasmResult.oracleChecks,
      workCounterGate: wasmResult.workCounterGate,
      counters: wasmResult.counters,
    },
  };
  self.postMessage(result);
};
