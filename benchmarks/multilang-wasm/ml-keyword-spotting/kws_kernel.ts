import * as C from "./constants";

const HOP_SAMPLES = 320;
const WINDOW_SAMPLES = 480;
const FFT_SIZE = 512;
const HOPS = 300;
const FEATURES = 10;
const CONTEXT = 49;
const CHANNELS = 8;
const CLASSES = 12;
const ROWS = 25;
const COLUMNS = 5;
const ELEMENTS = ROWS * COLUMNS;

const PCM_OFFSET = 1048576;
const FEATURES_OFFSET = 4194304;
const SCORES_OFFSET = 5242880;
const RESULTS_OFFSET = 6291456;

let detection_count_value = 0;
const RE_BUF = memory.data(FFT_SIZE * 4);
const IM_BUF = memory.data(FFT_SIZE * 4);
const BANDS = memory.data(FEATURES * 4);
const CONTEXT_BUF = memory.data(CONTEXT * FEATURES);
const LAYER_A = memory.data(ELEMENTS * CHANNELS);
const LAYER_B = memory.data(ELEMENTS * CHANNELS);

function abs32(x: i32): i32 {
  return x < 0 ? -x : x;
}

function clamp_i8(x: i64, relu: bool): i32 {
  const low: i32 = relu ? 0 : -128;
  return x < low ? low : x > 127 ? 127 : <i32> x;
}

function round_div_i64(value: i64, divisor: i64): i64 {
  return value >= 0 ? (value + divisor / 2) / divisor : -((-value + divisor / 2) / divisor);
}

function requantize(accumulator: i32, multiplier: i64, relu: bool): i8 {
  return <i8> clamp_i8(round_div_i64(<i64> accumulator * multiplier, 16777216), relu);
}

function ilog2_u32(x: u32): i32 {
  let n = 0;
  while (x > 1) {
    x >>>= 1;
    n++;
  }
  return n;
}

function bit_reverse9(x: u32): u32 {
  let r: u32 = 0;
  for (let i = 0; i < 9; i++) {
    r = (r << 1) | (x & 1);
    x >>>= 1;
  }
  return r;
}

function feature_for_hop(hop: i32, out_ptr: usize): void {
  const base = hop * HOP_SAMPLES;
  for (let i = 0; i < FFT_SIZE; i++) {
    const source = base + i;
    const pcm_val = load<i16>(PCM_OFFSET + source * 2);
    let win_val: i32 = 0;
    if (i < WINDOW_SAMPLES) {
      win_val = C.KWS_WINDOW_Q15[i];
    }
    store<i32>(
      RE_BUF + i * 4,
      i < WINDOW_SAMPLES && source < 960000 ? (<i32> pcm_val * win_val) >> 15 : 0,
    );
    store<i32>(IM_BUF + i * 4, 0);
  }
  for (let i = 0; i < FFT_SIZE; i++) {
    const j = bit_reverse9(<u32> i);
    if (j > <u32> i) {
      const tr = load<i32>(RE_BUF + i * 4);
      store<i32>(RE_BUF + i * 4, load<i32>(RE_BUF + j * 4));
      store<i32>(RE_BUF + j * 4, tr);

      const ti = load<i32>(IM_BUF + i * 4);
      store<i32>(IM_BUF + i * 4, load<i32>(IM_BUF + j * 4));
      store<i32>(IM_BUF + j * 4, ti);
    }
  }
  for (let length = 2; length <= FFT_SIZE; length <<= 1) {
    const half = length >> 1;
    const twiddle_step = FFT_SIZE / length;
    for (let start = 0; start < FFT_SIZE; start += length) {
      for (let offset = 0; offset < half; offset++) {
        const twiddle = offset * twiddle_step;
        const br = load<i32>(RE_BUF + (start + offset + half) * 4);
        const bi = load<i32>(IM_BUF + (start + offset + half) * 4);
        const wr = C.KWS_TWIDDLE_REAL_Q15[twiddle];
        const wi = C.KWS_TWIDDLE_IMAG_Q15[twiddle];
        const tr = <i32> ((<i64> br * wr - <i64> bi * wi) >> 15);
        const ti = <i32> ((<i64> br * wi + <i64> bi * wr) >> 15);
        const ar = load<i32>(RE_BUF + (start + offset) * 4);
        const ai = load<i32>(IM_BUF + (start + offset) * 4);
        store<i32>(RE_BUF + (start + offset) * 4, (ar + tr) >> 1);
        store<i32>(IM_BUF + (start + offset) * 4, (ai + ti) >> 1);
        store<i32>(RE_BUF + (start + offset + half) * 4, (ar - tr) >> 1);
        store<i32>(IM_BUF + (start + offset + half) * 4, (ai - ti) >> 1);
      }
    }
  }
  for (let band = 0; band < FEATURES; band++) {
    const begin = 1 + (band * 256) / FEATURES;
    const end = 1 + ((band + 1) * 256) / FEATURES;
    let sum: u32 = 1;
    for (let bin = begin; bin < end; bin++) {
      sum += <u32> (abs32(load<i32>(RE_BUF + bin * 4)) + abs32(load<i32>(IM_BUF + bin * 4)));
    }
    store<i32>(BANDS + band * 4, ilog2_u32(sum));
  }
  for (let coefficient = 0; coefficient < FEATURES; coefficient++) {
    let sum: i32 = 0;
    for (let band = 0; band < FEATURES; band++) {
      sum += load<i32>(BANDS + band * 4) * C.KWS_DCT_Q15[coefficient * FEATURES + band];
    }
    const raw = clamp_i8(<i64> sum >> 13, false);
    store<i8>(out_ptr + coefficient, C.KWS_NORMALIZATION_I8[coefficient * 256 + raw + 128]);
  }
}

