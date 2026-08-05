// audio-stft multilang kernel (C++)
// Mirrors benchmarks/audio-stft/workload.ts stftInto:
// Windowing + Radix-2 FFT over overlapping frames into spectrogram buffer.

#include <stdint.h>

extern "C" {

static void fft_radix2(float* data, uint32_t n, const float* twiddle) {
  for (uint32_t i = 1, j = 0; i < n; i++) {
    uint32_t bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      uint32_t ri = i * 2, rj = j * 2;
      float t = data[ri]; data[ri] = data[rj]; data[rj] = t;
      t = data[ri + 1]; data[ri + 1] = data[rj + 1]; data[rj + 1] = t;
    }
  }
  uint32_t tw_idx = 0;
  for (uint32_t len = 2; len <= n; len <<= 1) {
    uint32_t half_len = len >> 1;
    for (uint32_t i = 0; i < n; i += len) {
      uint32_t tw = tw_idx;
      for (uint32_t j = 0; j < half_len; j++) {
        float w_cos = twiddle[tw];
        float w_sin = twiddle[tw + 1];
        tw += 2;
        uint32_t even_idx = (i + j) * 2;
        uint32_t odd_idx = (i + j + half_len) * 2;
        float even_re = data[even_idx], even_im = data[even_idx + 1];
        float odd_re = data[odd_idx], odd_im = data[odd_idx + 1];
        float t_re = w_cos * odd_re - w_sin * odd_im;
        float t_im = w_cos * odd_im + w_sin * odd_re;
        data[even_idx] = even_re + t_re;
        data[even_idx + 1] = even_im + t_im;
        data[odd_idx] = even_re - t_re;
        data[odd_idx + 1] = even_im - t_im;
      }
    }
    tw_idx += half_len * 2;
  }
}

__attribute__((visibility("default")))
void stft(
    const float* input, uint32_t input_len, uint32_t frame_size, uint32_t hop_size,
    const float* window, const float* twiddle, float* scratch, float* spectrogram) {
  uint32_t num_frames = 1 + (input_len - frame_size) / hop_size;
  for (uint32_t frame = 0; frame < num_frames; frame++) {
    uint32_t offset = frame * hop_size;
    for (uint32_t i = 0; i < frame_size; i++) {
      scratch[i * 2] = input[offset + i] * window[i];
      scratch[i * 2 + 1] = 0.0f;
    }
    fft_radix2(scratch, frame_size, twiddle);
    uint32_t spec_offset = frame * frame_size * 2;
    for (uint32_t i = 0; i < frame_size * 2; i++) {
      spectrogram[spec_offset + i] = scratch[i];
    }
  }
}

} // extern "C"
