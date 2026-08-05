// Bit-identity verification for the todomvc multilang kernels (C/C++/Rust).
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

for (
  const [file, label] of [
    ["todomvc_engine_c.wasm", "C"],
    ["todomvc_engine_cpp.wasm", "C++"],
    ["todomvc_engine_rs.wasm", "Rust"],
  ] as const
) {
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
  if (ret !== count) throw new Error(`${label}: run returned ${ret}`);
  const commands = Array.from(new Int32Array(mem.buffer, cmdOff, encoded.length));
  const flags = Array.from(new Uint8Array(mem.buffer, stateOff, 100));
  const versions = Array.from(new Uint8Array(mem.buffer, stateOff + 100, 100));
  const filter = new Uint8Array(mem.buffer, stateOff + 200, 1)[0];
  if (JSON.stringify(commands) !== JSON.stringify(oracleCommands)) {
    throw new Error(`${label}: commands mismatch`);
  }
  if (JSON.stringify(flags) !== JSON.stringify(oracleFlags)) {
    throw new Error(`${label}: flags mismatch`);
  }
  if (JSON.stringify(versions) !== JSON.stringify(oracleVersions)) {
    throw new Error(`${label}: versions mismatch`);
  }
  if (filter !== oracleFilter) {
    throw new Error(`${label}: filter mismatch (kernel=${filter} oracle=${oracleFilter})`);
  }
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
    if (v !== oracleCounters[k]) {
      throw new Error(`${label}: counter ${k} ${v} != ${oracleCounters[k]}`);
    }
  }
  console.log(
    `${label}: BIT-IDENTICAL (commands=${commands.length}, alive=${
      flags.filter((f) => (f & 1) !== 0).length
    }, completed=${flags.filter((f) => (f & 2) !== 0).length}, counters=${
      JSON.stringify(counters)
    })`,
  );
}
console.log("ALL LINEAR KERNELS BIT-IDENTICAL");

// Dart/WasmGC kernel
{
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
  if (!kernels || typeof kernels.run !== "function") throw new Error("dartKernels not published");
  const count = encoded.length / 4;
  const input = new Uint8Array(encoded.buffer.slice(0));
  const commands = new Uint8Array(2400);
  const state = new Uint8Array(201);
  const ret = kernels.run(input, count, commands, state);
  if (ret !== count) throw new Error(`Dart: run returned ${ret}`);
  const cmd = Array.from(new Int32Array(commands.buffer));
  const fl = Array.from(state.slice(0, 100));
  const ver = Array.from(state.slice(100, 200));
  const flt = state[200];
  if (JSON.stringify(cmd) !== JSON.stringify(oracleCommands)) {
    throw new Error("Dart: commands mismatch");
  }
  if (JSON.stringify(fl) !== JSON.stringify(oracleFlags)) throw new Error("Dart: flags mismatch");
  if (JSON.stringify(ver) !== JSON.stringify(oracleVersions)) {
    throw new Error("Dart: versions mismatch");
  }
  if (flt !== oracleFilter) throw new Error(`Dart: filter mismatch`);
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
    if (v !== oracleCounters[k]) throw new Error(`Dart: counter ${k} ${v} != ${oracleCounters[k]}`);
  }
  console.log(`Dart: BIT-IDENTICAL (commands=${cmd.length}, counters=${JSON.stringify(counters)})`);
}
console.log("ALL KERNELS (C/C++/Rust/Dart) BIT-IDENTICAL");
