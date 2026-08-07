#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// ml-numeric-kernels multilang Rust kernel — mirrors
// benchmarks/base/ml-numeric-kernels/workload.js + the controlled C target
// exactly: GEMM f32/i8, Conv f32/i8, Softmax f32/i8 on the frozen shapes
// (GEMM 8x7x9, CONV 8x8x3->4 k3/s1/p1, SOFTMAX 8x16). Rust f32 arithmetic
// rounds to f32 after every op (wasm f32.add/f32.mul), bit-identical to the
// JS Math.fround formulation. i8/i32/u8 ops are exact.

const GEMM_M: u32 = 8;
const GEMM_N: u32 = 7;
const GEMM_K: u32 = 9;
const CONV_H: u32 = 8;
const CONV_W: u32 = 8;
const CONV_IN: u32 = 3;
const CONV_OUT: u32 = 4;
const CONV_K: u32 = 3;
const SM_ROWS: u32 = 8;
const SM_COLS: u32 = 16;

fn finite_f32(value: f32) -> bool {
    let bits = value.to_bits();
    (bits & 0x7f80_0000) != 0x7f80_0000
}

#[inline(never)]
#[no_mangle]
pub extern "C" fn gemm_f32(a: *const f32, b: *const f32, out: *mut f32) -> i32 {
    // SAFETY: caller provides m*k / k*n / m*n buffers per the frozen shapes.
    unsafe {
        for x in 0..(GEMM_M * GEMM_K) as usize {
            if !finite_f32(*a.add(x)) {
                return 1;
            }
        }
        for x in 0..(GEMM_K * GEMM_N) as usize {
            if !finite_f32(*b.add(x)) {
                return 1;
            }
        }
        for i in 0..GEMM_M {
            for j in 0..GEMM_N {
                let mut acc: f32 = 0.0;
                for k in 0..GEMM_K {
                    acc += *a.add((i * GEMM_K + k) as usize) * *b.add((k * GEMM_N + j) as usize);
                }
                *out.add((i * GEMM_N + j) as usize) = acc + 0.0;
            }
        }
        0
    }
}

#[no_mangle]
pub extern "C" fn gemm_i8(a: *const i8, b: *const i8, out: *mut i32) {
    // SAFETY: caller provides m*k / k*n / m*n buffers per the frozen shapes.
    unsafe {
        for i in 0..GEMM_M {
            for j in 0..GEMM_N {
                let mut acc: i32 = 0;
                for k in 0..GEMM_K {
                    acc += *a.add((i * GEMM_K + k) as usize) as i32
                        * *b.add((k * GEMM_N + j) as usize) as i32;
                }
                *out.add((i * GEMM_N + j) as usize) = acc;
            }
        }
    }
}

fn input_index(y: u32, x: u32, c: u32) -> usize {
    ((y * CONV_W + x) * CONV_IN + c) as usize
}
fn weight_index(ky: u32, kx: u32, c: u32, o: u32) -> usize {
    (((ky * CONV_K + kx) * CONV_IN + c) * CONV_OUT + o) as usize
}

#[no_mangle]
pub extern "C" fn conv_f32(input: *const f32, weights: *const f32, out: *mut f32) -> i32 {
    // SAFETY: caller provides the frozen CONV buffers.
    unsafe {
        for x in 0..(CONV_H * CONV_W * CONV_IN) as usize {
            if !finite_f32(*input.add(x)) {
                return 1;
            }
        }
        for x in 0..(CONV_K * CONV_K * CONV_IN * CONV_OUT) as usize {
            if !finite_f32(*weights.add(x)) {
                return 1;
            }
        }
        for y in 0..CONV_H {
            for x in 0..CONV_W {
                for o in 0..CONV_OUT {
                    let mut acc: f32 = 0.0;
                    for ky in 0..CONV_K {
                        for kx in 0..CONV_K {
                            let iy = y as i32 + ky as i32 - 1;
                            let ix = x as i32 + kx as i32 - 1;
                            if iy < 0 || ix < 0 || iy >= CONV_H as i32 || ix >= CONV_W as i32 {
                                continue;
                            }
                            for c in 0..CONV_IN {
                                acc += *input.add(input_index(iy as u32, ix as u32, c))
                                    * *weights.add(weight_index(ky, kx, c, o));
                            }
                        }
                    }
                    *out.add(((y * CONV_W + x) * CONV_OUT + o) as usize) = acc + 0.0;
                }
            }
        }
        0
    }
}

