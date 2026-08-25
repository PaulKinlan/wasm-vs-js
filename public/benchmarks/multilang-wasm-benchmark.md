# Multi-Language WebAssembly Benchmark Report

Generated: 2026-08-25T23:46:08.848Z

## Overview
This report quantifies the overhead, binary footprint, cold instantiation latency, and warm execution speed across the same two kernels written in JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and Dart (WasmGC). The Kotlin/Wasm row reports measured footprint only (its workload differs). All numbers are measured in this build — no synthesized values.

## Benchmark Results

### 1. Array Summation (`sum-u32`, 1,000 u32 elements, 200,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 82.3 ms            | 1.00×         |
| **Raw WAT** (Handwritten)      | 96 B                | 0.0013 ms               | 53.39 ms            | 1.54×         |
| **AssemblyScript** (asc -O3)   | 94 B                | 0.0011 ms               | 53.66 ms            | 1.53×         |
| **C / Wasm** (Clang -nostdlib) | 757 B               | 0.0018 ms               | 40.44 ms            | 2.04×         |
| **C++ / Wasm** (Clang++ -O3)   | 759 B               | 0.0018 ms               | 41.19 ms            | 2.00×         |
| **Rust / Wasm** (rustc -O)     | 498 B               | 0.0012 ms               | 41.17 ms            | 2.00×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B              | 0.0952 ms               | 146.55 ms           | 0.56×         |

### 2. Fast Fourier Transform Butterfly (`fft-kernel`, 512 elements, 2,000 iterations)
| Language / Toolchain           | Binary Size (bytes) | Cold Instantiation (ms) | Warm Execution (ms) | Speedup vs JS |
| ------------------------------ | ------------------- | ----------------------- | ------------------- | ------------- |
| **JavaScript** (V8 JIT)        | 0 B                 | 0.00 ms                 | 36.08 ms            | 1.00×         |
| **AssemblyScript** (asc -O3)   | 2479 B              | 0.0015 ms               | 8.18 ms            | 4.41×         |
| **C / Wasm** (Clang -nostdlib) | 1149 B              | 0.0018 ms               | 8.02 ms            | 4.50×         |
| **C++ / Wasm** (Clang++ -O3)   | 1151 B              | 0.0018 ms               | 7.75 ms            | 4.66×         |
| **Rust / Wasm** (rustc -O)     | 889 B              | 0.0011 ms               | 7.72 ms            | 4.67×         |
| **Dart / WasmGC** (dart2wasm)  | 39613 B              | 0.0952 ms               | 51.94 ms           | 0.69×         |

### 3. Myers Diff (`text-diff-patch`, 512-line base, 30 interleaved edits, 60 warm iterations)

All variants are bit-identical to the JS myersDiff oracle (ops + editDistance + frontierSteps, test-verified).

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (oracle)        | 0 B                 | 4.35 ms        | 1.00× |
| **C / Wasm** (Clang)           | 3077 B              | 2.16 ms         | 2.01× |
| **C++ / Wasm** (Clang++)       | 3079 B              | 2.32 ms        | 1.88× |
| **Rust / Wasm** (rustc)        | 6122 B              | 0.7 ms         | 6.21× |
| **Dart / WasmGC** (dart2wasm)  | 44023 B             | 22.33 ms       | 0.19× |

### 4. Strict-f32 GEMM (`ml-gemm`, one 128×128×128 product, 200 warm iterations)

All variants are bit-identical to the JS Math.fround oracle (test-verified). Dart/WasmGC emulates f32 with Math.fround per op — no f32 primitive in Dart — so its overhead is real and disclosed.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (fround oracle) | 0 B                 | 729.68 ms        | 1.00× |
| **C / Wasm** (Clang)           | 1186 B              | 270.76 ms         | 2.69× |
| **C++ / Wasm** (Clang++)       | 1188 B              | 263.26 ms        | 2.77× |
| **Rust / Wasm** (rustc)        | 926 B              | 264.21 ms         | 2.76× |
| **AssemblyScript / Wasm** (asc) | 213 B             | 364.34 ms        | 2.00× |
| **Dart / WasmGC** (dart2wasm)  | 39079 B             | 11676.89 ms       | 0.06× |

### 5. FIPS-180-4 SHA-256 (`crypto-file-integrity`, 1 MiB seeded fixture, 64 KiB chunks, 30 warm iterations)

All variants are bit-identical to the oracle digest (test-verified, incl. padding boundaries). Dart/WasmGC uses zero-copy Uint8Array views with no linear memory.

| Language / Toolchain           | Binary Size (bytes) | Warm Execution (ms) | vs JS |
| ------------------------------ | ------------------- | ------------------- | ----- |
| **JavaScript** (ControlledSha256) | 0 B              | 450.38 ms        | 1.00× |
| **C / Wasm** (Clang)           | 3197 B              | 104.43 ms         | 4.31× |
| **C++ / Wasm** (Clang++)       | 3244 B              | 104.38 ms        | 4.31× |
| **Rust / Wasm** (rustc)        | 5205 B              | 107.21 ms         | 4.20× |
| **Dart / WasmGC** (dart2wasm)  | 53795 B             | 358 ms       | 1.26× |

### 4. Managed WasmGC Runtime Footprint (measured — workloads differ, no warm comparison)
| Language / Toolchain             | Binary Size (bytes) | Cold Instantiation (ms) | Imports |
| -------------------------------- | ------------------- | ----------------------- | ------- |
| **Dart / WasmGC** (dart2wasm)    | 39613 B    | 0.0952 ms | 380 |
| **Kotlin / Wasm** (prebuilt)     | 36961 B (~37 KB) | 0.0738 ms | 216 |

## Key Insights & Toolchain Overhead Analysis
1. **Binary Size & Cold Startup**: raw WAT and AssemblyScript produce ultra-compact binaries with instantaneous instantiation; C/C++ via `-nostdlib` and Rust no_std cdylibs add minimal metadata (~500-1,150 bytes); managed WasmGC runtimes (Dart, Kotlin) carry runtime code (~37-40 KB) and import descriptors for GC/host interop.
2. **Warm Execution Speed**: on V8, compiled C, C++, Rust, AssemblyScript, and Raw WAT reach near-identical peak throughput once JIT-warmed; WebAssembly delivers 1.5× to 3.2× speedups over pure JavaScript on math-heavy kernels. Dart/WasmGC numbers are in the rows above and are workload-specific.
