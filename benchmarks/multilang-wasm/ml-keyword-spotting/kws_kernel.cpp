#include "../../base/ml-keyword-spotting/constants.v1.h"

namespace KWS {
  constexpr int HOP_SAMPLES = 320;
  constexpr int WINDOW_SAMPLES = 480;
  constexpr int FFT_SIZE = 512;
  constexpr int HOPS = 300;
  constexpr int FEATURES = 10;
  constexpr int CONTEXT = 49;
  constexpr int CHANNELS = 8;
  constexpr int CLASSES = 12;
  constexpr int ROWS = 25;
  constexpr int COLUMNS = 5;
  constexpr int ELEMENTS = ROWS * COLUMNS;

  constexpr unsigned PCM_OFFSET = 1048576u;
  constexpr unsigned FEATURES_OFFSET = 4194304u;
  constexpr unsigned SCORES_OFFSET = 5242880u;
  constexpr unsigned RESULTS_OFFSET = 6291456u;

  using int8_t = signed char;
  using int16_t = short;
  using int32_t = int;
  using int64_t = long long;
  using uint8_t = unsigned char;
  using uint32_t = unsigned int;

  int16_t* const pcm = reinterpret_cast<int16_t*>(PCM_OFFSET);
  int8_t* const all_features = reinterpret_cast<int8_t*>(FEATURES_OFFSET);
  int32_t* const all_scores = reinterpret_cast<int32_t*>(SCORES_OFFSET);
  uint32_t* const detections = reinterpret_cast<uint32_t*>(RESULTS_OFFSET);
  uint32_t* const counters = reinterpret_cast<uint32_t*>(RESULTS_OFFSET + 3072u);
  uint32_t* const fnvs = reinterpret_cast<uint32_t*>(RESULTS_OFFSET + 3200u);

  int32_t re_buf[FFT_SIZE];
  int32_t im_buf[FFT_SIZE];
  int32_t bands[FEATURES];
  int8_t context_buf[CONTEXT * FEATURES];
  int8_t layer_a[ELEMENTS * CHANNELS];
  int8_t layer_b[ELEMENTS * CHANNELS];
  int32_t detection_count_value;

  constexpr int32_t abs32(int32_t x) { return x < 0 ? -x : x; }
  constexpr int32_t clamp_i8(int64_t x, bool relu) {
    int32_t low = relu ? 0 : -128;
    return x < low ? low : (x > 127 ? 127 : static_cast<int32_t>(x));
  }
  constexpr int64_t round_div_i64(int64_t value, int64_t divisor) {
    return value >= 0 ? (value + divisor / 2) / divisor : -((-value + divisor / 2) / divisor);
  }
  constexpr int8_t requantize(int32_t accumulator, int64_t multiplier, bool relu) {
    return static_cast<int8_t>(clamp_i8(round_div_i64(static_cast<int64_t>(accumulator) * multiplier, 16777216LL), relu));
  }
  constexpr int32_t ilog2_u32(uint32_t x) {
    int32_t n = 0;
    while (x > 1u) { x >>= 1u; n++; }
    return n;
  }
  constexpr uint32_t bit_reverse9(uint32_t x) {
    uint32_t r = 0;
    for (int i = 0; i < 9; i++) { r = (r << 1u) | (x & 1u); x >>= 1u; }
    return r;
  }

