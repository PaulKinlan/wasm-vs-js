// C source: sum_u32 kernel for build variant benchmarking.
// Compiled at different optimization levels to measure binary size and execution differences.
// Export: sum_u32(ptr: *i32, len: i32) -> i32

int sum_u32(int *ptr, int len) {
  int sum = 0;
  for (int i = 0; i < len; i++) {
    sum += ptr[i];
  }
  return sum;
}
