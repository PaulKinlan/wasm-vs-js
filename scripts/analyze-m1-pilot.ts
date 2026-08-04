// M1 Pilot Statistical Analysis.
// Processes cold/warm evidence JSONs with paired log-ratio estimators and
// exact order-statistic precision bounds per the preregistration.
//
// Usage: deno run --allow-read scripts/analyze-m1-pilot.ts [evidence-cold.json] [evidence-warm.json]

import { glob } from "jsr:@std/fs@1";

// ── Types ──

type AttemptTimings = {
  js: {
    firstScored: string | null;
    median: string | null;
    p95: string | null;
    count: string | null;
  };
  wasm: {
    firstScored: string | null;
    median: string | null;
    p95: string | null;
    count: string | null;
  };
  trajectorySamples: number;
};

type AttemptResult = {
  attempt: number;
  success: boolean;
  timings?: AttemptTimings;
  screenshotPath?: string;
};

type EvidenceFile = {
  timestamp: string;
  stratum: string;
  maxAttempts: number;
  browserInfo: { product: string; userAgent: string; launchArguments: string[] };
  results: AttemptResult[];
};

type StratumAnalysis = {
  stratum: string;
  totalAttempts: number;
  successfulAttempts: number;
  pairsExtracted: number;
  logRatios: number[];
  meanLogRatio: number | null;
  medianLogRatio: number | null;
  precisionPct: number | null;
  bonferroniPrecisionMet: boolean;
  jsMedianMs: number | null;
  wasmMedianMs: number | null;
  ratioGeometricMean: number | null;
};

// ── Helpers ──

function parseMs(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)\s*ms/);
  return match ? parseFloat(match[1]) : null;
}

function logRatio(jsMs: number, wasmMs: number): number {
  return Math.log(jsMs / wasmMs);
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], meanValue: number): number {
  if (values.length < 2) return 0;
  return Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - meanValue, 2), 0) / (values.length - 1),
  );
}

// Exact order-statistic precision: width of the central 95% interval of log-ratios
// as a percentage of the median. Bonferroni-protected for 2 strata (alpha = 0.025).
function precisionBound(sortedLogRatios: number[]): number {
  if (sortedLogRatios.length < 20) return Infinity;
  const lower = percentile(sortedLogRatios, 0.025);
  const upper = percentile(sortedLogRatios, 0.975);
  const med = percentile(sortedLogRatios, 0.5);
  if (med === 0) return Infinity;
  return Math.abs((upper - lower) / med) * 100;
}

// ── Analysis ──

function analyzeStratum(evidence: EvidenceFile): StratumAnalysis {
  const results = evidence.results;
  const successful = results.filter((r) => r.success);

  // Extract paired timings
  const pairs: Array<{ js: number; wasm: number; attempt: number }> = [];

  for (const r of successful) {
    if (!r.timings) continue;
    const jsMedian = parseMs(r.timings.js.median);
    const wasmMedian = parseMs(r.timings.wasm.median);
    if (jsMedian !== null && wasmMedian !== null && jsMedian > 0 && wasmMedian > 0) {
      pairs.push({ js: jsMedian, wasm: wasmMedian, attempt: r.attempt });
    }
  }

  // Compute log-ratios
  const logRatios = pairs.map((p) => logRatio(p.js, p.wasm)).sort((a, b) => a - b);

  const meanLR = logRatios.length > 0 ? mean(logRatios) : null;
  const medianLR = logRatios.length > 0 ? percentile(logRatios, 0.5) : null;
  const precision = logRatios.length >= 20 ? precisionBound(logRatios) : null;
  const geoMean = meanLR !== null ? Math.exp(meanLR) : null;

  // Aggregate medians
  const jsMedians = pairs.map((p) => p.js);
  const wasmMedians = pairs.map((p) => p.wasm);

  return {
    stratum: evidence.stratum,
    totalAttempts: results.length,
    successfulAttempts: successful.length,
    pairsExtracted: pairs.length,
    logRatios,
    meanLogRatio: meanLR,
    medianLogRatio: medianLR,
    precisionPct: precision,
    bonferroniPrecisionMet: precision !== null && precision <= 3.0,
    jsMedianMs: jsMedians.length > 0 ? percentile(jsMedians.sort((a, b) => a - b), 0.5) : null,
    wasmMedianMs: wasmMedians.length > 0
      ? percentile(wasmMedians.sort((a, b) => a - b), 0.5)
      : null,
    ratioGeometricMean: geoMean,
  };
}

// ── Reporting ──

