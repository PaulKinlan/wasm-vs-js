// stft.ts — AssemblyScript multilang kernel for audio.stft.v1.
//
// Mirrors stft.c, which mirrors benchmarks/audio-stft/workload.ts stftInto:
// windowing plus a radix-2 FFT over overlapping frames into a spectrogram
// buffer. Same bit-reversal permutation, same twiddle consumption order, same
// butterfly term ordering, all in f32 — so every rounding step matches.
//
// The twiddle table is supplied by the caller, so unlike the audio-fft kernel
// there is no trigonometry here to diverge on.
//
// Pointers are raw linear-memory byte offsets; no allocation, no runtime
// imports.

function fftRadix2(data: usize, n: u32, twiddle: usize): void {
  for (let i: u32 = 1, j: u32 = 0; i < n; i++) {
    let bit: u32 = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const ri: usize = data + (<usize> (i * 2)) * 4;
      const rj: usize = data + (<usize> (j * 2)) * 4;
      const t0: f32 = load<f32>(ri);
      store<f32>(ri, load<f32>(rj));
      store<f32>(rj, t0);
      const t1: f32 = load<f32>(ri + 4);
      store<f32>(ri + 4, load<f32>(rj + 4));
      store<f32>(rj + 4, t1);
    }
  }
  let twIdx: u32 = 0;
  for (let len: u32 = 2; len <= n; len <<= 1) {
    const halfLen: u32 = len >> 1;
    for (let i: u32 = 0; i < n; i += len) {
      let tw: u32 = twIdx;
      for (let j: u32 = 0; j < halfLen; j++) {
        const wCos: f32 = load<f32>(twiddle + (<usize> tw) * 4);
        const wSin: f32 = load<f32>(twiddle + (<usize> (tw + 1)) * 4);
        tw += 2;
        const evenIdx: usize = data + (<usize> ((i + j) * 2)) * 4;
        const oddIdx: usize = data + (<usize> ((i + j + halfLen) * 2)) * 4;
        const evenRe: f32 = load<f32>(evenIdx);
        const evenIm: f32 = load<f32>(evenIdx + 4);
        const oddRe: f32 = load<f32>(oddIdx);
        const oddIm: f32 = load<f32>(oddIdx + 4);
        const tRe: f32 = wCos * oddRe - wSin * oddIm;
        const tIm: f32 = wCos * oddIm + wSin * oddRe;
        store<f32>(evenIdx, evenRe + tRe);
        store<f32>(evenIdx + 4, evenIm + tIm);
        store<f32>(oddIdx, evenRe - tRe);
        store<f32>(oddIdx + 4, evenIm - tIm);
      }
    }
    twIdx += halfLen * 2;
  }
}

export function stft(
  input: usize,
  inputLen: u32,
  frameSize: u32,
  hopSize: u32,
  window: usize,
  twiddle: usize,
  scratch: usize,
  spectrogram: usize,
): void {
  const numFrames: u32 = 1 + (inputLen - frameSize) / hopSize;
  for (let frame: u32 = 0; frame < numFrames; frame++) {
    const offset: u32 = frame * hopSize;
    for (let i: u32 = 0; i < frameSize; i++) {
      const at: usize = scratch + (<usize> (i * 2)) * 4;
      store<f32>(
        at,
        load<f32>(input + (<usize> (offset + i)) * 4) * load<f32>(window + (<usize> i) * 4),
      );
      store<f32>(at + 4, 0.0);
    }
    fftRadix2(scratch, frameSize, twiddle);
    const specOffset: u32 = frame * frameSize * 2;
    for (let i: u32 = 0; i < frameSize * 2; i++) {
      store<f32>(
        spectrogram + (<usize> (specOffset + i)) * 4,
        load<f32>(scratch + (<usize> i) * 4),
      );
    }
  }
}
