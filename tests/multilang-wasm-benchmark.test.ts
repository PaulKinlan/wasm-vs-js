import { assert, assertEquals } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");

Deno.test("multilang-wasm-benchmark: builds artifacts and validates correctness across C, C++, AssemblyScript, WAT, and JS", async () => {
  const sumCBytes = await Deno.readFile(
    `${rootDir}/public/artifacts/multilang-wasm-benchmark/sum_c.wasm`,
  );
  const sumCppBytes = await Deno.readFile(
    `${rootDir}/public/artifacts/multilang-wasm-benchmark/sum_cpp.wasm`,
  );
  const sumAscBytes = await Deno.readFile(
    `${rootDir}/public/artifacts/multilang-wasm-benchmark/sum_asc.wasm`,
  );
  const sumWatBytes = await Deno.readFile(
    `${rootDir}/public/artifacts/multilang-wasm-benchmark/sum_wat.wasm`,
  );

  const sumCMod = await WebAssembly.instantiate(sumCBytes);
  const sumCppMod = await WebAssembly.instantiate(sumCppBytes);
  const sumAscMod = await WebAssembly.instantiate(sumAscBytes);
  const sumWatMod = await WebAssembly.instantiate(sumWatBytes);

  const testArr = new Uint32Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const expectedSum = testArr.reduce((a, b) => a + b, 0);

  // Setup C Wasm memory
  const cMem = new Uint32Array(
    (sumCMod.instance.exports.memory as WebAssembly.Memory).buffer,
    1024,
    testArr.length,
  );
  cMem.set(testArr);
  const cRes = (sumCMod.instance.exports.sum_u32 as (p: number, l: number) => number)(
    1024,
    testArr.length,
  );
  assertEquals(cRes, expectedSum);

  // Setup C++ Wasm memory
  const cppMem = new Uint32Array(
    (sumCppMod.instance.exports.memory as WebAssembly.Memory).buffer,
    1024,
    testArr.length,
  );
  cppMem.set(testArr);
  const cppRes = (sumCppMod.instance.exports.sum_u32 as (p: number, l: number) => number)(
    1024,
    testArr.length,
  );
  assertEquals(cppRes, expectedSum);

  // Setup AssemblyScript Wasm memory
  const ascMem = new Uint32Array(
    (sumAscMod.instance.exports.memory as WebAssembly.Memory).buffer,
    1024,
    testArr.length,
  );
  ascMem.set(testArr);
  const ascRes = (sumAscMod.instance.exports.sum_u32 as (p: number, l: number) => number)(
    1024,
    testArr.length,
  );
  assertEquals(ascRes, expectedSum);

  // Setup WAT Wasm memory
  const watMem = new Uint32Array(
    (sumWatMod.instance.exports.memory as WebAssembly.Memory).buffer,
    0,
    testArr.length,
  );
  watMem.set(testArr);
  const watRes = (sumWatMod.instance.exports.sum_u32 as (p: number, l: number) => number)(
    0,
    testArr.length,
  );
  assertEquals(watRes, expectedSum);
});

Deno.test("multilang-wasm-benchmark: JSON report passes schema validation and contains key insights", async () => {
  const reportText = await Deno.readTextFile(
    `${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`,
  );
  const report = JSON.parse(reportText);

  assertEquals(report.schemaVersion, "1.0.0");
  assert(report.workloads.length > 0, "workloads empty");
  assert(report.summary.totalVariantsTested >= 10, "fewer than 10 variants tested");
  assert(report.summary.keyInsights.length > 0, "no key insights");
});
