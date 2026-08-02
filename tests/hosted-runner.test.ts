import { assert, assertEquals, assertRejects } from "./assert.ts";
import { generateInput, INPUT_LENGTH, sumU32 } from "../benchmarks/sum-u32/workload.js";
import {
  boundedIterations,
  fixedWorkCounters,
  ORACLE,
  runScoredPair,
  summarizeSamples,
} from "../public/hosted-runner-core.js";

Deno.test("hosted runner core preserves exact JS/Wasm output and bounded scored trajectories", async () => {
  const bytes = await Deno.readFile("public/artifacts/sum-u32/sum-u32.wasm");
  const instance = await WebAssembly.instantiate(bytes);
  const input = generateInput();
  const memory = instance.instance.exports.memory as WebAssembly.Memory;
  const sum = instance.instance.exports.sum_u32 as (pointer: number, length: number) => number;
  new Uint32Array(memory.buffer, 0, input.length).set(input);
  const jsRun = () => sumU32(input);
  const wasmRun = () => sum(0, input.length) >>> 0;
  assertEquals(jsRun(), ORACLE);
  assertEquals(wasmRun(), ORACLE);
  let yields = 0;
  const progress: string[] = [];
  const samples = await runScoredPair({
    jsRun,
    wasmRun,
    batchSize: 1,
    iterations: 5,
    order: "wasm-first",
    onProgress: ({ variant, iteration }) => progress.push(`${variant}:${iteration}`),
    yieldTask: () => {
      yields += 1;
      return Promise.resolve();
    },
  });
  assertEquals(samples.javascript.length, 5);
  assertEquals(samples.wasm.length, 5);
  assertEquals(yields, 10);
  assertEquals(progress[0], "wasm:0");
  assert(samples.javascript.every((value) => value >= 0));
  assert(samples.wasm.every((value) => value >= 0));
});

Deno.test("scored batch rejects an earlier wrong output even when its final output is correct", async () => {
  let invocation = 0;
  const earlierWrongFinalCorrect = () => (++invocation % 2 === 0 ? ORACLE : 0);
  await assertRejects(
    () =>
      runScoredPair({
        jsRun: earlierWrongFinalCorrect,
        wasmRun: () => ORACLE,
        batchSize: 2,
        iterations: 5,
        order: "js-first",
        yieldTask: () => Promise.resolve(),
      }),
    "javascript output changed during scored iteration 1",
  );
  assertEquals(invocation, 2);
});

Deno.test("hosted statistics and fixed-work counters are exact and iteration controls are bounded", async () => {
  assertEquals(boundedIterations("5"), 5);
  assertEquals(boundedIterations("50"), 50);
  assertEquals(summarizeSamples([5, 1, 4, 2, 3]), {
    count: 5,
    medianMs: 3,
    p95Ms: 4.8,
    firstScoredMs: 5,
    samples: [5, 1, 4, 2, 3],
  });
  assertEquals(fixedWorkCounters(INPUT_LENGTH, INPUT_LENGTH * 4, 2), {
    items: 131_072,
    inputBytes: 524_288,
    additions: 131_072,
    loads: 131_072,
    boundaryCrossings: 2,
  });
  await assertRejects(() => Promise.resolve(boundedIterations(4)), "Iterations must be");
  await assertRejects(() => Promise.resolve(boundedIterations(51)), "Iterations must be");
});
