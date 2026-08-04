#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// Mirrors benchmarks/multilang-wasm/fft_kernel.c exactly: same custom
// polynomial sin/cos approximation (wasm32 has no hardware trig), same
// butterfly schedule, same f32 arithmetic order.
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 2.0 * PI;
const HALF_PI: f32 = 1.57079632679489661923;

fn sinf_custom(x: f32) -> f32 {
    let mut x = x;
    while x > PI {
        x -= TWO_PI;
    }
    while x < -PI {
        x += TWO_PI;
    }
    let x2 = x * x;
    let x3 = x * x2;
    let x5 = x3 * x2;
    let x7 = x5 * x2;
    x - (x3 / 6.0) + (x5 / 120.0) - (x7 / 5040.0)
}

fn cosf_custom(x: f32) -> f32 {
    sinf_custom(x + HALF_PI)
}

#[no_mangle]
pub extern "C" fn fft_butterfly(real: *mut f32, imag: *mut f32, len: u32) {
    let mut step: u32 = 1;
    while step < len {
        let angle = -PI / step as f32;
        let w_real = cosf_custom(angle);
        let w_imag = sinf_custom(angle);
        let mut i: u32 = 0;
        while i < len {
            let mut cur_w_real: f32 = 1.0;
            let mut cur_w_imag: f32 = 0.0;
            let mut j: u32 = 0;
            while j < step {
                let u = (i + j) as usize;
                let v = (i + j + step) as usize;
                // SAFETY: caller provides valid real/imag buffers of len elements;
                // every index used here is < len by the same loop bounds as C.
                unsafe {
                    let tr = *real.add(v) * cur_w_real - *imag.add(v) * cur_w_imag;
                    let ti = *real.add(v) * cur_w_imag + *imag.add(v) * cur_w_real;
                    *real.add(v) = *real.add(u) - tr;
                    *imag.add(v) = *imag.add(u) - ti;
                    *real.add(u) = *real.add(u) + tr;
                    *imag.add(u) = *imag.add(u) + ti;
                }
                let next_w_real = cur_w_real * w_real - cur_w_imag * w_imag;
                let next_w_imag = cur_w_real * w_imag + cur_w_imag * w_real;
                cur_w_real = next_w_real;
                cur_w_imag = next_w_imag;
                j += 1;
            }
            i += step << 1;
        }
        step <<= 1;
    }
}
