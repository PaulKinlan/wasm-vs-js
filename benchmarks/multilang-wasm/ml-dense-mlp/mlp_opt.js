// Track B JavaScript optimization for ml.dense-mlp.v1:
// Interchanges linear layers from column-strided (bi, o, i) to row-streaming
// (bi, i, o) with hoisted row offsets and 4-way column unrolling, reuses
// pre-allocated ping-pong Float32Array layer workspaces, and replaces per-element
// DataView pow2 scaling with a precomputed IEEE-754 exponent-bit table and
// unrolled Horner polynomial for frozen GELU. Preserves strict ascending
// i = 0..width-1 f32 accumulation and +0 signed-zero normalization.
// Equivalence class: bit-identical (0 ULP deviation, Object.is agreement).

const LN2 = 0.6931471805599453;
const EXP_C0 = 1.0;
const EXP_C1 = 1.0;
const EXP_C2 = 0.5;
const EXP_C3 = 0.16666666666666666;
const EXP_C4 = 0.041666666666666664;
const EXP_C5 = 0.008333333333333333;
const EXP_C6 = 0.001388888888888889;
const EXP_C7 = 0.0001984126984126984;
const EXP_C8 = 0.0000248015873015873;
const EXP_C9 = 0.0000027557319223985893;
const EXP_C10 = 0.0000002755731922398589;
const EXP_C11 = 0.000000025052108385441718;
const EXP_C12 = 0.00000000208767569878681;

const POW2_TABLE = (() => {
  const table = new Float64Array(2047);
  const view = new DataView(new ArrayBuffer(8));
  for (let k = -1022; k <= 1024; k++) {
    view.setUint32(0, 0, true);
    view.setUint32(4, (k + 1023) << 20, true);
    table[k + 1022] = view.getFloat64(0, true);
  }
  return table;
})();

export function geluFrozenOptF64(p) {
  const inner = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
  let t;
  if (Number.isNaN(inner)) {
    t = inner;
  } else if (inner >= 9.011) {
    t = 1;
  } else if (inner <= -9.011) {
    t = -1;
  } else {
    const twoX = 2 * inner;
    let ex;
    if (twoX > 709.7827) {
      ex = Infinity;
    } else if (twoX < -708.39) {
      ex = 0;
    } else {
      const k = Math.floor(twoX / LN2 + 0.5);
      const r = twoX - k * LN2;
      const poly =
        (((((((((((EXP_C12 * r + EXP_C11) * r + EXP_C10) * r + EXP_C9) * r + EXP_C8) * r +
                                    EXP_C7) * r + EXP_C6) * r + EXP_C5) * r + EXP_C4) * r +
                    EXP_C3) * r + EXP_C2) * r +
            EXP_C1) * r + EXP_C0;
      ex = poly * POW2_TABLE[k + 1022];
    }
    t = 1 - 2 / (ex + 1);
  }
  return 0.5 * p * (1 + t);
}

export function createMlpOptWorkspace(batch, width) {
  const n = batch * width;
  return {
    scratchA: new Float32Array(n),
    scratchB: new Float32Array(n),
    y: new Float32Array(n),
  };
}

export function mlpForwardOptF32(x, w, bias, scratchA, scratchB, y, batch, width, hiddenLayers) {
  const layers = hiddenLayers + 1;
  const total = batch * width;
  const width4 = width & ~3;
  let input = x;
  for (let layer = 0; layer < layers; layer++) {
    const out = layer === layers - 1 ? y : layer % 2 === 0 ? scratchA : scratchB;
    const layerWOff = layer * width * width;
    const biasOff = layer * width;
    for (let bi = 0; bi < batch; bi++) {
      const rowOff = bi * width;
      for (let o = 0; o < width; o++) {
        out[rowOff + o] = bias[biasOff + o];
      }
      for (let i = 0; i < width; i++) {
        const xVal = input[rowOff + i];
        const wRow = layerWOff + i * width;
        let o = 0;
        for (; o < width4; o += 4) {
          out[rowOff + o] = Math.fround(out[rowOff + o] + Math.fround(xVal * w[wRow + o]));
          out[rowOff + o + 1] = Math.fround(
            out[rowOff + o + 1] + Math.fround(xVal * w[wRow + o + 1]),
          );
          out[rowOff + o + 2] = Math.fround(
            out[rowOff + o + 2] + Math.fround(xVal * w[wRow + o + 2]),
          );
          out[rowOff + o + 3] = Math.fround(
            out[rowOff + o + 3] + Math.fround(xVal * w[wRow + o + 3]),
          );
        }
        for (; o < width; o++) {
          out[rowOff + o] = Math.fround(out[rowOff + o] + Math.fround(xVal * w[wRow + o]));
        }
      }
    }
    if (layer < layers - 1) {
      for (let idx = 0; idx < total; idx++) {
        out[idx] = Math.fround(geluFrozenOptF64(out[idx] + 0)) + 0;
      }
    } else {
      for (let idx = 0; idx < total; idx++) {
        out[idx] = out[idx] + 0;
      }
    }
    input = out;
  }
  return y;
}
