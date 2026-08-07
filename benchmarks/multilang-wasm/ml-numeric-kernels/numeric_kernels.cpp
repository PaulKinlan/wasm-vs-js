#include <stdint.h>
// ml-numeric-kernels multilang C++ kernel — mirrors
// benchmarks/base/ml-numeric-kernels/workload.js + the controlled C target
// exactly: GEMM f32/i8, Conv f32/i8, Softmax f32/i8 on the frozen shapes
// (GEMM 8x7x9, CONV 8x8x3->4 k3/s1/p1, SOFTMAX 8x16). C++ float arithmetic
// rounds to f32 after every op (wasm f32.add/f32.mul), bit-identical to the
// JS Math.fround formulation. i8/i32/u8 ops are exact.

typedef unsigned char u8;
typedef signed char i8;
typedef unsigned int u32;
typedef int i32;

#define GEMM_M 8
#define GEMM_N 7
#define GEMM_K 9
#define CONV_H 8
#define CONV_W 8
#define CONV_IN 3
#define CONV_OUT 4
#define CONV_K 3
#define SM_ROWS 8
#define SM_COLS 16

static int finite_f32(float value) {
  union { float f; u32 u; } bits;
  bits.f = value;
  return (bits.u & 0x7f800000u) != 0x7f800000u;
}

extern "C" {
__attribute__((export_name("gemm_f32"))) i32 gemm_f32(const float *a, const float *b, float *out) {
  for (i32 x = 0; x < GEMM_M * GEMM_K; x++) if (!finite_f32(a[x])) return 1;
  for (i32 x = 0; x < GEMM_K * GEMM_N; x++) if (!finite_f32(b[x])) return 1;
  for (i32 i = 0; i < GEMM_M; i++) for (i32 j = 0; j < GEMM_N; j++) {
    float acc = 0.0f;
    for (i32 k = 0; k < GEMM_K; k++) acc = acc + a[i * GEMM_K + k] * b[k * GEMM_N + j];
    out[i * GEMM_N + j] = acc + 0.0f;
  }
  return 0;
}

__attribute__((export_name("gemm_i8"))) void gemm_i8(const i8 *a, const i8 *b, i32 *out) {
  for (i32 i = 0; i < GEMM_M; i++) for (i32 j = 0; j < GEMM_N; j++) {
    i32 acc = 0;
    for (i32 k = 0; k < GEMM_K; k++) acc += (i32)a[i * GEMM_K + k] * (i32)b[k * GEMM_N + j];
    out[i * GEMM_N + j] = acc;
  }
}

static i32 input_index(i32 y, i32 x, i32 c) { return (y * CONV_W + x) * CONV_IN + c; }
static i32 weight_index(i32 ky, i32 kx, i32 c, i32 o) { return ((ky * CONV_K + kx) * CONV_IN + c) * CONV_OUT + o; }

__attribute__((export_name("conv_f32"))) i32 conv_f32(const float *input, const float *weights, float *out) {
  for (i32 x = 0; x < CONV_H * CONV_W * CONV_IN; x++) if (!finite_f32(input[x])) return 1;
  for (i32 x = 0; x < CONV_K * CONV_K * CONV_IN * CONV_OUT; x++) if (!finite_f32(weights[x])) return 1;
  for (i32 y = 0; y < CONV_H; y++) for (i32 x = 0; x < CONV_W; x++) for (i32 o = 0; o < CONV_OUT; o++) {
    float acc = 0.0f;
    for (i32 ky = 0; ky < CONV_K; ky++) for (i32 kx = 0; kx < CONV_K; kx++) {
      i32 iy = y + ky - 1, ix = x + kx - 1;
      if (iy < 0 || ix < 0 || iy >= CONV_H || ix >= CONV_W) continue;
      for (i32 c = 0; c < CONV_IN; c++) {
        acc = acc + input[input_index(iy, ix, c)] * weights[weight_index(ky, kx, c, o)];
      }
    }
    out[(y * CONV_W + x) * CONV_OUT + o] = acc + 0.0f;
  }
  return 0;
}

__attribute__((export_name("conv_i8"))) void conv_i8(const i8 *input, const i8 *weights, i32 *out) {
  for (i32 y = 0; y < CONV_H; y++) for (i32 x = 0; x < CONV_W; x++) for (i32 o = 0; o < CONV_OUT; o++) {
    i32 acc = 0;
    for (i32 ky = 0; ky < CONV_K; ky++) for (i32 kx = 0; kx < CONV_K; kx++) {
      i32 iy = y + ky - 1, ix = x + kx - 1;
      if (iy < 0 || ix < 0 || iy >= CONV_H || ix >= CONV_W) continue;
      for (i32 c = 0; c < CONV_IN; c++) {
        acc += (i32)input[input_index(iy, ix, c)] * (i32)weights[weight_index(ky, kx, c, o)];
      }
    }
    out[(y * CONV_W + x) * CONV_OUT + o] = acc;
  }
}

static float exp_approx(float value) {
  float x = value < -8.0f ? -8.0f : (value > 0.0f ? 0.0f : value);
  float y = 1.0f + x / 256.0f;
  for (i32 i = 0; i < 8; i++) y = y * y;
  return y;
}

__attribute__((export_name("softmax_f32"))) i32 softmax_f32(const float *input, float *out) {
  for (i32 x = 0; x < SM_ROWS * SM_COLS; x++) if (!finite_f32(input[x])) return 1;
  for (i32 r = 0; r < SM_ROWS; r++) {
    i32 base = r * SM_COLS;
    float max = input[base];
    for (i32 c = 1; c < SM_COLS; c++) if (input[base + c] > max) max = input[base + c];
    float sum = 0.0f;
    for (i32 c = 0; c < SM_COLS; c++) {
      float e = exp_approx(input[base + c] - max);
      out[base + c] = e;
      sum = sum + e;
    }
    for (i32 c = 0; c < SM_COLS; c++) out[base + c] = out[base + c] / sum + 0.0f;
  }
  return 0;
}

static const i32 lut[9] = {256, 94, 35, 13, 5, 2, 1, 0, 0};
__attribute__((export_name("softmax_i8"))) void softmax_i8(const i8 *input, u8 *out) {
  for (i32 r = 0; r < SM_ROWS; r++) {
    i32 base = r * SM_COLS, max = input[base], max_index = 0;
    for (i32 c = 1; c < SM_COLS; c++) if ((i32)input[base + c] > max) { max = input[base + c]; max_index = c; }
    i32 sum = 0;
    for (i32 c = 0; c < SM_COLS; c++) { i32 d = max - input[base + c]; if (d > 8) d = 8; sum += lut[d]; }
    i32 quantized = 0;
    for (i32 c = 0; c < SM_COLS; c++) {
      i32 d = max - input[base + c]; if (d > 8) d = 8;
      i32 q = (lut[d] * 255 + sum / 2) / sum;
      out[base + c] = (u8)q; quantized += q;
    }
    out[base + max_index] = (u8)((i32)out[base + max_index] + 255 - quantized);
  }
}
}
