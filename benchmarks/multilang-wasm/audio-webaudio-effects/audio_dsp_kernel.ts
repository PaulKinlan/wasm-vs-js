// audio_dsp_kernel.ts — multilang compute core for audio.webaudio-effects.v1.
// AssemblyScript: raw store/load over fixed offsets (no heap, no imports).
// Mirrors the strict-f32 DSP chain in benchmarks/base/audio-webaudio-effects/workload.js
// on the reduced 48,000-frame arithmetic fixture (the DC/impulse segment).

const FRAMES: i32 = 48000;
const BLOCK_FRAMES: i32 = 128;
const IR_LENGTH: i32 = 16;
const OUTPUT_FRAMES: i32 = 48015;

const OUTPUT_OFFSET: usize = 2097152;
const RES_OFFSET: usize = 3145728;

const B0: f32 = 0.206572083826147;
const B1: f32 = 0.413144167652294;
const B2: f32 = 0.206572083826147;
const A1: f32 = -0.369527377351241;
const A2: f32 = 0.195815712655833;

const THRESHOLD: f32 = 0.25;
const KNEE: f32 = 0.1;
const RATIO_RECIPROCAL: f32 = 0.25;
const ATTACK: f32 = 0.9;
const RELEASE: f32 = 0.9995;

// Per-channel state at state_ptr: +0 z1 (f32), +4 z2 (f32), +8 envelope (f32),
// +12 cursor (i32), +16..+80 history[16] (f32).
const STATE_Z1: usize = 0;
const STATE_Z2: usize = 4;
const STATE_ENV: usize = 8;
const STATE_CURSOR: usize = 12;
const STATE_HISTORY: usize = 16;

function get_ir(idx: i32): f32 {
  switch (idx) {
    case 0:
      return 0.625;
    case 1:
      return -0.1875;
    case 2:
      return 0.140625;
    case 3:
      return 0.10546875;
    case 4:
      return -0.0791015625;
    case 5:
      return 0.059326171875;
    case 6:
      return -0.04449462890625;
    case 7:
      return 0.0333709716796875;
    case 8:
      return -0.025028228759765625;
    case 9:
      return 0.01877117156982422;
    case 10:
      return -0.014078378677368164;
    case 11:
      return 0.010558784008026123;
    case 12:
      return -0.007919088006019592;
    case 13:
      return 0.005939316004514694;
    case 14:
      return -0.004454487003386021;
    case 15:
      return 0.0033408652525395155;
    default:
      return 0.0;
  }
}

function f_abs(x: f32): f32 {
  return abs(x);
}

function get_history(state_ptr: usize, idx: i32): f32 {
  return load<f32>(state_ptr + STATE_HISTORY + (idx as usize) * 4);
}

function set_history(state_ptr: usize, idx: i32, val: f32): void {
  store<f32>(state_ptr + STATE_HISTORY + (idx as usize) * 4, val);
}

function compressor_gain(envelope: f32): f32 {
  const half: f32 = KNEE * 0.5;
  const low: f32 = THRESHOLD - half;
  const high: f32 = THRESHOLD + half;
  if (envelope <= low) return 1.0;

  const over: f32 = envelope - THRESHOLD;
  const target: f32 = THRESHOLD + (over * RATIO_RECIPROCAL);
  const hard_gain: f32 = target / envelope;
  if (envelope >= high) return hard_gain;

  const t: f32 = (envelope - low) / KNEE;
  const mix: f32 = t * t;
  const effective: f32 = envelope + (mix * (target - envelope));
  return effective / envelope;
}

function convolve_sample(
  compressed: f32,
  output_ptr: usize,
  out_idx: i32,
  state_ptr: usize,
): void {
  set_history(state_ptr, load<i32>(state_ptr + STATE_CURSOR), compressed);
  let sum: f32 = 0.0;
  let hist_idx: i32 = load<i32>(state_ptr + STATE_CURSOR);
  for (let tap: i32 = 0; tap < IR_LENGTH; tap++) {
    sum += get_history(state_ptr, hist_idx) * get_ir(tap);
    hist_idx = hist_idx == 0 ? IR_LENGTH - 1 : hist_idx - 1;
  }
  store<f32>(output_ptr + (out_idx as usize) * 4, sum);
  let cursor: i32 = load<i32>(state_ptr + STATE_CURSOR) + 1;
  if (cursor == IR_LENGTH) cursor = 0;
  store<i32>(state_ptr + STATE_CURSOR, cursor);
}

function process_block(
  input_ptr: usize,
  offset: i32,
  frames: i32,
  output_ptr: usize,
  state_ptr: usize,
): void {
  for (let i: i32 = 0; i < frames; i++) {
    const sample: f32 = load<f32>(input_ptr + ((offset + i) as usize) * 4);
    const filtered: f32 = (B0 * sample) + load<f32>(state_ptr + STATE_Z1);
    store<f32>(
      state_ptr + STATE_Z1,
      ((B1 * sample) - (A1 * filtered)) + load<f32>(state_ptr + STATE_Z2),
    );
    store<f32>(state_ptr + STATE_Z2, (B2 * sample) - (A2 * filtered));

    const magnitude: f32 = f_abs(filtered);
    const coefficient: f32 = magnitude > load<f32>(state_ptr + STATE_ENV) ? ATTACK : RELEASE;
    store<f32>(
      state_ptr + STATE_ENV,
      (coefficient * load<f32>(state_ptr + STATE_ENV)) + ((1.0 - coefficient) * magnitude),
    );

    const gain: f32 = compressor_gain(load<f32>(state_ptr + STATE_ENV));
    convolve_sample(filtered * gain, output_ptr, offset + i, state_ptr);
  }
}

