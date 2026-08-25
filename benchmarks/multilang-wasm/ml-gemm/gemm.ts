// gemm.ts — AssemblyScript multilang kernel for ml.gemm.v1.
//
// Same ABI and same arithmetic as gemm.c / gemm.rs: C = C0 + A * B with strict
// f32 left-to-right accumulation in the frozen ascending i/j/k order. Pointers
// are raw linear-memory byte offsets; no allocation, no runtime imports, so the
// engine can be instantiated with no import object.
//
// AssemblyScript's f32 arithmetic lowers to wasm f32.mul / f32.add, which
// rounds to f32 after every operation — bit-identical to the C and Rust
// kernels and to the JS oracle's Math.fround formulation.

export function gemm(
  a: usize,
  b: usize,
  c0: usize,
  out: usize,
  m: u32,
  n: u32,
  k: u32,
): void {
  for (let i: u32 = 0; i < m; i++) {
    for (let j: u32 = 0; j < n; j++) {
      let acc: f32 = load<f32>(c0 + <usize>(i * n + j) * 4);
      for (let t: u32 = 0; t < k; t++) {
        acc += load<f32>(a + <usize>(i * k + t) * 4) * load<f32>(b + <usize>(t * n + j) * 4);
      }
      // "acc + 0" normalizes -0 to +0, matching the JS oracle's "acc + 0".
      store<f32>(out + <usize>(i * n + j) * 4, acc + 0.0);
    }
  }
}
