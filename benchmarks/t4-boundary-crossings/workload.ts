// M2 T4: JS↔Wasm boundary-crossing microbenchmarks.
// Measures call overhead, copy cost, and batching effects at the JS/Wasm boundary.
// These are diagnostic cells — they isolate boundary cost, not computation.

export const T4_ITERATIONS = 100_000;
export const T4_WARMUP = 10_000;

// ── Wasm module: minimal functions for boundary measurement ──

const T4_WAT = `(module
  (memory (export "memory") 1)
  (func (export "noop") (result i32)
    i32.const 0
  )
  (func (export "add") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add
  )
  (func (export "copy_i32") (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32)
    (block $done
      (loop $next
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done
        (i32.store
          (local.get $dst)
          (local.get $i)
          i32.const 2
          i32.shl
          i32.add
        )
        (i32.load
          (local.get $src)
          (local.get $i)
          i32.const 2
          i32.shl
          i32.add
        )
        ;; Overwrite stored value with loaded value (correct copy)
        (i32.store
          (local.get $dst)
          (local.get $i)
          i32.const 2
          i32.shl
          i32.add
          (i32.load
            (local.get $src)
            (local.get $i)
            i32.const 2
            i32.shl
            i32.add
          )
        )
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $next
      )
    )
  )
  ;; Import a JS function for Wasm→JS callback measurement
  (func (export "call_js_callback") (param $reps i32) (result i32)
    (local $i i32)
    (local $sum i32)
    (block $done
      (loop $next
        local.get $i
        local.get $reps
        i32.ge_u
        br_if $done
        local.get $sum
        i32.const 1
        i32.add
        local.set $sum
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $next
      )
    )
    local.get $sum
  )
  (func (export "batch_calls") (param $reps i32) (result i32)
    (local $i i32)
    (local $sum i32)
    (block $done
      (loop $next
        local.get $i
        local.get $reps
        i32.ge_u
        br_if $done
        local.get $sum
        local.get $i
        i32.const 3
        i32.and
        i32.add
        local.set $sum
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $next
      )
    )
    local.get $sum
  )
)`;

// ── Compile Wasm ──

let wasmInstance: WebAssembly.Instance | null = null;

async function getWasm(): Promise<WebAssembly.Instance> {
  if (wasmInstance) return wasmInstance;
  const wabtModule = await WebAssembly.compile(
    new TextEncoder().encode(T4_WAT),
  );
  wasmInstance = await WebAssembly.instantiate(wabtModule);
  return wasmInstance;
}

// ── Measurement helpers ──

export type BoundaryResult = {
  test: string;
  iterations: number;
  totalMs: number;
  meanNs: number;
  p50Ns: number;
  p99Ns: number;
  valid: boolean;
};

function measure(
  name: string,
  fn: () => number,
  iterations: number,
): BoundaryResult {
  // Warmup
  for (let i = 0; i < T4_WARMUP; i++) {
    fn();
  }

  // Measure
  const samples: number[] = new Array(iterations);
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    checksum ^= fn();
    const end = performance.now();
    samples[i] = (end - start) * 1_000_000; // ns
  }

  // Prevent dead-code elimination
  if (checksum === -1) console.log("impossible");

  samples.sort((a, b) => a - b);
  const totalMs = samples.reduce((a, b) => a + b, 0) / 1_000_000;
  const meanNs = totalMs * 1_000_000 / iterations;
  const p50Ns = samples[Math.floor(iterations * 0.5)];
  const p99Ns = samples[Math.floor(iterations * 0.99)];

  return {
    test: name,
    iterations,
    totalMs,
    meanNs,
    p50Ns,
    p99Ns,
    valid: Number.isFinite(meanNs) && meanNs >= 0,
  };
}

// ── T4 benchmark suite ──

export async function runT4BoundarySuite(): Promise<{
  results: BoundaryResult[];
  wasmBytes: number;
}> {
  const wasm = await getWasm();
  const wasmBytes = new TextEncoder().encode(T4_WAT).byteLength;

  const exports = wasm.exports as Record<string, WebAssembly.ExportValue>;
  const noop = exports["noop"] as () => number;
  const add = exports["add"] as (a: number, b: number) => number;
  const batchCalls = exports["batch_calls"] as (reps: number) => number;

  const results: BoundaryResult[] = [];

  // 1. JS no-op baseline (pure JS function call overhead)
  {
    const jsNoop = () => 1;
    results.push(measure("js-noop", jsNoop, T4_ITERATIONS));
  }

  // 2. Wasm no-op (single boundary crossing, no args)
  results.push(measure("wasm-noop", noop, T4_ITERATIONS));

  // 3. Wasm with 2 i32 args
  results.push(measure("wasm-add-2args", () => add(1, 2), T4_ITERATIONS));

  // 4. JS function with 2 args baseline
  {
    const jsAdd = (a: number, b: number) => a + b;
    results.push(measure("js-add-2args", () => jsAdd(1, 2), T4_ITERATIONS));
  }

  // 5. Wasm batch (100 internal iterations, single boundary crossing)
  results.push(
    measure("wasm-batch-100", () => batchCalls(100), T4_ITERATIONS / 10),
  );

  // 6. JS batch (100 iterations for comparison)
  {
    const jsBatch = (reps: number) => {
      let sum = 0;
      for (let i = 0; i < reps; i++) {
        sum += i & 3;
      }
      return sum;
    };
    results.push(
      measure("js-batch-100", () => jsBatch(100), T4_ITERATIONS / 10),
    );
  }

  // 7. Memory copy via Wasm (copy 1024 i32 values)
  {
    const copyFn = exports["copy_i32"] as (s: number, d: number, n: number) => void;
    // Source and dest offsets in i32 units (byte offset / 4)
    const srcOff = 0;
    const dstOff = 16384; // Different region
    // Note: the WAT copy function uses byte addressing, so pass byte offsets
    results.push(
      measure(
        "wasm-copy-1024i32",
        () => {
          copyFn(srcOff * 4, dstOff * 4, 1024);
          return 0;
        },
        T4_ITERATIONS / 10,
      ),
    );
  }

  // 8. JS memory copy baseline (TypedArray.set)
  {
    const src = new Uint32Array(1024);
    const dst = new Uint32Array(1024);
    results.push(
      measure(
        "js-copy-1024i32",
        () => {
          dst.set(src);
          return dst[0];
        },
        T4_ITERATIONS / 10,
      ),
    );
  }

  return { results, wasmBytes };
}
