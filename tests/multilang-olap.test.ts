import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// The frozen workload oracle (benchmarks/base/database-olap-chart/engine.js).
const { runOlapJavaScript, OUTPUT_WORDS } = await import(
  `${rootDir}/benchmarks/base/database-olap-chart/engine.js`
);
const { generateOlapFixture } = await import(
  `${rootDir}/benchmarks/base/database-olap-chart/fixture.js`
);

const fixture = generateOlapFixture();
const oracle = runOlapJavaScript(fixture);
const oracleWords = oracle.output;
const ocounters = oracle.counters;

function checkBitIdentical(label: string, result: Uint32Array, counters: number[]): void {
  let first = -1;
  for (let i = 0; i < oracleWords.length; i++) {
    if (result[i] !== oracleWords[i]) {
      first = i;
      break;
    }
  }
  assert(first === -1, `${label} output mismatch at word ${first}`);
  assert(
    counters[0] === ocounters.queries && counters[3] === ocounters.matchedRows &&
      counters[4] === ocounters.sortComparisons && counters[5] === ocounters.aggregateRows,
    `${label} counters mismatch (${
      counters.join(",")
    } vs ${ocounters.queries},${ocounters.matchedRows},${ocounters.sortComparisons},${ocounters.aggregateRows})`,
  );
}

Deno.test(
  "multilang-olap: C, C++, Rust, and Dart/WasmGC olap kernels are bit-identical to the JS oracle",
  async () => {
    const linear = [
      ["olap_c.wasm", "C"],
      ["olap_cpp.wasm", "C++"],
      ["olap_rs.wasm", "Rust"],
    ] as const;
    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      )) as unknown as { instance: WebAssembly.Instance };
      const inst = mod.instance.exports as unknown as {
        memory: WebAssembly.Memory;
        input_ptr: () => number;
        result_ptr: () => number;
        run: (n: number) => number;
        counter: (i: number) => number;
      };
      const mem = inst.memory;
      const inPtr = inst.input_ptr(), resPtr = inst.result_ptr();
      new Uint32Array(mem.buffer, inPtr, fixture.length / 4).set(new Uint32Array(fixture.buffer));
      inst.run(fixture.length);
      const result = new Uint32Array(mem.buffer, resPtr, OUTPUT_WORDS);
      const counters = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => inst.counter(i));
      checkBitIdentical(label, result, counters);
    }

    const dartGlue = await import(`file://${ARTIFACTS}/olap_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/olap_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      run: (input: Uint32Array, result: Uint32Array, byteLength: number) => void;
      counter: (i: number) => number;
    };
    assert(kernels && typeof kernels.run === "function", "dartKernels not published");
    const input = new Uint32Array(fixture.buffer.slice(0));
    const result = new Uint32Array(OUTPUT_WORDS);
    kernels.run(input, result, fixture.length);
    const counters = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => kernels.counter(i));
    checkBitIdentical("Dart/WasmGC", result, counters);
  },
);

Deno.test("multilang-olap: report contains a measured database-olap-chart workload with 5 variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const wl = report.workloads.find((w: { name: string }) => w.name === "database-olap-chart");
  assert(wl, "database-olap-chart workload missing from multilang report");
  assert(wl.variants.length >= 5, `expected >=5 variants, got ${wl.variants.length}`);
  for (const v of wl.variants as Array<{ warmExecutionMs: number }>) {
    assert(
      typeof v.warmExecutionMs === "number" && v.warmExecutionMs > 0,
      `${v} missing a measured warmExecutionMs`,
    );
  }
});
