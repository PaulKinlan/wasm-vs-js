// multilang-regex-automata-duel.test.ts — every multilang engine's
// regex-automata-duel-demo compute core must produce the EXACT oracle of the
// JS NFA sim (scanJSAutomata in benchmarks/regex-automata-duel/js-automata.ts
// on the frozen 1,048,576-byte BMP corpus + 20 frozen safe patterns). Kernels
// scan the precompiled Thompson→DFA tables that JavaScript bakes into the
// frozen 1,163,248-byte multilang fixture at
// public/artifacts/regex-automata-duel-multilang/fixture.bin and each kernel
// walks every DFA over the corpus, mixing (patternId,startCP,endCP) into an
// FNV-1a digest. Oracle: 141,605 matches, 1,623 captures extracted,
// 20,971,520 code points scanned, tuple FNV-1a 0xa5be957f.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const FIXTURE_PATH = `${rootDir}/public/artifacts/regex-automata-duel-multilang/fixture.bin`;
const FIXTURE_OFFSET = 3145728;
const RES_OFFSET = 5242880;

const ORACLE = Object.freeze({
  matchesFound: 141605,
  patternsExecuted: 20,
  codePointsSearched: 20971520,
  capturesExtracted: 1623,
  boundaryCrossings: 20,
  inputBytes: 1163248,
  corpusBytes: 1048576,
  tupleFnv1a: 0xa5be957f,
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
    (exports.regex_scan as (n: number) => number)(fixture.byteLength),
  );
  const view = new Uint32Array((exports.memory as WebAssembly.Memory).buffer);
  const base = RES_OFFSET / 4;
  return {
    ret,
    matchesFound: view[base],
    patternsExecuted: view[base + 1],
    codePointsSearched: view[base + 2],
    capturesExtracted: view[base + 3],
    boundaryCrossings: view[base + 4],
    inputBytes: view[base + 5],
    corpusBytes: view[base + 6],
    tupleFnv1a: view[base + 7] >>> 0,
    status: view[base + 8],
  };
}

function assertOracle(label: string, r: ReturnType<typeof runKernel>) {
  assert(r.ret === 0, `${label} run returned non-zero status ${r.ret}`);
  assert(
    r.tupleFnv1a === ORACLE.tupleFnv1a,
    `${label} tuple FNV-1a ${r.tupleFnv1a.toString(16)} != ${ORACLE.tupleFnv1a.toString(16)}`,
  );
  const counterFields: Array<
    [keyof typeof ORACLE, keyof ReturnType<typeof runKernel>]
  > = [
    ["matchesFound", "matchesFound"],
    ["patternsExecuted", "patternsExecuted"],
    ["codePointsSearched", "codePointsSearched"],
    ["capturesExtracted", "capturesExtracted"],
    ["boundaryCrossings", "boundaryCrossings"],
    ["inputBytes", "inputBytes"],
    ["corpusBytes", "corpusBytes"],
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

Deno.test("multilang regex-automata-duel: JS scanJSAutomata matches the oracle exactly", async () => {
  const { generateRegexFixture } = await import(
    `${rootDir}/benchmarks/regex-automata-duel/input.ts`
  );
  const { scanJSAutomata } = await import(
    `${rootDir}/benchmarks/regex-automata-duel/js-automata.ts`
  );
  const fixture = generateRegexFixture();
  const result = await scanJSAutomata(fixture);
  assert(
    result.matchesFound === ORACLE.matchesFound,
    `JS matchesFound ${result.matchesFound} != ${ORACLE.matchesFound}`,
  );
  assert(
    result.patternsExecuted === ORACLE.patternsExecuted,
    `JS patternsExecuted ${result.patternsExecuted}`,
  );
  assert(
    result.codePointsSearched === ORACLE.codePointsSearched,
    `JS codePointsSearched ${result.codePointsSearched}`,
  );
  assert(
    result.capturesExtracted === ORACLE.capturesExtracted,
    `JS capturesExtracted ${result.capturesExtracted}`,
  );
  // FNV-1a over the ordered (patternId,startCP,endCP) tuples must match the
  // frozen multilang oracle.
  const bytes = new Uint8Array(result.matches.length * 12);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < result.matches.length; i++) {
    const m = result.matches[i];
    view.setUint32(i * 12, m.patternId, true);
    view.setUint32(i * 12 + 4, m.startCP, true);
    view.setUint32(i * 12 + 8, m.endCP, true);
  }
  let fnv = 0x811c9dc5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    fnv = (fnv ^ bytes[i]) >>> 0;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
  }
  assert(
    fnv === ORACLE.tupleFnv1a,
    `JS tuple FNV-1a ${fnv.toString(16)} != ${ORACLE.tupleFnv1a.toString(16)}`,
  );
});

Deno.test("multilang regex-automata-duel: C kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("regex_scan_kernel_c.wasm"), fixture);
  assertOracle("C", r);
});

Deno.test("multilang regex-automata-duel: C++ kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("regex_scan_kernel_cpp.wasm"), fixture);
  assertOracle("C++", r);
});

Deno.test("multilang regex-automata-duel: Rust kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("regex_scan_kernel_rs.wasm"), fixture);
  assertOracle("Rust", r);
});

Deno.test("multilang regex-automata-duel: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("regex_scan_kernel_asc.wasm", {
      env: { abort: () => {} },
    }),
    fixture,
  );
  assertOracle("AS", r);
});
