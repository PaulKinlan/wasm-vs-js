// audio_dsp_kernel.rs — multilang compute core for audio.webaudio-effects.v1.

#![no_std]
#![no_main]
#![allow(static_mut_refs)]

const FRAMES: usize = 48000;
const BLOCK_FRAMES: usize = 128;
const IR_LENGTH: usize = 16;
const OUTPUT_FRAMES: usize = 48015;

const OUTPUT_OFFSET: usize = 2097152;
const RES_OFFSET: usize = 3145728;

const B0: f32 = 0.206572083826147;
const B1: f32 = 0.413144167652294;
const B2: f32 = 0.206572083826147;
const A1: f32 = -0.369527377351241;
const A2: f32 = 0.195815712655833;

const THRESHOLD: f32 = 0.25;
const KNEE: f32 = 0.1;
const RATIO_RECIPROCAL: f32 = 0.25;
const ATTACK: f32 = 0.9;
const RELEASE: f32 = 0.9995;

const IR: [f32; 16] = [
    0.625, -0.1875, 0.140625, 0.10546875, -0.0791015625, 0.059326171875, -0.04449462890625,
    0.0333709716796875, -0.025028228759765625, 0.01877117156982422, -0.014078378677368164,
    0.010558784008026123, -0.007919088006019592, 0.005939316004514694, -0.004454487003386021,
    0.0033408652525395155,
];

#[derive(Default, Clone)]
struct ChannelState {
    z1: f32,
    z2: f32,
    envelope: f32,
    history: [f32; IR_LENGTH],
    cursor: usize,
}

fn f_abs(x: f32) -> f32 {
    let mut bits = x.to_bits();
    bits &= 0x7fffffff;
    f32::from_bits(bits)
}

fn compressor_gain(envelope: f32) -> f32 {
    let half = KNEE * 0.5;
    let low = THRESHOLD - half;
    let high = THRESHOLD + half;
    if envelope <= low {
        return 1.0;
    }
    
    let over = envelope - THRESHOLD;
    let target = THRESHOLD + (over * RATIO_RECIPROCAL);
    let hard_gain = target / envelope;
    if envelope >= high {
        return hard_gain;
    }
    
    let t = (envelope - low) / KNEE;
    let mix = t * t;
    let effective = envelope + (mix * (target - envelope));
    effective / envelope
}

fn convolve_sample(compressed: f32, output: &mut [f32], out_idx: usize, state: &mut ChannelState) {
    state.history[state.cursor] = compressed;
    let mut sum = 0.0f32;
    let mut hist_idx = state.cursor;
    for tap in 0..IR_LENGTH {
        sum += state.history[hist_idx] * IR[tap];
        hist_idx = if hist_idx == 0 { IR_LENGTH - 1 } else { hist_idx - 1 };
    }
    output[out_idx] = sum;
    state.cursor += 1;
    if state.cursor == IR_LENGTH {
        state.cursor = 0;
    }
}

fn process_block(input: &[f32], offset: usize, frames: usize, output: &mut [f32], state: &mut ChannelState) {
    for i in 0..frames {
        let sample = input[offset + i];
        let filtered = (B0 * sample) + state.z1;
        state.z1 = ((B1 * sample) - (A1 * filtered)) + state.z2;
        state.z2 = (B2 * sample) - (A2 * filtered);
        
        let magnitude = f_abs(filtered);
        let coefficient = if magnitude > state.envelope { ATTACK } else { RELEASE };
        state.envelope = (coefficient * state.envelope) + ((1.0 - coefficient) * magnitude);
        
        let gain = compressor_gain(state.envelope);
        convolve_sample(filtered * gain, output, offset + i, state);
    }
}

static mut LEFT_IN: [f32; FRAMES] = [0.0; FRAMES];
static mut RIGHT_IN: [f32; FRAMES] = [0.0; FRAMES];
static mut LEFT_OUT: [f32; OUTPUT_FRAMES] = [0.0; OUTPUT_FRAMES];
static mut RIGHT_OUT: [f32; OUTPUT_FRAMES] = [0.0; OUTPUT_FRAMES];

#[no_mangle]
pub extern "C" fn audio_dsp() -> u32 {
    unsafe {
        let results = core::slice::from_raw_parts_mut(RES_OFFSET as *mut u32, 5);
        results[0] = 0; // blockInvocations
        results[1] = 0; // stateCarryBoundaries
        results[2] = 0; // tailFlushInvocations
        results[3] = 0; // tailFlushFrames
        
        LEFT_IN[0] = 1.0;
        RIGHT_IN[0] = -0.75;
        for i in 1..FRAMES {
            if i < 12000 {
                LEFT_IN[i] = 0.10000000149011612;
                RIGHT_IN[i] = -0.07500000298023224;
            } else if i < 24000 {
                LEFT_IN[i] = 0.25;
                RIGHT_IN[i] = -0.1875;
            } else if i < 36000 {
                LEFT_IN[i] = 0.30000001192092896;
                RIGHT_IN[i] = -0.22499999403953552;
            } else {
                LEFT_IN[i] = -0.20000000298023224;
                RIGHT_IN[i] = 0.15000000596046448;
            }
        }
        
        let mut state_l = ChannelState::default();
        let mut blocks = 0;
        let mut offset = 0;
        while offset < FRAMES {
            let frames = if FRAMES - offset > BLOCK_FRAMES { BLOCK_FRAMES } else { FRAMES - offset };
            if blocks > 0 { results[1] += 1; }
            process_block(&LEFT_IN, offset, frames, &mut LEFT_OUT, &mut state_l);
            blocks += 1;
            results[0] += 1;
            offset += BLOCK_FRAMES;
        }
        for tail in 0..(IR_LENGTH - 1) {
            convolve_sample(0.0, &mut LEFT_OUT, FRAMES + tail, &mut state_l);
        }
        results[2] += 1;
        results[3] += (IR_LENGTH - 1) as u32;

        let mut state_r = ChannelState::default();
        blocks = 0;
        offset = 0;
        while offset < FRAMES {
            let frames = if FRAMES - offset > BLOCK_FRAMES { BLOCK_FRAMES } else { FRAMES - offset };
            if blocks > 0 { results[1] += 1; }
            process_block(&RIGHT_IN, offset, frames, &mut RIGHT_OUT, &mut state_r);
            blocks += 1;
            results[0] += 1;
            offset += BLOCK_FRAMES;
        }
        for tail in 0..(IR_LENGTH - 1) {
            convolve_sample(0.0, &mut RIGHT_OUT, FRAMES + tail, &mut state_r);
        }
        results[2] += 1;
        results[3] += (IR_LENGTH - 1) as u32;

        let out_mem = core::slice::from_raw_parts_mut(OUTPUT_OFFSET as *mut f32, OUTPUT_FRAMES * 2);
        for i in 0..OUTPUT_FRAMES {
            let mut l = LEFT_OUT[i];
            if l == -0.0 { l = 0.0; }
            let mut r = RIGHT_OUT[i];
            if r == -0.0 { r = 0.0; }
            out_mem[i * 2] = l;
            out_mem[i * 2 + 1] = r;
        }

        let out_bytes = core::slice::from_raw_parts(OUTPUT_OFFSET as *const u8, OUTPUT_FRAMES * 8);
        let mut fnv: u32 = 0x811c9dc5;
        for i in 0..out_bytes.len() {
            fnv = (fnv ^ (out_bytes[i] as u32)).wrapping_mul(0x01000193);
        }
        results[4] = fnv;
        
        fnv
    }
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
