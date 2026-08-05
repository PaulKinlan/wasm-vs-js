// audio-fir multilang kernel (C)
// Mirrors benchmarks/audio-fir/workload.ts direct convolution:
// output[i+j] += input[i] * taps[j]

#include <stdint.h>

__attribute__((visibility("default")))
void fir(
    const float* input,
    const float* taps,
    float* output,
    uint32_t input_len,
    uint32_t taps_len) {
  uint32_t out_len = input_len + taps_len - 1;
  for (uint32_t k = 0; k < out_len; k++) output[k] = 0.0f;
  for (uint32_t i = 0; i < input_len; i++) {
    float sample = input[i];
    for (uint32_t j = 0; j < taps_len; j++) {
      output[i + j] += sample * taps[j];
    }
  }
}