function reportAnalysis(analysis: StratumAnalysis): void {
  console.log(`\n=== ${analysis.stratum.toUpperCase()} STRATUM ===`);
  console.log(`  Total attempts: ${analysis.totalAttempts}`);
  console.log(`  Successful: ${analysis.successfulAttempts}`);
  console.log(`  Pairs extracted: ${analysis.pairsExtracted}`);

  if (analysis.pairsExtracted === 0) {
    console.log(`  ⚠ NO TIMING DATA — evidence contains success/screenshot only.`);
    console.log(`    Timing extraction from page DOM not captured in this run.`);
    return;
  }

  console.log(`\n  Log-ratio statistics:`);
  console.log(`    Mean: ${analysis.meanLogRatio?.toFixed(6)}`);
  console.log(`    Median: ${analysis.medianLogRatio?.toFixed(6)}`);
  console.log(`    Geometric mean ratio (JS/Wasm): ${analysis.ratioGeometricMean?.toFixed(4)}`);
  console.log(`    StdDev: ${stdDev(analysis.logRatios, analysis.meanLogRatio ?? 0).toFixed(6)}`);

  console.log(`\n  Timing medians:`);
  console.log(`    JS: ${analysis.jsMedianMs?.toFixed(3)} ms`);
  console.log(`    Wasm: ${analysis.wasmMedianMs?.toFixed(3)} ms`);

  console.log(`\n  Precision (Bonferroni α=0.025, 3% threshold):`);
  console.log(`    Order-statistic precision: ${analysis.precisionPct?.toFixed(2)}%`);
  console.log(`    Threshold met: ${analysis.bonferroniPrecisionMet ? "YES ✓" : "NO"}`);

  if (analysis.pairsExtracted < 20) {
    console.log(`    ⚠ Fewer than 20 pairs — cannot assess precision`);
  } else if (!analysis.bonferroniPrecisionMet) {
    console.log(`    Stratum inconclusive at this sample size`);
  }
}

// ── Main ──

async function main(): Promise<void> {
  const args = Deno.args;
  const coldFiles = args.length > 0 && args[0] !== ""
    ? [args[0]]
    : [...await glob("raw/m1-pilot-evidence-cold-*.json")].sort();
  const warmFiles = args.length > 1 && args[1] !== ""
    ? [args[1]]
    : [...await glob("raw/m1-pilot-evidence-warm-*.json")].sort();

  const analyses: StratumAnalysis[] = [];

  for (const [label, files] of [["cold", coldFiles], ["warm", warmFiles]] as const) {
    if (files.length === 0) {
      console.log(`No ${label} evidence found`);
      continue;
    }
    const evidence: EvidenceFile = JSON.parse(await Deno.readTextFile(files[files.length - 1]));
    console.log(`\nLoaded ${label} evidence: ${files[files.length - 1]}`);
    console.log(`Browser: ${evidence.browserInfo.product}`);
    const analysis = analyzeStratum(evidence);
    reportAnalysis(analysis);
    analyses.push(analysis);
  }

  // Cross-stratum summary
  if (analyses.length >= 2) {
    console.log("\n=== CROSS-STRATUM SUMMARY ===");
    const allPairs = analyses.reduce((sum, a) => sum + a.pairsExtracted, 0);
    console.log(`Total pairs across strata: ${allPairs}`);
    for (const a of analyses) {
      const status = a.pairsExtracted === 0
        ? "no timing data"
        : a.bonferroniPrecisionMet
        ? "precision met"
        : a.pairsExtracted >= 20
        ? "inconclusive"
        : "insufficient pairs";
      console.log(`  ${a.stratum}: ${a.pairsExtracted} pairs, ${status}`);
    }
  }

  // Write summary JSON
  const summaryPath = "raw/m1-pilot-analysis-summary.json";
  const summary = {
    timestamp: new Date().toISOString(),
    analyses: analyses.map((a) => ({
      stratum: a.stratum,
      totalAttempts: a.totalAttempts,
      successfulAttempts: a.successfulAttempts,
      pairsExtracted: a.pairsExtracted,
      meanLogRatio: a.meanLogRatio,
      medianLogRatio: a.medianLogRatio,
      precisionPct: a.precisionPct,
      bonferroniPrecisionMet: a.bonferroniPrecisionMet,
      jsMedianMs: a.jsMedianMs,
      wasmMedianMs: a.wasmMedianMs,
      ratioGeometricMean: a.ratioGeometricMean,
    })),
  };
  await Deno.writeTextFile(summaryPath, JSON.stringify(summary, null, 2) + "\n");
  console.log(`\nSummary written to ${summaryPath}`);
}

await main().catch((e) => {
  console.error("Analysis failed:", e);
  Deno.exit(1);
});
