export const EXPECTED_OLAP_DIGEST = "e26a152f";

const CORE_COUNTERS = Object.freeze([
  "queries",
  "rowsVisited",
  "predicateChecks",
  "matchedRows",
  "sortComparisons",
  "aggregateRows",
  "chartBins",
  "outputRows",
  "outputWords",
]);

function fail(message) {
  throw new Error(`OLAP correctness gate failed: ${message}`);
}

function exactJson(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} mismatch`);
}

function exactWords(actual, expected, label) {
  if (!(actual instanceof Uint32Array) || !Array.isArray(expected)) fail(`${label} is incomplete`);
  if (actual.length !== expected.length) fail(`${label} length mismatch`);
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) fail(`${label} mismatch at word ${index}`);
  }
}

export function validateOlapBrowserResults(javascript, wasm, oracle) {
  if (
    !oracle || oracle.schemaVersion !== 1 || oracle.workloadId !== "database.olap-chart.v1" ||
    oracle.status !== "correctness-validation-not-performance"
  ) fail("oracle identity mismatch");
  const expected = oracle.completeOutput;
  if (
    !expected || expected.digestAlgorithm !== "fnv1a-u32le-v1" ||
    expected.digest !== EXPECTED_OLAP_DIGEST || expected.words !== 560 || expected.bytes !== 2240
  ) fail("oracle output contract mismatch");

  for (const [name, result] of [["JavaScript", javascript], ["Wasm", wasm]]) {
    if (result.workloadId !== oracle.workloadId || result.digest !== EXPECTED_OLAP_DIGEST) {
      fail(`${name} digest mismatch`);
    }
    if (result.outputBytes !== expected.bytes) fail(`${name} output byte count mismatch`);
    exactWords(result.output, expected.values, `${name} complete output`);
    exactJson(result.chartModels, expected.chartModels, `${name} five-model oracle`);
    if (
      result.chartModels.length !== 5 ||
      result.chartModels.some((model, index) =>
        model.controlRevision !== index + 1 || model.bins.length !== 16 ||
        model.topRows.length !== 8
      )
    ) fail(`${name} model structure mismatch`);
    exactJson(result.counters, oracle.variants[result.variantId]?.counters, `${name} counters`);
  }

  exactWords(wasm.output, Array.from(javascript.output), "cross-target complete output");
  exactJson(wasm.chartModels, javascript.chartModels, "cross-target chart models");
  for (const counter of CORE_COUNTERS) {
    if (javascript.counters[counter] !== wasm.counters[counter]) {
      fail(`cross-target ${counter} counter mismatch`);
    }
  }

  return {
    expectedDigest: EXPECTED_OLAP_DIGEST,
    exactArtifactHashes: true,
    fullOutputValidated: true,
    countersValidated: true,
    crossTargetValidated: true,
    oracleValidated: true,
    allFiveModelsValidated: true,
  };
}
