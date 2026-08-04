// M2 Track B: Named JavaScript platform optimization-hint variants.
// Tests different JS coding patterns that trigger different V8 optimization tiers.
// Each variant is labelled with the optimization hint and support probe.

export const JS_VARIANT_ITERATIONS = 100_000;

export type JsVariant = {
  name: string;
  description: string;
  hint: string;
  fn: () => number;
};

export type JsVariantResult = {
  variant: string;
  hint: string;
  iterations: number;
  totalMs: number;
  meanNs: number;
  p50Ns: number;
  valid: boolean;
  output: number;
};

export type JsVariantReport = {
  results: JsVariantResult[];
  engineInfo: {
    v8Version: string;
    turbofanEnabled: boolean;
    maglevEnabled: boolean;
    sparkplugEnabled: boolean;
  };
};

// ── Variants ──

function makeVariants(): JsVariant[] {
  const N = 1000;
  const typed = new Int32Array(N);
  const regular = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    typed[i] = i;
    regular[i] = i;
  }

  return [
    {
      name: "typed-array-sum",
      description: "Sum Int32Array with index loop (monomorphic, stable shape)",
      hint: "Monomorphic Int32Array — TurboFan optimizes to tight loop",
      fn: () => {
        let s = 0;
        for (let i = 0; i < N; i++) s += typed[i];
        return s;
      },
    },
    {
      name: "regular-array-sum",
      description: "Sum regular Array<number> with index loop (may be megamorphic)",
      hint: "Array<number> — holey vs packed affects optimization tier",
      fn: () => {
        let s = 0;
        for (let i = 0; i < N; i++) s += regular[i];
        return s;
      },
    },
    {
      name: "typed-array-reduce",
      description: "Sum Int32Array with Array.prototype.reduce (callback overhead)",
      hint: "reduce callback — function call boundary per element",
      fn: () => typed.reduce((a, b) => a + b, 0),
    },
    {
      name: "for-of-typed",
      description: "Sum Int32Array with for-of iterator protocol",
      hint: "for-of — iterator protocol overhead vs index loop",
      fn: () => {
        let s = 0;
        for (const v of typed) s += v;
        return s;
      },
    },
    {
      name: "while-typed",
      description: "Sum Int32Array with while loop and decrementing counter",
      hint: "while loop — different control flow, same optimization potential",
      fn: () => {
        let s = 0;
        let i = N;
        while (i-- > 0) s += typed[i];
        return s;
      },
    },
    {
      name: "unrolled-4x-typed",
      description: "Sum Int32Array with 4x loop unrolling (manual optimization hint)",
      hint: "Manual unroll — reduces branch overhead, may help or hurt JIT",
      fn: () => {
        let s = 0;
        const lim = N - (N % 4);
        for (let i = 0; i < lim; i += 4) {
          s += typed[i] + typed[i + 1] + typed[i + 2] + typed[i + 3];
        }
        return s;
      },
    },
  ];
}

// ── Measurement ──

function measure(variant: JsVariant, iterations: number): JsVariantResult {
  // Warmup: trigger JIT compilation
  for (let i = 0; i < 10_000; i++) variant.fn();

  const samples: number[] = new Array(iterations);
  let output = 0;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    output = variant.fn();
    samples[i] = (performance.now() - start) * 1_000_000; // ns
  }

  samples.sort((a, b) => a - b);
  const totalMs = samples.reduce((a, b) => a + b, 0) / 1_000_000;

  return {
    variant: variant.name,
    hint: variant.hint,
    iterations,
    totalMs,
    meanNs: totalMs * 1_000_000 / iterations,
    p50Ns: samples[Math.floor(iterations * 0.5)],
    valid: Number.isFinite(totalMs) && totalMs > 0,
    output,
  };
}

// ── Engine info probes ──

function probeEngineInfo(): JsVariantReport["engineInfo"] {
  // V8 version from Deno
  const v8Version = Deno.version?.v8 ??
      typeof navigator !== "undefined"
    ? String(navigator?.userAgent ?? "unknown")
    : "unknown";

  return {
    v8Version: String(v8Version),
    // These flags are always on in V8 12+ (Chrome 111+); we report them as probes
    turbofanEnabled: true,
    maglevEnabled: true,
    sparkplugEnabled: true,
  };
}

// ── Suite ──

export function runJsVariantSuite(): JsVariantReport {
  const variants = makeVariants();
  const results = variants.map((v) => measure(v, JS_VARIANT_ITERATIONS));

  return {
    results,
    engineInfo: probeEngineInfo(),
  };
}