function model_input(hop: i32, row: i32, column: i32): i8 {
  if (row < 0 || row >= CONTEXT || column < 0 || column >= FEATURES) return 0;
  const source_hop = hop - (CONTEXT - 1 - row);
  if (source_hop < 0) return 0;
  return load<i8>(CONTEXT_BUF + (source_hop % CONTEXT) * FEATURES + column);
}

function infer_hop(hop: i32, feature_ptr: usize, scores_ptr: usize): void {
  const context_offset = (hop % CONTEXT) * FEATURES;
  for (let f = 0; f < FEATURES; f++) {
    store<i8>(CONTEXT_BUF + context_offset + f, load<i8>(feature_ptr + f));
  }
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      for (let output_channel = 0; output_channel < CHANNELS; output_channel++) {
        let accumulator = C.KWS_CONV0_BIASES[output_channel];
        const weight_base = output_channel * 40;
        for (let kernel_row = 0; kernel_row < 10; kernel_row++) {
          for (let kernel_column = 0; kernel_column < 4; kernel_column++) {
            accumulator +=
              <i32> model_input(hop, row * 2 + kernel_row - 4, column * 2 + kernel_column - 1) *
              C.KWS_CONV0_WEIGHTS[weight_base + kernel_row * 4 + kernel_column];
          }
        }
        store<i8>(
          LAYER_A + (row * COLUMNS + column) * CHANNELS + output_channel,
          requantize(accumulator, C.KWS_CONV0_MULTIPLIER_Q24, true),
        );
      }
    }
  }
  for (let block = 0; block < 4; block++) {
    const depthwise_weights = block == 0
      ? C.KWS_DW0_WEIGHTS
      : block == 1
      ? C.KWS_DW1_WEIGHTS
      : block == 2
      ? C.KWS_DW2_WEIGHTS
      : C.KWS_DW3_WEIGHTS;
    const depthwise_biases = block == 0
      ? C.KWS_DW0_BIASES
      : block == 1
      ? C.KWS_DW1_BIASES
      : block == 2
      ? C.KWS_DW2_BIASES
      : C.KWS_DW3_BIASES;
    const depthwise_multipliers = block == 0
      ? C.KWS_DW0_MULTIPLIER_Q24
      : block == 1
      ? C.KWS_DW1_MULTIPLIER_Q24
      : block == 2
      ? C.KWS_DW2_MULTIPLIER_Q24
      : C.KWS_DW3_MULTIPLIER_Q24;
    const pointwise_weights = block == 0
      ? C.KWS_PW0_WEIGHTS
      : block == 1
      ? C.KWS_PW1_WEIGHTS
      : block == 2
      ? C.KWS_PW2_WEIGHTS
      : C.KWS_PW3_WEIGHTS;
    const pointwise_biases = block == 0
      ? C.KWS_PW0_BIASES
      : block == 1
      ? C.KWS_PW1_BIASES
      : block == 2
      ? C.KWS_PW2_BIASES
      : C.KWS_PW3_BIASES;
    const pointwise_multipliers = block == 0
      ? C.KWS_PW0_MULTIPLIER_Q24
      : block == 1
      ? C.KWS_PW1_MULTIPLIER_Q24
      : block == 2
      ? C.KWS_PW2_MULTIPLIER_Q24
      : C.KWS_PW3_MULTIPLIER_Q24;

    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        for (let channel = 0; channel < CHANNELS; channel++) {
          let accumulator = depthwise_biases[channel];
          for (let kernel_row = 0; kernel_row < 3; kernel_row++) {
            const source_row = row + kernel_row - 1;
            for (let kernel_column = 0; kernel_column < 3; kernel_column++) {
              const source_column = column + kernel_column - 1;
              if (
                source_row >= 0 && source_row < ROWS && source_column >= 0 &&
                source_column < COLUMNS
              ) {
                accumulator += <i32> load<i8>(
                  LAYER_A + (source_row * COLUMNS + source_column) * CHANNELS + channel,
                ) *
                  depthwise_weights[channel * 9 + kernel_row * 3 + kernel_column];
              }
            }
          }
          store<i8>(
            LAYER_B + (row * COLUMNS + column) * CHANNELS + channel,
            requantize(accumulator, depthwise_multipliers, false),
          );
        }
      }
    }
    for (let element = 0; element < ELEMENTS; element++) {
      for (let output_channel = 0; output_channel < CHANNELS; output_channel++) {
        let accumulator = pointwise_biases[output_channel];
        for (let input_channel = 0; input_channel < CHANNELS; input_channel++) {
          accumulator += <i32> load<i8>(LAYER_B + element * CHANNELS + input_channel) *
            pointwise_weights[output_channel * CHANNELS + input_channel];
        }
        store<i8>(
          LAYER_A + element * CHANNELS + output_channel,
          requantize(accumulator, pointwise_multipliers, true),
        );
      }
    }
  }
  for (let class_index = 0; class_index < CLASSES; class_index++) {
    let accumulator = C.KWS_DENSE_BIASES[class_index];
    for (let channel = 0; channel < CHANNELS; channel++) {
      let sum: i32 = 0;
      for (let element = 0; element < ELEMENTS; element++) {
        sum += load<i8>(LAYER_A + element * CHANNELS + channel);
      }
      accumulator += <i32> round_div_i64(sum, ELEMENTS) *
        C.KWS_DENSE_WEIGHTS[class_index * CHANNELS + channel];
    }
    store<i32>(scores_ptr + class_index * 4, accumulator);
  }
}

