# Multi-Language WebAssembly Benchmark Report

Generated: 2026-08-05T14:19:12.685Z

## Overview

This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 82.38 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0012 ms               | 52.87 ms            | 1.56×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.001 ms                | 53.09 ms            | 1.55×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 40.08 ms            | 2.06×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0017 ms               | 39.95 ms            | 2.06×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0011 ms               | 39.99 ms            | 2.06×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0932 ms               | 144.97 ms           | 0.57×         |

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 35.39 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0015 ms               | 8.12 ms             | 4.36×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 7.92 ms             | 4.47×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.71 ms             | 4.59×         |
| **Rust / Wasm** (rustc -O)     | 889 B               | 0.0011 ms               | 7.68 ms             | 4.61×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0932 ms               | 51.11 ms            | 0.69×         |

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain          | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ----------------------------- | ------------------- | ------------------- | ----- |
| **JavaScript** (oracle)       | 0 B                 | 2.63 ms             | 1.00× |
| **C / Wasm** (Clang)          | 3077 B              | 2.03 ms             | 1.30× |
| **C++ / Wasm** (Clang++)      | 3079 B              | 2.06 ms             | 1.28× |
| **Rust / Wasm** (rustc)       | 6110 B              | 0.68 ms             | 3.87× |
| **Dart / WasmGC** (dart2wasm) | 44023 B             | 22.86 ms            | 0.12× |

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (fround oracle) | 0 B                 | 730.59 ms           | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 264.32 ms           | 2.76× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 264.29 ms           | 2.76× |
| **Rust / Wasm** (rustc)        | 926 B               | 265.39 ms           | 2.75× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11810.25 ms         | 0.06× |

### 5. FIPS-180-4 SHA-256 (`crypto-file-integrity`, 1 MiB seeded fixture, 64 KiB chunks, 30 warm iterations)

All variants are bit-identical to the oracle digest (test-verified, incl. padding boundaries). Dart/WasmGC uses zero-copy Uint8Array views with no linear memory.

| Language / Toolchain              | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| --------------------------------- | ------------------- | ------------------- | ----- |
| **JavaScript** (ControlledSha256) | 0 B                 | 467.75 ms           | 1.00× |
| **C / Wasm** (Clang)              | 3197 B              | 104.43 ms           | 4.48× |
| **C++ / Wasm** (Clang++)          | 3244 B              | 104.04 ms           | 4.50× |
| **Rust / Wasm** (rustc)           | 5189 B              | 106.92 ms           | 4.37× |
| **Dart / WasmGC** (dart2wasm)     | 53795 B             | 410.6 ms            | 1.14× |

### 4. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)

| Language / Toolchain          | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| ----------------------------- | ------------------- | ----------------------- | ------- |
| **Dart / WasmGC** (dart2wasm) | 39613 B             | 0.0932 ms               | 380     |
| **Kotlin / Wasm** (prebuilt)  | 36961 B (~37 KB)    | 0.0799 ms               | 216     |

## Key Insights & Toolchain Overhead Analysis

1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