  void feature_for_hop(int hop, int8_t *out) {
    int base = hop * HOP_SAMPLES;
    for (int i = 0; i < FFT_SIZE; i++) {
      int source = base + i;
      re_buf[i] = i < WINDOW_SAMPLES && source < 960000
        ? ((int32_t)pcm[source] * KWS_WINDOW_Q15[i]) >> 15
        : 0;
      im_buf[i] = 0;
    }
    for (uint32_t i = 0; i < FFT_SIZE; i++) {
      uint32_t j = bit_reverse9(i);
      if (j > i) {
        int32_t tr = re_buf[i]; re_buf[i] = re_buf[j]; re_buf[j] = tr;
        int32_t ti = im_buf[i]; im_buf[i] = im_buf[j]; im_buf[j] = ti;
      }
    }
    for (int length = 2; length <= FFT_SIZE; length <<= 1) {
      int half = length >> 1;
      int twiddle_step = FFT_SIZE / length;
      for (int start = 0; start < FFT_SIZE; start += length) {
        for (int offset = 0; offset < half; offset++) {
          int twiddle = offset * twiddle_step;
          int32_t br = re_buf[start + offset + half];
          int32_t bi = im_buf[start + offset + half];
          int32_t wr = KWS_TWIDDLE_REAL_Q15[twiddle];
          int32_t wi = KWS_TWIDDLE_IMAG_Q15[twiddle];
          int32_t tr = static_cast<int32_t>((static_cast<int64_t>(br) * wr - static_cast<int64_t>(bi) * wi) >> 15);
          int32_t ti = static_cast<int32_t>((static_cast<int64_t>(br) * wi + static_cast<int64_t>(bi) * wr) >> 15);
          int32_t ar = re_buf[start + offset];
          int32_t ai = im_buf[start + offset];
          re_buf[start + offset] = (ar + tr) >> 1;
          im_buf[start + offset] = (ai + ti) >> 1;
          re_buf[start + offset + half] = (ar - tr) >> 1;
          im_buf[start + offset + half] = (ai - ti) >> 1;
        }
      }
    }
    for (int band = 0; band < FEATURES; band++) {
      int begin = 1 + (band * 256) / FEATURES;
      int end = 1 + ((band + 1) * 256) / FEATURES;
      uint32_t sum = 1;
      for (int bin = begin; bin < end; bin++) sum += static_cast<uint32_t>(abs32(re_buf[bin]) + abs32(im_buf[bin]));
      bands[band] = ilog2_u32(sum);
    }
    for (int coefficient = 0; coefficient < FEATURES; coefficient++) {
      int32_t sum = 0;
      for (int band = 0; band < FEATURES; band++) sum += bands[band] * KWS_DCT_Q15[coefficient * FEATURES + band];
      int32_t raw = clamp_i8(sum >> 13, false);
      out[coefficient] = KWS_NORMALIZATION_I8[coefficient * 256 + raw + 128];
    }
  }

  int8_t model_input(int hop, int row, int column) {
    if (row < 0 || row >= CONTEXT || column < 0 || column >= FEATURES) return 0;
    int source_hop = hop - (CONTEXT - 1 - row);
    return source_hop < 0 ? 0 : context_buf[(source_hop % CONTEXT) * FEATURES + column];
  }

  void infer_hop(int hop, const int8_t *feature, int32_t *scores) {
    int context_offset = (hop % CONTEXT) * FEATURES;
    for (int f = 0; f < FEATURES; f++) context_buf[context_offset + f] = feature[f];
    for (int row = 0; row < ROWS; row++) {
      for (int column = 0; column < COLUMNS; column++) {
        for (int output_channel = 0; output_channel < CHANNELS; output_channel++) {
          int32_t accumulator = KWS_CONV0_BIASES[output_channel];
          int weight_base = output_channel * 40;
          for (int kernel_row = 0; kernel_row < 10; kernel_row++) {
            for (int kernel_column = 0; kernel_column < 4; kernel_column++) {
              accumulator += static_cast<int32_t>(model_input(hop, row * 2 + kernel_row - 4, column * 2 + kernel_column - 1)) *
                KWS_CONV0_WEIGHTS[weight_base + kernel_row * 4 + kernel_column];
            }
          }
          layer_a[(row * COLUMNS + column) * CHANNELS + output_channel] = requantize(accumulator, KWS_CONV0_MULTIPLIER_Q24, true);
        }
      }
    }
    const int8_t *depthwise_weights[4] = { KWS_DW0_WEIGHTS, KWS_DW1_WEIGHTS, KWS_DW2_WEIGHTS, KWS_DW3_WEIGHTS };
    const int32_t *depthwise_biases[4] = { KWS_DW0_BIASES, KWS_DW1_BIASES, KWS_DW2_BIASES, KWS_DW3_BIASES };
    const int64_t depthwise_multipliers[4] = { KWS_DW0_MULTIPLIER_Q24, KWS_DW1_MULTIPLIER_Q24, KWS_DW2_MULTIPLIER_Q24, KWS_DW3_MULTIPLIER_Q24 };
    const int8_t *pointwise_weights[4] = { KWS_PW0_WEIGHTS, KWS_PW1_WEIGHTS, KWS_PW2_WEIGHTS, KWS_PW3_WEIGHTS };
    const int32_t *pointwise_biases[4] = { KWS_PW0_BIASES, KWS_PW1_BIASES, KWS_PW2_BIASES, KWS_PW3_BIASES };
    const int64_t pointwise_multipliers[4] = { KWS_PW0_MULTIPLIER_Q24, KWS_PW1_MULTIPLIER_Q24, KWS_PW2_MULTIPLIER_Q24, KWS_PW3_MULTIPLIER_Q24 };
    for (int block = 0; block < 4; block++) {
      for (int row = 0; row < ROWS; row++) {
        for (int column = 0; column < COLUMNS; column++) {
          for (int channel = 0; channel < CHANNELS; channel++) {
            int32_t accumulator = depthwise_biases[block][channel];
            for (int kernel_row = 0; kernel_row < 3; kernel_row++) {
              int source_row = row + kernel_row - 1;
              for (int kernel_column = 0; kernel_column < 3; kernel_column++) {
                int source_column = column + kernel_column - 1;
                if (source_row >= 0 && source_row < ROWS && source_column >= 0 && source_column < COLUMNS) {
                  accumulator += layer_a[(source_row * COLUMNS + source_column) * CHANNELS + channel] *
                    depthwise_weights[block][channel * 9 + kernel_row * 3 + kernel_column];
                }
              }
            }
            layer_b[(row * COLUMNS + column) * CHANNELS + channel] = requantize(accumulator, depthwise_multipliers[block], false);
          }
        }
      }
      for (int element = 0; element < ELEMENTS; element++) {
        for (int output_channel = 0; output_channel < CHANNELS; output_channel++) {
          int32_t accumulator = pointwise_biases[block][output_channel];
          for (int input_channel = 0; input_channel < CHANNELS; input_channel++) {
            accumulator += layer_b[element * CHANNELS + input_channel] * pointwise_weights[block][output_channel * CHANNELS + input_channel];
          }
          layer_a[element * CHANNELS + output_channel] = requantize(accumulator, pointwise_multipliers[block], true);
        }
      }
    }
    for (int class_index = 0; class_index < CLASSES; class_index++) {
      int32_t accumulator = KWS_DENSE_BIASES[class_index];
      for (int channel = 0; channel < CHANNELS; channel++) {
        int32_t sum = 0;
        for (int element = 0; element < ELEMENTS; element++) sum += layer_a[element * CHANNELS + channel];
        accumulator += static_cast<int32_t>(round_div_i64(sum, ELEMENTS)) * KWS_DENSE_WEIGHTS[class_index * CHANNELS + channel];
      }
      scores[class_index] = accumulator;
    }
  }

