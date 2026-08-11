// multilang-audio-webaudio-effects.test.ts
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const ORACLE = Object.freeze({
  blockInvocations: 750,
  stateCarryBoundaries: 748,
  tailFlushInvocations: 2,
  tailFlushFrames: 30,
  fnv: 3299433303,
});

async function load(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = (exports.memory as WebAssembly.Memory).buffer;
  const fnv = (exports.audio_dsp as () => number)() >>> 0;
  const view = new Uint32Array(mem);
  const offset = 3145728 / 4;
  return {
    fnv,
    blockInvocations: view[offset],
    stateCarryBoundaries: view[offset + 1],
    tailFlushInvocations: view[offset + 2],
    tailFlushFrames: view[offset + 3],
  };
}

Deno.test("multilang audio-webaudio-effects: JS model reproduces the frozen oracle", async () => {
  const m = await import("../benchmarks/base/audio-webaudio-effects/workload.js");
  const fix = m.generateFixture(48000);
  const out = m.processJavaScript(fix);

  assert(out.observations.blockInvocations === ORACLE.blockInvocations);
  assert(out.observations.stateCarryBoundaries === ORACLE.stateCarryBoundaries);
  assert(out.observations.tailFlushInvocations === ORACLE.tailFlushInvocations);
  assert(out.observations.tailFlushFrames === ORACLE.tailFlushFrames);

  const outBytes = new Uint8Array(48015 * 8);
  const dv = new DataView(outBytes.buffer);
  for (let i = 0; i < 48015; i++) {
    let l = out.left[i];
    if (l === 0) l = 0;
    let r = out.right[i];
    if (r === 0) r = 0;
    dv.setFloat32(i * 8, l, true);
    dv.setFloat32(i * 8 + 4, r, true);
  }
  let fnv = 0x811c9dc5;
  for (let i = 0; i < outBytes.length; i++) {
    fnv = Math.imul((fnv ^ outBytes[i]) >>> 0, 0x01000193) >>> 0;
  }
  assert((fnv >>> 0) === ORACLE.fnv, `JS fnv ${(fnv >>> 0)} != ${ORACLE.fnv}`);
});

Deno.test("multilang audio-webaudio-effects: C kernel matches the JS oracle exactly", async () => {
  const instance = await load("audio_dsp_kernel_c.wasm");
  const r = runKernel(instance);
  assert(r.fnv === ORACLE.fnv, `C fnv ${r.fnv} != ${ORACLE.fnv}`);
  assert(
    r.blockInvocations === ORACLE.blockInvocations,
    `C blockInvocations ${r.blockInvocations} != ${ORACLE.blockInvocations}`,
  );
  assert(
    r.stateCarryBoundaries === ORACLE.stateCarryBoundaries,
    `C stateCarryBoundaries ${r.stateCarryBoundaries} != ${ORACLE.stateCarryBoundaries}`,
  );
  assert(
    r.tailFlushInvocations === ORACLE.tailFlushInvocations,
    `C tailFlushInvocations ${r.tailFlushInvocations} != ${ORACLE.tailFlushInvocations}`,
  );
  assert(
    r.tailFlushFrames === ORACLE.tailFlushFrames,
    `C tailFlushFrames ${r.tailFlushFrames} != ${ORACLE.tailFlushFrames}`,
  );
});

Deno.test("multilang audio-webaudio-effects: C++ kernel matches the JS oracle exactly", async () => {
  const instance = await load("audio_dsp_kernel_cpp.wasm");
  const r = runKernel(instance);
  assert(r.fnv === ORACLE.fnv, `C++ fnv ${r.fnv} != ${ORACLE.fnv}`);
});

Deno.test("multilang audio-webaudio-effects: Rust kernel matches the JS oracle exactly", async () => {
  const instance = await load("audio_dsp_kernel_rs.wasm");
  const r = runKernel(instance);
  assert(r.fnv === ORACLE.fnv, `Rust fnv ${r.fnv} != ${ORACLE.fnv}`);
});

Deno.test("multilang audio-webaudio-effects: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const instance = await load("audio_dsp_kernel_asc.wasm", { env: { abort: () => {} } });
  const r = runKernel(instance);
  assert(r.fnv === ORACLE.fnv, `AssemblyScript fnv ${r.fnv} != ${ORACLE.fnv}`);
});
