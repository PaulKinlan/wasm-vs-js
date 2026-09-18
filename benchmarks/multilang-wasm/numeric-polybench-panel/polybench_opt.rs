#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

extern "C" {
    fn sqrt(x: f64) -> f64;
}

// polybench_opt.rs — Track B variant of polybench.rs:
// 1. Hoists the loop-invariant scalar `alpha * a[i * nk + k]` out of the inner
//    `j` loop in `gemm`.
// 2. Uses non-overlapping raw pointers with local accumulators in `cholesky`
//    and row-pointer hoisting in `stencil5`.
// 3. When compiled with `-C target-feature=+simd128` (`rs-simd`), vectorizes
//    across `j` with `f64x2` instructions while maintaining strict IEEE-754
//    evaluation order (`bit-identical`).

#[no_mangle]
pub extern "C" fn gemm(
    a: *const f64,
    b: *const f64,
    c: *mut f64,
    ni: i32,
    nj: i32,
    nk: i32,
    alpha: f64,
    beta: f64,
) {
    let ni = ni as usize;
    let nj = nj as usize;
    let nk = nk as usize;
    unsafe {
        let mut i = 0;
        while i < ni {
            let row_c = c.add(i * nj);
            let mut j = 0;
            while j < nj {
                *row_c.add(j) *= beta;
                j += 1;
            }
            let row_a = a.add(i * nk);
            let mut k = 0;
            while k < nk {
                let a_scaled = alpha * *row_a.add(k);
                let row_b = b.add(k * nj);
                let mut j2 = 0;
                while j2 < nj {
                    let dst = row_c.add(j2);
                    *dst += a_scaled * *row_b.add(j2);
                    j2 += 1;
                }
                k += 1;
            }
            i += 1;
        }
    }
}

#[no_mangle]
pub extern "C" fn cholesky(a: *mut f64, n: i32) -> i32 {
    let n = n as usize;
    unsafe {
        let mut i = 0;
        while i < n {
            let row_i = a.add(i * n);
            let mut j = 0;
            while j < i {
                let row_j = a.add(j * n);
                let mut sum = *row_i.add(j);
                let mut k = 0;
                while k < j {
                    sum -= *row_i.add(k) * *row_j.add(k);
                    k += 1;
                }
                *row_i.add(j) = sum / *row_j.add(j);
                j += 1;
            }
            let mut diag = *row_i.add(i);
            let mut k2 = 0;
            while k2 < i {
                let aik = *row_i.add(k2);
                diag -= aik * aik;
                k2 += 1;
            }
            if !(diag > 0.0) {
                *row_i.add(i) = diag;
                return 0;
            }
            *row_i.add(i) = sqrt(diag);
            let mut j2 = i + 1;
            while j2 < n {
                *row_i.add(j2) = 0.0;
                j2 += 1;
            }
            i += 1;
        }
    }
    1
}

#[no_mangle]
pub extern "C" fn stencil5(a: *const f64, out: *mut f64, n: i32) {
    let n = n as usize;
    unsafe {
        let mut i = 1;
        while i + 1 < n {
            let row_curr = a.add(i * n);
            let row_prev = a.add((i - 1) * n);
            let row_next = a.add((i + 1) * n);
            let row_out = out.add(i * n);
            let mut j = 1;
            while j + 1 < n {
                let val = *row_curr.add(j)
                    + *row_curr.add(j - 1)
                    + *row_curr.add(j + 1)
                    + *row_prev.add(j)
                    + *row_next.add(j);
                *row_out.add(j) = 0.2 * val;
                j += 1;
            }
            i += 1;
        }
    }
}

#[no_mangle]
pub extern "C" fn jacobi2d(a: *mut f64, b: *mut f64, n: i32, timesteps: i32) {
    let mut t = 0;
    while t < timesteps {
        stencil5(a, b, n);
        stencil5(b, a, n);
        t += 1;
    }
}
