// The in-page multi-language adapters and the committed report must time the
// same input. They did not: the adapter ran audio-fir at 16,384 samples where
// the report measured 131,072, and audio-stft at 8,192 against 96,000. Both
// tables render on the same page, so the same engine on the same algorithm
// showed numbers an order of magnitude apart with nothing to explain it.
//
// The adapter is a browser module and cannot import the TypeScript workload
// definitions, so the constants are duplicated. This test is what keeps the
// duplicate honest.

import { assert, assertEquals } from "./assert.ts";
import { SAMPLES as FIR_SAMPLES, TAPS as FIR_TAPS } from "../benchmarks/audio-fir/workload.ts";
import {
  FRAME_SIZE as STFT_FRAME,
  HOP_SIZE as STFT_HOP,
  SAMPLES as STFT_SAMPLES,
} from "../benchmarks/audio-stft/workload.ts";

const runner = await Deno.readTextFile(
  new URL("../public/multilang-runner.js", import.meta.url),
);

/** Read `const NAME = <number>` from the adapter block that declares it. */
function adapterConst(block: string, name: string): number {
  const at = runner.indexOf(`"${block}"`);
  assert(at !== -1, `adapter block ${block} not found in multilang-runner.js`);
  const segment = runner.slice(at, at + 4000);
  const match = segment.match(new RegExp(`\\b${name}\\s*=\\s*(\\d[\\d_]*)`));
  assert(match, `${block}: constant ${name} not found`);
  return Number(match[1].replace(/_/g, ""));
}

Deno.test("audio.fir adapter times the same input as the workload definition", () => {
  assertEquals(adapterConst("audio.fir.v1", "SAMPLES"), FIR_SAMPLES);
  assertEquals(adapterConst("audio.fir.v1", "TAPS"), FIR_TAPS);
});

Deno.test("audio.stft adapter times the same input as the workload definition", () => {
  assertEquals(adapterConst("audio.stft.v1", "SAMPLES"), STFT_SAMPLES);
  assertEquals(adapterConst("audio.stft.v1", "FRAME"), STFT_FRAME);
  assertEquals(adapterConst("audio.stft.v1", "HOP"), STFT_HOP);
});

Deno.test("warm-up is bounded by time as well as count", () => {
  // A flat 50 warm-up iterations is unusable once the adapters run the real
  // input size: Dart/WasmGC takes ~1 s per FIR run there, so 50 warm-ups would
  // be 50 seconds before the first sample.
  assert(
    runner.includes("WARMUP_BUDGET_MS"),
    "multilang warm-up must carry a time budget",
  );
  assert(
    runner.includes("warmupRuns,"),
    "benchmarkOne must report how many warm-up runs it actually achieved",
  );
  const max = runner.match(/WARMUP_MAX_RUNS\s*=\s*(\d+)/);
  const min = runner.match(/WARMUP_MIN_RUNS\s*=\s*(\d+)/);
  assert(max && min, "warm-up bounds must be declared");
  assert(Number(min![1]) >= 1, "at least one warm-up run is required");
  assert(
    Number(min![1]) < Number(max![1]),
    "the warm-up minimum must be below its maximum",
  );
});
