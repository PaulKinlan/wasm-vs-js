#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// ml-dense-mlp multilang kernel — exact mirror of the C mlp_forward: strict
// f32 linear layers, frozen f64 GELU-tanh (frozenExp/frozenTanh from
// frozen-transcendentals.js with identical IEEE-754 double operation order),
// ping-pong scratch, final projection without activation.

const LN2: f64 = 0.6931471805599453;
const EXP_COEFFS: [f64; 13] = [
    1.0, 1.0, 0.5, 0.16666666666666666, 0.041666666666666664,
    0.008333333333333333, 0.001388888888888889, 0.0001984126984126984,
    0.0000248015873015873, 0.0000027557319223985893,
    0.0000002755731922398589, 0.000000025052108385441718,
    0.00000000208767569878681,
];

#[inline(always)]
fn pow2_exact(k: i32) -> f64 {
    // f64 bits = ((k + 1023) << 52): k=1024 yields exponent field 2047 = +Inf.
    let bits: u64 = ((k + 1023) as u64) << 52;
    f64::from_bits(bits)
}

#[inline(always)]
fn frozen_exp(x: f64) -> f64 {
    if x.is_nan() {
        return x;
    }
    if x > 709.7827 {
        return f64::INFINITY;
    }
    if x < -708.39 {
        return 0.0;
    }
    // floor via trunc + adjust (exact for |v| < 2^53; reachable range is tiny)
    let v = x / LN2 + 0.5;
    let t = v as i64 as f64;
    let k = if v < t { t - 1.0 } else { t };
    let r = x - k * LN2;
    let mut p = EXP_COEFFS[12];
    let mut i = 11i32;
    while i >= 0 {
        p = p * r + EXP_COEFFS[i as usize];
        i -= 1;
    }
    p * pow2_exact(k as i32)
}

#[inline(always)]
fn frozen_tanh(x: f64) -> f64 {
    if x.is_nan() {
        return x;
    }
    if x >= 9.011 {
        return 1.0;
    }
    if x <= -9.011 {
        return -1.0;
    }
    1.0 - 2.0 / (frozen_exp(2.0 * x) + 1.0)
}

#[inline(always)]
fn gelu_frozen_f64(p: f64) -> f64 {
    let inner = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
    0.5 * p * (1.0 + frozen_tanh(inner))
}

fn linear_layer_f32(
    x: *const f32, w: *const f32, bias: *const f32, y: *mut f32,
    batch: u32, width: u32, w_off: u32, bias_off: u32,
) {
    unsafe {
    for bi in 0..batch {
        for o in 0..width {
            let mut acc = *bias.add((bias_off + o) as usize);
            for i in 0..width {
                acc += *x.add((bi * width + i) as usize) * *w.add((w_off + i * width + o) as usize);
            }
            *y.add((bi * width + o) as usize) = acc + 0.0; // normalize -0 to +0
        }
    }
    }
}

fn gelu_in_place(buffer: *mut f32, len: u32) {
    unsafe {
        for index in 0..len {
            *buffer.add(index as usize) = gelu_frozen_f64(*buffer.add(index as usize) as f64) as f32 + 0.0;
        }
    }
}

#[no_mangle]
pub extern "C" fn mlp_forward(
    x: *const f32, w: *const f32, bias: *const f32,
    scratch_a: *mut f32, scratch_b: *mut f32, y: *mut f32,
    batch: u32, width: u32, hidden_layers: u32,
) {
    unsafe {
        let layers = hidden_layers + 1;
        let mut input = x;
        for layer in 0..layers {
            let out = if layer == layers - 1 {
                y
            } else if layer % 2 == 0 {
                scratch_a
            } else {
                scratch_b
            };
            linear_layer_f32(input, w, bias, out, batch, width,
                             layer * width * width, layer * width);
            if layer < layers - 1 {
                gelu_in_place(out, batch * width);
            }
            input = out;
        }
    }
}
