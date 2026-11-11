// Track B JavaScript optimization for audio.fir.v1:
// Reverses the tap vector once into a pre-allocated Float32Array workspace and
// register-blocks 8 adjacent output samples (acc0..acc7) with a sliding 8-sample
// window over the input signal. Iterating k = 0..nTaps-1 visits i = (n - nTaps + 1) + k
// in strict ascending input-sample order, matching firDirectConvolution's exact
// sequence of Math.fround multiplies and adds while eliminating inner-loop
// Float32Array loads and stores on the output buffer.
// Equivalence class: bit-identical (0 ULP deviation, Object.is agreement).

export function createFirOptWorkspace(samples, taps) {
  return {
    out: new Float32Array(Math.max(0, samples + taps - 1)),
    tpRev: new Float32Array(taps),
  };
}

export function firOptF32(sig, tp, out, tpRev) {
  const nSig = sig.length;
  const nTaps = tp.length;
  const outLen = nSig + nTaps - 1;
  if (nSig === 0 || nTaps === 0) {
    out.fill(0);
    return out;
  }
  for (let k = 0; k < nTaps; k++) {
    tpRev[k] = tp[nTaps - 1 - k];
  }

  // Head ramp: n = 0 .. min(nTaps - 1, outLen) - 1
  const headEnd = Math.min(nTaps - 1, outLen);
  for (let n = 0; n < headEnd; n++) {
    const iMax = Math.min(n, nSig - 1);
    let acc = 0;
    for (let i = 0; i <= iMax; i++) {
      acc = Math.fround(acc + Math.fround(sig[i] * tp[n - i]));
    }
    out[n] = acc;
  }

  // Steady interior: nTaps - 1 <= n < nSig, 8 outputs accumulated in registers
  const steadyEnd = nSig;
  let n = headEnd;
  for (; n + 7 < steadyEnd; n += 8) {
    const base = n - nTaps + 1;
    let acc0 = 0, acc1 = 0, acc2 = 0, acc3 = 0;
    let acc4 = 0, acc5 = 0, acc6 = 0, acc7 = 0;
    let s0 = sig[base],
      s1 = sig[base + 1],
      s2 = sig[base + 2],
      s3 = sig[base + 3],
      s4 = sig[base + 4],
      s5 = sig[base + 5],
      s6 = sig[base + 6];
    for (let k = 0; k < nTaps; k++) {
      const h = tpRev[k];
      const s7 = sig[base + k + 7];
      acc0 = Math.fround(acc0 + Math.fround(s0 * h));
      acc1 = Math.fround(acc1 + Math.fround(s1 * h));
      acc2 = Math.fround(acc2 + Math.fround(s2 * h));
      acc3 = Math.fround(acc3 + Math.fround(s3 * h));
      acc4 = Math.fround(acc4 + Math.fround(s4 * h));
      acc5 = Math.fround(acc5 + Math.fround(s5 * h));
      acc6 = Math.fround(acc6 + Math.fround(s6 * h));
      acc7 = Math.fround(acc7 + Math.fround(s7 * h));
      s0 = s1;
      s1 = s2;
      s2 = s3;
      s3 = s4;
      s4 = s5;
      s5 = s6;
      s6 = s7;
    }
    out[n] = acc0;
    out[n + 1] = acc1;
    out[n + 2] = acc2;
    out[n + 3] = acc3;
    out[n + 4] = acc4;
    out[n + 5] = acc5;
    out[n + 6] = acc6;
    out[n + 7] = acc7;
  }
  for (; n < steadyEnd; n++) {
    const base = n - nTaps + 1;
    let acc = 0;
    for (let k = 0; k < nTaps; k++) {
      acc = Math.fround(acc + Math.fround(sig[base + k] * tpRev[k]));
    }
    out[n] = acc;
  }

  // Tail ramp: n = steadyEnd .. outLen - 1
  for (; n < outLen; n++) {
    const iMin = Math.max(0, n - nTaps + 1);
    const iMax = nSig - 1;
    let acc = 0;
    for (let i = iMin; i <= iMax; i++) {
      acc = Math.fround(acc + Math.fround(sig[i] * tp[n - i]));
    }
    out[n] = acc;
  }
  return out;
}
