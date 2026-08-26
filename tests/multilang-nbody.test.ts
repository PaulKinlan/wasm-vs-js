// The simulation-nbody-cloth multi-language lane shipped C, C++, Rust and
// Dart kernels with no oracle test anywhere in the gate — the artifacts were
// loaded by the page and trusted. This covers every linear engine, including
// the AssemblyScript kernel added alongside it, against the same JS oracle the
// adapter uses.

import { assert, assertEquals } from "./assert.ts";

const ARTIFACTS =
  new URL("../public/artifacts/multilang-wasm-benchmark/", import.meta.url).pathname;

// Reduced fixed shape the page adapter runs (the full contract is 1024x120).
const N = 128, STEPS = 30, DT = 0.01, GRAVITY = 0.0001, SOFT2 = 0.0001;

/** First N bodies of the workload's frozen xorshift32(0x31c0ffee) stream. */
function makeFixture() {
  let state = 0x31c0ffee;
  const xorshift = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const unit = (v: number) => v / 0x100000000;
  const f = {
    mass: new Float64Array(N),
    px: new Float64Array(N),
    py: new Float64Array(N),
    pz: new Float64Array(N),
    vx: new Float64Array(N),
    vy: new Float64Array(N),
    vz: new Float64Array(N),
  };
  for (let i = 0; i < N; i++) {
    state = xorshift();
    f.mass[i] = 0.5 + unit(state) * 1.5;
    state = xorshift();
    f.px[i] = unit(state) * 2 - 1;
    state = xorshift();
    f.py[i] = unit(state) * 2 - 1;
    state = xorshift();
    f.pz[i] = unit(state) * 2 - 1;
    state = xorshift();
    f.vx[i] = (unit(state) * 2 - 1) * 0.001;
    state = xorshift();
    f.vy[i] = (unit(state) * 2 - 1) * 0.001;
    state = xorshift();
    f.vz[i] = (unit(state) * 2 - 1) * 0.001;
  }
  return f;
}

/** O(N^2) pairwise gravity plus leapfrog Kick-Drift-Kick, in IEEE f64. */
function jsOracle(): Float64Array {
  const f = makeFixture();
  const { mass } = f;
  const px = Float64Array.from(f.px), py = Float64Array.from(f.py), pz = Float64Array.from(f.pz);
  const vx = Float64Array.from(f.vx), vy = Float64Array.from(f.vy), vz = Float64Array.from(f.vz);
  const ax = new Float64Array(N), ay = new Float64Array(N), az = new Float64Array(N);
  const accelerate = () => {
    for (let i = 0; i < N; i++) {
      let sx = 0, sy = 0, sz = 0;
      const x = px[i], y = py[i], z = pz[i];
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const dx = px[j] - x, dy = py[j] - y, dz = pz[j] - z;
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz + SOFT2);
        const scale = GRAVITY * mass[j] * inv * inv * inv;
        sx += dx * scale;
        sy += dy * scale;
        sz += dz * scale;
      }
      ax[i] = sx;
      ay[i] = sy;
      az[i] = sz;
    }
  };
  accelerate();
  for (let step = 1; step <= STEPS; step++) {
    for (let i = 0; i < N; i++) {
      vx[i] += ax[i] * DT * 0.5;
      vy[i] += ay[i] * DT * 0.5;
      vz[i] += az[i] * DT * 0.5;
      px[i] += vx[i] * DT;
      py[i] += vy[i] * DT;
      pz[i] += vz[i] * DT;
    }
    accelerate();
    for (let i = 0; i < N; i++) {
      vx[i] += ax[i] * DT * 0.5;
      vy[i] += ay[i] * DT * 0.5;
      vz[i] += az[i] * DT * 0.5;
    }
  }
  const out = new Float64Array(6 * N);
  let cursor = 0;
  for (const part of [px, py, pz, vx, vy, vz]) {
    for (let i = 0; i < N; i++) out[cursor++] = part[i];
  }
  return out;
}

async function runLinear(file: string): Promise<Float64Array> {
  const { instance } = await WebAssembly.instantiate(
    await Deno.readFile(`${ARTIFACTS}${file}`),
    // AssemblyScript emits an env.abort import for its bounds checks; a
    // correct kernel never calls it.
    { env: { abort: () => {} } },
  );
  const mem = instance.exports.memory as WebAssembly.Memory;
  const bytesPer = N * 8;
  const off = (k: number) => k * bytesPer;
  const f = makeFixture();
  new Float64Array(mem.buffer, off(0), N).set(f.mass);
  new Float64Array(mem.buffer, off(1), N).set(f.px);
  new Float64Array(mem.buffer, off(2), N).set(f.py);
  new Float64Array(mem.buffer, off(3), N).set(f.pz);
  new Float64Array(mem.buffer, off(4), N).set(f.vx);
  new Float64Array(mem.buffer, off(5), N).set(f.vy);
  new Float64Array(mem.buffer, off(6), N).set(f.vz);
  (instance.exports.nbody_step as (...a: number[]) => void)(
    off(0),
    off(1),
    off(2),
    off(3),
    off(4),
    off(5),
    off(6),
    off(7),
    off(8),
    off(9),
    off(10),
    N,
    STEPS,
    DT,
    GRAVITY,
    SOFT2,
  );
  return new Float64Array(mem.buffer.slice(off(10), off(10) + 6 * N * 8));
}

Deno.test(
  "multilang-nbody: C, C++, Rust and AssemblyScript kernels are bit-identical to the JS oracle",
  async () => {
    const oracle = jsOracle();
    for (
      const [file, label] of [
        ["nbody_step_c.wasm", "C"],
        ["nbody_step_cpp.wasm", "C++"],
        ["nbody_step_rs.wasm", "Rust"],
        ["nbody_step_asc.wasm", "AssemblyScript"],
      ] as const
    ) {
      const got = await runLinear(file);
      assertEquals(got.length, oracle.length);
      const gb = new Uint8Array(got.buffer), ob = new Uint8Array(oracle.buffer);
      for (let i = 0; i < ob.length; i++) {
        assert(
          gb[i] === ob[i],
          `${label}: element ${i >> 3} is ${got[i >> 3]}, oracle says ${oracle[i >> 3]}`,
        );
      }
    }
  },
);

Deno.test("multilang-nbody: the oracle actually moves the bodies", () => {
  // A kernel that returned its input unchanged would pass a comparison against
  // an oracle that also did nothing, so assert the simulation has an effect.
  const f = makeFixture();
  const out = jsOracle();
  let moved = 0;
  for (let i = 0; i < N; i++) if (out[i] !== f.px[i]) moved++;
  assert(moved === N, `expected every body's x position to change, ${moved}/${N} did`);
});
