# Multi-Language WebAssembly Benchmark Report

Generated: 2026-08-05T22:09:55.291Z

## Overview

This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 83.07 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0014 ms               | 54.15 ms            | 1.53×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.001 ms                | 54.07 ms            | 1.54×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 41.1 ms             | 2.02×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0017 ms               | 40.97 ms            | 2.03×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0011 ms               | 41.57 ms            | 2.00×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0937 ms               | 146.89 ms           | 0.57×         |

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 36.08 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0015 ms               | 8.27 ms             | 4.36×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 8.05 ms             | 4.48×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.85 ms             | 4.60×         |
| **Rust / Wasm** (rustc -O)     | 889 B               | 0.0011 ms               | 7.81 ms             | 4.62×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0937 ms               | 54.56 ms            | 0.66×         |

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain          | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ----------------------------- | ------------------- | ------------------- | ----- |
| **JavaScript** (oracle)       | 0 B                 | 3.09 ms             | 1.00× |
| **C / Wasm** (Clang)          | 3077 B              | 2.06 ms             | 1.50× |
| **C++ / Wasm** (Clang++)      | 3079 B              | 2.07 ms             | 1.49× |
| **Rust / Wasm** (rustc)       | 6110 B              | 0.75 ms             | 4.12× |
| **Dart / WasmGC** (dart2wasm) | 44023 B             | 23.84 ms            | 0.13× |

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (fround oracle) | 0 B                 | 731.02 ms           | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 265.46 ms           | 2.75× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 270.02 ms           | 2.71× |
| **Rust / Wasm** (rustc)        | 926 B               | 265.66 ms           | 2.75× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11916.58 ms         | 0.06× |

### 5. FIPS-180-4 SHA-256 (`crypto-file-integrity`, 1 MiB seeded fixture, 64 KiB chunks, 30 warm iterations)

All variants are bit-identical to the oracle digest (test-verified, incl. padding boundaries). Dart/WasmGC uses zero-copy Uint8Array views with no linear memory.

| Language / Toolchain              | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| --------------------------------- | ------------------- | ------------------- | ----- |
| **JavaScript** (ControlledSha256) | 0 B                 | 460.89 ms           | 1.00× |
| **C / Wasm** (Clang)              | 3197 B              | 104.77 ms           | 4.40× |
| **C++ / Wasm** (Clang++)          | 3244 B              | 104.64 ms           | 4.40× |
| **Rust / Wasm** (rustc)           | 5193 B              | 107.47 ms           | 4.29× |
| **Dart / WasmGC** (dart2wasm)     | 53795 B             | 435.35 ms           | 1.06× |

### 4. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)

| Language / Toolchain          | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| ----------------------------- | ------------------- | ----------------------- | ------- |
| **Dart / WasmGC** (dart2wasm) | 39613 B             | 0.0937 ms               | 380     |
| **Kotlin / Wasm** (prebuilt)  | 36961 B (~37 KB)    | 0.0797 ms               | 216     |

## Key Insights & Toolchain Overhead Analysis

1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
