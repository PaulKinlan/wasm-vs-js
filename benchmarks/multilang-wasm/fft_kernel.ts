// fft_kernel.ts — AssemblyScript radix-2 FFT butterfly.
//
// Mirrors fft_kernel.c exactly, including its hand-written sine and cosine.
// The previous version called Mathf.sin/Mathf.cos, which is a different
// function from the C kernel's four-term Taylor series: the two disagreed by
// up to 2.25 absolute across a 1024-bin transform, so the published
// "AssemblyScript vs C" FFT comparison was not comparing the same algorithm.
// PLAN.md's fairness contract prohibits target-specific algorithm
// substitution; this restores it.

const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 2.0 * 3.14159265358979323846;
const HALF_PI: f32 = 1.57079632679489661923;

/** Four-term Taylor sine after range reduction — identical to sinf_custom. */
function sinCustom(x0: f32): f32 {
  let x: f32 = x0;
  while (x > PI) x -= TWO_PI;
  while (x < -PI) x += TWO_PI;
  const x2: f32 = x * x;
  const x3: f32 = x * x2;
  const x5: f32 = x3 * x2;
  const x7: f32 = x5 * x2;
  return x - (x3 / <f32> 6.0) + (x5 / <f32> 120.0) - (x7 / <f32> 5040.0);
}

function cosCustom(x: f32): f32 {
  return sinCustom(x + HALF_PI);
}

export function fft_butterfly(realPtr: usize, imagPtr: usize, len: i32): void {
  for (let step: i32 = 1; step < len; step <<= 1) {
    const angle: f32 = -PI / <f32> step;
    const wReal: f32 = cosCustom(angle);
    const wImag: f32 = sinCustom(angle);
    for (let i: i32 = 0; i < len; i += step << 1) {
      let curWReal: f32 = 1.0;
      let curWImag: f32 = 0.0;
      for (let j: i32 = 0; j < step; j++) {
        const u: usize = <usize> (i + j) << 2;
        const v: usize = <usize> (i + j + step) << 2;
        const rv: f32 = load<f32>(realPtr + v);
        const iv: f32 = load<f32>(imagPtr + v);
        const tr: f32 = rv * curWReal - iv * curWImag;
        const ti: f32 = rv * curWImag + iv * curWReal;
        const ru: f32 = load<f32>(realPtr + u);
        const iu: f32 = load<f32>(imagPtr + u);
        store<f32>(realPtr + v, ru - tr);
        store<f32>(imagPtr + v, iu - ti);
        store<f32>(realPtr + u, ru + tr);
        store<f32>(imagPtr + u, iu + ti);

        const nextWReal: f32 = curWReal * wReal - curWImag * wImag;
        const nextWImag: f32 = curWReal * wImag + curWImag * wReal;
        curWReal = nextWReal;
        curWImag = nextWImag;
      }
    }
  }
}
