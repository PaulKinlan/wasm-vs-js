const UINT32_RANGE = 0x1_0000_0000n;
const DEFAULT_ZERO_REPLACEMENT = 0x6d2b79f5;

function finiteValues(values: number[], label: string): number[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} requires values`);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} requires finite values`);
  }
  return [...values];
}

export function medianEvenAverage(values: number[]): number {
  const sorted = finiteValues(values, "median").sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function percentileType7(values: number[], probability: number): number {
  const sorted = finiteValues(values, "percentile").sort((left, right) => left - right);
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error("probability must be in [0,1]");
  }
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

function binomialCoefficient(n: number, k: number): bigint {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(k) || n < 0 || k < 0 || k > n) return 0n;
  const symmetric = Math.min(k, n - k);
  let result = 1n;
  for (let index = 1; index <= symmetric; index += 1) {
    result = result * BigInt(n - symmetric + index) / BigInt(index);
  }
  return result;
}

function cumulativeBinomialNumerator(n: number, k: number): bigint {
  let sum = 0n;
  for (let index = 0; index <= k; index += 1) sum += binomialCoefficient(n, index);
  return sum;
}

export type ExactMedianInterval = {
  algorithm: "exact-distribution-free-sign-order-statistic-v1";
  alpha: number;
  confidenceAtLeast: number;
  sampleCount: number;
  lowerOrderStatistic: number | null;
  upperOrderStatistic: number | null;
  lower: number;
  upper: number;
};

export function exactMedianInterval(values: number[], alpha = 0.01): ExactMedianInterval {
  const sorted = finiteValues(values, "exact median interval").sort((left, right) => left - right);
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error("alpha must be in (0,1)");
  }
  const n = sorted.length;
  if (n > 120) throw new Error("exact median interval is bounded to 120 values");
  const denominator = 2n ** BigInt(n);
  let selected = -1;
  for (let k = 0; k < Math.floor(n / 2); k += 1) {
    const twoSidedTail = Number(2n * cumulativeBinomialNumerator(n, k)) / Number(denominator);
    if (twoSidedTail <= alpha) selected = k;
    else break;
  }
  if (selected < 0) {
    return {
      algorithm: "exact-distribution-free-sign-order-statistic-v1",
      alpha,
      confidenceAtLeast: 1 - alpha,
      sampleCount: n,
      lowerOrderStatistic: null,
      upperOrderStatistic: null,
      lower: Number.NEGATIVE_INFINITY,
      upper: Number.POSITIVE_INFINITY,
    };
  }
  const twoSidedTail = Number(2n * cumulativeBinomialNumerator(n, selected)) /
    Number(denominator);
  return {
    algorithm: "exact-distribution-free-sign-order-statistic-v1",
    alpha,
    confidenceAtLeast: 1 - twoSidedTail,
    sampleCount: n,
    lowerOrderStatistic: selected + 1,
    upperOrderStatistic: n - selected,
    lower: sorted[selected],
    upper: sorted[n - selected - 1],
  };
}

export function multiplicativeHalfWidth(lowerLog: number, upperLog: number): number {
  if (!Number.isFinite(lowerLog) || !Number.isFinite(upperLog) || upperLog < lowerLog) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.exp((upperLog - lowerLog) / 2) - 1;
}

export class XorShift32 {
  #state: number;

  constructor(seed: number, zeroReplacement = DEFAULT_ZERO_REPLACEMENT) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      throw new Error("xorshift seed must be uint32");
    }
    if (
      !Number.isSafeInteger(zeroReplacement) || zeroReplacement <= 0 ||
      zeroReplacement > 0xffff_ffff
    ) {
      throw new Error("xorshift zero replacement must be non-zero uint32");
    }
    this.#state = seed === 0 ? zeroReplacement >>> 0 : seed >>> 0;
  }

  nextWord(): number {
    let value = this.#state;
    value = (value ^ (value << 13)) >>> 0;
    value = (value ^ (value >>> 17)) >>> 0;
    value = (value ^ (value << 5)) >>> 0;
    this.#state = value >>> 0;
    return this.#state;
  }

  index(length: number): number {
    if (!Number.isSafeInteger(length) || length < 1 || length > 0xffff_ffff) {
      throw new Error("sample length must be uint32-positive");
    }
    return Number((BigInt(this.nextWord()) * BigInt(length)) / UINT32_RANGE);
  }
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function deriveBootstrapSeed(
  baseSeed: number,
  stratum: "cold" | "warm",
  attemptedCheckpoint: 20 | 30 | 40 | 50 | 60,
): number {
  if (!Number.isSafeInteger(baseSeed) || baseSeed < 0 || baseSeed > 0xffff_ffff) {
    throw new Error("base seed must be uint32");
  }
  const seedLabel = `0x${baseSeed.toString(16).padStart(8, "0")}:${stratum}:${attemptedCheckpoint}`;
  const derived = (fnv1a32(seedLabel) ^ baseSeed) >>> 0;
  return derived === 0 ? DEFAULT_ZERO_REPLACEMENT : derived;
}

export type DescriptiveBootstrap = {
  role: "descriptive-sensitivity-only-never-confidence-or-stopping";
  algorithm: "paired-percentile-bootstrap-type7-v1";
  resamples: number;
  derivedSeed: number;
  p005: number;
  p50: number;
  p995: number;
};

