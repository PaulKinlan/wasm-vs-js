import { assert } from "./assert.ts";
import { assertCompleteOutput } from "../benchmarks/audio-shared/oracle.ts";
import { generatePinnedF64Reference } from "../benchmarks/audio-shared/reference.ts";
import { prepareAudioHarness } from "../lib/audio-workloads.ts";

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
