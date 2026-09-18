#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// gemm_tiled.rs — Track B variant of gemm.rs: 32x32 i/j panel cache blocking.
//
// Blocks i and j into 32x32 panels while leaving the inner k reduction intact.
// Equivalence: bit-identical (strict f32 ascending t accumulation per cell).

const TILE: usize = 32;

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
        let mut ii = 0;
        while ii < m {
            let i_max = if ii + TILE < m { ii + TILE } else { m };
            let mut jj = 0;
            while jj < n {
                let j_max = if jj + TILE < n { jj + TILE } else { n };
                let mut i = ii;
                while i < i_max {
                    let row_a = a.add(i * k);
                    let mut j = jj;
                    while j < j_max {
                        let mut acc = *c0.add(i * n + j);
                        let mut t = 0;
                        while t < k {
                            acc += *row_a.add(t) * *b.add(t * n + j);
                            t += 1;
                        }
                        *out.add(i * n + j) = acc + 0.0;
                        j += 1;
                    }
                    i += 1;
                }
                jj += TILE;
            }
            ii += TILE;
        }
    }
}
