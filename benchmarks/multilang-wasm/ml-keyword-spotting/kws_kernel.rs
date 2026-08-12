#![no_std]
#![no_main]

mod constants;
use constants::*;

const HOP_SAMPLES: usize = 320;
const WINDOW_SAMPLES: usize = 480;
const FFT_SIZE: usize = 512;
const HOPS: usize = 300;
const FEATURES: usize = 10;
const CONTEXT: usize = 49;
const CHANNELS: usize = 8;
const CLASSES: usize = 12;
const ROWS: usize = 25;
const COLUMNS: usize = 5;
const ELEMENTS: usize = ROWS * COLUMNS;

const PCM_OFFSET: usize = 1048576;
const FEATURES_OFFSET: usize = 4194304;
const SCORES_OFFSET: usize = 5242880;
const RESULTS_OFFSET: usize = 6291456;

static mut RE_BUF: [i32; FFT_SIZE] = [0; FFT_SIZE];
static mut IM_BUF: [i32; FFT_SIZE] = [0; FFT_SIZE];
static mut BANDS: [i32; FEATURES] = [0; FEATURES];
static mut CONTEXT_BUF: [i8; CONTEXT * FEATURES] = [0; CONTEXT * FEATURES];
static mut LAYER_A: [i8; ELEMENTS * CHANNELS] = [0; ELEMENTS * CHANNELS];
static mut LAYER_B: [i8; ELEMENTS * CHANNELS] = [0; ELEMENTS * CHANNELS];
static mut DETECTION_COUNT_VALUE: i32 = 0;

fn abs32(x: i32) -> i32 {
    if x < 0 { -x } else { x }
}

fn clamp_i8(x: i64, relu: bool) -> i32 {
    let low = if relu { 0 } else { -128 };
    if x < low { low as i32 } else if x > 127 { 127 } else { x as i32 }
}

fn round_div_i64(value: i64, divisor: i64) -> i64 {
    if value >= 0 {
        (value + divisor / 2) / divisor
    } else {
        -((-value + divisor / 2) / divisor)
    }
}

fn requantize(accumulator: i32, multiplier: i64, relu: bool) -> i8 {
    clamp_i8(round_div_i64(accumulator as i64 * multiplier, 16777216), relu) as i8
}

fn ilog2_u32(mut x: u32) -> i32 {
    let mut n = 0;
    while x > 1 {
        x >>= 1;
        n += 1;
    }
    n
}

fn bit_reverse9(mut x: u32) -> u32 {
    let mut r = 0;
    for _ in 0..9 {
        r = (r << 1) | (x & 1);
        x >>= 1;
    }
    r
}

unsafe fn feature_for_hop(hop: usize, out: &mut [i8]) {
    let pcm = core::slice::from_raw_parts(PCM_OFFSET as *const i16, 960000);
    let base = hop * HOP_SAMPLES;
    for i in 0..FFT_SIZE {
        let source = base + i;
        RE_BUF[i] = if i < WINDOW_SAMPLES && source < 960000 {
            ((pcm[source] as i32 * KWS_WINDOW_Q15[i] as i32) >> 15) as i32
        } else {
            0
        };
        IM_BUF[i] = 0;
    }

    for i in 0..FFT_SIZE {
        let j = bit_reverse9(i as u32) as usize;
        if j > i {
            let tr = RE_BUF[i]; RE_BUF[i] = RE_BUF[j]; RE_BUF[j] = tr;
            let ti = IM_BUF[i]; IM_BUF[i] = IM_BUF[j]; IM_BUF[j] = ti;
        }
    }
    let mut length = 2;
    while length <= FFT_SIZE {
        let half = length >> 1;
        let twiddle_step = FFT_SIZE / length;
        let mut start = 0;
        while start < FFT_SIZE {
            for offset in 0..half {
                let twiddle = offset * twiddle_step;
                let br = RE_BUF[start + offset + half];
                let bi = IM_BUF[start + offset + half];
                let wr = KWS_TWIDDLE_REAL_Q15[twiddle] as i32;
                let wi = KWS_TWIDDLE_IMAG_Q15[twiddle] as i32;
                let tr = ((br as i64 * wr as i64 - bi as i64 * wi as i64) >> 15) as i32;
                let ti = ((br as i64 * wi as i64 + bi as i64 * wr as i64) >> 15) as i32;
                let ar = RE_BUF[start + offset];
                let ai = IM_BUF[start + offset];
                RE_BUF[start + offset] = (ar + tr) >> 1;
                IM_BUF[start + offset] = (ai + ti) >> 1;
                RE_BUF[start + offset + half] = (ar - tr) >> 1;
                IM_BUF[start + offset + half] = (ai - ti) >> 1;
            }
            start += length;
        }
        length <<= 1;
    }
    for band in 0..FEATURES {
        let begin = 1 + (band * 256) / FEATURES;
        let end = 1 + ((band + 1) * 256) / FEATURES;
        let mut sum: u32 = 1;
        for bin in begin..end {
            sum += (abs32(RE_BUF[bin]) + abs32(IM_BUF[bin])) as u32;
        }
        BANDS[band] = ilog2_u32(sum);
    }
    for coefficient in 0..FEATURES {
        let mut sum = 0;
        for band in 0..FEATURES {
            sum += BANDS[band] * KWS_DCT_Q15[coefficient * FEATURES + band] as i32;
        }
        let raw = clamp_i8(sum as i64 >> 13, false);
        out[coefficient] = KWS_NORMALIZATION_I8[(coefficient as i32 * 256 + raw + 128) as usize];
    }
}

