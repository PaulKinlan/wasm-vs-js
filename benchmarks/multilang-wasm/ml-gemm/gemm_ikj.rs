#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// gemm_ikj.rs — Track B variant of gemm.rs: loop interchange i/j/k -> i/k/j.
//
// Streams B[t][0..n] contiguously along rows instead of walking columns of B.
// Equivalence: bit-identical (strict f32 ascending t accumulation per cell).

#[no_mangle]
pub extern "C" fn gemm(
    a: *const f32,
    b: *const f32,
    c0: *const f32,
    out: *mut f32,
    m: u32,
    n: u32,
    k: u32,
) {
    let m = m as usize;
    let n = n as usize;
    let k = k as usize;
    unsafe {
        let mut i = 0;
        while i < m {
            let row_out = out.add(i * n);
            let row_c0 = c0.add(i * n);
            let mut j = 0;
            while j < n {
                *row_out.add(j) = *row_c0.add(j);
                j += 1;
            }

            let row_a = a.add(i * k);
            let mut t = 0;
            while t < k {
                let aik = *row_a.add(t);
                let row_b = b.add(t * n);
                let mut j2 = 0;
                while j2 < n {
                    let dst = row_out.add(j2);
                    *dst = *dst + aik * *row_b.add(j2);
                    j2 += 1;
                }
                t += 1;
            }

            let mut j3 = 0;
            while j3 < n {
                let dst = row_out.add(j3);
                *dst = *dst + 0.0;
                j3 += 1;
            }
            i += 1;
        }
    }
}
