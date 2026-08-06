#include <stdint.h>

// Track B — FFT optimized C variant (INDEPENDENTLY OPTIMIZED).
// Track A baseline (benchmarks/multilang-wasm/fft_kernel.c) is KEPT UNTOUCHED;
// the arithmetic below is the VERBATIM Track A sequence (same custom sin/cos,
// same butterfly op order) → BIT-IDENTICAL output.
//
// OPTIMIZATION LOG:
// 1. Pointer-hoisted butterflies: real/imag reads for u and v are loaded into
//    locals once per j (the baseline re-reads real[v]/imag[v] four times per
//    j iteration). The float op order is unchanged.
// 2. Hoisted `i + step` (v base) and the row pointers out of the innermost
//    expression.
// Measured delta in docs/track-b-optimizations.md.

static float sinf_custom(float x) {
  while (x > 3.14159265358979323846f) x -= 2.0f * 3.14159265358979323846f;
  while (x < -3.14159265358979323846f) x += 2.0f * 3.14159265358979323846f;
  float x2 = x * x;
  float x3 = x * x2;
  float x5 = x3 * x2;
  float x7 = x5 * x2;
  return x - (x3 / 6.0f) + (x5 / 120.0f) - (x7 / 5040.0f);
}

static float cosf_custom(float x) {
  return sinf_custom(x + 1.57079632679489661923f);
}

__attribute__((visibility("default")))
void fft_butterfly_baseline(float* real, float* imag, uint32_t len) {
  for (uint32_t step = 1; step < len; step <<= 1) {
    float angle = -3.14159265358979323846f / (float)step;
    float w_real = cosf_custom(angle);
    float w_imag = sinf_custom(angle);
    for (uint32_t i = 0; i < len; i += (step << 1)) {
      float cur_w_real = 1.0f;
      float cur_w_imag = 0.0f;
      for (uint32_t j = 0; j < step; j++) {
        uint32_t u = i + j;
        uint32_t v = i + j + step;
        float tr = real[v] * cur_w_real - imag[v] * cur_w_imag;
        float ti = real[v] * cur_w_imag + imag[v] * cur_w_real;
        real[v] = real[u] - tr;
        imag[v] = imag[u] - ti;
        real[u] += tr;
        imag[u] += ti;
        float nwR = cur_w_real * w_real - cur_w_imag * w_imag;
        float nwI = cur_w_real * w_imag + cur_w_imag * w_real;
        cur_w_real = nwR;
        cur_w_imag = nwI;
      }
    }
  }
}

__attribute__((visibility("default")))
void fft_butterfly_opt(float* real, float* imag, uint32_t len) {
  for (uint32_t step = 1; step < len; step <<= 1) {
    float angle = -3.14159265358979323846f / (float)step;
    float w_real = cosf_custom(angle);
    float w_imag = sinf_custom(angle);
    uint32_t block = step << 1;
    for (uint32_t i = 0; i < len; i += block) {
      float cur_w_real = 1.0f;
      float cur_w_imag = 0.0f;
      float* rv = real + i + step;
      float* iv = imag + i + step;
      for (uint32_t j = 0; j < step; j++) {
        float rvj = rv[j];
        float ivj = iv[j];
        float tr = rvj * cur_w_real - ivj * cur_w_imag;
        float ti = rvj * cur_w_imag + ivj * cur_w_real;
        uint32_t u = i + j;
        rv[j] = real[u] - tr;
        iv[j] = imag[u] - ti;
        real[u] += tr;
        imag[u] += ti;
        float nwR = cur_w_real * w_real - cur_w_imag * w_imag;
        float nwI = cur_w_real * w_imag + cur_w_imag * w_real;
        cur_w_real = nwR;
        cur_w_imag = nwI;
      }
    }
  }
}
