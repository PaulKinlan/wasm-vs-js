// table_sort_kernel.ts — AssemblyScript multilang compute core for
// dom.table-sort-filter-pagination.v1. Same ABI as the C kernel: generates
// the frozen 120-action trace from seed 0x31415926, runs the 5,000-row JS
// reference model, writes counters to a fixed offset, returns pageScoreSum.
// Raw linear-memory access only (no heap allocation, no runtime imports).

const ROWS = 5000;
const PAGE = 50;
const ACTIONS = 120;
const SCORES_OFFSET: usize = 0; // i32[5000] → bytes 0..20000
const FILT_OFFSET: usize = 20000; // i32[5000] → bytes 20000..40000
const RESULTS_OFFSET: usize = 40000; // u32[5] → bytes 40000..40020
// Two 8-byte scratch buffers for name-column string comparison (no heap alloc).
const NAME_A_OFFSET: usize = 40032;
const NAME_B_OFFSET: usize = 40048;

let seed: u32 = 0;

function randNext(): f64 {
  seed ^= seed << 13;
  // replicate the JS engine's rand(): >> 17 applies to the int32
  // interpretation (arithmetic, sign-extending).
  seed ^= (<i32> seed >> 17) as u32;
  seed ^= seed << 5;
  return (<f64> seed) / 4294967296.0;
}

function catRank(c: i32): i32 {
  if (c === 0) return 0;
  if (c === 1) return 1;
  if (c === 2) return 4;
  if (c === 3) return 2;
  return 3;
}
function statRank(s: i32): i32 {
  if (s === 0) return 0;
  if (s === 1) return 2;
  return 1;
}
function cmpName(a: i32, b: i32): i32 {
  let na: i32 = 0;
  let nb: i32 = 0;
  let x = a;
  do {
    store<u8>(NAME_A_OFFSET + <usize> na, <u8> (48 + (x % 10)));
    na++;
    x = (x / 10) as i32;
  } while (x !== 0);
  x = b;
  do {
    store<u8>(NAME_B_OFFSET + <usize> nb, <u8> (48 + (x % 10)));
    nb++;
    x = (x / 10) as i32;
  } while (x !== 0);
  let i: i32 = 0;
  while (i < na && i < nb) {
    const ca = load<u8>(NAME_A_OFFSET + <usize> (na - 1 - i));
    const cb = load<u8>(NAME_B_OFFSET + <usize> (nb - 1 - i));
    if (ca !== cb) return ca < cb ? -1 : 1;
    i++;
  }
  if (na !== nb) return na < nb ? -1 : 1;
  return 0;
}
function cmpRow(aId: i32, bId: i32, col: i32, asc: i32): i32 {
  let cmp: i32 = 0;
  if (col === 0) {
    cmp = aId < bId ? -1 : (aId > bId ? 1 : 0);
  } else if (col === 1) {
    cmp = cmpName(aId, bId);
  } else if (col === 2) {
    const ra = catRank(aId % 5);
    const rb = catRank(bId % 5);
    cmp = ra < rb ? -1 : (ra > rb ? 1 : 0);
  } else if (col === 3) {
    const sa = load<i32>(SCORES_OFFSET + <usize> aId * 4);
    const sb = load<i32>(SCORES_OFFSET + <usize> bId * 4);
    cmp = sa < sb ? -1 : (sa > sb ? 1 : 0);
  } else if (col === 4) {
    const ra = statRank(aId % 3);
    const rb = statRank(bId % 3);
    cmp = ra < rb ? -1 : (ra > rb ? 1 : 0);
  }
  return asc !== 0 ? cmp : -cmp;
}

export function table_sort_trace(): i32 {
  for (let i = 0; i < ROWS; i++) {
    store<i32>(SCORES_OFFSET + i * 4, (i * 37) % 1000);
    store<i32>(FILT_OFFSET + i * 4, i);
  }
  let filteredCount: i32 = ROWS;
  let currentPage: i32 = 0;
  let pageSize: i32 = PAGE;
  let totalSorts: u32 = 0;
  let totalFilters: u32 = 0;

  seed = 0x31415926;
  for (let a = 0; a < ACTIONS; a++) {
    const opType = randNext();
    if (opType < 0.35) {
      const col = <i32> (randNext() * 5.0);
      const asc: i32 = randNext() > 0.5 ? 1 : 0;
      for (let i = 1; i < filteredCount; i++) {
        const key = load<i32>(FILT_OFFSET + i * 4);
        let j = i - 1;
        while (j >= 0 && cmpRow(key, load<i32>(FILT_OFFSET + j * 4), col, asc) < 0) {
          store<i32>(FILT_OFFSET + (j + 1) * 4, load<i32>(FILT_OFFSET + j * 4));
          j--;
        }
        store<i32>(FILT_OFFSET + (j + 1) * 4, key);
      }
      totalSorts += 1;
    } else if (opType < 0.70) {
      const fIdx = <i32> (randNext() * 6.0);
      let out: i32 = 0;
      if (fIdx === 5) {
        for (let i = 0; i < ROWS; i++) {
          store<i32>(FILT_OFFSET + out * 4, i);
          out++;
        }
      } else {
        const targetCat = fIdx;
        for (let i = 0; i < ROWS; i++) {
          if ((i % 5) === targetCat) {
            store<i32>(FILT_OFFSET + out * 4, i);
            out++;
          }
        }
      }
      filteredCount = out;
      totalFilters += 1;
    } else if (opType < 0.90) {
      const page = <i32> (randNext() * 20.0);
      currentPage = page;
      pageSize = PAGE;
    } else {
      const rowId = <i32> (randNext() * 5000.0);
      const newScore = <i32> (randNext() * 1000.0);
      if (rowId >= 0 && rowId < ROWS) {
        store<i32>(SCORES_OFFSET + rowId * 4, newScore);
      }
    }
  }

  const pageStart = currentPage * pageSize;
  let pageEnd = pageStart + pageSize;
  if (pageEnd > filteredCount) pageEnd = filteredCount;
  let sliceLen = pageEnd - pageStart;
  if (sliceLen < 0) sliceLen = 0;
  let pageScoreSum: u32 = 0;
  for (let i = pageStart; i < pageEnd; i++) {
    const id = load<i32>(FILT_OFFSET + i * 4);
    pageScoreSum += <u32> load<i32>(SCORES_OFFSET + id * 4);
  }

  store<u32>(RESULTS_OFFSET, <u32> filteredCount);
  store<u32>(RESULTS_OFFSET + 4, totalSorts);
  store<u32>(RESULTS_OFFSET + 8, totalFilters);
  store<u32>(RESULTS_OFFSET + 12, <u32> sliceLen);
  store<u32>(RESULTS_OFFSET + 16, pageScoreSum);
  return <i32> pageScoreSum;
}
