#include <stdint.h>

// ml-gemm multilang kernel — mirrors benchmarks/v2/ml-gemm/workload.js semantics:
// C = C0 + A * B, strict f32 left-to-right accumulation in frozen ascending
// i/j/k order. C float arithmetic rounds to f32 after every op (hardware
// f32.add/f32.mul), which is bit-identical to the JS Math.fround formulation.
// NaN policy "reject" and signed-zero "normalize-positive" are handled by the
// generator/validation, not the kernel.

__attribute__((visibility("default")))
void gemm(
    const float* a, const float* b, const float* c0, float* out,
    uint32_t m, uint32_t n, uint32_t k) {
  for (uint32_t i = 0; i < m; i++) {
    for (uint32_t j = 0; j < n; j++) {
      float acc = c0[i * n + j];
      for (uint32_t t = 0; t < k; t++) {
        acc += a[i * k + t] * b[t * n + j];
      }
      // "acc + 0.0f" normalizes -0 to +0, matching the JS oracle's "acc + 0".
      out[i * n + j] = acc + 0.0f;
    }
  }
}
