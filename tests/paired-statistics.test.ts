import {
  deriveBootstrapSeed,
  descriptivePairedLogRatioBootstrap,
  evaluateAttemptCheckpoint,
  exactMedianInterval,
  medianEvenAverage,
  multiplicativeHalfWidth,
  pairedEffects,
  percentileType7,
  XorShift32,
} from "../lib/paired-statistics.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

Deno.test("median, type-7 percentiles, and exact order-stat interval are frozen", () => {
  assertEquals(medianEvenAverage([4, 1, 3, 2]), 2.5);
  assertEquals(percentileType7([0, 10, 20, 30, 40], 0.25), 10);
  const interval = exactMedianInterval(Array.from({ length: 20 }, (_, index) => index + 1), 0.01);
  assertEquals(interval.lowerOrderStatistic, 4);
  assertEquals(interval.upperOrderStatistic, 17);
  assertEquals(interval.lower, 4);
  assertEquals(interval.upper, 17);
  assert(interval.confidenceAtLeast >= 0.99);
  assertEquals(multiplicativeHalfWidth(Number.NEGATIVE_INFINITY, 1), Number.POSITIVE_INFINITY);
});

Deno.test("exact median interval retains ties and rejects nonfinite evidence", async () => {
  const interval = exactMedianInterval(Array(20).fill(7), 0.01);
  assertEquals(interval.lower, 7);
  assertEquals(interval.upper, 7);
  assertEquals(multiplicativeHalfWidth(interval.lower, interval.upper), 0);
  await assertRejects(() => Promise.resolve(exactMedianInterval([1, Number.NaN], 0.01)), "finite");
  await assertRejects(() => Promise.resolve(exactMedianInterval([], 0.01)), "requires values");
  await assertRejects(
    () => Promise.resolve(exactMedianInterval(Array(121).fill(1), 0.01)),
    "bounded to 120",
  );
});

Deno.test("xorshift32 transition, zero handling, and multiply-high indices are golden", () => {
  const random = new XorShift32(1);
  assertEquals([random.nextWord(), random.nextWord(), random.nextWord()], [
    270369,
    67634689,
    2647435461,
  ]);
  const zero = new XorShift32(0);
  assertEquals(zero.nextWord(), 1085196063);
  const indexed = new XorShift32(0x12345678);
  assertEquals([indexed.index(7), indexed.index(7), indexed.index(7)], [3, 0, 1]);
  assertEquals(deriveBootstrapSeed(0x7a31c9e5, "cold", 20), 3796127030);
  assertEquals(deriveBootstrapSeed(0x7a31c9e5, "warm", 60), 2741682123);
});

Deno.test("descriptive paired log-ratio bootstrap is deterministic and unambiguous", async () => {
  const javascriptMedians = Array(20).fill(10);
  const wasmMedians = Array.from({ length: 20 }, (_, index) => 5 + index / 10);
  const first = descriptivePairedLogRatioBootstrap(javascriptMedians, wasmMedians, {
    stratum: "cold",
    attemptedCheckpoint: 20,
  });
  const second = descriptivePairedLogRatioBootstrap(javascriptMedians, wasmMedians, {
    stratum: "cold",
    attemptedCheckpoint: 20,
  });
  assertEquals(first, second);
  assertEquals(first.role, "descriptive-sensitivity-only-never-confidence-or-stopping");
  assertEquals(first.estimand, "median-even-average-v1-of-paired-log-ratios");
  assertEquals(first.derivedSeed, 3796127030);
  assertEquals(first.resamples, 10_000);
  assertEquals(first.p005, -0.6070115700897187);
  assertEquals(first.p50, -0.5192291829241813);
  assertEquals(first.p995, -0.4385350093604369);
  const absoluteDifferences = wasmMedians.map((value, index) => value - javascriptMedians[index]);
  await assertRejects(
    () =>
      Promise.resolve(descriptivePairedLogRatioBootstrap(
        absoluteDifferences,
        [1],
        { stratum: "cold", attemptedCheckpoint: 20 },
      )),
    "equal length",
  );
});

