// Track B — FFT optimized JavaScript variant (INDEPENDENTLY OPTIMIZED).
// Track A baseline = the jsFft in public/multilang-runner.js (KEPT UNTOUCHED);
// mirrored verbatim below.
//
// OPTIMIZATION LOG:
// 1. TWIDDLE SEQUENCE CACHE: the baseline advances cur_w_real/cur_w_imag via a
//    complex multiply for EVERY (i, j) — the sequence is identical for every i
//    at a given step. The optimized variant computes the exact same multiply
//    sequence ONCE per step into a Float64Array and reuses it for all i blocks.
//    Same float ops in the same order → BIT-IDENTICAL output.
// 2. Locals for u/v row reads (real[v]/imag[v] read once per j).

export function fftBaseline(real, imag, LEN) {
  for (let step = 1; step < LEN; step <<= 1) {
    const angle = -Math.PI / step, wReal = Math.cos(angle), wImag = Math.sin(angle);
    for (let i = 0; i < LEN; i += step << 1) {
      let cwR = 1.0, cwI = 0.0;
      for (let j = 0; j < step; j++) {
        const u = i + j, v = i + j + step;
        const tr = real[v] * cwR - imag[v] * cwI;
        const ti = real[v] * cwI + imag[v] * cwR;
        real[v] = real[u] - tr;
        imag[v] = imag[u] - ti;
        real[u] += tr;
        imag[u] += ti;
        const nwR = cwR * wReal - cwI * wImag, nwI = cwR * wImag + cwI * wReal;
        cwR = nwR;
        cwI = nwI;
      }
    }
  }
}

export function fftOpt(real, imag, LEN) {
  for (let step = 1; step < LEN; step <<= 1) {
    const angle = -Math.PI / step, wReal = Math.cos(angle), wImag = Math.sin(angle);
    // Precompute the exact per-step twiddle sequence (same multiply order).
    const tw = new Float64Array(step * 2);
    let cwR = 1.0, cwI = 0.0;
    for (let j = 0; j < step; j++) {
      tw[j * 2] = cwR;
      tw[j * 2 + 1] = cwI;
      const nwR = cwR * wReal - cwI * wImag, nwI = cwR * wImag + cwI * wReal;
      cwR = nwR;
      cwI = nwI;
    }
    for (let i = 0; i < LEN; i += step << 1) {
      for (let j = 0; j < step; j++) {
        const u = i + j, v = i + j + step;
        const cwr = tw[j * 2], cwi = tw[j * 2 + 1];
        const tr = real[v] * cwr - imag[v] * cwi;
        const ti = real[v] * cwi + imag[v] * cwr;
        real[v] = real[u] - tr;
        imag[v] = imag[u] - ti;
        real[u] += tr;
        imag[u] += ti;
      }
    }
  }
}
