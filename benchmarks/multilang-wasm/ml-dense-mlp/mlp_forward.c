#include <stdint.h>

// Freestanding: wasm32 has no libc headers. floor/infinity/memcpy use
// compiler builtins that lower to f64.floor / IEEE infinity / plain moves.
#define INFINITY (__builtin_inf())

// ml-dense-mlp multilang kernel — mirrors benchmarks/v2/ml-dense-mlp/
// workload.js mlpControlled EXACTLY: strict f32 linear layers (hardware
// f32 mul/add == the JS Math.fround formulation), the frozen f64 GELU-tanh
// activation with the identical IEEE-754 double operation order
// (frozenExp/frozenTanh/geluFrozenF64 from frozen-transcendentals.js,
// including the exponent-bit pow2 scaling), ping-pong scratch, final
// projection without activation, -0 normalization via "+0".

static const double LN2 = 0.6931471805599453;
static const double EXP_COEFFS[13] = {
  1.0, 1.0, 0.5, 0.16666666666666666, 0.041666666666666664,
  0.008333333333333333, 0.001388888888888889, 0.0001984126984126984,
  0.0000248015873015873, 0.0000027557319223985893,
  0.0000002755731922398589, 0.000000025052108385441718,
  0.00000000208767569878681,
};

static double pow2_exact(int k) {
  // f64 bits = ((k + 1023) << 52): the JS table builds (k+1023)<<20 into the
  // high 32-bit word; k=1024 yields exponent field 2047 = +Infinity.
  uint64_t bits = ((uint64_t)(k + 1023)) << 52;
  double out;
  __builtin_memcpy(&out, &bits, 8);
  return out;
}

static double frozen_exp(double x) {
  if (x != x) return x; // NaN
  if (x > 709.7827) return INFINITY;
  if (x < -708.39) return 0.0;
  double k = __builtin_floor(x / LN2 + 0.5);
  double r = x - k * LN2;
  double p = EXP_COEFFS[12];
  for (int i = 11; i >= 0; i--) {
    p = p * r + EXP_COEFFS[i];
  }
  return p * pow2_exact((int)k);
}

static double frozen_tanh(double x) {
  if (x != x) return x; // NaN
  if (x >= 9.011) return 1.0;
  if (x <= -9.011) return -1.0;
  return 1.0 - 2.0 / (frozen_exp(2.0 * x) + 1.0);
}

static double gelu_frozen_f64(double p) {
  const double inner = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
  return 0.5 * p * (1.0 + frozen_tanh(inner));
}

static void linear_layer_f32(
    const float* x, const float* w, const float* bias, float* y,
    uint32_t batch, uint32_t width, uint32_t w_off, uint32_t bias_off) {
  for (uint32_t bi = 0; bi < batch; bi++) {
    for (uint32_t o = 0; o < width; o++) {
      float acc = bias[bias_off + o];
      for (uint32_t i = 0; i < width; i++) {
        acc += x[bi * width + i] * w[w_off + i * width + o];
      }
      y[bi * width + o] = acc + 0.0f; // normalize -0 to +0
    }
  }
}

static void gelu_in_place(float* buffer, uint32_t len) {
  for (uint32_t index = 0; index < len; index++) {
    buffer[index] = (float)gelu_frozen_f64((double)buffer[index]) + 0.0f;
  }
}

__attribute__((visibility("default")))
void mlp_forward(
    const float* x, const float* w, const float* bias,
    float* scratch_a, float* scratch_b, float* y,
    uint32_t batch, uint32_t width, uint32_t hidden_layers) {
  const uint32_t layers = hidden_layers + 1;
  const float* input = x;
  for (uint32_t layer = 0; layer < layers; layer++) {
    float* out = (layer == layers - 1) ? y : (layer % 2 == 0 ? scratch_a : scratch_b);
    linear_layer_f32(input, w, bias, out, batch, width,
                     layer * width * width, layer * width);
    if (layer < layers - 1) {
      gelu_in_place(out, batch * width);
    }
    input = out;
  }
}
