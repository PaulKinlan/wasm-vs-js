import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// V8's js-string builtins option is not in the TS WebAssembly types.
// Reduced fixed shape for the comparison (full contract shape is 32x512x8).
const B = 16, W = 128, HIDDEN = 4;
const LAYERS = HIDDEN + 1;

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
function pow2Exact(k: number): number {
  const b = new DataView(new ArrayBuffer(8));
  b.setUint32(0, 0, true);
  b.setUint32(4, (k + 1023) << 20, true);
  return b.getFloat64(0, true);
}
function frozenExp(x: number): number {
  if (Number.isNaN(x)) return x;
  if (x > 709.7827) return Infinity;
  if (x < -708.39) return 0;
  const k = Math.floor(x / LN2 + 0.5);
  const r = x - k * LN2;
  let p = EXP_COEFFS[12];
  for (let i = 11; i >= 0; i--) p = p * r + EXP_COEFFS[i];
  return p * pow2Exact(k);
}
function frozenTanh(x: number): number {
  if (Number.isNaN(x)) return x;
  if (x >= 9.011) return 1;
  if (x <= -9.011) return -1;
  return 1 - 2 / (frozenExp(2 * x) + 1);
}
function geluFrozen(p: number): number {
  const inner = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
  return 0.5 * p * (1 + frozenTanh(inner));
}

// Exact mirror of workload.js mlpControlled on the reduced shape.
function oracleMLP(x: Float32Array, w: Float32Array, bias: Float32Array): Float32Array {
  const sA = new Float32Array(B * W), sB = new Float32Array(B * W), y = new Float32Array(B * W);
  let input = x;
  for (let layer = 0; layer < LAYERS; layer++) {
    const out = layer === LAYERS - 1 ? y : layer % 2 === 0 ? sA : sB;
    for (let bi = 0; bi < B; bi++) {
      for (let o = 0; o < W; o++) {
        let acc = bias[layer * W + o];
        for (let i = 0; i < W; i++) {
          acc = Math.fround(acc + Math.fround(input[bi * W + i] * w[layer * W * W + i * W + o]));
        }
        out[bi * W + o] = acc + 0;
      }
    }
    if (layer < LAYERS - 1) {
      for (let idx = 0; idx < out.length; idx++) out[idx] = Math.fround(geluFrozen(out[idx])) + 0;
    }
    input = out;
  }
  return y;
}

function makeInputs(): { x: Float32Array; w: Float32Array; bias: Float32Array } {
  const x = new Float32Array(B * W),
    w = new Float32Array(LAYERS * W * W),
    bias = new Float32Array(LAYERS * W);
  let s = 0x5a17c0de;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return Math.fround((s / 4294967296) * 2 - 1);
  };
  for (let i = 0; i < x.length; i++) x[i] = next();
  for (let i = 0; i < w.length; i++) w[i] = Math.fround(next() * 0.0625);
  for (let i = 0; i < bias.length; i++) bias[i] = Math.fround(next() * 0.25);
  return { x, w, bias };
}

function assertBitIdentical(label: string, got: Float32Array, ref: Float32Array): void {
  for (let i = 0; i < ref.length; i++) {
    assert(
      Object.is(got[i], ref[i]),
      `${label} output mismatch at ${i}: got=${got[i]} ref=${ref[i]}`,
    );
  }
}

Deno.test(
  "multilang-mlp: C, C++, Rust, and Dart/WasmGC mlp_forward kernels are bit-identical to the frozen-GELU oracle",
  async () => {
    const { x, w, bias } = makeInputs();
    const ref = oracleMLP(x, w, bias);

    const linear = [
      ["mlp_forward_c.wasm", "C"],
      ["mlp_forward_cpp.wasm", "C++"],
      ["mlp_forward_rs.wasm", "Rust"],
    ] as const;
    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const xOff = 0, wOff = xOff + B * W * 4, biasOff = wOff + LAYERS * W * W * 4;
      const sAOff = biasOff + LAYERS * W * 4, sBOff = sAOff + B * W * 4, yOff = sBOff + B * W * 4;
      new Float32Array(mem.buffer, xOff, B * W).set(x);
      new Float32Array(mem.buffer, wOff, LAYERS * W * W).set(w);
      new Float32Array(mem.buffer, biasOff, LAYERS * W).set(bias);
      (mod.instance.exports.mlp_forward as (
        x: number,
        w: number,
        b: number,
        sa: number,
        sb: number,
        y: number,
        bch: number,
        wd: number,
        hl: number,
      ) => void)(xOff, wOff, biasOff, sAOff, sBOff, yOff, B, W, HIDDEN);
      assertBitIdentical(label, new Float32Array(mem.buffer, yOff, B * W), ref);
    }

    const dartGlue = await import(`file://${ARTIFACTS}/mlp_forward_dart.mjs`);
    const dartApp = await dartGlue.compile(
      await Deno.readFile(`${ARTIFACTS}/mlp_forward_dart.wasm`),
    );
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      mlp_forward: (
        x: Float32Array,
        w: Float32Array,
        b: Float32Array,
        sa: Float32Array,
        sb: Float32Array,
        y: Float32Array,
        bch: number,
        wd: number,
        hl: number,
      ) => void;
    };
    assert(kernels && typeof kernels.mlp_forward === "function", "dartKernels not published");
    const y = new Float32Array(B * W);
    kernels.mlp_forward(
      x,
      w,
      bias,
      new Float32Array(B * W),
      new Float32Array(B * W),
      y,
      B,
      W,
      HIDDEN,
    );
    assertBitIdentical("Dart/WasmGC", y, ref);
  },
);

Deno.test("multilang-mlp: report contains a measured ml-dense-mlp workload with 5 variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const wl = report.workloads.find((w: { name: string }) => w.name === "ml-dense-mlp");
  assert(wl, "ml-dense-mlp workload missing from report");
  assert(wl.variants.length >= 5, "ml-dense-mlp needs 5 variants");
  for (const variant of wl.variants) {
    assert(typeof variant.warmExecutionMs === "number", `${variant.language} must be measured`);
  }
  const languages = wl.variants.map((v: { language: string }) => v.language);
  for (const expected of ["Rust / Wasm", "Dart / WasmGC", "C / Wasm", "C++ / Wasm", "JavaScript"]) {
    assert(languages.includes(expected), `ml-dense-mlp missing ${expected}`);
  }
});
