// multilang-dom-virtualized-grid.test.ts — every multilang engine's
// dom.virtualized-grid.v1 compute core must produce the EXACT oracle of the
// JS model (benchmarks/base/dom-virtualized-grid/engine.js
// createJavaScriptGridExecution on the frozen 1,604,864-byte fixture at
// public/artifacts/dom-virtualized-grid-v1/fixture.bin — 300 typed events
// replayed over 100,000 rows; commandDigest 83889fa4; counters:
// rowsScanned=700,000, comparisons=3,279,951, events=300, commands=4,252,
// physicalCreates=28, physicalReuses=3,764, physicalUpdates=2,
// physicalPlacements=92, physicalHides=64, focusOperations=2,
// layoutReads=300; final checkpoint start=60,318, end=60,346,
// visibleLength=28, focused=10,524, selected=10,524, filteredLength=100,000).
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const FIXTURE_PATH = `${rootDir}/public/artifacts/dom-virtualized-grid-v1/fixture.bin`;
const FIXTURE_OFFSET = 3145728;
const RES_OFFSET = 5242880;

const ORACLE = Object.freeze({
  commandDigest: 0x83889fa4,
  rowsScanned: 700000,
  comparisons: 3279951,
  events: 300,
  commands: 4252,
  physicalCreates: 28,
  physicalReuses: 3764,
  physicalUpdates: 2,
  physicalPlacements: 92,
  physicalHides: 64,
  focusOperations: 2,
  layoutReads: 300,
  finalStart: 60318,
  finalEnd: 60346,
  finalVisibleLength: 28,
  focused: 10524,
  selected: 10524,
  filteredLength: 100000,
});

async function readFixture(): Promise<Uint8Array> {
  return await Deno.readFile(FIXTURE_PATH);
}

async function loadWasm(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance, fixture: Uint8Array) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = new Uint8Array((exports.memory as WebAssembly.Memory).buffer);
  mem.set(fixture, FIXTURE_OFFSET);
  const ret = Number(
    (exports.grid_trace as (n: number) => number)(fixture.byteLength),
  );
  const view = new Uint32Array((exports.memory as WebAssembly.Memory).buffer);
  const base = RES_OFFSET / 4;
  return {
    ret,
    commandDigest: view[base] >>> 0,
    rowsScanned: view[base + 1],
    comparisons: view[base + 2],
    events: view[base + 3],
    commands: view[base + 4],
    physicalCreates: view[base + 5],
    physicalReuses: view[base + 6],
    physicalUpdates: view[base + 7],
    physicalPlacements: view[base + 8],
    physicalHides: view[base + 9],
    focusOperations: view[base + 10],
    layoutReads: view[base + 11],
    finalStart: view[base + 12],
    finalEnd: view[base + 13],
    finalVisibleLength: view[base + 14],
    focused: view[base + 15],
    selected: view[base + 16],
    filteredLength: view[base + 17],
  };
}

function assertOracle(label: string, r: ReturnType<typeof runKernel>) {
  assert(r.ret === 0, `${label} run returned non-zero status ${r.ret}`);
  assert(
    r.commandDigest === ORACLE.commandDigest,
    `${label} commandDigest ${r.commandDigest.toString(16)} != ${
      ORACLE.commandDigest.toString(16)
    }`,
  );
  const counterFields: Array<
    [keyof typeof ORACLE, keyof ReturnType<typeof runKernel>]
  > = [
    ["rowsScanned", "rowsScanned"],
    ["comparisons", "comparisons"],
    ["events", "events"],
    ["commands", "commands"],
    ["physicalCreates", "physicalCreates"],
    ["physicalReuses", "physicalReuses"],
    ["physicalUpdates", "physicalUpdates"],
    ["physicalPlacements", "physicalPlacements"],
    ["physicalHides", "physicalHides"],
    ["focusOperations", "focusOperations"],
    ["layoutReads", "layoutReads"],
    ["finalStart", "finalStart"],
    ["finalEnd", "finalEnd"],
    ["finalVisibleLength", "finalVisibleLength"],
    ["focused", "focused"],
    ["selected", "selected"],
    ["filteredLength", "filteredLength"],
  ];
  for (const [expectedKey, actualKey] of counterFields) {
    const expected = ORACLE[expectedKey] as number;
    const actual = r[actualKey] as number;
    assert(
      actual === expected,
      `${label} ${String(actualKey)} ${actual} != ${expected}`,
    );
  }
}

Deno.test("multilang dom-virtualized-grid: JS engine runJavaScript matches the oracle exactly", async () => {
  const fixture = await readFixture();
  const { runJavaScript } = await import(
    `${rootDir}/benchmarks/base/dom-virtualized-grid/engine.js`
  );
  const result = runJavaScript(fixture);
  assert(
    result.commandDigest === ORACLE.commandDigest.toString(16).padStart(8, "0"),
    `JS commandDigest ${result.commandDigest}`,
  );
  const counters = result.counters as Record<string, number>;
  for (
    const key of [
      "rowsScanned",
      "comparisons",
      "events",
      "commands",
      "physicalCreates",
      "physicalReuses",
      "physicalUpdates",
      "physicalPlacements",
      "physicalHides",
      "focusOperations",
      "layoutReads",
    ] as const
  ) {
    assert(
      counters[key] === ORACLE[key],
      `JS ${key} ${counters[key]} != ${ORACLE[key]}`,
    );
  }
  const final = result.final as Record<string, number>;
  assert(
    final.start === ORACLE.finalStart,
    `JS final.start ${final.start}`,
  );
  assert(final.end === ORACLE.finalEnd, `JS final.end ${final.end}`);
  assert(
    final.visibleLength === ORACLE.finalVisibleLength,
    `JS final.visibleLength ${final.visibleLength}`,
  );
  assert(final.focused === ORACLE.focused, `JS final.focused ${final.focused}`);
  assert(
    final.selected === ORACLE.selected,
    `JS final.selected ${final.selected}`,
  );
  assert(
    final.filteredLength === ORACLE.filteredLength,
    `JS final.filteredLength ${final.filteredLength}`,
  );
});

Deno.test("multilang dom-virtualized-grid: C kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("grid_trace_kernel_c.wasm"), fixture);
  assertOracle("C", r);
});

Deno.test("multilang dom-virtualized-grid: C++ kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("grid_trace_kernel_cpp.wasm"), fixture);
  assertOracle("C++", r);
});

Deno.test("multilang dom-virtualized-grid: Rust kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("grid_trace_kernel_rs.wasm"), fixture);
  assertOracle("Rust", r);
});

Deno.test("multilang dom-virtualized-grid: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("grid_trace_kernel_asc.wasm", { env: { abort: () => {} } }),
    fixture,
  );
  assertOracle("AS", r);
});
