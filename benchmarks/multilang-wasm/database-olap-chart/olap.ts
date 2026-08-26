// olap.ts — AssemblyScript multilang kernel for database.olap-chart.v1.
//
// Mirrors olap.c exactly: the same column-major access, the same FNV filter
// digest, the same bottom-up stable merge sort with its index tie-break, the
// same per-category u64 accumulation split into low and high words, and the
// same nine counters in the same order.
//
// Everything lives at fixed linear-memory offsets. The caller obtains the
// input and result regions through input_ptr() and result_ptr(), so the
// layout below is the contract; an AssemblyScript array would be
// heap-allocated somewhere the caller does not know about.

const ROWS: u32 = 10000;
const QUERIES: u32 = 5;
const CATEGORIES: u32 = 16;
const TOP: u32 = 8;
const ROW_WORDS: u32 = 6;
const QUERY_WORDS: u32 = 6;
const HEADER: u32 = 8;
const OUT_PER_QUERY: u32 = 112;
const OUTPUT_WORDS: u32 = QUERIES * OUT_PER_QUERY;
const MAGIC: u32 = 0x50414c4f;

const INPUT_WORDS: u32 = HEADER + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS;

const INPUT_OFF: usize = 0;
const RESULT_OFF: usize = INPUT_OFF + (<usize> INPUT_WORDS) * 4;
const INDEXES_OFF: usize = RESULT_OFF + (<usize> OUTPUT_WORDS) * 4;
const TEMPORARY_OFF: usize = INDEXES_OFF + (<usize> ROWS) * 4;
const COUNTERS_OFF: usize = TEMPORARY_OFF + (<usize> ROWS) * 4;
// Per-query aggregates: u32 count, u64 units, u64 revenue per category.
const COUNT_OFF: usize = COUNTERS_OFF + 9 * 4;
const UNITS_OFF: usize = COUNT_OFF + (<usize> CATEGORIES) * 4;
const REVENUE_OFF: usize = UNITS_OFF + (<usize> CATEGORIES) * 8;

function iw(i: u32): u32 {
  return load<u32>(INPUT_OFF + (<usize> i) * 4);
}

function setRw(i: u32, v: u32): void {
  store<u32>(RESULT_OFF + (<usize> i) * 4, v);
}

function idx(i: u32): u32 {
  return load<u32>(INDEXES_OFF + (<usize> i) * 4);
}

function setIdx(i: u32, v: u32): void {
  store<u32>(INDEXES_OFF + (<usize> i) * 4, v);
}

function bump(i: u32, by: u32 = 1): void {
  store<u32>(COUNTERS_OFF + (<usize> i) * 4, load<u32>(COUNTERS_OFF + (<usize> i) * 4) + by);
}

export function input_ptr(): u32 {
  return <u32> INPUT_OFF;
}

export function result_ptr(): u32 {
  return <u32> RESULT_OFF;
}

export function counter(index: u32): u32 {
  return index < 9 ? load<u32>(COUNTERS_OFF + (<usize> index) * 4) : 0;
}

function mix(hash: u32, value: u32): u32 {
  return (hash ^ value) * 0x01000193;
}

function columnValue(column: u32, row: u32): u32 {
  return iw(HEADER + column * ROWS + row);
}

function rowKey(row: u32, column: u32): u32 {
  return columnValue(column == 0 ? 5 : 4, row);
}

function before(left: u32, right: u32, column: u32, descending: u32): bool {
  const a: u32 = rowKey(left, column), b: u32 = rowKey(right, column);
  if (a != b) return descending ? a > b : a < b;
  return left < right;
}

function stableSort(length: u32, column: u32, descending: u32): void {
  for (let width: u32 = 1; width < length; width *= 2) {
    for (let left: u32 = 0; left < length; left += width * 2) {
      const mid: u32 = left + width < length ? left + width : length;
      const right: u32 = left + width * 2 < length ? left + width * 2 : length;
      let i: u32 = left, j: u32 = mid, out: u32 = left;
      while (i < mid && j < right) {
        bump(4);
        if (before(idx(i), idx(j), column, descending)) {
          store<u32>(TEMPORARY_OFF + (<usize> out) * 4, idx(i));
          i++;
        } else {
          store<u32>(TEMPORARY_OFF + (<usize> out) * 4, idx(j));
          j++;
        }
        out++;
      }
      while (i < mid) {
        store<u32>(TEMPORARY_OFF + (<usize> out) * 4, idx(i));
        i++;
        out++;
      }
      while (j < right) {
        store<u32>(TEMPORARY_OFF + (<usize> out) * 4, idx(j));
        j++;
        out++;
      }
      for (let k: u32 = left; k < right; k++) {
        setIdx(k, load<u32>(TEMPORARY_OFF + (<usize> k) * 4));
      }
    }
  }
}

