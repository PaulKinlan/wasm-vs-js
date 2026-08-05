#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// audio-fir multilang kernel (Rust)
// Mirrors benchmarks/audio-fir/workload.ts direct convolution:
// output[i+j] += input[i] * taps[j]

#[no_mangle]
pub extern "C" fn fir(
    input: *const f32,
    taps: *const f32,
    output: *mut f32,
    input_len: u32,
    taps_len: u32,
) {
    let input_len = input_len as usize;
    let taps_len = taps_len as usize;
    let out_len = input_len + taps_len - 1;
    unsafe {
        for k in 0..out_len {
            *output.add(k) = 0.0;
        }
        for i in 0..input_len {
            let sample = *input.add(i);
            for j in 0..taps_len {
                *output.add(i + j) += sample * *taps.add(j);
            }
        }
    }
}
