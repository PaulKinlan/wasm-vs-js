# Multi-Language WebAssembly Benchmark Report

Generated: 2026-08-26T21:14:18.442Z

## Overview
This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 82.77 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0013 ms               | 53.73 ms            | 1.54×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.001 ms               | 54.15 ms            | 1.53×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 40.59 ms            | 2.04×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0017 ms               | 41.52 ms            | 1.99×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0011 ms               | 40.6 ms            | 2.04×         |
| **Dart / WasmGC** (dart2wasm)  | 41222 B              | 0.0973 ms               | 146.83 ms           | 0.56×         |

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 36.02 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 532 B              | 0.0011 ms               | 8.53 ms            | 4.22×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 8.04 ms            | 4.48×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.78 ms            | 4.63×         |
| **Rust / Wasm** (rustc -O)     | 889 B              | 0.0011 ms               | 7.73 ms            | 4.66×         |
| **Dart / WasmGC** (dart2wasm)  | 41222 B              | 0.0973 ms               | 108.48 ms           | 0.33×         |

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (oracle)        | 0 B                 | 3.05 ms        | 1.00× |
| **C / Wasm** (Clang)           | 3077 B              | 2.17 ms         | 1.41× |
| **C++ / Wasm** (Clang++)       | 3079 B              | 2.08 ms        | 1.47× |
| **Rust / Wasm** (rustc)        | 6122 B              | 0.77 ms         | 3.96× |
| **Dart / WasmGC** (dart2wasm)  | 44023 B             | 20.49 ms       | 0.15× |

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (fround oracle) | 0 B                 | 731.41 ms        | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 271.42 ms         | 2.69× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 269.94 ms        | 2.71× |
| **Rust / Wasm** (rustc)        | 926 B              | 267.34 ms         | 2.74× |
| **AssemblyScript / Wasm** (asc) | 213 B             | 374.26 ms        | 1.95× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11777.01 ms       | 0.06× |

### 5. FIPS-180-4 SHA-256 (`crypto-file-integrity`, 1 MiB seeded fixture, 64 KiB chunks, 30 warm iterations)

All variants are bit-identical to the oracle digest (test-verified, incl. padding boundaries). Dart/WasmGC uses zero-copy Uint8Array views with no linear memory.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (ControlledSha256) | 0 B              | 474.8 ms        | 1.00× |
| **C / Wasm** (Clang)           | 3197 B              | 105.54 ms         | 4.50× |
| **C++ / Wasm** (Clang++)       | 3244 B              | 105.24 ms        | 4.51× |
| **Rust / Wasm** (rustc)        | 5205 B              | 107.82 ms         | 4.40× |
| **AssemblyScript / Wasm** (asc) | 1610 B             | 103.87 ms        | 4.57× |
| **Dart / WasmGC** (dart2wasm)  | 53795 B             | 357.04 ms       | 1.33× |

### 4. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)
| Language / Toolchain             | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| -------------------------------- | ------------------- | ----------------------- | ------- |
| **Dart / WasmGC** (dart2wasm)    | 41222 B    | 0.0973 ms | 384 |
| **Kotlin / Wasm** (prebuilt)     | 36961 B (~37 KB) | 0.077 ms | 216 |

## Key Insights & Toolchain Overhead Analysis
1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
