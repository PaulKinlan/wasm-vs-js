// multilang-markdown-cms.test.ts — every multilang engine's
// text.markdown-cms.v1 compute core must produce the EXACT oracle of the JS
// model (benchmarks/v2/text-markdown-cms/workload.js renderMarkdown() on the
// frozen 10,978,068-byte fixture at
// public/artifacts/text-markdown-cms-multilang/fixture.bin — 500 documents,
// output 11,057,325 bytes, output FNV-1a 0xe5a7f519; counters:
// documents=500, input-bytes=10,976,060, tokens=2997, ast-nodes=5996,
// transforms=1001, sanitizer-checks=1000, output-bytes=11,057,325,
// rejected=499).
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const FIXTURE_PATH = `${rootDir}/public/artifacts/text-markdown-cms-multilang/fixture.bin`;
const FIXTURE_OFFSET = 3145728;
const RES_OFFSET = 28311552;

const ORACLE = Object.freeze({
  documents: 500,
  inputBytes: 10_976_060,
  tokens: 2997,
  astNodes: 5996,
  transforms: 1001,
  sanitizerChecks: 1000,
  outputBytes: 11_057_325,
  rejected: 499,
  outputFnv1a: 0xe5a7f519,
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
    (exports.markdown_cms_render as (n: number) => number)(fixture.byteLength),
  );
  const view = new Uint32Array((exports.memory as WebAssembly.Memory).buffer);
  const base = RES_OFFSET / 4;
  return {
    ret,
    documents: view[base],
    inputBytes: view[base + 1],
    tokens: view[base + 2],
    astNodes: view[base + 3],
    transforms: view[base + 4],
    sanitizerChecks: view[base + 5],
    outputBytes: view[base + 6],
    rejected: view[base + 7],
    outputFnv1a: view[base + 8] >>> 0,
    status: view[base + 9],
  };
}

function assertOracle(label: string, r: ReturnType<typeof runKernel>) {
  assert(r.ret === 0, `${label} run returned non-zero status ${r.ret}`);
  assert(
    r.outputFnv1a === ORACLE.outputFnv1a,
    `${label} output FNV-1a ${r.outputFnv1a.toString(16)} != ${ORACLE.outputFnv1a.toString(16)}`,
  );
  const counterFields: Array<
    [keyof typeof ORACLE, keyof ReturnType<typeof runKernel>]
  > = [
    ["documents", "documents"],
    ["inputBytes", "inputBytes"],
    ["tokens", "tokens"],
    ["astNodes", "astNodes"],
    ["transforms", "transforms"],
    ["sanitizerChecks", "sanitizerChecks"],
    ["outputBytes", "outputBytes"],
    ["rejected", "rejected"],
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

Deno.test("multilang markdown-cms: JS renderMarkdown matches the oracle exactly", async () => {
  const fixture = await readFixture();
  const {
    generateMarkdownFixture,
    serializeMarkdownCorpus,
    renderMarkdown,
  } = await import(
    `${rootDir}/benchmarks/v2/text-markdown-cms/workload.js`
  );
  const { documents } = generateMarkdownFixture();
  const corpus = serializeMarkdownCorpus(documents);
  assert(
    corpus.byteLength === fixture.byteLength,
    `generated corpus length ${corpus.byteLength} != on-disk ${fixture.byteLength}`,
  );
  for (let i = 0; i < corpus.byteLength; i++) {
    if (corpus[i] !== fixture[i]) {
      throw new Error(`generated fixture mismatch at byte ${i}`);
    }
  }
  let totalInputBytes = 0;
  let totalTokens = 0;
  let totalAstNodes = 0;
  let totalTransforms = 0;
  let totalSanitizer = 0;
  let totalOutputBytes = 0;
  let totalRejected = 0;
  const outputs: Uint8Array[] = [];
  for (const doc of documents) {
    const r = renderMarkdown(doc);
    totalInputBytes += r.counters["input-bytes"];
    totalTokens += r.counters.tokens;
    totalAstNodes += r.counters["ast-nodes"];
    totalTransforms += r.counters.transforms;
    totalSanitizer += r.counters["sanitizer-checks"];
    totalOutputBytes += r.counters["output-bytes"];
    totalRejected += r.rejected;
    outputs.push(r.outputBytes);
  }
  let fnv = 0x811c9dc5 >>> 0;
  for (const out of outputs) {
    for (let i = 0; i < out.length; i++) {
      fnv = (fnv ^ out[i]) >>> 0;
      fnv = Math.imul(fnv, 0x01000193) >>> 0;
    }
  }
  assert(
    documents.length === ORACLE.documents,
    `JS documents ${documents.length} != ${ORACLE.documents}`,
  );
  const pairs: Array<[string, number]> = [
    ["input-bytes", ORACLE.inputBytes],
    ["tokens", ORACLE.tokens],
    ["ast-nodes", ORACLE.astNodes],
    ["transforms", ORACLE.transforms],
    ["sanitizer-checks", ORACLE.sanitizerChecks],
    ["output-bytes", ORACLE.outputBytes],
    ["rejected", ORACLE.rejected],
  ];
  const actualMap = new Map<string, number>([
    ["input-bytes", totalInputBytes],
    ["tokens", totalTokens],
    ["ast-nodes", totalAstNodes],
    ["transforms", totalTransforms],
    ["sanitizer-checks", totalSanitizer],
    ["output-bytes", totalOutputBytes],
    ["rejected", totalRejected],
  ]);
  for (const [k, v] of pairs) {
    const actual = actualMap.get(k);
    assert(actual === v, `JS counter ${k} ${actual} != ${v}`);
  }
  assert(
    fnv === ORACLE.outputFnv1a,
    `JS output FNV-1a ${fnv.toString(16)} != ${ORACLE.outputFnv1a.toString(16)}`,
  );
});

Deno.test("multilang markdown-cms: C kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("markdown_cms_kernel_c.wasm"),
    fixture,
  );
  assertOracle("C", r);
});

Deno.test("multilang markdown-cms: C++ kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("markdown_cms_kernel_cpp.wasm"),
    fixture,
  );
  assertOracle("C++", r);
});

Deno.test("multilang markdown-cms: Rust kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("markdown_cms_kernel_rs.wasm"),
    fixture,
  );
  assertOracle("Rust", r);
});
