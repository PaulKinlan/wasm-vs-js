#include <stdint.h>

// Track B — sum-u32 optimized C variant (INDEPENDENTLY OPTIMIZED, non-default).
// Track A baseline (benchmarks/multilang-wasm/sum_u32.c) is KEPT UNTOUCHED and
// mirrored verbatim below as `sum_u32_baseline` for the side-by-side diff.
//
// OPTIMIZATION LOG (what / why / measured):
// 1. 4-way loop unroll with four independent accumulators. u32 addition is
//    associative modulo 2^32, so the result is BIT-IDENTICAL to the baseline —
//    no rounding, no semantics change. Reduces loop-carried dependency latency
//    (4 independent add chains) and loop overhead (one iteration per 4 adds).
// 2. Hoisted the pointer walk (ptr + 4*i) instead of recomputing index loads.
// Measured delta in docs/track-b-optimizations.md.

__attribute__((visibility("default")))
uint32_t sum_u32_baseline(const uint32_t* ptr, uint32_t len) {
  uint32_t total = 0;
  for (uint32_t i = 0; i < len; i++) {
    total += ptr[i];
  }
  return total;
}

__attribute__((visibility("default")))
uint32_t sum_u32_opt(const uint32_t* ptr, uint32_t len) {
  uint32_t a0 = 0, a1 = 0, a2 = 0, a3 = 0;
  uint32_t i = 0;
  for (; i + 4 <= len; i += 4) {
    a0 += ptr[i];
    a1 += ptr[i + 1];
    a2 += ptr[i + 2];
    a3 += ptr[i + 3];
  }
  for (; i < len; i++) {
    a0 += ptr[i];
  }
  return a0 + a1 + a2 + a3;
}
