// audio_dsp_kernel.ts — multilang compute core for audio.webaudio-effects.v1.

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

// Workaround for raw memory without new Float32Array to avoid imports
@unmanaged
class ChannelState {
  z1: f32;
  z2: f32;
  envelope: f32;
  history_0: f32;
  history_1: f32;
  history_2: f32;
  history_3: f32;
  history_4: f32;
  history_5: f32;
  history_6: f32;
  history_7: f32;
  history_8: f32;
  history_9: f32;
  history_10: f32;
  history_11: f32;
  history_12: f32;
  history_13: f32;
  history_14: f32;
  history_15: f32;
  cursor: i32;

  get_history(idx: i32): f32 {
    switch (idx) {
      case 0:
        return this.history_0;
      case 1:
        return this.history_1;
      case 2:
        return this.history_2;
      case 3:
        return this.history_3;
      case 4:
        return this.history_4;
      case 5:
        return this.history_5;
      case 6:
        return this.history_6;
      case 7:
        return this.history_7;
      case 8:
        return this.history_8;
      case 9:
        return this.history_9;
      case 10:
        return this.history_10;
      case 11:
        return this.history_11;
      case 12:
        return this.history_12;
      case 13:
        return this.history_13;
      case 14:
        return this.history_14;
      case 15:
        return this.history_15;
      default:
        return 0.0;
    }
  }

  set_history(idx: i32, val: f32): void {
    switch (idx) {
      case 0:
        this.history_0 = val;
        break;
      case 1:
        this.history_1 = val;
        break;
      case 2:
        this.history_2 = val;
        break;
      case 3:
        this.history_3 = val;
        break;
      case 4:
        this.history_4 = val;
        break;
      case 5:
        this.history_5 = val;
        break;
      case 6:
        this.history_6 = val;
        break;
      case 7:
        this.history_7 = val;
        break;
      case 8:
        this.history_8 = val;
        break;
      case 9:
        this.history_9 = val;
        break;
      case 10:
        this.history_10 = val;
        break;
      case 11:
        this.history_11 = val;
        break;
      case 12:
        this.history_12 = val;
        break;
      case 13:
        this.history_13 = val;
        break;
      case 14:
        this.history_14 = val;
        break;
      case 15:
        this.history_15 = val;
        break;
    }
  }
}

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

function compressor_gain(envelope: f32): f32 {
  let half: f32 = KNEE * 0.5;
  let low: f32 = THRESHOLD - half;
  let high: f32 = THRESHOLD + half;
  if (envelope <= low) return 1.0;

  let over: f32 = envelope - THRESHOLD;
  let target: f32 = THRESHOLD + (over * RATIO_RECIPROCAL);
  let hard_gain: f32 = target / envelope;
  if (envelope >= high) return hard_gain;

  let t: f32 = (envelope - low) / KNEE;
  let mix: f32 = t * t;
  let effective: f32 = envelope + (mix * (target - envelope));
  return effective / envelope;
}

function convolve_sample(
  compressed: f32,
  output_ptr: usize,
  out_idx: i32,
  state: ChannelState,
): void {
  state.set_history(state.cursor, compressed);
  let sum: f32 = 0.0;
  let hist_idx: i32 = state.cursor;
  for (let tap: i32 = 0; tap < IR_LENGTH; tap++) {
    sum += state.get_history(hist_idx) * get_ir(tap);
    hist_idx = hist_idx == 0 ? IR_LENGTH - 1 : hist_idx - 1;
  }
  store<f32>(output_ptr + (out_idx as usize) * 4, sum);
  state.cursor++;
  if (state.cursor == IR_LENGTH) state.cursor = 0;
}

function process_block(
  input_ptr: usize,
  offset: i32,
  frames: i32,
  output_ptr: usize,
  state: ChannelState,
): void {
  for (let i: i32 = 0; i < frames; i++) {
    let sample = load<f32>(input_ptr + ((offset + i) as usize) * 4);
    let filtered: f32 = (B0 * sample) + state.z1;
    state.z1 = ((B1 * sample) - (A1 * filtered)) + state.z2;
    state.z2 = (B2 * sample) - (A2 * filtered);

    let magnitude: f32 = f_abs(filtered);
    let coefficient: f32 = magnitude > state.envelope ? ATTACK : RELEASE;
    state.envelope = (coefficient * state.envelope) + ((1.0 - coefficient) * magnitude);

    let gain: f32 = compressor_gain(state.envelope);
    convolve_sample(filtered * gain, output_ptr, offset + i, state);
  }
}