#[no_mangle]
pub extern "C" fn conv_i8(input: *const i8, weights: *const i8, out: *mut i32) {
    // SAFETY: caller provides the frozen CONV buffers.
    unsafe {
        for y in 0..CONV_H {
            for x in 0..CONV_W {
                for o in 0..CONV_OUT {
                    let mut acc: i32 = 0;
                    for ky in 0..CONV_K {
                        for kx in 0..CONV_K {
                            let iy = y as i32 + ky as i32 - 1;
                            let ix = x as i32 + kx as i32 - 1;
                            if iy < 0 || ix < 0 || iy >= CONV_H as i32 || ix >= CONV_W as i32 {
                                continue;
                            }
                            for c in 0..CONV_IN {
                                acc += *input.add(input_index(iy as u32, ix as u32, c)) as i32
                                    * *weights.add(weight_index(ky, kx, c, o)) as i32;
                            }
                        }
                    }
                    *out.add(((y * CONV_W + x) * CONV_OUT + o) as usize) = acc;
                }
            }
        }
    }
}

fn exp_approx(value: f32) -> f32 {
    let x = if value < -8.0 { -8.0 } else if value > 0.0 { 0.0 } else { value };
    let mut y = 1.0 + x / 256.0;
    for _ in 0..8 {
        y = y * y;
    }
    y
}

#[no_mangle]
pub extern "C" fn softmax_f32(input: *const f32, out: *mut f32) -> i32 {
    // SAFETY: caller provides the frozen SOFTMAX buffers.
    unsafe {
        for x in 0..(SM_ROWS * SM_COLS) as usize {
            if !finite_f32(*input.add(x)) {
                return 1;
            }
        }
        for r in 0..SM_ROWS {
            let base = (r * SM_COLS) as usize;
            let mut max = *input.add(base);
            for c in 1..SM_COLS {
                if *input.add(base + c as usize) > max {
                    max = *input.add(base + c as usize);
                }
            }
            let mut sum: f32 = 0.0;
            for c in 0..SM_COLS {
                let e = exp_approx(*input.add(base + c as usize) - max);
                *out.add(base + c as usize) = e;
                sum += e;
            }
            for c in 0..SM_COLS {
                *out.add(base + c as usize) = *out.add(base + c as usize) / sum + 0.0;
            }
        }
        0
    }
}

const LUT: [i32; 9] = [256, 94, 35, 13, 5, 2, 1, 0, 0];

#[no_mangle]
pub extern "C" fn softmax_i8(input: *const i8, out: *mut u8) {
    // SAFETY: caller provides the frozen SOFTMAX buffers.
    unsafe {
        for r in 0..SM_ROWS {
            let base = (r * SM_COLS) as usize;
            let mut max = *input.add(base) as i32;
            let mut max_index = 0u32;
            for c in 1..SM_COLS {
                let v = *input.add(base + c as usize) as i32;
                if v > max {
                    max = v;
                    max_index = c;
                }
            }
            let mut sum = 0i32;
            for c in 0..SM_COLS {
                let mut d = max - *input.add(base + c as usize) as i32;
                if d > 8 {
                    d = 8;
                }
                sum += LUT[d as usize];
            }
            let mut quantized = 0i32;
            for c in 0..SM_COLS {
                let mut d = max - *input.add(base + c as usize) as i32;
                if d > 8 {
                    d = 8;
                }
                let q = (LUT[d as usize] * 255 + sum / 2) / sum;
                *out.add(base + c as usize) = q as u8;
                quantized += q;
            }
            let o = *out.add(base + max_index as usize) as i32 + 255 - quantized;
            *out.add(base + max_index as usize) = o as u8;
        }
    }
}
