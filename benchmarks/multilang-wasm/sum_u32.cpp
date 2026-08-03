typedef unsigned int uint32_t;

extern "C" {
__attribute__((visibility("default")))
uint32_t sum_u32(const uint32_t* ptr, uint32_t len) {
  uint32_t total = 0;
  for (uint32_t i = 0; i < len; i++) {
    total += ptr[i];
  }
  return total;
}
}
