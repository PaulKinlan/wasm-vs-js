import { fixtureWords, generateOlapFixture, OLAP } from "./fixture.js";

export const OLAP_VARIANTS = Object.freeze(["js-controlled", "wasm-linear-controlled"]);
export const OUTPUT_WORDS_PER_QUERY = 112;
export const OUTPUT_WORDS = OUTPUT_WORDS_PER_QUERY * OLAP.queries;
const HEADER_WORDS = 8;

function mix(hash, value) {
  return Math.imul((hash ^ (value >>> 0)) >>> 0, 0x01000193) >>> 0;
}
function hex(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}
export function digestWords(words) {
  let hash = 0x811c9dc5;
  for (const value of words) hash = mix(hash, value);
  return hex(hash);
}
function add64(lo, hi, value) {
  const next = (lo + (value >>> 0)) >>> 0;
  return [next, (hi + (next < lo ? 1 : 0)) >>> 0];
}

function queryTrace(words) {
  const start = HEADER_WORDS + OLAP.rows * OLAP.rowWords;
  return Array.from(
    { length: OLAP.queries },
    (_, i) => words.slice(start + i * OLAP.queryWords, start + (i + 1) * OLAP.queryWords),
  );
}
function key(words, row, sortColumn) {
  return words[HEADER_WORDS + row * OLAP.rowWords + (sortColumn === 0 ? 5 : 4)];
}
function before(words, left, right, sortColumn, descending) {
  const a = key(words, left, sortColumn), b = key(words, right, sortColumn);
  if (a !== b) return descending ? a > b : a < b;
  return left < right;
}
function stableMergeSort(words, indexes, temp, sortColumn, descending, counters) {
  for (let width = 1; width < indexes.length; width *= 2) {
    for (let left = 0; left < indexes.length; left += width * 2) {
      const mid = Math.min(left + width, indexes.length);
      const right = Math.min(left + width * 2, indexes.length);
      let i = left, j = mid, out = left;
      while (i < mid && j < right) {
        counters.sortComparisons += 1;
        if (before(words, indexes[i], indexes[j], sortColumn, descending)) {
          temp[out++] = indexes[i++];
        } else temp[out++] = indexes[j++];
      }
      while (i < mid) temp[out++] = indexes[i++];
      while (j < right) temp[out++] = indexes[j++];
      for (let k = left; k < right; k += 1) indexes[k] = temp[k];
    }
  }
}

export function runOlapJavaScript(bytes = generateOlapFixture()) {
  const words = fixtureWords(bytes);
  const output = new Uint32Array(OUTPUT_WORDS);
  const counters = {
    queries: OLAP.queries,
    rowsVisited: 0,
    predicateChecks: 0,
    matchedRows: 0,
    sortComparisons: 0,
    aggregateRows: 0,
    chartBins: OLAP.queries * OLAP.categories,
    outputRows: OLAP.queries * OLAP.topRows,
    outputWords: OUTPUT_WORDS,
    allocations: OLAP.queries * 7 + 1,
    boundaryCrossings: 0,
  };
  const trace = queryTrace(words);
  for (let q = 0; q < trace.length; q += 1) {
    const [regionMask, categoryMask, minUnits, descending, sortColumn, controlRevision] = trace[q];
    const indexes = new Uint32Array(OLAP.rows);
    const temp = new Uint32Array(OLAP.rows);
    let matched = 0;
    const count = new Uint32Array(OLAP.categories);
    const unitsLo = new Uint32Array(OLAP.categories), unitsHi = new Uint32Array(OLAP.categories);
    const revenueLo = new Uint32Array(OLAP.categories),
      revenueHi = new Uint32Array(OLAP.categories);
    let filterDigest = 0x811c9dc5;
    for (let row = 0; row < OLAP.rows; row += 1) {
      const base = HEADER_WORDS + row * OLAP.rowWords;
      counters.rowsVisited += 1;
      counters.predicateChecks += 3;
      const region = words[base + 1], category = words[base + 2], units = words[base + 4];
      if (
        ((regionMask >>> region) & 1) === 0 || ((categoryMask >>> category) & 1) === 0 ||
        units < minUnits
      ) continue;
      indexes[matched++] = row;
      counters.matchedRows += 1;
      counters.aggregateRows += 1;
      filterDigest = mix(filterDigest, row);
      count[category] += 1;
      [unitsLo[category], unitsHi[category]] = add64(unitsLo[category], unitsHi[category], units);
      [revenueLo[category], revenueHi[category]] = add64(
        revenueLo[category],
        revenueHi[category],
        words[base + 5],
      );
    }
    const selected = indexes.subarray(0, matched);
    stableMergeSort(words, selected, temp, sortColumn, descending !== 0, counters);
    let out = q * OUTPUT_WORDS_PER_QUERY;
    output.set([
      q,
      matched,
      sortColumn,
      descending,
      filterDigest,
      OLAP.topRows,
      OLAP.categories,
      controlRevision,
    ], out);
    out += 8;
    for (let i = 0; i < OLAP.topRows; i += 1) {
      const row = selected[i];
      const base = HEADER_WORDS + row * OLAP.rowWords;
      output.set([row, words[base + 4], words[base + 5]], out);
      out += 3;
    }
    for (let bin = 0; bin < OLAP.categories; bin += 1) {
      output.set([count[bin], unitsLo[bin], unitsHi[bin], revenueLo[bin], revenueHi[bin]], out);
      out += 5;
    }
  }
  return finalize("js-controlled", "javascript", bytes, output, counters);
}

