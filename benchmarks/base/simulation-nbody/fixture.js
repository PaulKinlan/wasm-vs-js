import {
  BODY_COUNT,
  CHECKPOINT_STEPS,
  DT,
  GRAVITY,
  INPUT_BYTES,
  INPUT_MAGIC,
  QUANTIZATION,
  SEED,
  SOFTENING_SQUARED,
  TIMESTEPS,
} from "./contract.js";

function xorshift32(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}
function unit(value) {
  return value / 0x1_0000_0000;
}
export function generateFixture() {
  const bytes = new Uint8Array(INPUT_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, INPUT_MAGIC, true);
  view.setUint32(4, 1, true);
  view.setUint32(8, BODY_COUNT, true);
  view.setUint32(12, TIMESTEPS, true);
  view.setUint32(16, SEED, true);
  view.setUint32(20, CHECKPOINT_STEPS.length, true);
  view.setFloat64(32, DT, true);
  view.setFloat64(40, SOFTENING_SQUARED, true);
  view.setFloat64(48, GRAVITY, true);
  view.setFloat64(56, QUANTIZATION, true);
  const arrays = Array.from(
    { length: 7 },
    (_, index) => new Float64Array(bytes.buffer, 64 + index * BODY_COUNT * 8, BODY_COUNT),
  );
  const [mass, px, py, pz, vx, vy, vz] = arrays;
  let state = SEED;
  for (let i = 0; i < BODY_COUNT; i++) {
    state = xorshift32(state);
    mass[i] = 0.5 + unit(state) * 1.5;
    state = xorshift32(state);
    px[i] = unit(state) * 2 - 1;
    state = xorshift32(state);
    py[i] = unit(state) * 2 - 1;
    state = xorshift32(state);
    pz[i] = unit(state) * 2 - 1;
    state = xorshift32(state);
    vx[i] = (unit(state) * 2 - 1) * 0.001;
    state = xorshift32(state);
    vy[i] = (unit(state) * 2 - 1) * 0.001;
    state = xorshift32(state);
    vz[i] = (unit(state) * 2 - 1) * 0.001;
  }
  return bytes;
}
