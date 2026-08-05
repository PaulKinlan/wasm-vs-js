# Multi-Language WebAssembly Benchmark Report

Generated: 2026-08-05T12:25:23.893Z

## Overview
This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 87.1 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0013 ms               | 75.81 ms            | 1.15×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.001 ms               | 71.44 ms            | 1.22×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 46.23 ms            | 1.88×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0017 ms               | 44.84 ms            | 1.94×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0011 ms               | 50.33 ms            | 1.73×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B              | 0.0931 ms               | 282.37 ms           | 0.31×         |

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 71.35 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0015 ms               | 13.64 ms            | 5.23×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 13.24 ms            | 5.39×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 11.91 ms            | 5.99×         |
| **Rust / Wasm** (rustc -O)     | 889 B              | 0.0011 ms               | 12.08 ms            | 5.91×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B              | 0.0931 ms               | 106.83 ms           | 0.67×         |

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (oracle)        | 0 B                 | 6.65 ms        | 1.00× |
| **C / Wasm** (Clang)           | 3077 B              | 4.36 ms         | 1.53× |
| **C++ / Wasm** (Clang++)       | 3079 B              | 4.2 ms        | 1.58× |
| **Rust / Wasm** (rustc)        | 6110 B              | 1.77 ms         | 3.76× |
| **Dart / WasmGC** (dart2wasm)  | 44023 B             | 101.38 ms       | 0.07× |

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (fround oracle) | 0 B                 | 734.47 ms        | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 269.22 ms         | 2.73× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 270.4 ms        | 2.72× |
| **Rust / Wasm** (rustc)        | 926 B              | 269.09 ms         | 2.73× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11865.48 ms       | 0.06× |

### 5. FIPS-180-4 SHA-256 (`crypto-file-integrity`, 1 MiB seeded fixture, 64 KiB chunks, 30 warm iterations)

All variants are bit-identical to the oracle digest (test-verified, incl. padding boundaries). Dart/WasmGC uses zero-copy Uint8Array views with no linear memory.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (ControlledSha256) | 0 B              | 457.31 ms        | 1.00× |
| **C / Wasm** (Clang)           | 3197 B              | 104.66 ms         | 4.37× |
| **C++ / Wasm** (Clang++)       | 3244 B              | 105.8 ms        | 4.32× |
| **Rust / Wasm** (rustc)        | 5193 B              | 108.13 ms         | 4.23× |
| **Dart / WasmGC** (dart2wasm)  | 53795 B             | 368.24 ms       | 1.24× |

### 4. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)
| Language / Toolchain             | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| -------------------------------- | ------------------- | ----------------------- | ------- |
| **Dart / WasmGC** (dart2wasm)    | 39613 B    | 0.0931 ms | 380 |
| **Kotlin / Wasm** (prebuilt)     | 36961 B (~37 KB) | 0.0758 ms | 216 |

## Key Insights & Toolchain Overhead Analysis
1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
