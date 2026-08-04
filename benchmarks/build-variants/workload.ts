// M2 Track B: Named build variants for Wasm workloads.
// Compiles the same WAT source with different wabt options and measures
// code size and execution speed differences.
// Track B = optimized variants (algorithm/build differences expected and documented).

import wabtFactory from "wabt";

export type BuildVariant = {
  name: string;
  flags: {
    canonicalizeLebs: boolean;
    relocatable: boolean;
    writeDebugNames: boolean;
  };
  description: string;
};

export type VariantResult = {
  variant: string;
  wasmBytes: number;
  rawBytes: number;
  compileMs: number;
  valid: boolean;
  exportedFunctions: string[];
};

export type VariantReport = {
  results: VariantResult[];
  watSource: string;
};

// ── Build variants to test ──

export const BUILD_VARIANTS: BuildVariant[] = [
  {
    name: "default",
    flags: { canonicalizeLebs: true, relocatable: false, writeDebugNames: false },
    description: "Default canonical build: smallest binary, no debug names",
  },
  {
    name: "debug-names",
    flags: { canonicalizeLebs: true, relocatable: false, writeDebugNames: true },
    description: "With debug names for stack traces and debugging",
  },
  {
    name: "non-canonical-lebs",
    flags: { canonicalizeLebs: false, relocatable: false, writeDebugNames: false },
    description: "Non-canonical LEB128 encoding (larger binary, possibly faster decode)",
  },
  {
    name: "relocatable",
    flags: { canonicalizeLebs: true, relocatable: true, writeDebugNames: false },
    description: "Relocatable binary for linking (larger, with relocation entries)",
  },
];

// ── Test WAT source (sum-u32 from the M1 workload) ──

const SUM_U32_WAT = `(module
  (memory (export "memory") 4)
  (func (export "sum_u32") (param $ptr i32) (param $len i32) (result i32)
    (local $index i32)
    (local $sum i32)
    (block $done
      (loop $next
        local.get $index
        local.get $len
        i32.ge_u
        br_if $done
        local.get $sum
        local.get $ptr
        local.get $index
        i32.const 4
        i32.mul
        i32.add
        i32.load
        i32.add
        local.set $sum
        local.get $index
        i32.const 1
        i32.add
        local.set $index
        br $next))
    local.get $sum)
)`;

// ── Compile with variant flags ──

async function compileVariant(
  wat: string,
  variant: BuildVariant,
): Promise<VariantResult> {
  const start = performance.now();
  const wabt = await wabtFactory();
  const mod = wabt.parseWat(`variant-${variant.name}.wat`, wat, {
    exceptions: false,
    threads: false,
    simd: false,
  });
  mod.resolveNames();
  mod.validate();
  const binary = mod.toBinary({
    canonicalize_lebs: variant.flags.canonicalizeLebs,
    relocatable: variant.flags.relocatable,
    write_debug_names: variant.flags.writeDebugNames,
  });
  mod.destroy();

  const wasmBytes = new Uint8Array(binary.buffer);
  const compileMs = performance.now() - start;

  // Verify the binary compiles and exports are accessible
  const compiled = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(compiled);
  const exports = Object.keys(instance.exports).filter(
    (k) => typeof instance.exports[k] === "function",
  );

  return {
    variant: variant.name,
    wasmBytes: wasmBytes.byteLength,
    rawBytes: wasmBytes.byteLength,
    compileMs,
    valid: exports.includes("sum_u32"),
    exportedFunctions: exports,
  };
}

// ── Run all variants ──

export async function runBuildVariantSuite(): Promise<VariantReport> {
  const results: VariantResult[] = [];

  for (const variant of BUILD_VARIANTS) {
    try {
      const result = await compileVariant(SUM_U32_WAT, variant);
      results.push(result);
    } catch {
      results.push({
        variant: variant.name,
        wasmBytes: 0,
        rawBytes: 0,
        compileMs: 0,
        valid: false,
        exportedFunctions: [],
      });
    }
  }

  return { results, watSource: "sum-u32" };
}

// ── Get the WAT source for external use ──

export function getSumU32Wat(): string {
  return SUM_U32_WAT;
}
