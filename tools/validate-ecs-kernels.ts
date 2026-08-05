// Temporary bit-identity validation for the ECS multilang kernels.
import { generateEcsFixture } from "../benchmarks/v1/game-ecs-frame-update/fixture.js";
import { runEcsJavaScript } from "../benchmarks/v1/game-ecs-frame-update/engine.js";

const ENTITIES = 1024, FRAMES = 300;

function hex(v) {
  return (v >>> 0).toString(16).padStart(8, "0");
}

async function runLinear(bytes, fixture) {
  const mod = new WebAssembly.Module(bytes);
  const inst = await WebAssembly.instantiate(mod);
  const mem = inst.exports.memory;
  const input = new Uint8Array(mem.buffer, inst.exports.input_ptr(), fixture.length);
  input.set(fixture);
  const code = inst.exports.run(fixture.length);
  if (code !== 0) throw new Error(`run returned ${code}`);
  const words = new Uint32Array(mem.buffer, inst.exports.result_ptr(), 128);
  return {
    stateDigest: hex(words[0]),
    checkpointDigest: hex(words[1]),
    pairTests: words[23],
    collisions: words[24],
    animationUpdates: words[25],
    controlMutations: words[27],
    stateMutations: words[28],
  };
}

const fixture = generateEcsFixture({ entities: ENTITIES, frames: FRAMES, seed: 0x6ec5f17d });
const js = runEcsJavaScript(fixture);
const expected = {
  stateDigest: js.oracle.finalStateDigest,
  checkpointDigest: js.oracle.checkpointDigest,
  pairTests: js.counters.pairTests,
  collisions: js.counters.collisions,
  animationUpdates: js.counters.animationUpdates,
  controlMutations: js.counters.controlMutations,
  stateMutations: js.counters.stateMutations,
};

let allOk = true;
for (const [key, path] of [
  ["C", "/tmp/ecs-test/ecs_c.wasm"],
  ["C++", "/tmp/ecs-test/ecs_cpp.wasm"],
  ["Rust", "/tmp/ecs-test/ecs_rs.wasm"],
]) {
  const got = await runLinear(await Deno.readFile(path), fixture);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  allOk = allOk && ok;
  console.log(`${key}: ${ok ? "BIT-IDENTICAL" : "MISMATCH"}`);
  if (!ok) {
    for (const k of Object.keys(expected)) {
      if (got[k] !== expected[k]) console.log(`  ${k}: got=${got[k]} expected=${expected[k]}`);
    }
  }
}
console.log("JS oracle:", JSON.stringify(expected));
console.log(allOk ? "ALL BIT-IDENTICAL ✓" : "FAILURES ✗");

// ── Dart WasmGC kernel ──
const glue = await import("file:///tmp/ecs-test/ecs_dart.mjs");
const app = await glue.compile(await Deno.readFile("/tmp/ecs-test/ecs_dart.wasm"));
const inst = await app.instantiate({});
inst.invokeMain();
const kernels = globalThis.dartKernels;
const result = new Uint32Array(128 + ENTITIES * 6);
kernels.run(fixture, result);
const dartGot = {
  stateDigest: hex(result[0]),
  checkpointDigest: hex(result[1]),
  pairTests: result[23],
  collisions: result[24],
  animationUpdates: result[25],
  controlMutations: result[27],
  stateMutations: result[28],
};
const dartOk = JSON.stringify(dartGot) === JSON.stringify(expected);
console.log(`Dart/WasmGC: ${dartOk ? "BIT-IDENTICAL" : "MISMATCH"}`);
if (!dartOk) {
  for (const k of Object.keys(expected)) {
    if (dartGot[k] !== expected[k]) console.log(`  ${k}: got=${dartGot[k]} expected=${expected[k]}`);
  }
}
console.log(dartOk && allOk ? "ALL VARIANT BIT-IDENTICAL ✓" : "FAILURES ✗");
