// fir.ts — AssemblyScript multilang kernel for audio.fir.v1.
//
// Same ABI and same arithmetic as fir.c / fir.rs: direct convolution,
// output[i + j] += input[i] * taps[j], accumulated in f32 in the frozen i/j
// order. Pointers are raw linear-memory byte offsets; no allocation, no
// runtime imports.
//
// AssemblyScript's f32 arithmetic lowers to wasm f32.mul / f32.add, rounding
// to f32 after every operation — bit-identical to the C and Rust kernels and
// to the JS oracle's Math.fround formulation.

export function fir(
  input: usize,
  taps: usize,
  output: usize,
  inputLen: u32,
  tapsLen: u32,
): void {
  const outLen: u32 = inputLen + tapsLen - 1;
  for (let k: u32 = 0; k < outLen; k++) {
    store<f32>(output + <usize> k * 4, 0.0);
  }
  for (let i: u32 = 0; i < inputLen; i++) {
    const sample: f32 = load<f32>(input + <usize> i * 4);
    for (let j: u32 = 0; j < tapsLen; j++) {
      const at: usize = output + <usize> (i + j) * 4;
      store<f32>(at, load<f32>(at) + sample * load<f32>(taps + <usize> j * 4));
    }
  }
}