export function run(byteLength: u32): u32 {
  const expected: u32 = INPUT_WORDS * 4;
  if (
    byteLength != expected || iw(0) != MAGIC || iw(1) != 1 || iw(2) != ROWS ||
    iw(3) != QUERIES || iw(4) != CATEGORIES || iw(5) != TOP ||
    iw(6) != ROW_WORDS || iw(7) != QUERY_WORDS
  ) return 0;

  for (let i: u32 = 0; i < 9; i++) store<u32>(COUNTERS_OFF + (<usize> i) * 4, 0);
  store<u32>(COUNTERS_OFF, QUERIES);
  store<u32>(COUNTERS_OFF + 6 * 4, QUERIES * CATEGORIES);
  store<u32>(COUNTERS_OFF + 7 * 4, QUERIES * TOP);
  store<u32>(COUNTERS_OFF + 8 * 4, OUTPUT_WORDS);

  const queryStart: u32 = HEADER + ROWS * ROW_WORDS;
  for (let q: u32 = 0; q < QUERIES; q++) {
    const qp: u32 = queryStart + q * QUERY_WORDS;
    const regionMask: u32 = iw(qp), categoryMask: u32 = iw(qp + 1);
    const minUnits: u32 = iw(qp + 2), descending: u32 = iw(qp + 3);
    const sortColumn: u32 = iw(qp + 4), revision: u32 = iw(qp + 5);

    for (let b: u32 = 0; b < CATEGORIES; b++) {
      store<u32>(COUNT_OFF + (<usize> b) * 4, 0);
      store<u64>(UNITS_OFF + (<usize> b) * 8, 0);
      store<u64>(REVENUE_OFF + (<usize> b) * 8, 0);
    }

    let matched: u32 = 0;
    let filterDigest: u32 = 0x811c9dc5;
    for (let row: u32 = 0; row < ROWS; row++) {
      const region: u32 = columnValue(1, row);
      const category: u32 = columnValue(2, row);
      const amount: u32 = columnValue(4, row);
      bump(1);
      bump(2, 3);
      if (
        ((regionMask >> region) & 1) == 0 || ((categoryMask >> category) & 1) == 0 ||
        amount < minUnits
      ) continue;
      setIdx(matched, row);
      matched++;
      bump(3);
      bump(5);
      filterDigest = mix(filterDigest, row);
      store<u32>(
        COUNT_OFF + (<usize> category) * 4,
        load<u32>(COUNT_OFF + (<usize> category) * 4) + 1,
      );
      store<u64>(
        UNITS_OFF + (<usize> category) * 8,
        load<u64>(UNITS_OFF + (<usize> category) * 8) + <u64> amount,
      );
      store<u64>(
        REVENUE_OFF + (<usize> category) * 8,
        load<u64>(REVENUE_OFF + (<usize> category) * 8) + <u64> columnValue(5, row),
      );
    }

    stableSort(matched, sortColumn, descending);

    let out: u32 = q * OUT_PER_QUERY;
    setRw(out++, q);
    setRw(out++, matched);
    setRw(out++, sortColumn);
    setRw(out++, descending);
    setRw(out++, filterDigest);
    setRw(out++, TOP);
    setRw(out++, CATEGORIES);
    setRw(out++, revision);
    for (let i: u32 = 0; i < TOP; i++) {
      const row: u32 = idx(i);
      setRw(out++, row);
      setRw(out++, columnValue(4, row));
      setRw(out++, columnValue(5, row));
    }
    for (let b: u32 = 0; b < CATEGORIES; b++) {
      setRw(out++, load<u32>(COUNT_OFF + (<usize> b) * 4));
      const u: u64 = load<u64>(UNITS_OFF + (<usize> b) * 8);
      setRw(out++, <u32> u);
      setRw(out++, <u32> (u >> 32));
      const r: u64 = load<u64>(REVENUE_OFF + (<usize> b) * 8);
      setRw(out++, <u32> r);
      setRw(out++, <u32> (r >> 32));
    }
  }
  return OUTPUT_WORDS;
}
