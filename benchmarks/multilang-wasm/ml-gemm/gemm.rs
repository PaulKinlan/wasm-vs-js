#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// ml-gemm multilang kernel — mirrors benchmarks/v2/ml-gemm/workload.js:
// C = C0 + A * B, strict f32 left-to-right accumulation in frozen i/j/k order.
// Rust f32 arithmetic rounds to f32 after every op (wasm f32.add/f32.mul),
// bit-identical to the JS Math.fround formulation.

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
    for i in 0..m {
        for j in 0..n {
            // SAFETY: caller provides m*n c0/out and m*k / k*n a/b buffers.
            unsafe {
                let mut acc = *c0.add((i * n + j) as usize);
                for t in 0..k {
                    acc += *a.add((i * k + t) as usize) * *b.add((t * n + j) as usize);
                }
                // "acc + 0.0" normalizes -0 to +0, matching the JS oracle's "acc + 0".
                *out.add((i * n + j) as usize) = acc + 0.0;
            }
        }
    }
}
