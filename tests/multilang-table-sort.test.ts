// multilang-table-sort.test.ts — every multilang engine's
// table-sort-filter-pagination compute core must produce the EXACT oracle of
// the JS model (frozen 120-action trace from seed 0x31415926, 5,000 rows with
// category=i%5, status=i%3, score=(i*37)%1000, JS-string-order stable sort):
//   filteredCount 1000 / totalSorts 44 / totalFilters 40 / pageSliceCount 50
//   / pageScoreSum 24888.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const RES_OFFSET = 40000;

const ORACLE = Object.freeze({
  filteredCount: 1000,
  totalSorts: 44,
  totalFilters: 40,
  pageSliceCount: 50,
  pageScoreSum: 24888,
});

async function load(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = (exports.memory as WebAssembly.Memory).buffer;
  const ret = (exports.table_sort_trace as () => number)();
  const view = new Int32Array(mem);
  return {
    ret,
    filteredCount: view[RES_OFFSET / 4],
    totalSorts: view[RES_OFFSET / 4 + 1],
    totalFilters: view[RES_OFFSET / 4 + 2],
    pageSliceCount: view[RES_OFFSET / 4 + 3],
    pageScoreSum: view[RES_OFFSET / 4 + 4],
  };
}

Deno.test("multilang table-sort: JS model reproduces the frozen oracle", async () => {
  // JS reference: replicate generateTableActions + runTableSortFilterJS.
  const { generateTableActions, runTableSortFilterJS } = await import(
    `${rootDir}/public/benchmarks/dom-table-sort-filter-pagination/engine.js`
  );
  const r = runTableSortFilterJS(generateTableActions());
  assert(
    r.filteredCount === ORACLE.filteredCount,
    `JS filteredCount ${r.filteredCount} != ${ORACLE.filteredCount}`,
  );
  assert(
    r.totalSorts === ORACLE.totalSorts,
    `JS totalSorts ${r.totalSorts} != ${ORACLE.totalSorts}`,
  );
  assert(
    r.totalFilters === ORACLE.totalFilters,
    `JS totalFilters ${r.totalFilters} != ${ORACLE.totalFilters}`,
  );
  assert(
    r.pageSize === ORACLE.pageSliceCount,
    `JS pageSize ${r.pageSize} != ${ORACLE.pageSliceCount}`,
  );
  assert(
    r.pageScoreSum === ORACLE.pageScoreSum,
    `JS pageScoreSum ${r.pageScoreSum} != ${ORACLE.pageScoreSum}`,
  );
});

Deno.test("multilang table-sort: C kernel matches the JS oracle exactly", async () => {
  const instance = await load("table_sort_kernel_c.wasm");
  const r = runKernel(instance);
  assert(
    r.filteredCount === ORACLE.filteredCount,
    `C filteredCount ${r.filteredCount} != ${ORACLE.filteredCount}`,
  );
  assert(
    r.totalSorts === ORACLE.totalSorts,
    `C totalSorts ${r.totalSorts} != ${ORACLE.totalSorts}`,
  );
  assert(
    r.totalFilters === ORACLE.totalFilters,
    `C totalFilters ${r.totalFilters} != ${ORACLE.totalFilters}`,
  );
  assert(
    r.pageSliceCount === ORACLE.pageSliceCount,
    `C pageSliceCount ${r.pageSliceCount} != ${ORACLE.pageSliceCount}`,
  );
  assert(
    r.pageScoreSum === ORACLE.pageScoreSum,
    `C pageScoreSum ${r.pageScoreSum} != ${ORACLE.pageScoreSum}`,
  );
  assert(r.ret === ORACLE.pageScoreSum, `C return ${r.ret} != ${ORACLE.pageScoreSum}`);
});

Deno.test("multilang table-sort: C++ kernel matches the JS oracle exactly", async () => {
  const instance = await load("table_sort_kernel_cpp.wasm");
  const r = runKernel(instance);
  assert(
    r.filteredCount === ORACLE.filteredCount,
    `C++ filteredCount ${r.filteredCount} != ${ORACLE.filteredCount}`,
  );
  assert(
    r.totalSorts === ORACLE.totalSorts,
    `C++ totalSorts ${r.totalSorts} != ${ORACLE.totalSorts}`,
  );
  assert(
    r.totalFilters === ORACLE.totalFilters,
    `C++ totalFilters ${r.totalFilters} != ${ORACLE.totalFilters}`,
  );
  assert(
    r.pageSliceCount === ORACLE.pageSliceCount,
    `C++ pageSliceCount ${r.pageSliceCount} != ${ORACLE.pageSliceCount}`,
  );
  assert(
    r.pageScoreSum === ORACLE.pageScoreSum,
    `C++ pageScoreSum ${r.pageScoreSum} != ${ORACLE.pageScoreSum}`,
  );
});

Deno.test("multilang table-sort: Rust kernel matches the JS oracle exactly", async () => {
  const instance = await load("table_sort_kernel_rs.wasm");
  const r = runKernel(instance);
  assert(
    r.filteredCount === ORACLE.filteredCount,
    `Rust filteredCount ${r.filteredCount} != ${ORACLE.filteredCount}`,
  );
  assert(
    r.totalSorts === ORACLE.totalSorts,
    `Rust totalSorts ${r.totalSorts} != ${ORACLE.totalSorts}`,
  );
  assert(
    r.totalFilters === ORACLE.totalFilters,
    `Rust totalFilters ${r.totalFilters} != ${ORACLE.totalFilters}`,
  );
  assert(
    r.pageSliceCount === ORACLE.pageSliceCount,
    `Rust pageSliceCount ${r.pageSliceCount} != ${ORACLE.pageSliceCount}`,
  );
  assert(
    r.pageScoreSum === ORACLE.pageScoreSum,
    `Rust pageScoreSum ${r.pageScoreSum} != ${ORACLE.pageScoreSum}`,
  );
});

Deno.test("multilang table-sort: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const instance = await load("table_sort_kernel_asc.wasm");
  const r = runKernel(instance);
  assert(
    r.filteredCount === ORACLE.filteredCount,
    `AS filteredCount ${r.filteredCount} != ${ORACLE.filteredCount}`,
  );
  assert(
    r.totalSorts === ORACLE.totalSorts,
    `AS totalSorts ${r.totalSorts} != ${ORACLE.totalSorts}`,
  );
  assert(
    r.totalFilters === ORACLE.totalFilters,
    `AS totalFilters ${r.totalFilters} != ${ORACLE.totalFilters}`,
  );
  assert(
    r.pageSliceCount === ORACLE.pageSliceCount,
    `AS pageSliceCount ${r.pageSliceCount} != ${ORACLE.pageSliceCount}`,
  );
  assert(
    r.pageScoreSum === ORACLE.pageScoreSum,
    `AS pageScoreSum ${r.pageScoreSum} != ${ORACLE.pageScoreSum}`,
  );
});