unsafe fn model_input(hop: i32, row: i32, column: i32) -> i8 {
    if row < 0 || row >= CONTEXT as i32 || column < 0 || column >= FEATURES as i32 { return 0; }
    let source_hop = hop - (CONTEXT as i32 - 1 - row);
    if source_hop < 0 { 0 } else { CONTEXT_BUF[(source_hop as usize % CONTEXT) * FEATURES + column as usize] }
}

unsafe fn infer_hop(hop: usize, feature: &[i8], scores: &mut [i32]) {
    let context_offset = (hop % CONTEXT) * FEATURES;
    for f in 0..FEATURES {
        CONTEXT_BUF[context_offset + f] = feature[f];
    }
    for row in 0..ROWS {
        for column in 0..COLUMNS {
            for output_channel in 0..CHANNELS {
                let mut accumulator = KWS_CONV0_BIASES[output_channel];
                let weight_base = output_channel * 40;
                for kernel_row in 0..10 {
                    for kernel_column in 0..4 {
                        let input = model_input(hop as i32, row as i32 * 2 + kernel_row - 4, column as i32 * 2 + kernel_column - 1);
                        accumulator += input as i32 * KWS_CONV0_WEIGHTS[weight_base + kernel_row as usize * 4 + kernel_column as usize] as i32;
                    }
                }
                LAYER_A[(row * COLUMNS + column) * CHANNELS + output_channel] = requantize(accumulator, KWS_CONV0_MULTIPLIER_Q24, true);
            }
        }
    }
    
    let depthwise_weights = [&KWS_DW0_WEIGHTS[..], &KWS_DW1_WEIGHTS[..], &KWS_DW2_WEIGHTS[..], &KWS_DW3_WEIGHTS[..]];
    let depthwise_biases = [&KWS_DW0_BIASES[..], &KWS_DW1_BIASES[..], &KWS_DW2_BIASES[..], &KWS_DW3_BIASES[..]];
    let depthwise_multipliers = [KWS_DW0_MULTIPLIER_Q24, KWS_DW1_MULTIPLIER_Q24, KWS_DW2_MULTIPLIER_Q24, KWS_DW3_MULTIPLIER_Q24];
    
    let pointwise_weights = [&KWS_PW0_WEIGHTS[..], &KWS_PW1_WEIGHTS[..], &KWS_PW2_WEIGHTS[..], &KWS_PW3_WEIGHTS[..]];
    let pointwise_biases = [&KWS_PW0_BIASES[..], &KWS_PW1_BIASES[..], &KWS_PW2_BIASES[..], &KWS_PW3_BIASES[..]];
    let pointwise_multipliers = [KWS_PW0_MULTIPLIER_Q24, KWS_PW1_MULTIPLIER_Q24, KWS_PW2_MULTIPLIER_Q24, KWS_PW3_MULTIPLIER_Q24];
    
    for block in 0..4 {
        for row in 0..ROWS {
            for column in 0..COLUMNS {
                for channel in 0..CHANNELS {
                    let mut accumulator = depthwise_biases[block][channel];
                    for kernel_row in 0..3 {
                        let source_row = row as i32 + kernel_row - 1;
                        for kernel_column in 0..3 {
                            let source_column = column as i32 + kernel_column - 1;
                            if source_row >= 0 && source_row < ROWS as i32 && source_column >= 0 && source_column < COLUMNS as i32 {
                                accumulator += LAYER_A[(source_row as usize * COLUMNS + source_column as usize) * CHANNELS + channel] as i32 *
                                    depthwise_weights[block][channel * 9 + kernel_row as usize * 3 + kernel_column as usize] as i32;
                            }
                        }
                    }
                    LAYER_B[(row * COLUMNS + column) * CHANNELS + channel] = requantize(accumulator, depthwise_multipliers[block], false);
                }
            }
        }
        for element in 0..ELEMENTS {
            for output_channel in 0..CHANNELS {
                let mut accumulator = pointwise_biases[block][output_channel];
                for input_channel in 0..CHANNELS {
                    accumulator += LAYER_B[element * CHANNELS + input_channel] as i32 * pointwise_weights[block][output_channel * CHANNELS + input_channel] as i32;
                }
                LAYER_A[element * CHANNELS + output_channel] = requantize(accumulator, pointwise_multipliers[block], true);
            }
        }
    }
    
    for class_index in 0..CLASSES {
        let mut accumulator = KWS_DENSE_BIASES[class_index];
        for channel in 0..CHANNELS {
            let mut sum = 0;
            for element in 0..ELEMENTS {
                sum += LAYER_A[element * CHANNELS + channel] as i32;
            }
            accumulator += round_div_i64(sum as i64, ELEMENTS as i64) as i32 * KWS_DENSE_WEIGHTS[class_index * CHANNELS + channel] as i32;
        }
        scores[class_index] = accumulator;
    }
}

