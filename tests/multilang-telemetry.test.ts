// The serialization-json-telemetry multi-language lane wrote its payload at
// linear-memory offset 0, on top of each kernel's own static data. The C and
// C++ kernels keep their UTF-8 option tables there, so the payload destroyed
// the tables the parser compares against and process() returned -10 at the
// very first record. The adapter discarded the return value, so both engines
// were timed and reported as extremely fast while parsing nothing at all.
// Rust survived only because its data layout differs.
//
// This holds the fix: every engine must parse the whole payload and produce
// byte-identical output, and the adapter must refuse to time a rejection.

import { assert, assertEquals } from "./assert.ts";

const ARTIFACTS =
  new URL("../public/artifacts/multilang-wasm-benchmark/", import.meta.url).pathname;
const RUNNER = await Deno.readTextFile(
  new URL("../public/multilang-runner.js", import.meta.url),
);

const RECORDS = 800;
const REGIONS = ["ap", "eu", "na", "sa"];
const KINDS = ["click", "purchase", "view"];
const LABELS = ["Café", "東京", "مرحبا", "🚀"];
const TAGS = ["α", "数据", "mañana", "🧪"];

/** The frozen record shape, in the workload's own field order. */
function payload(): Uint8Array {
  let state = 0x7e1e2026 >>> 0;
  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
  let json = "[";
  for (let i = 0; i < RECORDS; i++) {
    const region = REGIONS[next() % 4], kind = KINDS[next() % 3];
    const ok = (next() & 1) === 1, value = next() % 10000;
    const label = LABELS[next() % 4], tag = TAGS[next() % 4];
    if (i) json += ",";
    json += `{"id":${i},"ts":${1700000000 + i},"region":"${region}","kind":"${kind}",` +
      `"ok":${ok},"value":${value},"meta":{"label":"${label}","tag":"${tag}"}}`;
  }
  return new TextEncoder().encode(json + "]");
}

const BYTES = payload();
const INPUT_BASE = 262144;

interface Run {
  written: number;
  summary: string;
  records: number;
  numeric: number;
  strings: number;
  booleans: number;
}

async function run(file: string, inOff: number): Promise<Run> {
  const { instance } = await WebAssembly.instantiate(
    await Deno.readFile(`${ARTIFACTS}${file}`),
    { env: { abort: () => {} } },
  );
  const exports = instance.exports as Record<string, CallableFunction> & {
    memory: WebAssembly.Memory;
  };
  const outOff = inOff + BYTES.byteLength + 1024;
  const outCap = 4096;
  const need = outOff + outCap;
  if (exports.memory.buffer.byteLength < need) {
    exports.memory.grow(Math.ceil((need - exports.memory.buffer.byteLength) / 65536));
  }
  new Uint8Array(exports.memory.buffer, inOff, BYTES.length).set(BYTES);
  const written = Number(exports.process(inOff, BYTES.length, outOff, outCap));
  const summary = written > 0
    ? new TextDecoder().decode(new Uint8Array(exports.memory.buffer, outOff, written))
    : "";
  return {
    written,
    summary,
    records: Number(exports.get_records()),
    numeric: Number(exports.get_numeric_values()),
    strings: Number(exports.get_string_values()),
    booleans: Number(exports.get_booleans()),
  };
}

const ENGINES = [
  ["telemetry_c.wasm", "C"],
  ["telemetry_cpp.wasm", "C++"],
  ["telemetry_rs.wasm", "Rust"],
  ["telemetry_asc.wasm", "AssemblyScript"],
] as const;

Deno.test("every telemetry engine parses the whole payload and agrees byte for byte", async () => {
  let reference: Run | null = null;
  for (const [file, label] of ENGINES) {
    const result = await run(file, INPUT_BASE);
    assert(
      result.written > 0,
      `${label}: process() rejected the payload (${result.written}) — it parsed nothing`,
    );
    assertEquals(result.records, RECORDS);
    assertEquals(result.numeric, RECORDS * 3);
    assertEquals(result.strings, RECORDS * 4);
    assertEquals(result.booleans, RECORDS);
    if (reference === null) {
      reference = result;
      assert(
        result.summary.includes(`"count":${RECORDS}`),
        `${label}: summary does not report every record: ${result.summary.slice(0, 80)}`,
      );
    } else {
      assertEquals(result.summary, reference.summary);
      assertEquals(result.written, reference.written);
    }
  }
});

Deno.test("writing the payload over the kernels' static data breaks them", async () => {
  // The original defect, kept as an executable statement of why the input base
  // is where it is. If a future change moves the payload back to offset 0 this
  // test starts passing for the wrong reason — so it asserts the specific
  // engines that are known to be destroyed by it.
  for (const file of ["telemetry_c.wasm", "telemetry_cpp.wasm"]) {
    const result = await run(file, 0);
    assert(
      result.written < 0,
      `${file} at offset 0 returned ${result.written}; if its layout changed, ` +
        `revisit the INPUT_BASE comment in multilang-runner.js`,
    );
  }
});

Deno.test("the adapter refuses to time a rejected parse", () => {
  const at = RUNNER.indexOf('kernels: ["telemetry"]');
  assert(at !== -1, "telemetry adapter not found");
  const block = RUNNER.slice(at, at + 14000);
  assert(
    block.includes("const INPUT_BASE = 262144"),
    "the telemetry adapter must place the payload above the kernels' static data",
  );
  assert(
    /if \(written <= 0\)[\s\S]{0,200}throw new Error/.test(block),
    "the telemetry adapter must throw when process() rejects, not report a timing",
  );
});
