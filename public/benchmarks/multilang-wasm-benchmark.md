# Multi-Language WebAssembly Benchmark Report

Generated: 2026-08-05T14:42:25.935Z

## Overview

This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 82.52 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0012 ms               | 53.46 ms            | 1.54×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.001 ms                | 53.4 ms             | 1.55×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 40.57 ms            | 2.03×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0017 ms               | 45.08 ms            | 1.83×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0011 ms               | 40.11 ms            | 2.06×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.091 ms                | 154.79 ms           | 0.53×         |

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 35.64 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0014 ms               | 8.73 ms             | 4.08×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 7.97 ms             | 4.47×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.76 ms             | 4.59×         |
| **Rust / Wasm** (rustc -O)     | 889 B               | 0.0011 ms               | 7.77 ms             | 4.59×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.091 ms                | 52.34 ms            | 0.68×         |

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain          | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ----------------------------- | ------------------- | ------------------- | ----- |
| **JavaScript** (oracle)       | 0 B                 | 2.78 ms             | 1.00× |
| **C / Wasm** (Clang)          | 3077 B              | 2.09 ms             | 1.33× |
| **C++ / Wasm** (Clang++)      | 3079 B              | 2.02 ms             | 1.38× |
| **Rust / Wasm** (rustc)       | 6110 B              | 0.74 ms             | 3.76× |
| **Dart / WasmGC** (dart2wasm) | 44023 B             | 22.39 ms            | 0.12× |

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (fround oracle) | 0 B                 | 729.01 ms           | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 269.85 ms           | 2.70× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 268.62 ms           | 2.71× |
| **Rust / Wasm** (rustc)        | 926 B               | 263.23 ms           | 2.77× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11671.68 ms         | 0.06× |

### 5. Image Pixel Kernels (`image-editing`, flood fill 64×48 + luma Gaussian 40×30, 2,000 warm iterations)

One warm iteration runs both integer-only kernels on the pinned repo fixtures. All variants are bit-identical to the image-editing oracle — output pixels, visited mask, and the nine ABI work counters (build-checked and test-verified).

| Language / Toolchain            | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------- | ------------------- | ------------------- | ----- |
| **JavaScript** (integer oracle) | 0 B                 | 141.51 ms           | 1.00× |
| **C / Wasm** (Clang)            | 3093 B              | 45.39 ms            | 3.12× |
| **C++ / Wasm** (Clang++)        | 3095 B              | 44.28 ms            | 3.20× |
| **Rust / Wasm** (rustc)         | 1862 B              | 38.85 ms            | 3.64× |
| **AssemblyScript** (asc -O3)    | 1661 B              | 49.17 ms            | 2.88× |
| **Dart / WasmGC** (dart2wasm)   | 43780 B             | 97.91 ms            | 1.45× |

### 6. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)

| Language / Toolchain          | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| ----------------------------- | ------------------- | ----------------------- | ------- |
| **Dart / WasmGC** (dart2wasm) | 39613 B             | 0.091 ms                | 380     |
| **Kotlin / Wasm** (prebuilt)  | 36961 B (~37 KB)    | 0.076 ms                | 216     |

## Key Insights & Toolchain Overhead Analysis

1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