  uint32_t fnv1a(const uint8_t *data, uint32_t length) {
    uint32_t hash = 0x811c9dc5u;
    for (uint32_t i = 0; i < length; i++) {
      hash ^= data[i];
      hash *= 0x01000193u;
    }
    return hash;
  }
}

extern "C" {
  int kws_run(void) {
    using namespace KWS;
    detection_count_value = 0;
    for (int i = 0; i < CONTEXT * FEATURES; i++) context_buf[i] = 0;
    int accepted = 10;
    int candidate = 10;
    int candidate_count = 0;
    
    for (int hop = 0; hop < HOPS; hop++) {
      int8_t *feature = &all_features[hop * FEATURES];
      int32_t *scores = &all_scores[hop * CLASSES];
      feature_for_hop(hop, feature);
      infer_hop(hop, feature, scores);
      int best = 0;
      for (int c = 1; c < CLASSES; c++) if (scores[c] > scores[best]) best = c;
      if (best == candidate) candidate_count++;
      else { candidate = best; candidate_count = 1; }
      if (candidate_count == 5 && candidate != accepted) {
        accepted = candidate;
        if (accepted != 10 && detection_count_value < HOPS) {
          int out = detection_count_value * 3;
          detections[out] = hop; 
          detections[out + 1] = accepted; 
          detections[out + 2] = scores[accepted];
          detection_count_value++;
        }
      }
    }

    counters[0] = 300; 
    counters[1] = 300; 
    counters[2] = 300 * 480; 
    counters[3] = 300; 
    counters[4] = 300 * 2304; 
    counters[5] = 300 * 256; 
    counters[6] = 300 * 10; 
    counters[7] = 300 * 25 * 5 * 8 * 10 * 4; 
    counters[8] = 300 * 4 * 25 * 5 * 8 * 9; 
    counters[9] = 300 * 4 * 25 * 5 * 8 * 8; 
    counters[10] = 300 * 25 * 5 * 8; 
    counters[11] = 300 * 8 * 12; 
    counters[12] = 300 * 12; 
    counters[13] = 300 * 10; 
    counters[14] = 193280; 
    counters[15] = 300 * 10 + 300 * 12 * 4 + detection_count_value * 12; 
    counters[16] = detection_count_value * 3; 
    
    fnvs[0] = fnv1a(reinterpret_cast<const uint8_t*>(all_features), HOPS * FEATURES);
    fnvs[1] = fnv1a(reinterpret_cast<const uint8_t*>(all_scores), HOPS * CLASSES * 4);
    fnvs[2] = fnv1a(reinterpret_cast<const uint8_t*>(detections), detection_count_value * 12);
    
    return 0;
  }
}
