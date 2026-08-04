// M2 Track B: SIMD vector operations benchmark.
// Compares scalar JS vs SIMD Wasm for f32x4 dot product and vector multiply-accumulate.
// Uses WebAssembly SIMD (v128, f32x4) with scalar equivalents.

import wabtFactory from "wabt";

export const SIMD_VECTOR_SIZE = 1024;
export const SIMD_ITERATIONS = 50_000;

// ── SIMD WAT: f32x4 dot product and vector multiply ──

const SIMD_WAT = `(module
  (memory (export "memory") 4)
  ;; f32x4 dot product: sum of a[i] * b[i] for i in 0..len
  (func (export "dot_f32x4") (param $a i32) (param $b i32) (param $len i32) (result f32)
    (local $i i32)
    (local $sum_v v128)
    (local $sum f32)
    (block $done
      (loop $next
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done
        ;; Load 4 f32 values from a and b
        local.get $sum_v
        local.get $a
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        v128.load
        local.get $b
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        v128.load
        f32x4.mul
        f32x4.add
        local.set $sum_v
        local.get $i
        i32.const 4
        i32.add
        local.set $i
        br $next))
    ;; Horizontal sum of v128 lanes
    local.get $sum_v
    f32x4.extract_lane 0
    local.get $sum_v
    f32x4.extract_lane 1
    f32.add
    local.get $sum_v
    f32x4.extract_lane 2
    f32x4.add
    local.get $sum_v
    f32x4.extract_lane 3
    f32x4.add)
  ;; Scalar f32 dot product for correctness comparison
  (func (export "dot_scalar") (param $a i32) (param $b i32) (param $len i32) (result f32)
    (local $i i32)
    (local $sum f32)
    (block $done
      (loop $next
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done
        local.get $sum
        local.get $a
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        f32.load
        local.get $b
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        f32.load
        f32.mul
        f32.add
        local.set $sum
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $next))
    local.get $sum)
  ;; f32x4 vector multiply: c[i] = a[i] * b[i]
  (func (export "vecmul_f32x4") (param $a i32) (param $b i32) (param $c i32) (param $len i32)
    (local $i i32)
    (block $done
      (loop $next
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done
        local.get $c
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        local.get $a
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        v128.load
        local.get $b
        local.get $i
        i32.const 2
        i32.shl
        i32.add
        v128.load
        f32x4.mul
        v128.store
        local.get $i
        i32.const 4
        i32.add
        local.set $i
        br $next)))
)`;

// ── Types ──

export type SimdResult = {
  test: string;
  iterations: number;
  totalMs: number;
  meanMs: number;
  valid: boolean;
};

export type SimdReport = {
  results: SimdResult[];
  simdAvailable: boolean;
  wasmBytes: number;
  dotCorrectnessPassed: boolean;
  vecmulCorrectnessPassed: boolean;
};

// ── Compile Wasm ──

let simdInstance: WebAssembly.Instance | null = null;

async function getSimdWasm(): Promise<{
  instance: WebAssembly.Instance;
  bytes: number;
}> {
  if (simdInstance) {
    return { instance: simdInstance, bytes: 0 };
  }
  const wabt = await wabtFactory();
  const mod = wabt.parseWat("simd-vectors.wat", SIMD_WAT, {
    exceptions: false,
    threads: false,
    simd: true,
  });
  mod.resolveNames();
  mod.validate();
  const binary = mod.toBinary({
    canonicalize_lebs: true,
    relocatable: false,
    write_debug_names: false,
  });
  mod.destroy();
  const wasmBytes = new Uint8Array(binary.buffer);
  const compiled = await WebAssembly.compile(wasmBytes);
  simdInstance = await WebAssembly.instantiate(compiled);
  return { instance: simdInstance, bytes: wasmBytes.byteLength };
}

// ── Benchmark helpers ──

function measure(
  name: string,
  fn: () => void,
  iterations: number,
): SimdResult {
  // Warmup
  for (let i = 0; i < 1000; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;

  return {
    test: name,
    iterations,
    totalMs,
    meanMs: totalMs / iterations,
    valid: Number.isFinite(totalMs) && totalMs > 0,
  };
}

// ── JS scalar implementations ──

function jsDotScalar(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function jsVecmulScalar(
  a: Float32Array,
  b: Float32Array,
  c: Float32Array,
): void {
  for (let i = 0; i < a.length; i++) {
    c[i] = a[i] * b[i];
  }
}

// ── Suite ──

export async function runSimdSuite(): Promise<SimdReport> {
  const { instance, bytes } = await getSimdWasm();
  const exports = instance.exports as Record<string, WebAssembly.ExportValue>;
  const memory = exports["memory"] as WebAssembly.Memory;
  const heap = new Float32Array(memory.buffer);

  const dotSimd = exports["dot_f32x4"] as (a: number, b: number, len: number) => number;
  const dotScalarWasm = exports["dot_scalar"] as (a: number, b: number, len: number) => number;
  const vecmulSimd = exports["vecmul_f32x4"] as (
    a: number,
    b: number,
    c: number,
    len: number,
  ) => void;

  // Prepare deterministic input
  const len = SIMD_VECTOR_SIZE;
  const aOffset = 0;
  const bOffset = len * 4;
  const cOffset = len * 8;
  const a = new Float32Array(len);
  const b = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    a[i] = (i * 0.001) % 1.0;
    b[i] = ((i + 1) * 0.001) % 1.0;
  }
  heap.set(a, aOffset / 4);
  heap.set(b, bOffset / 4);

  // Correctness: SIMD vs scalar Wasm
  const simdDot = dotSimd(aOffset, bOffset, len);
  const scalarDot = dotScalarWasm(aOffset, bOffset, len);
  const dotCorrectnessPassed = Math.abs(simdDot - scalarDot) < 0.001;

  // Correctness: vecmul SIMD vs JS scalar
  vecmulSimd(aOffset, bOffset, cOffset, len);
  const cSimd = new Float32Array(heap.subarray(cOffset / 4, cOffset / 4 + len));
  const cJs = new Float32Array(len);
  jsVecmulScalar(a, b, cJs);
  let vecmulCorrectnessPassed = true;
  for (let i = 0; i < len; i++) {
    if (Math.abs(cSimd[i] - cJs[i]) > 0.0001) {
      vecmulCorrectnessPassed = false;
      break;
    }
  }

  const results: SimdResult[] = [];

  // 1. Wasm SIMD dot product
  results.push(
    measure("wasm-simd-dot", () => dotSimd(aOffset, bOffset, len), SIMD_ITERATIONS),
  );

  // 2. Wasm scalar dot product
  results.push(
    measure("wasm-scalar-dot", () => dotScalarWasm(aOffset, bOffset, len), SIMD_ITERATIONS),
  );

  // 3. JS scalar dot product
  results.push(
    measure("js-scalar-dot", () => {
      jsDotScalar(a, b);
    }, SIMD_ITERATIONS),
  );

  // 4. Wasm SIMD vector multiply
  results.push(
    measure("wasm-simd-vecmul", () => vecmulSimd(aOffset, bOffset, cOffset, len), SIMD_ITERATIONS),
  );

  // 5. JS scalar vector multiply
  results.push(
    measure("js-scalar-vecmul", () => jsVecmulScalar(a, b, cJs), SIMD_ITERATIONS),
  );

  return {
    results,
    simdAvailable: true,
    wasmBytes: bytes,
    dotCorrectnessPassed,
    vecmulCorrectnessPassed,
  };
}
