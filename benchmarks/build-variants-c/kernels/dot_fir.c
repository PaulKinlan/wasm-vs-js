// C source: dot product kernel for SIMD variant benchmarking.
// Export: dot_f32(a: *f32, b: *f32, len: i32) -> f32
// At -O3 -msimd128, clang auto-vectorizes the inner loop.

float dot_f32(float *a, float *b, int len) {
  float sum = 0.0f;
  for (int i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// FIR convolution: out[i] = sum(a[i-j] * taps[j]) for j in 0..tapCount
void fir_convolve(float *out, float *input, int inputLen, float *taps, int tapCount) {
  for (int i = 0; i < inputLen; i++) {
    float acc = 0.0f;
    for (int j = 0; j < tapCount && (i - j) >= 0; j++) {
      acc += input[i - j] * taps[j];
    }
    out[i] = acc;
  }
}
