# Multi-Language WebAssembly Benchmark Report

Generated: 2026-08-04T23:43:22.900Z

## Overview
This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 86.62 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0016 ms               | 53.12 ms            | 1.63×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.0011 ms               | 53 ms            | 1.63×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 41.7 ms            | 2.08×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0017 ms               | 40.59 ms            | 2.13×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0012 ms               | 42.01 ms            | 2.06×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B              | 0.0988 ms               | 149.39 ms           | 0.58×         |

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 35.81 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0015 ms               | 8.31 ms            | 4.31×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 8.05 ms            | 4.45×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.83 ms            | 4.57×         |
| **Rust / Wasm** (rustc -O)     | 889 B              | 0.0012 ms               | 7.78 ms            | 4.60×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B              | 0.0988 ms               | 51.99 ms           | 0.69×         |

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (oracle)        | 0 B                 | 2.39 ms        | 1.00× |
| **C / Wasm** (Clang)           | 3077 B              | 2.05 ms         | 1.17× |
| **C++ / Wasm** (Clang++)       | 3079 B              | 2.16 ms        | 1.11× |
| **Rust / Wasm** (rustc)        | 6146 B              | 0.77 ms         | 3.10× |
| **Dart / WasmGC** (dart2wasm)  | 44023 B             | 24.91 ms       | 0.10× |

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (fround oracle) | 0 B                 | 732.93 ms        | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 272.15 ms         | 2.69× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 271.48 ms        | 2.70× |
| **Rust / Wasm** (rustc)        | 926 B              | 265.42 ms         | 2.76× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11870.77 ms       | 0.06× |

### 4. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)
| Language / Toolchain             | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| -------------------------------- | ------------------- | ----------------------- | ------- |
| **Dart / WasmGC** (dart2wasm)    | 39613 B    | 0.0988 ms | 380 |
| **Kotlin / Wasm** (prebuilt)     | 36961 B (~37 KB) | 0.0852 ms | 216 |

## Key Insights & Toolchain Overhead Analysis
1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
