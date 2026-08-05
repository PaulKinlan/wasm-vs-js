#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// audio-stft multilang kernel (Rust)
// Mirrors benchmarks/audio-stft/workload.ts stftInto:
// Windowing + Radix-2 FFT over overlapping frames into spectrogram buffer.

fn fft_radix2(data: &mut [f32], n: usize, twiddle: &[f32]) {
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while (j & bit) != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            let ri = i * 2;
            let rj = j * 2;
            data.swap(ri, rj);
            data.swap(ri + 1, rj + 1);
        }
    }
    let mut tw_idx = 0;
    let mut len = 2;
    while len <= n {
        let half_len = len >> 1;
        let mut i = 0;
        while i < n {
            let mut tw = tw_idx;
            for jj in 0..half_len {
                let w_cos = twiddle[tw];
                let w_sin = twiddle[tw + 1];
                tw += 2;
                let even_idx = (i + jj) * 2;
                let odd_idx = (i + jj + half_len) * 2;
                let even_re = data[even_idx];
                let even_im = data[even_idx + 1];
                let odd_re = data[odd_idx];
                let odd_im = data[odd_idx + 1];
                let t_re = w_cos * odd_re - w_sin * odd_im;
                let t_im = w_cos * odd_im + w_sin * odd_re;
                data[even_idx] = even_re + t_re;
                data[even_idx + 1] = even_im + t_im;
                data[odd_idx] = even_re - t_re;
                data[odd_idx + 1] = even_im - t_im;
            }
            i += len;
        }
        tw_idx += half_len * 2;
        len <<= 1;
    }
}

#[no_mangle]
pub extern "C" fn stft(
    input: *const f32,
    input_len: u32,
    frame_size: u32,
    hop_size: u32,
    window: *const f32,
    twiddle: *const f32,
    scratch: *mut f32,
    spectrogram: *mut f32,
) {
    let input_len = input_len as usize;
    let frame_size = frame_size as usize;
    let hop_size = hop_size as usize;
    let num_frames = 1 + (input_len - frame_size) / hop_size;

    unsafe {
        let input_slice = core::slice::from_raw_parts(input, input_len);
        let window_slice = core::slice::from_raw_parts(window, frame_size);
        let twiddle_slice = core::slice::from_raw_parts(twiddle, (frame_size - 1) * 2);
        let scratch_slice = core::slice::from_raw_parts_mut(scratch, frame_size * 2);
        let spec_slice = core::slice::from_raw_parts_mut(spectrogram, num_frames * frame_size * 2);

        for frame in 0..num_frames {
            let offset = frame * hop_size;
            for i in 0..frame_size {
                scratch_slice[i * 2] = input_slice[offset + i] * window_slice[i];
                scratch_slice[i * 2 + 1] = 0.0;
            }
            fft_radix2(scratch_slice, frame_size, twiddle_slice);
            let spec_offset = frame * frame_size * 2;
            spec_slice[spec_offset..(spec_offset + frame_size * 2)]
                .copy_from_slice(&scratch_slice[..frame_size * 2]);
        }
    }
}