export function audio_dsp(): u32 {
  store<u32>(RES_OFFSET, 0); // blockInvocations
  store<u32>(RES_OFFSET + 4, 0); // stateCarryBoundaries
  store<u32>(RES_OFFSET + 8, 0); // tailFlushInvocations
  store<u32>(RES_OFFSET + 12, 0); // tailFlushFrames

  // Allocate raw buffers dynamically inside linear memory to avoid classes
  let LEFT_IN = memory.data(FRAMES * 4);
  let RIGHT_IN = memory.data(FRAMES * 4);
  let LEFT_OUT = memory.data(OUTPUT_FRAMES * 4);
  let RIGHT_OUT = memory.data(OUTPUT_FRAMES * 4);

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

  // We allocate a ChannelState on the heap but as a raw struct (with --bindings none it just uses standard AS allocator if we don't import abort, wait I can allocate it using memory.data too)
  let state_l_ptr = memory.data(128); // enough for z1, z2, env, 16 floats, cursor
  let state_l = changetype<ChannelState>(state_l_ptr);
  state_l.z1 = 0;
  state_l.z2 = 0;
  state_l.envelope = 0;
  state_l.cursor = 0;
  for (let i = 0; i < 16; i++) state_l.set_history(i, 0);

  let blocks: i32 = 0;
  for (let offset: i32 = 0; offset < FRAMES; offset += BLOCK_FRAMES) {
    let frames = FRAMES - offset;
    if (frames > BLOCK_FRAMES) frames = BLOCK_FRAMES;
    if (blocks > 0) store<u32>(RES_OFFSET + 4, load<u32>(RES_OFFSET + 4) + 1);
    process_block(LEFT_IN, offset, frames, LEFT_OUT, state_l);
    blocks++;
    store<u32>(RES_OFFSET, load<u32>(RES_OFFSET) + 1);
  }
  for (let tail: i32 = 0; tail < IR_LENGTH - 1; tail++) {
    convolve_sample(0.0, LEFT_OUT, FRAMES + tail, state_l);
  }
  store<u32>(RES_OFFSET + 8, load<u32>(RES_OFFSET + 8) + 1);
  store<u32>(RES_OFFSET + 12, load<u32>(RES_OFFSET + 12) + (IR_LENGTH as u32) - 1);

  let state_r_ptr = memory.data(128);
  let state_r = changetype<ChannelState>(state_r_ptr);
  state_r.z1 = 0;
  state_r.z2 = 0;
  state_r.envelope = 0;
  state_r.cursor = 0;
  for (let i = 0; i < 16; i++) state_r.set_history(i, 0);

  blocks = 0;
  for (let offset: i32 = 0; offset < FRAMES; offset += BLOCK_FRAMES) {
    let frames = FRAMES - offset;
    if (frames > BLOCK_FRAMES) frames = BLOCK_FRAMES;
    if (blocks > 0) store<u32>(RES_OFFSET + 4, load<u32>(RES_OFFSET + 4) + 1);
    process_block(RIGHT_IN, offset, frames, RIGHT_OUT, state_r);
    blocks++;
    store<u32>(RES_OFFSET, load<u32>(RES_OFFSET) + 1);
  }
  for (let tail: i32 = 0; tail < IR_LENGTH - 1; tail++) {
    convolve_sample(0.0, RIGHT_OUT, FRAMES + tail, state_r);
  }
  store<u32>(RES_OFFSET + 8, load<u32>(RES_OFFSET + 8) + 1);
  store<u32>(RES_OFFSET + 12, load<u32>(RES_OFFSET + 12) + (IR_LENGTH as u32) - 1);

  for (let i: i32 = 0; i < OUTPUT_FRAMES; i++) {
    let l = load<f32>(LEFT_OUT + (i as usize) * 4);
    if (l == -0.0) l = 0.0;
    let r = load<f32>(RIGHT_OUT + (i as usize) * 4);
    if (r == -0.0) r = 0.0;
    store<f32>(OUTPUT_OFFSET + (i as usize) * 8, l);
    store<f32>(OUTPUT_OFFSET + (i as usize) * 8 + 4, r);
  }

  let fnv: u32 = 0x811c9dc5;
  for (let i: i32 = 0; i < OUTPUT_FRAMES * 8; i++) {
    let byte = load<u8>(OUTPUT_OFFSET + (i as usize));
    fnv = (fnv ^ (byte as u32)) * 0x01000193;
  }
  store<u32>(RES_OFFSET + 16, fnv);

  return fnv;
}