function fnv1a(ptr: usize, length: u32): u32 {
  let hash: u32 = 0x811c9dc5;
  for (let i: u32 = 0; i < length; i++) {
    hash ^= load<u8>(ptr + i);
    hash = hash * 0x01000193;
  }
  return hash;
}

export function kws_run(): i32 {
  detection_count_value = 0;
  for (let i = 0; i < CONTEXT * FEATURES; i++) {
    store<i8>(CONTEXT_BUF + i, 0);
  }
  let accepted = 10;
  let candidate = 10;
  let candidate_count = 0;

  for (let hop = 0; hop < HOPS; hop++) {
    const feature_ptr = FEATURES_OFFSET + hop * FEATURES;
    const scores_ptr = SCORES_OFFSET + hop * CLASSES * 4;
    feature_for_hop(hop, feature_ptr);
    infer_hop(hop, feature_ptr, scores_ptr);

    let best = 0;
    for (let c = 1; c < CLASSES; c++) {
      if (load<i32>(scores_ptr + c * 4) > load<i32>(scores_ptr + best * 4)) best = c;
    }

    if (best == candidate) candidate_count++;
    else {
      candidate = best;
      candidate_count = 1;
    }

    if (candidate_count == 5 && candidate != accepted) {
      accepted = candidate;
      if (accepted != 10 && detection_count_value < HOPS) {
        const out = detection_count_value * 12;
        store<u32>(RESULTS_OFFSET + out, hop);
        store<u32>(RESULTS_OFFSET + out + 4, accepted);
        store<u32>(RESULTS_OFFSET + out + 8, load<i32>(scores_ptr + accepted * 4));
        detection_count_value++;
      }
    }
  }

  const counters_ptr = RESULTS_OFFSET + 3072;
  store<u32>(counters_ptr + 0, 300);
  store<u32>(counters_ptr + 4, 300);
  store<u32>(counters_ptr + 8, 300 * 480);
  store<u32>(counters_ptr + 12, 300);
  store<u32>(counters_ptr + 16, 300 * 2304);
  store<u32>(counters_ptr + 20, 300 * 256);
  store<u32>(counters_ptr + 24, 300 * 10);
  store<u32>(counters_ptr + 28, 300 * 25 * 5 * 8 * 10 * 4);
  store<u32>(counters_ptr + 32, 300 * 4 * 25 * 5 * 8 * 9);
  store<u32>(counters_ptr + 36, 300 * 4 * 25 * 5 * 8 * 8);
  store<u32>(counters_ptr + 40, 300 * 25 * 5 * 8);
  store<u32>(counters_ptr + 44, 300 * 8 * 12);
  store<u32>(counters_ptr + 48, 300 * 12);
  store<u32>(counters_ptr + 52, 300 * 10);
  store<u32>(counters_ptr + 56, 193280);
  store<u32>(counters_ptr + 60, 300 * 10 + 300 * 12 * 4 + detection_count_value * 12);
  store<u32>(counters_ptr + 64, detection_count_value * 3);

  const fnvs_ptr = RESULTS_OFFSET + 3200;
  store<u32>(fnvs_ptr + 0, fnv1a(FEATURES_OFFSET, HOPS * FEATURES));
  store<u32>(fnvs_ptr + 4, fnv1a(SCORES_OFFSET, HOPS * CLASSES * 4));
  store<u32>(fnvs_ptr + 8, fnv1a(RESULTS_OFFSET, detection_count_value * 12));

  return 0;
}
