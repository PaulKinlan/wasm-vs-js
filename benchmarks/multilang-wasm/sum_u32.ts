export function sum_u32(ptr: usize, len: i32): i32 {
  let total: i32 = 0;
  for (let i: i32 = 0; i < len; i++) {
    total += load<u32>(ptr + (i << 2));
  }
  return total;
}
