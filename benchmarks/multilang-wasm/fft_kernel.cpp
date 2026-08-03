typedef unsigned int uint32_t;

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

extern "C" {
__attribute__((visibility("default")))
void fft_butterfly(float* real, float* imag, uint32_t len) {
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

        float next_w_real = cur_w_real * w_real - cur_w_imag * w_imag;
        float next_w_imag = cur_w_real * w_imag + cur_w_imag * w_real;
        cur_w_real = next_w_real;
        cur_w_imag = next_w_imag;
      }
    }
  }
}
}
