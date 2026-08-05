# Multi-Language WebAssembly Benchmark Report

<<<<<<< HEAD
Generated: 2026-08-05T14:02:27.586Z
=======
Generated: 2026-08-05T13:54:17.745Z
>>>>>>> feat/multilang-ecs

## Overview

This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
<<<<<<< HEAD
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 85.38 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0013 ms               | 53.17 ms            | 1.61×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.0011 ms               | 53.28 ms            | 1.60×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 40.45 ms            | 2.11×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0018 ms               | 40.48 ms            | 2.11×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0011 ms               | 40.26 ms            | 2.12×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0953 ms               | 147.67 ms           | 0.58×         |
=======
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 84.01 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0013 ms               | 53.87 ms            | 1.56×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.0011 ms               | 59.54 ms            | 1.41×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.002 ms                | 40.55 ms            | 2.07×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0018 ms               | 40.71 ms            | 2.06×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0012 ms               | 44.16 ms            | 1.90×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0941 ms               | 146.81 ms           | 0.57×         |
>>>>>>> feat/multilang-ecs

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)

| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
<<<<<<< HEAD
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 35.7 ms             | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0015 ms               | 8.25 ms             | 4.33×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 8.05 ms             | 4.43×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.8 ms              | 4.58×         |
| **Rust / Wasm** (rustc -O)     | 889 B               | 0.0012 ms               | 7.73 ms             | 4.62×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0953 ms               | 51.06 ms            | 0.70×         |
=======
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 35.03 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0015 ms               | 8.32 ms             | 4.21×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 8.08 ms             | 4.34×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.83 ms             | 4.47×         |
| **Rust / Wasm** (rustc -O)     | 889 B               | 0.0011 ms               | 7.75 ms             | 4.52×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B             | 0.0941 ms               | 51.82 ms            | 0.68×         |
>>>>>>> feat/multilang-ecs

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain          | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ----------------------------- | ------------------- | ------------------- | ----- |
<<<<<<< HEAD
| **JavaScript** (oracle)       | 0 B                 | 2.67 ms             | 1.00× |
| **C / Wasm** (Clang)          | 3077 B              | 2.08 ms             | 1.28× |
| **C++ / Wasm** (Clang++)      | 3079 B              | 2.14 ms             | 1.25× |
| **Rust / Wasm** (rustc)       | 6110 B              | 0.68 ms             | 3.93× |
| **Dart / WasmGC** (dart2wasm) | 44023 B             | 21.88 ms            | 0.12× |
=======
| **JavaScript** (oracle)       | 0 B                 | 2.34 ms             | 1.00× |
| **C / Wasm** (Clang)          | 3077 B              | 2.1 ms              | 1.11× |
| **C++ / Wasm** (Clang++)      | 3079 B              | 2.02 ms             | 1.16× |
| **Rust / Wasm** (rustc)       | 6106 B              | 0.67 ms             | 3.49× |
| **Dart / WasmGC** (dart2wasm) | 44023 B             | 21.49 ms            | 0.11× |
>>>>>>> feat/multilang-ecs

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
<<<<<<< HEAD
| **JavaScript** (fround oracle) | 0 B                 | 729.14 ms           | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 269.19 ms           | 2.71× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 272.3 ms            | 2.68× |
| **Rust / Wasm** (rustc)        | 926 B               | 268.48 ms           | 2.72× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11629.39 ms         | 0.06× |
=======
| **JavaScript** (fround oracle) | 0 B                 | 732.9 ms            | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 270.55 ms           | 2.71× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 270.12 ms           | 2.71× |
| **Rust / Wasm** (rustc)        | 926 B               | 268.67 ms           | 2.73× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11804.56 ms         | 0.06× |
>>>>>>> feat/multilang-ecs

### 5. FIPS-180-4 SHA-256 (`crypto-file-integrity`, 1 MiB seeded fixture, 64 KiB chunks, 30 warm iterations)

All variants are bit-identical to the oracle digest (test-verified, incl. padding boundaries). Dart/WasmGC uses zero-copy Uint8Array views with no linear memory.

| Language / Toolchain              | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| --------------------------------- | ------------------- | ------------------- | ----- |
<<<<<<< HEAD
| **JavaScript** (ControlledSha256) | 0 B                 | 461.46 ms           | 1.00× |
| **C / Wasm** (Clang)              | 3197 B              | 104.29 ms           | 4.42× |
| **C++ / Wasm** (Clang++)          | 3244 B              | 104.3 ms            | 4.42× |
| **Rust / Wasm** (rustc)           | 5189 B              | 107.41 ms           | 4.30× |
| **Dart / WasmGC** (dart2wasm)     | 53795 B             | 351.26 ms           | 1.31× |
=======
| **JavaScript** (ControlledSha256) | 0 B                 | 472.8 ms            | 1.00× |
| **C / Wasm** (Clang)              | 3197 B              | 104.43 ms           | 4.53× |
| **C++ / Wasm** (Clang++)          | 3244 B              | 104.3 ms            | 4.53× |
| **Rust / Wasm** (rustc)           | 5189 B              | 107.15 ms           | 4.41× |
| **Dart / WasmGC** (dart2wasm)     | 53795 B             | 418.84 ms           | 1.13× |
>>>>>>> feat/multilang-ecs

### 4. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)

| Language / Toolchain          | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| ----------------------------- | ------------------- | ----------------------- | ------- |
<<<<<<< HEAD
| **Dart / WasmGC** (dart2wasm) | 39613 B             | 0.0953 ms               | 380     |
| **Kotlin / Wasm** (prebuilt)  | 36961 B (~37 KB)    | 0.078 ms                | 216     |
=======
| **Dart / WasmGC** (dart2wasm) | 39613 B             | 0.0941 ms               | 380     |
| **Kotlin / Wasm** (prebuilt)  | 36961 B (~37 KB)    | 0.0849 ms               | 216     |
>>>>>>> feat/multilang-ecs

## Key Insights & Toolchain Overhead Analysis

1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
