// ml-gemm multilang kernel — mirrors benchmarks/v2/ml-gemm/workload.js:
// C = C0 + A * B, strict f32 left-to-right accumulation in frozen i/j/k order.
// Rust f32 arithmetic rounds to f32 after every op (wasm f32.add/f32.mul),
// bit-identical to the JS Math.fround formulation.

extern "C" {
__attribute__((visibility("default")))
void gemm(
    const float* a, const float* b, const float* c0, float* out,
    unsigned int m, unsigned int n, unsigned int k) {
  for (unsigned int i = 0; i < m; i++) {
    for (unsigned int j = 0; j < n; j++) {
      float acc = c0[i * n + j];
      for (unsigned int t = 0; t < k; t++) {
        acc += a[i * k + t] * b[t * n + j];
      }
      // "acc + 0.0f" normalizes -0 to +0, matching the JS oracle's "acc + 0".
      out[i * n + j] = acc + 0.0f;
    }
  }
}
}