Deno.test("attempt checkpoints reconcile failures and always reach a frozen terminal state", async () => {
  const zeroCommitted = evaluateAttemptCheckpoint(
    {
      attempted: 20,
      committed: 0,
      failedCorrectness: 20,
      failedMeasurement: 0,
      blockedContainment: 0,
      blockedCache: 0,
      blockedProvenance: 0,
    },
    [],
    [],
  );
  assertEquals(zeroCommitted.terminal, "continue");
  const underFloor = evaluateAttemptCheckpoint(
    {
      attempted: 20,
      committed: 18,
      failedCorrectness: 1,
      failedMeasurement: 0,
      blockedContainment: 0,
      blockedCache: 1,
      blockedProvenance: 0,
    },
    Array(18).fill(10),
    Array(18).fill(5),
  );
  assertEquals(underFloor.terminal, "continue");
  assertEquals(underFloor.effects, null);
  const capUnderFloor = evaluateAttemptCheckpoint(
    {
      attempted: 60,
      committed: 19,
      failedCorrectness: 1,
      failedMeasurement: 10,
      blockedContainment: 10,
      blockedCache: 10,
      blockedProvenance: 10,
    },
    Array(19).fill(10),
    Array(19).fill(5),
  );
  assertEquals(capUnderFloor.terminal, "cap-inconclusive");
  for (const attempted of [20, 60] as const) {
    const committed = attempted === 20 ? 2 : 2;
    const accounting = {
      attempted,
      committed,
      failedCorrectness: attempted - committed,
      failedMeasurement: 0,
      blockedContainment: 0,
      blockedCache: 0,
      blockedProvenance: 0,
    };
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      await assertRejects(
        () =>
          Promise.resolve(evaluateAttemptCheckpoint(
            accounting,
            [10, invalid],
            [5, 5],
          )),
        invalid <= 0 ? "positive" : "finite",
      );
      await assertRejects(
        () =>
          Promise.resolve(evaluateAttemptCheckpoint(
            accounting,
            [10, 10],
            [5, invalid],
          )),
        invalid <= 0 ? "positive" : "finite",
      );
    }
  }
  const precise = evaluateAttemptCheckpoint(
    {
      attempted: 20,
      committed: 20,
      failedCorrectness: 0,
      failedMeasurement: 0,
      blockedContainment: 0,
      blockedCache: 0,
      blockedProvenance: 0,
    },
    Array(20).fill(10),
    Array(20).fill(5),
  );
  assertEquals(precise.terminal, "precision-met");
  await assertRejects(
    () =>
      Promise.resolve(evaluateAttemptCheckpoint(
        {
          attempted: 20,
          committed: 20,
          failedCorrectness: 1,
          failedMeasurement: 0,
          blockedContainment: 0,
          blockedCache: 0,
          blockedProvenance: 0,
        },
        Array(20).fill(10),
        Array(20).fill(5),
      )),
    "does not reconcile",
  );
});

Deno.test("paired log-ratio and absolute-difference estimators share exact intervals", () => {
  const js = Array.from({ length: 20 }, (_, index) => 10 + index);
  const wasm = js.map((value) => value * 0.5);
  const result = pairedEffects(js, wasm, 0.01);
  assert(Math.abs(result.logRatio.ratio - 0.5) < 1e-12);
  assert(Math.abs(result.logRatio.interval.lower - Math.log(0.5)) < 1e-12);
  assert(Math.abs(result.logRatio.interval.upper - Math.log(0.5)) < 1e-12);
  assertEquals(result.logRatio.multiplicativeHalfWidth, 0);
  assertEquals(result.absoluteDifferenceMs.point, -9.75);
  assertEquals(result.absoluteDifferenceMs.interval.lower, -13);
  assertEquals(result.absoluteDifferenceMs.interval.upper, -6.5);
});