function finalize(variantId, executionTarget, fixture, output, counters) {
  return {
    workloadId: OLAP.workloadId,
    variantId,
    executionTarget,
    fixtureBytes: fixture.byteLength,
    outputBytes: output.byteLength,
    digest: digestWords(output),
    output,
    chartModels: decodeChartModels(output),
    counters,
  };
}
export function decodeChartModels(output) {
  const models = [];
  for (let q = 0; q < OLAP.queries; q += 1) {
    const base = q * OUTPUT_WORDS_PER_QUERY;
    const topRows = [];
    for (let i = 0; i < OLAP.topRows; i += 1) {
      const p = base + 8 + i * 3;
      topRows.push({ stableRowId: output[p], units: output[p + 1], revenueCents: output[p + 2] });
    }
    const bins = [];
    for (let i = 0; i < OLAP.categories; i += 1) {
      const p = base + 32 + i * 5;
      bins.push({
        category: i,
        count: output[p],
        unitsLow: output[p + 1],
        unitsHigh: output[p + 2],
        revenueLow: output[p + 3],
        revenueHigh: output[p + 4],
      });
    }
    models.push({
      query: output[base],
      matchedRows: output[base + 1],
      sortColumn: output[base + 2],
      descending: Boolean(output[base + 3]),
      filterDigest: hex(output[base + 4]),
      controlRevision: output[base + 7],
      topRows,
      bins,
    });
  }
  return models;
}

export async function instantiateOlapWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}
export function runOlapWasm(runtime, bytes = generateOlapFixture()) {
  fixtureWords(bytes);
  const inputPtr = runtime.input_ptr();
  new Uint8Array(runtime.memory.buffer, inputPtr, bytes.length).set(bytes);
  const words = runtime.run(bytes.length);
  if (words !== OUTPUT_WORDS) throw new Error(`Wasm output words ${words} != ${OUTPUT_WORDS}`);
  const output = new Uint32Array(runtime.memory.buffer, runtime.result_ptr(), words).slice();
  const counters = {
    queries: Number(runtime.counter(0)),
    rowsVisited: Number(runtime.counter(1)),
    predicateChecks: Number(runtime.counter(2)),
    matchedRows: Number(runtime.counter(3)),
    sortComparisons: Number(runtime.counter(4)),
    aggregateRows: Number(runtime.counter(5)),
    chartBins: Number(runtime.counter(6)),
    outputRows: Number(runtime.counter(7)),
    outputWords: Number(runtime.counter(8)),
    allocations: 0,
    boundaryCrossings: 2,
  };
  return finalize("wasm-linear-controlled", "wasm-linear", bytes, output, counters);
}
