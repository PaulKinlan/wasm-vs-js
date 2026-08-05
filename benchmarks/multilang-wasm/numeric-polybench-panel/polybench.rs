#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

extern "C" {
    fn sqrt(x: f64) -> f64;
}

// numeric-polybench-panel multilang kernel (Rust)
// Mirrors benchmarks/base/numeric-polybench-panel/workload.js & WAT/reference.c:
// 4 kernels: gemm, cholesky, stencil5, jacobi2d operating on double precision (f64).

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
        for i in 0..ni {
            for j in 0..nj {
                *c.add(i * nj + j) *= beta;
            }
            for k in 0..nk {
                let aik = *a.add(i * nk + k);
                for j in 0..nj {
                    *c.add(i * nj + j) += alpha * aik * *b.add(k * nj + j);
                }
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn cholesky(a: *mut f64, n: i32) -> i32 {
    let n = n as usize;
    unsafe {
        for i in 0..n {
            for j in 0..i {
                for k in 0..j {
                    let aik = *a.add(i * n + k);
                    let ajk = *a.add(j * n + k);
                    *a.add(i * n + j) -= aik * ajk;
                }
                let ajj = *a.add(j * n + j);
                *a.add(i * n + j) /= ajj;
            }
            for k in 0..i {
                let aik = *a.add(i * n + k);
                *a.add(i * n + i) -= aik * aik;
            }
            let aii = *a.add(i * n + i);
            if !(aii > 0.0) {
                return 0;
            }
            *a.add(i * n + i) = sqrt(aii);
            for j in (i + 1)..n {
                *a.add(i * n + j) = 0.0;
            }
        }
    }
    1
}

#[no_mangle]
pub extern "C" fn stencil5(a: *const f64, out: *mut f64, n: i32) {
    let n = n as usize;
    unsafe {
        for i in 1..(n - 1) {
            for j in 1..(n - 1) {
                let p = i * n + j;
                let val = *a.add(p) + *a.add(p - 1) + *a.add(p + 1) + *a.add(p - n) + *a.add(p + n);
                *out.add(p) = 0.2 * val;
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn jacobi2d(a: *mut f64, b: *mut f64, n: i32, timesteps: i32) {
    for _ in 0..timesteps {
        stencil5(a, b, n);
        stencil5(b, a, n);
    }
}
