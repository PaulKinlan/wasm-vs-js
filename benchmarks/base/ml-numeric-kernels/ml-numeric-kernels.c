// Scalar controlled linear-Wasm target for ml.numeric-kernels.v1.
// Build flags prohibit SIMD, vectorization, builtin/libc substitution and FP
// contraction. No host imports; every GEMM, convolution and softmax output is
// computed in this module.
typedef unsigned char u8;
typedef signed char i8;
typedef unsigned int u32;
typedef int i32;

#define EXPORT(name) __attribute__((export_name(name)))
static int finite_f32(float value) {
  union { float f; u32 u; } bits;
  bits.f = value;
  return (bits.u & 0x7f800000u) != 0x7f800000u;
}

EXPORT("gemm_f32") i32 gemm_f32(const float *a, const float *b, float *out) {
  for (i32 x = 0; x < 72; x++) if (!finite_f32(a[x])) return 1;
  for (i32 x = 0; x < 63; x++) if (!finite_f32(b[x])) return 1;
  for (i32 i = 0; i < 8; i++) for (i32 j = 0; j < 7; j++) {
    float acc = 0.0f;
    for (i32 k = 0; k < 9; k++) acc = acc + a[i * 9 + k] * b[k * 7 + j];
    out[i * 7 + j] = acc + 0.0f;
  }
  return 0;
}

EXPORT("gemm_i8") void gemm_i8(const i8 *a, const i8 *b, i32 *out) {
  for (i32 i = 0; i < 8; i++) for (i32 j = 0; j < 7; j++) {
    i32 acc = 0;
    for (i32 k = 0; k < 9; k++) acc += (i32)a[i * 9 + k] * (i32)b[k * 7 + j];
    out[i * 7 + j] = acc;
  }
}

static i32 input_index(i32 y, i32 x, i32 c) { return (y * 8 + x) * 3 + c; }
static i32 weight_index(i32 ky, i32 kx, i32 c, i32 o) { return ((ky * 3 + kx) * 3 + c) * 4 + o; }

EXPORT("conv_f32") i32 conv_f32(const float *input, const float *weights, float *out) {
  for (i32 x = 0; x < 192; x++) if (!finite_f32(input[x])) return 1;
  for (i32 x = 0; x < 108; x++) if (!finite_f32(weights[x])) return 1;
  for (i32 y = 0; y < 8; y++) for (i32 x = 0; x < 8; x++) for (i32 o = 0; o < 4; o++) {
    float acc = 0.0f;
    for (i32 ky = 0; ky < 3; ky++) for (i32 kx = 0; kx < 3; kx++) {
      i32 iy = y + ky - 1, ix = x + kx - 1;
      if (iy < 0 || ix < 0 || iy >= 8 || ix >= 8) continue;
      for (i32 c = 0; c < 3; c++) acc = acc + input[input_index(iy, ix, c)] * weights[weight_index(ky, kx, c, o)];
    }
    out[(y * 8 + x) * 4 + o] = acc + 0.0f;
  }
  return 0;
}

EXPORT("conv_i8") void conv_i8(const i8 *input, const i8 *weights, i32 *out) {
  for (i32 y = 0; y < 8; y++) for (i32 x = 0; x < 8; x++) for (i32 o = 0; o < 4; o++) {
    i32 acc = 0;
    for (i32 ky = 0; ky < 3; ky++) for (i32 kx = 0; kx < 3; kx++) {
      i32 iy = y + ky - 1, ix = x + kx - 1;
      if (iy < 0 || ix < 0 || iy >= 8 || ix >= 8) continue;
      for (i32 c = 0; c < 3; c++) acc += (i32)input[input_index(iy, ix, c)] * (i32)weights[weight_index(ky, kx, c, o)];
    }
    out[(y * 8 + x) * 4 + o] = acc;
  }
}

static float exp_approx(float value) {
  float x = value < -8.0f ? -8.0f : (value > 0.0f ? 0.0f : value);
  float y = 1.0f + x / 256.0f;
  for (i32 i = 0; i < 8; i++) y = y * y;
  return y;
}

EXPORT("softmax_f32") i32 softmax_f32(const float *input, float *out) {
  for (i32 x = 0; x < 128; x++) if (!finite_f32(input[x])) return 1;
  for (i32 r = 0; r < 8; r++) {
    i32 base = r * 16;
    float max = input[base];
    for (i32 c = 1; c < 16; c++) if (input[base + c] > max) max = input[base + c];
    float sum = 0.0f;
    for (i32 c = 0; c < 16; c++) { float e = exp_approx(input[base + c] - max); out[base + c] = e; sum = sum + e; }
    for (i32 c = 0; c < 16; c++) out[base + c] = out[base + c] / sum + 0.0f;
  }
  return 0;
}

static const i32 lut[9] = {256, 94, 35, 13, 5, 2, 1, 0, 0};
EXPORT("softmax_i8") void softmax_i8(const i8 *input, u8 *out) {
  for (i32 r = 0; r < 8; r++) {
    i32 base = r * 16, max = input[base], max_index = 0;
    for (i32 c = 1; c < 16; c++) if ((i32)input[base + c] > max) { max = input[base + c]; max_index = c; }
    i32 sum = 0;
    for (i32 c = 0; c < 16; c++) { i32 d = max - input[base + c]; if (d > 8) d = 8; sum += lut[d]; }
    i32 quantized = 0;
    for (i32 c = 0; c < 16; c++) { i32 d = max - input[base + c]; if (d > 8) d = 8; i32 q = (lut[d] * 255 + sum / 2) / sum; out[base + c] = (u8)q; quantized += q; }
    out[base + max_index] = (u8)((i32)out[base + max_index] + 255 - quantized);
  }
}