export function descriptivePairedBootstrap(
  values: number[],
  options: {
    baseSeed?: number;
    stratum: "cold" | "warm";
    attemptedCheckpoint: 20 | 30 | 40 | 50 | 60;
    resamples?: number;
  },
): DescriptiveBootstrap {
  const source = finiteValues(values, "bootstrap");
  const resamples = options.resamples ?? 10_000;
  if (!Number.isSafeInteger(resamples) || resamples < 1 || resamples > 100_000) {
    throw new Error("resamples must be an integer in [1,100000]");
  }
  const seed = deriveBootstrapSeed(
    options.baseSeed ?? 0x7a31c9e5,
    options.stratum,
    options.attemptedCheckpoint,
  );
  const random = new XorShift32(seed);
  const estimates: number[] = [];
  for (let repetition = 0; repetition < resamples; repetition += 1) {
    const sample: number[] = [];
    for (let index = 0; index < source.length; index += 1) {
      sample.push(source[random.index(source.length)]);
    }
    estimates.push(medianEvenAverage(sample));
  }
  return {
    role: "descriptive-sensitivity-only-never-confidence-or-stopping",
    algorithm: "paired-percentile-bootstrap-type7-v1",
    resamples,
    derivedSeed: seed,
    p005: percentileType7(estimates, 0.005),
    p50: percentileType7(estimates, 0.5),
    p995: percentileType7(estimates, 0.995),
  };
}

export type AttemptAccounting = {
  attempted: number;
  committed: number;
  failedCorrectness: number;
  failedMeasurement: number;
  blockedContainment: number;
  blockedCache: number;
  blockedProvenance: number;
};

export function evaluateAttemptCheckpoint(
  accounting: AttemptAccounting,
  javascriptMedians: number[],
  wasmMedians: number[],
): {
  terminal: "continue" | "precision-met" | "cap-inconclusive";
  reason: string;
  effects: ReturnType<typeof pairedEffects> | null;
} {
  const checkpoints = [20, 30, 40, 50, 60];
  if (!checkpoints.includes(accounting.attempted)) {
    throw new Error("attempted count is not a frozen checkpoint");
  }
  const fields = Object.values(accounting);
  if (fields.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("accounting counts must be non-negative integers");
  }
  const reconciled = accounting.committed + accounting.failedCorrectness +
    accounting.failedMeasurement + accounting.blockedContainment + accounting.blockedCache +
    accounting.blockedProvenance;
  if (reconciled !== accounting.attempted) throw new Error("attempt accounting does not reconcile");
  if (
    javascriptMedians.length !== accounting.committed ||
    wasmMedians.length !== accounting.committed
  ) throw new Error("committed pair arrays do not reconcile");
  if (accounting.committed < 20) {
    return accounting.attempted === 60
      ? {
        terminal: "cap-inconclusive",
        reason: "60 attempts exhausted with fewer than 20 committed pairs",
        effects: null,
      }
      : {
        terminal: "continue",
        reason: "fewer than 20 committed pairs; precision not inspected",
        effects: null,
      };
  }
  const effects = pairedEffects(javascriptMedians, wasmMedians, 0.01);
  if (
    Number.isFinite(effects.logRatio.interval.lower) &&
    Number.isFinite(effects.logRatio.interval.upper) &&
    effects.logRatio.multiplicativeHalfWidth <= 0.03
  ) {
    return { terminal: "precision-met", reason: "exact interval met 3% precision", effects };
  }
  return accounting.attempted === 60
    ? { terminal: "cap-inconclusive", reason: "60 attempts exhausted without precision", effects }
    : { terminal: "continue", reason: "precision absent at frozen checkpoint", effects };
}

export function pairedEffects(
  javascriptMedians: number[],
  wasmMedians: number[],
  alpha = 0.01,
): {
  logRatio: {
    values: number[];
    point: number;
    ratio: number;
    interval: ExactMedianInterval;
    multiplicativeHalfWidth: number;
  };
  absoluteDifferenceMs: { values: number[]; point: number; interval: ExactMedianInterval };
} {
  const js = finiteValues(javascriptMedians, "JavaScript medians");
  const wasm = finiteValues(wasmMedians, "Wasm medians");
  if (js.length !== wasm.length) throw new Error("paired arrays must have equal length");
  if (js.some((value) => value <= 0) || wasm.some((value) => value <= 0)) {
    throw new Error("paired medians must be positive");
  }
  const logValues = wasm.map((value, index) => Math.log(value / js[index]));
  const differenceValues = wasm.map((value, index) => value - js[index]);
  const logInterval = exactMedianInterval(logValues, alpha);
  return {
    logRatio: {
      values: logValues,
      point: medianEvenAverage(logValues),
      ratio: Math.exp(medianEvenAverage(logValues)),
      interval: logInterval,
      multiplicativeHalfWidth: multiplicativeHalfWidth(logInterval.lower, logInterval.upper),
    },
    absoluteDifferenceMs: {
      values: differenceValues,
      point: medianEvenAverage(differenceValues),
      interval: exactMedianInterval(differenceValues, alpha),
    },
  };
}