function reset_state(state_ptr: usize): void {
  store<f32>(state_ptr + STATE_Z1, 0.0);
  store<f32>(state_ptr + STATE_Z2, 0.0);
  store<f32>(state_ptr + STATE_ENV, 0.0);
  store<i32>(state_ptr + STATE_CURSOR, 0);
  for (let i: i32 = 0; i < IR_LENGTH; i++) set_history(state_ptr, i, 0.0);
}

function process_channel(
  input_ptr: usize,
  output_ptr: usize,
  state_ptr: usize,
): void {
  reset_state(state_ptr);
  let blocks: i32 = 0;
  for (let offset: i32 = 0; offset < FRAMES; offset += BLOCK_FRAMES) {
    let frames: i32 = FRAMES - offset;
    if (frames > BLOCK_FRAMES) frames = BLOCK_FRAMES;
    if (blocks > 0) store<u32>(RES_OFFSET + 4, load<u32>(RES_OFFSET + 4) + 1);
    process_block(input_ptr, offset, frames, output_ptr, state_ptr);
    blocks++;
    store<u32>(RES_OFFSET, load<u32>(RES_OFFSET) + 1);
  }
  for (let tail: i32 = 0; tail < IR_LENGTH - 1; tail++) {
    convolve_sample(0.0, output_ptr, FRAMES + tail, state_ptr);
  }
  store<u32>(RES_OFFSET + 8, load<u32>(RES_OFFSET + 8) + 1);
  store<u32>(RES_OFFSET + 12, load<u32>(RES_OFFSET + 12) + (IR_LENGTH as u32) - 1);
}

export function audio_dsp(): u32 {
  store<u32>(RES_OFFSET, 0); // blockInvocations
  store<u32>(RES_OFFSET + 4, 0); // stateCarryBoundaries
  store<u32>(RES_OFFSET + 8, 0); // tailFlushInvocations
  store<u32>(RES_OFFSET + 12, 0); // tailFlushFrames

  // Allocate raw buffers inside linear memory (fixed offsets past the data segment).
  const LEFT_IN: usize = memory.data(FRAMES * 4);
  const RIGHT_IN: usize = memory.data(FRAMES * 4);
  const LEFT_OUT: usize = memory.data(OUTPUT_FRAMES * 4);
  const RIGHT_OUT: usize = memory.data(OUTPUT_FRAMES * 4);

  store<f32>(LEFT_IN, 1.0);
  store<f32>(RIGHT_IN, -0.75);
  for (let i: i32 = 1; i < FRAMES; i++) {
    if (i < 12000) {
      store<f32>(LEFT_IN + (i as usize) * 4, 0.10000000149011612);
      store<f32>(RIGHT_IN + (i as usize) * 4, -0.07500000298023224);
    } else if (i < 24000) {
      store<f32>(LEFT_IN + (i as usize) * 4, 0.25);
      store<f32>(RIGHT_IN + (i as usize) * 4, -0.1875);
    } else if (i < 36000) {
      store<f32>(LEFT_IN + (i as usize) * 4, 0.30000001192092896);
      store<f32>(RIGHT_IN + (i as usize) * 4, -0.22499999403953552);
    } else {
      store<f32>(LEFT_IN + (i as usize) * 4, -0.20000000298023224);
      store<f32>(RIGHT_IN + (i as usize) * 4, 0.15000000596046448);
    }
  }

  const state_l_ptr: usize = memory.data(128);
  process_channel(LEFT_IN, LEFT_OUT, state_l_ptr);

  const state_r_ptr: usize = memory.data(128);
  process_channel(RIGHT_IN, RIGHT_OUT, state_r_ptr);

  for (let i: i32 = 0; i < OUTPUT_FRAMES; i++) {
    let l: f32 = load<f32>(LEFT_OUT + (i as usize) * 4);
    if (l == 0.0) l = 0.0;
    let r: f32 = load<f32>(RIGHT_OUT + (i as usize) * 4);
    if (r == 0.0) r = 0.0;
    store<f32>(OUTPUT_OFFSET + (i as usize) * 8, l);
    store<f32>(OUTPUT_OFFSET + (i as usize) * 8 + 4, r);
  }

  let fnv: u32 = 0x811c9dc5;
  for (let i: i32 = 0; i < OUTPUT_FRAMES * 8; i++) {
    const byte: u8 = load<u8>(OUTPUT_OFFSET + (i as usize));
    fnv = (fnv ^ (byte as u32)) * 0x01000193;
  }
  store<u32>(RES_OFFSET + 16, fnv);

  return fnv;
}
