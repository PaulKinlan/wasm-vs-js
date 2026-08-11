// multilang-server-ssr-template.test.ts — every multilang engine's
// server.ssr-template.v1 compute core must produce the EXACT oracle of the
// JS model (benchmarks/v1/server-ssr-template/workload.js renderJavaScript on
// the frozen 91,442-byte fixture at
// public/artifacts/server-ssr-template-v1-multilang/fixture.bin — 1,000
// records, output 426,192 bytes, output FNV-1a 0x7c5fa247; counters:
// responses=1,000, parsed-fields=7,000, template-tokens=23,000,
// text-escapes=2,000, attribute-escapes=1,000, url-escapes=2,000,
// integer-formats=4,000, date-formats=2,000, input-bytes=91,442,
// output-bytes=426,192).
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const FIXTURE_PATH = `${rootDir}/public/artifacts/server-ssr-template-v1-multilang/fixture.bin`;
const FIXTURE_OFFSET = 3145728;
const RES_OFFSET = 3932160;

const ORACLE = Object.freeze({
  responses: 1000,
  parsedFields: 7000,
  templateTokens: 23000,
  textEscapes: 2000,
  attributeEscapes: 1000,
  urlEscapes: 2000,
  integerFormats: 4000,
  dateFormats: 2000,
  inputBytes: 91442,
  outputBytes: 426192,
  outputFnv1a: 0x7c5fa247,
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
    (exports.ssr_render as (n: number) => number)(fixture.byteLength),
  );
  const view = new Uint32Array((exports.memory as WebAssembly.Memory).buffer);
  const base = RES_OFFSET / 4;
  return {
    ret,
    responses: view[base],
    parsedFields: view[base + 1],
    templateTokens: view[base + 2],
    textEscapes: view[base + 3],
    attributeEscapes: view[base + 4],
    urlEscapes: view[base + 5],
    integerFormats: view[base + 6],
    dateFormats: view[base + 7],
    inputBytes: view[base + 8],
    outputBytes: view[base + 9],
    outputFnv1a: view[base + 10] >>> 0,
    status: view[base + 11],
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
    ["responses", "responses"],
    ["parsedFields", "parsedFields"],
    ["templateTokens", "templateTokens"],
    ["textEscapes", "textEscapes"],
    ["attributeEscapes", "attributeEscapes"],
    ["urlEscapes", "urlEscapes"],
    ["integerFormats", "integerFormats"],
    ["dateFormats", "dateFormats"],
    ["inputBytes", "inputBytes"],
    ["outputBytes", "outputBytes"],
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

Deno.test("multilang server-ssr-template: JS renderJavaScript matches the oracle exactly", async () => {
  const fixture = await readFixture();
  const { generateFixture, renderJavaScript } = await import(
    `${rootDir}/benchmarks/v1/server-ssr-template/workload.js`
  );
  const generated = generateFixture();
  assert(
    generated.byteLength === fixture.byteLength,
    `generated fixture length ${generated.byteLength} != on-disk ${fixture.byteLength}`,
  );
  for (let i = 0; i < generated.byteLength; i++) {
    if (generated[i] !== fixture[i]) {
      throw new Error(`generated fixture mismatch at byte ${i}`);
    }
  }
  const { output, counters } = renderJavaScript(fixture);
  assert(
    output.byteLength === ORACLE.outputBytes,
    `JS output.byteLength ${output.byteLength} != ${ORACLE.outputBytes}`,
  );
  // FNV-1a over the whole framed output stream.
  let fnv = 0x811c9dc5 >>> 0;
  for (let i = 0; i < output.length; i++) {
    fnv = (fnv ^ output[i]) >>> 0;
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
  }
  assert(
    fnv === ORACLE.outputFnv1a,
    `JS output FNV-1a ${fnv.toString(16)} != ${ORACLE.outputFnv1a.toString(16)}`,
  );
  const pairs: Array<[string, number]> = [
    ["responses", ORACLE.responses],
    ["parsed-fields", ORACLE.parsedFields],
    ["template-tokens", ORACLE.templateTokens],
    ["text-escapes", ORACLE.textEscapes],
    ["attribute-escapes", ORACLE.attributeEscapes],
    ["url-escapes", ORACLE.urlEscapes],
    ["integer-formats", ORACLE.integerFormats],
    ["date-formats", ORACLE.dateFormats],
    ["input-bytes", ORACLE.inputBytes],
    ["output-bytes", ORACLE.outputBytes],
  ];
  const c = counters as Record<string, number>;
  for (const [k, v] of pairs) {
    assert(c[k] === v, `JS counter ${k} ${c[k]} != ${v}`);
  }
});

Deno.test("multilang server-ssr-template: C kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("server_ssr_kernel_c.wasm"), fixture);
  assertOracle("C", r);
});

Deno.test("multilang server-ssr-template: C++ kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("server_ssr_kernel_cpp.wasm"), fixture);
  assertOracle("C++", r);
});

Deno.test("multilang server-ssr-template: Rust kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(await loadWasm("server_ssr_kernel_rs.wasm"), fixture);
  assertOracle("Rust", r);
});

Deno.test("multilang server-ssr-template: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const fixture = await readFixture();
  const r = runKernel(
    await loadWasm("server_ssr_kernel_asc.wasm", {
      env: { abort: () => {} },
    }),
    fixture,
  );
  assertOracle("AS", r);
});
