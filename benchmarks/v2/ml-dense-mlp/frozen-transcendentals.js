// Frozen f64 transcendental implementations shared by BOTH controlled
// targets of the ml-dense-mlp workload. The JavaScript controlled target
// uses these functions and the Wasm linear target implements the identical
// frozen algorithm with the identical IEEE 754 double operation order, so
// both targets produce bit-identical results for every finite input and
// propagate NaN identically. Math.tanh / Math.exp are deliberately NOT used
// in the workload path; the pinned f64 oracle reference uses platform
// Math.tanh, which keeps the oracle independent of the controlled targets.
//
// The accurate domain of frozenExp is |x| <= ~708.4. Outside it the frozen
// guards return +Infinity (x > 709.7827) or 0 (x < -708.39); neither guard
// is reachable through frozenTanh, which saturates at |x| >= 9.011 and only
// ever calls frozenExp with arguments in (-18.022, 18.022).

const LN2 = 0.6931471805599453;
const EXP_COEFFS = [
  1.0,
  1.0,
  0.5,
  0.16666666666666666,
  0.041666666666666664,
  0.008333333333333333,
  0.001388888888888889,
  0.0001984126984126984,
  0.0000248015873015873,
  0.0000027557319223985893,
  0.0000002755731922398589,
  0.000000025052108385441718,
  0.00000000208767569878681,
];

// Precomputed exact powers of two for the range-reduction scaling, built
// ONCE at module load (outside the measured compute path) so activation
// evaluation performs zero allocations per call. Entries are constructed
// via 32-bit exponent-bit halves — Math.pow is implementation-approximated
// and BigInt would allocate per call, so the bit pattern is built directly
// to stay bit-identical to the Wasm exponent-bit scaling.
// The reachable k range after the exp guards is [-1022, 1024]; k = 1024
// yields exponent field 2047, i.e. +Infinity, exactly like the Wasm
// exponent-bit scaling at the overflow edge.
const POW2_TABLE = (() => {
  const table = new Float64Array(2047);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  for (let k = -1022; k <= 1024; k += 1) {
    view.setUint32(0, 0, true);
    view.setUint32(4, (k + 1023) << 20, true);
    table[k + 1022] = view.getFloat64(0, true);
  }
  return table;
})();
function pow2Exact(k) {
  return POW2_TABLE[k + 1022];
}

export function frozenExp(x) {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.7827) return Infinity;
  if (x < -708.39) return 0;
  const k = Math.floor(x / LN2 + 0.5);
  const r = x - k * LN2;
  let p = EXP_COEFFS[12];
  for (let i = 11; i >= 0; i -= 1) {
    p = p * r + EXP_COEFFS[i];
  }
  return p * pow2Exact(k);
}

export function frozenTanh(x) {
  if (Number.isNaN(x)) return NaN;
  if (x >= 9.011) return 1;
  if (x <= -9.011) return -1;
  return 1 - 2 / (frozenExp(2 * x) + 1);
}

// Frozen GELU (tanh form) on a float64 argument, with the exact operation
// order shared with the Wasm kernel: 0.5*p*(1 + tanh(0.7978845608*(p +
// 0.044715*((p*p)*p)))).
export function geluFrozenF64(p) {
  const inner = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
  return 0.5 * p * (1 + frozenTanh(inner));
}