fn fnv1a(data: &[u8]) -> u32 {
    let mut hash: u32 = 0x811c9dc5;
    for &byte in data {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    hash
}

#[no_mangle]
pub extern "C" fn kws_run() -> i32 {
    unsafe {
        DETECTION_COUNT_VALUE = 0;
        for i in 0..CONTEXT * FEATURES {
            CONTEXT_BUF[i] = 0;
        }
        
        let all_features = core::slice::from_raw_parts_mut(FEATURES_OFFSET as *mut i8, HOPS * FEATURES);
        let all_scores = core::slice::from_raw_parts_mut(SCORES_OFFSET as *mut i32, HOPS * CLASSES);
        let detections = core::slice::from_raw_parts_mut(RESULTS_OFFSET as *mut u32, 256 * 3);
        
        let mut accepted = 10;
        let mut candidate = 10;
        let mut candidate_count = 0;
        
        for hop in 0..HOPS {
            let feature = &mut all_features[hop * FEATURES..(hop + 1) * FEATURES];
            let scores = &mut all_scores[hop * CLASSES..(hop + 1) * CLASSES];
            feature_for_hop(hop, feature);
            infer_hop(hop, feature, scores);
            
            let mut best = 0;
            for c in 1..CLASSES {
                if scores[c] > scores[best] { best = c; }
            }
            
            if best == candidate {
                candidate_count += 1;
            } else {
                candidate = best;
                candidate_count = 1;
            }
            
            if candidate_count == 5 && candidate != accepted {
                accepted = candidate;
                if accepted != 10 && DETECTION_COUNT_VALUE < HOPS as i32 {
                    let out = (DETECTION_COUNT_VALUE * 3) as usize;
                    detections[out] = hop as u32;
                    detections[out + 1] = accepted as u32;
                    detections[out + 2] = scores[accepted] as u32;
                    DETECTION_COUNT_VALUE += 1;
                }
            }
        }
        
        let counters = core::slice::from_raw_parts_mut((RESULTS_OFFSET + 3072) as *mut u32, 17);
        counters[0] = 300; 
        counters[1] = 300; 
        counters[2] = 300 * 480;  
        counters[3] = 300; 
        counters[4] = 300 * 2304; 
        counters[5] = 300 * 256; 
        counters[6] = 300 * 10; 
        counters[7] = 300 * 25 * 5 * 8 * 10 * 4; 
        counters[8] = 300 * 4 * 25 * 5 * 8 * 9; 
        counters[9] = 300 * 4 * 25 * 5 * 8 * 8; 
        counters[10] = 300 * 25 * 5 * 8; 
        counters[11] = 300 * 8 * 12; 
        counters[12] = 300 * 12; 
        counters[13] = 300 * 10; 
        counters[14] = 193280; 
        counters[15] = 300 * 10 + 300 * 12 * 4 + (DETECTION_COUNT_VALUE as u32) * 12; 
        counters[16] = (DETECTION_COUNT_VALUE as u32) * 3;
        
        let fnvs = core::slice::from_raw_parts_mut((RESULTS_OFFSET + 3200) as *mut u32, 3);
        fnvs[0] = fnv1a(core::slice::from_raw_parts(FEATURES_OFFSET as *const u8, HOPS * FEATURES));
        fnvs[1] = fnv1a(core::slice::from_raw_parts(SCORES_OFFSET as *const u8, HOPS * CLASSES * 4));
        fnvs[2] = fnv1a(core::slice::from_raw_parts(RESULTS_OFFSET as *const u8, DETECTION_COUNT_VALUE as usize * 12));
    }
    0
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
