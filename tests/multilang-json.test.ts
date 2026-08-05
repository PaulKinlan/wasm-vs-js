import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const { generateTelemetryFixture, runTelemetryJS } = await import(
  `${rootDir}/benchmarks/v1/serialization-json-telemetry/workload.js`
);

function makeFixture(records: number): Uint8Array {
  return generateTelemetryFixture(records);
}

Deno.test(
  "multilang-json: C, C++, Rust, and Dart/WasmGC telemetry parsers are bit-identical to the JS oracle",
  async () => {
    const RECORDS = 300;
    const fixture = makeFixture(RECORDS);
    const oracle = runTelemetryJS(fixture);
    const oracleText = oracle.text;

    const linear = [
      ["telemetry_c.wasm", "C"],
      ["telemetry_cpp.wasm", "C++"],
      ["telemetry_rs.wasm", "Rust"],
    ] as const;
    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const inOff = 0, outOff = fixture.byteLength + 1024, outCap = 4096;
      new Uint8Array(mem.buffer, inOff, fixture.length).set(fixture);
      const ret = (mod.instance.exports.process as (
        i: number,
        l: number,
        o: number,
        c: number,
      ) => number)(inOff, fixture.length, outOff, outCap);
      const out = new Uint8Array(mem.buffer, outOff, ret);
      const text = new TextDecoder().decode(out);
      assert(ret === oracle.outputBytes.length, `${label} output length mismatch`);
      assert(text === oracleText, `${label} summary text mismatch`);
      assert(
        (mod.instance.exports.get_records as () => number)() === RECORDS,
        `${label} records counter mismatch`,
      );
    }

    const dartGlue = await import(`file://${ARTIFACTS}/telemetry_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/telemetry_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      process: (i: Uint8Array, l: number, o: Uint8Array, c: number) => number;
      get_records: () => number;
    };
    assert(kernels && typeof kernels.process === "function", "dartKernels not published");
    const out = new Uint8Array(4096);
    const ret = kernels.process(fixture, fixture.length, out, 4096);
    const text = new TextDecoder().decode(out.slice(0, ret));
    assert(ret === oracle.outputBytes.length, "Dart output length mismatch");
    assert(text === oracleText, "Dart summary text mismatch");
    assert(kernels.get_records() === RECORDS, "Dart records counter mismatch");
  },
);

Deno.test("multilang-json: report contains a measured serialization-json-telemetry workload with 5 variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const wl = report.workloads.find((w: { name: string }) =>
    w.name === "serialization-json-telemetry"
  );
  assert(wl, "serialization-json-telemetry workload missing from report");
  assert(wl.variants.length >= 5, "serialization-json-telemetry needs 5 variants");
  for (const variant of wl.variants) {
    assert(typeof variant.warmExecutionMs === "number", `${variant.language} must be measured`);
  }
  const languages = wl.variants.map((v: { language: string }) => v.language);
  for (const expected of ["Rust / Wasm", "Dart / WasmGC", "C / Wasm", "C++ / Wasm", "JavaScript"]) {
    assert(languages.includes(expected), `serialization-json-telemetry missing ${expected}`);
  }
});
