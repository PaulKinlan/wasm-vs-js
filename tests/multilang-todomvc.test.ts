// Bit-identity gate for the TodoMVC engine multi-language kernels.
// Mirrors the oracle (benchmarks/base/dom-todomvc-journey/engine.js runJavaScript)
// against C/C++/Rust (linear wasm) and Dart/WasmGC variants on the frozen
// 150-action trace — commands, flags/versions state, filter, and all eight
// counters must match byte-for-byte before any timing is shown.
import { assert } from "./assert.ts";
import { encodeActionTrace } from "../benchmarks/base/dom-todomvc-journey/fixture.js";
import { runJavaScript } from "../benchmarks/base/dom-todomvc-journey/engine.js";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const encoded = encodeActionTrace();
const oracle = runJavaScript(encoded);
const oracleCommands = oracle.commands;
const oracleFlags = oracle.flags;
const oracleVersions = oracle.versions;
const oracleFilter = oracle.summary.filter;
const oracleCounters = { ...oracle.counters };

Deno.test(
  "multilang-todomvc: C, C++, and Rust todomvc_engine kernels are bit-identical to the runJavaScript oracle",
  async () => {
    const linear = [
      ["todomvc_engine_c.wasm", "C"],
      ["todomvc_engine_cpp.wasm", "C++"],
      ["todomvc_engine_rs.wasm", "Rust"],
    ] as const;
    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const count = encoded.length / 4;
      const inOff = 0;
      const cmdOff = encoded.byteLength + 1024;
      const stateOff = cmdOff + encoded.byteLength + 1024;
      new Int32Array(mem.buffer, inOff, encoded.length).set(encoded);
      const ret = (mod.instance.exports.run as (c: number, i: number, o: number, s: number) => number)(
        count,
        inOff,
        cmdOff,
        stateOff,
      );
      assert(ret === count, `${label}: run returned ${ret}`);
      const commands = Array.from(new Int32Array(mem.buffer, cmdOff, encoded.length));
      const flags = Array.from(new Uint8Array(mem.buffer, stateOff, 100));
      const versions = Array.from(new Uint8Array(mem.buffer, stateOff + 100, 100));
      const filter = new Uint8Array(mem.buffer, stateOff + 200, 1)[0];
      assert(JSON.stringify(commands) === JSON.stringify(oracleCommands), `${label}: commands mismatch`);
      assert(JSON.stringify(flags) === JSON.stringify(oracleFlags), `${label}: flags mismatch`);
      assert(JSON.stringify(versions) === JSON.stringify(oracleVersions), `${label}: versions mismatch`);
      assert(filter === oracleFilter, `${label}: filter mismatch (kernel=${filter} oracle=${oracleFilter})`);
      const counters = {
        actions: (mod.instance.exports.counter_actions as () => number)(),
        adds: (mod.instance.exports.counter_adds as () => number)(),
        toggles: (mod.instance.exports.counter_toggles as () => number)(),
        filters: (mod.instance.exports.counter_filters as () => number)(),
        removes: (mod.instance.exports.counter_removes as () => number)(),
        edits: (mod.instance.exports.counter_edits as () => number)(),
        stateWrites: (mod.instance.exports.counter_state_writes as () => number)(),
        commandsEmitted: (mod.instance.exports.counter_commands_emitted as () => number)(),
      };
      for (const [k, v] of Object.entries(counters)) {
        assert(v === oracleCounters[k], `${label}: counter ${k} ${v} != ${oracleCounters[k]}`);
      }
    }
  },
);

Deno.test(
  "multilang-todomvc: Dart/WasmGC todomvc_engine kernel is bit-identical to the runJavaScript oracle",
  async () => {
    const glue = await import(`file://${ARTIFACTS}/todomvc_engine_dart.mjs`);
    const app = await glue.compile(await Deno.readFile(`${ARTIFACTS}/todomvc_engine_dart.wasm`));
    const inst = await app.instantiate({});
    inst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      run: (i: Uint8Array, c: number, o: Uint8Array, s: Uint8Array) => number;
      counter_actions: () => number;
      counter_adds: () => number;
      counter_toggles: () => number;
      counter_filters: () => number;
      counter_removes: () => number;
      counter_edits: () => number;
      counter_state_writes: () => number;
      counter_commands_emitted: () => number;
    };
    assert(kernels && typeof kernels.run === "function", "dartKernels not published");
    const out = new Uint8Array(encoded.byteLength * 2 + 2048);
    const state = new Uint8Array(512);
    const ret = kernels.run(new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength), encoded.length / 4, out, state);
    assert(ret === encoded.length / 4, `Dart run returned ${ret}`);
    const commands = Array.from(new Int32Array(out.buffer, out.byteOffset, encoded.length));
    const flags = Array.from(state.subarray(0, 100));
    const versions = Array.from(state.subarray(100, 200));
    const filter = state[200];
    assert(JSON.stringify(commands) === JSON.stringify(oracleCommands), "Dart: commands mismatch");
    assert(JSON.stringify(flags) === JSON.stringify(oracleFlags), "Dart: flags mismatch");
    assert(JSON.stringify(versions) === JSON.stringify(oracleVersions), "Dart: versions mismatch");
    assert(filter === oracleFilter, `Dart: filter mismatch (kernel=${filter} oracle=${oracleFilter})`);
    const counters = {
      actions: kernels.counter_actions(),
      adds: kernels.counter_adds(),
      toggles: kernels.counter_toggles(),
      filters: kernels.counter_filters(),
      removes: kernels.counter_removes(),
      edits: kernels.counter_edits(),
      stateWrites: kernels.counter_state_writes(),
      commandsEmitted: kernels.counter_commands_emitted(),
    };
    for (const [k, v] of Object.entries(counters)) {
      assert(v === oracleCounters[k], `Dart: counter ${k} ${v} != ${oracleCounters[k]}`);
    }
  },
);

Deno.test("multilang-todomvc: report contains a measured base-dom-todomvc-journey workload with 5 variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const workload = report.workloads.find((w: { name: string }) => w.name === "base-dom-todomvc-journey");
  assert(workload, "report missing base-dom-todomvc-journey workload");
  assert(workload.variants.length === 5, `expected 5 variants, got ${workload.variants.length}`);
  for (const variant of workload.variants) {
    assert(Number.isFinite(variant.warmExecutionMs), `${variant.language} lacks measured warmExecutionMs`);
  }
});
