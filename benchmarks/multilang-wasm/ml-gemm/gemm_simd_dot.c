#include <stdint.h>
#include <wasm_simd128.h>

// gemm_simd_dot.c — Track B `reassociated` variant of gemm.c.
//
// Keeps the i/j outer loop order and keeps B transposed into a scratch row or
// loads 4-wide along the k reduction using explicit wasm_v128 (`f32x4`) lanes,
// accumulating 4 partial sums in a vector register and reducing horizontally
// at the end:
//
//   acc_vec = [sum_{t%4==0}, sum_{t%4==1}, sum_{t%4==2}, sum_{t%4==3}]
//   out[i, j] = c0[i, j] + ((acc0 + acc1) + (acc2 + acc3))
//
// Because each output element sums 4 partial chains instead of a single strict
// left-to-right chain, floating-point rounding differs from the pinned i/j/k
// oracle by a few ULPs (`equivalence: "reassociated"` in docs/track-b-optimizations.md).

__attribute__((visibility("default")))
void gemm(
    const float* __restrict a,
    const float* __restrict b,
    const float* __restrict c0,
    float* __restrict out,
    uint32_t m,
    uint32_t n,
    uint32_t k) {
  for (uint32_t i = 0; i < m; i++) {
    const float* row_a = a + i * k;
    for (uint32_t j = 0; j < n; j++) {
      v128_t vsum = wasm_f32x4_splat(0.0f);
      uint32_t t = 0;
      for (; t + 4 <= k; t += 4) {
        v128_t va = wasm_v128_load(row_a + t);
        v128_t vb = wasm_f32x4_make(
            b[(t + 0) * n + j],
            b[(t + 1) * n + j],
            b[(t + 2) * n + j],
            b[(t + 3) * n + j]);
        vsum = wasm_f32x4_add(vsum, wasm_f32x4_mul(va, vb));
      }
      float s0 = wasm_f32x4_extract_lane(vsum, 0) + wasm_f32x4_extract_lane(vsum, 1);
      float s1 = wasm_f32x4_extract_lane(vsum, 2) + wasm_f32x4_extract_lane(vsum, 3);
      float acc = c0[i * n + j] + (s0 + s1);
      for (; t < k; t++) {
        acc += row_a[t] * b[t * n + j];
      }
      out[i * n + j] = acc + 0.0f;
    }
  }
}
