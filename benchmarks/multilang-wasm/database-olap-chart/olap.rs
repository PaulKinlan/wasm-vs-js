#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// database-olap-chart multilang kernel — exact mirror of the C olap.c:
// u32/u64 OLAP aggregation (region/category masks, stable mergesort top-8,
// per-category count/units/revenue), identical counters and output words.

const ROWS: usize = 10000;
const QUERIES: usize = 5;
const CATEGORIES: usize = 16;
const TOP: usize = 8;
const ROW_WORDS: usize = 6;
const QUERY_WORDS: usize = 6;
const HEADER: usize = 8;
const OUT_PER_QUERY: usize = 112;
const OUTPUT_WORDS: usize = QUERIES * OUT_PER_QUERY;

static mut INPUT_WORDS: [u32; HEADER + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS] = [0; HEADER + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS];
static mut RESULT_WORDS: [u32; OUTPUT_WORDS] = [0; OUTPUT_WORDS];
static mut INDEXES: [u32; ROWS] = [0; ROWS];
static mut TEMPORARY: [u32; ROWS] = [0; ROWS];
static mut COUNTERS: [u32; 9] = [0; 9];

#[no_mangle]
pub extern "C" fn input_ptr() -> u32 {
    unsafe { INPUT_WORDS.as_mut_ptr() as u32 }
}

#[no_mangle]
pub extern "C" fn result_ptr() -> u32 {
    unsafe { RESULT_WORDS.as_mut_ptr() as u32 }
}

#[no_mangle]
pub extern "C" fn counter(index: u32) -> u32 {
    unsafe { if index < 9 { COUNTERS[index as usize] } else { 0 } }
}

fn mix(hash: u32, value: u32) -> u32 {
    (hash ^ value).wrapping_mul(0x01000193)
}

fn column_value(column: usize, row: usize) -> u32 {
    unsafe { INPUT_WORDS[HEADER + column * ROWS + row] }
}

fn row_key(row: usize, column: usize) -> u32 {
    column_value(if column == 0 { 5 } else { 4 }, row)
}

fn before(left: usize, right: usize, column: usize, descending: bool) -> bool {
    let a = row_key(left, column);
    let b = row_key(right, column);
    if a != b {
        return if descending { a > b } else { a < b };
    }
    left < right
}

fn stable_sort(length: usize, column: usize, descending: bool) {
    let mut width = 1usize;
    while width < length {
        let mut left = 0usize;
        while left < length {
            let mid = if left + width < length { left + width } else { length };
            let right = if left + width * 2 < length { left + width * 2 } else { length };
            let (mut i, mut j, mut out) = (left, mid, left);
            while i < mid && j < right {
                unsafe { COUNTERS[4] += 1; }
                let (ri, rj) = unsafe { (INDEXES[i] as usize, INDEXES[j] as usize) };
                if before(ri, rj, column, descending) {
                    unsafe { TEMPORARY[out] = INDEXES[i]; }
                    i += 1;
                } else {
                    unsafe { TEMPORARY[out] = INDEXES[j]; }
                    j += 1;
                }
                out += 1;
            }
            while i < mid {
                unsafe { TEMPORARY[out] = INDEXES[i]; }
                i += 1;
                out += 1;
            }
            while j < right {
                unsafe { TEMPORARY[out] = INDEXES[j]; }
                j += 1;
                out += 1;
            }
            let mut k = left;
            while k < right {
                unsafe { INDEXES[k] = TEMPORARY[k]; }
                k += 1;
            }
            left += width * 2;
        }
        width *= 2;
    }
}

#[no_mangle]
pub extern "C" fn run(byte_length: u32) -> u32 {
    unsafe {
        let expected = ((HEADER + ROWS * ROW_WORDS + QUERIES * QUERY_WORDS) * 4) as u32;
        if byte_length != expected || INPUT_WORDS[0] != 0x50414c4f || INPUT_WORDS[1] != 1
            || INPUT_WORDS[2] != ROWS as u32 || INPUT_WORDS[3] != QUERIES as u32
            || INPUT_WORDS[4] != CATEGORIES as u32 || INPUT_WORDS[5] != TOP as u32
            || INPUT_WORDS[6] != ROW_WORDS as u32 || INPUT_WORDS[7] != QUERY_WORDS as u32 {
            return 0;
        }
        for c in COUNTERS.iter_mut() { *c = 0; }
        COUNTERS[0] = QUERIES as u32;
        COUNTERS[6] = (QUERIES * CATEGORIES) as u32;
        COUNTERS[7] = (QUERIES * TOP) as u32;
        COUNTERS[8] = OUTPUT_WORDS as u32;
        let query_start = HEADER + ROWS * ROW_WORDS;
        for q in 0..QUERIES {
            let qp = query_start + q * QUERY_WORDS;
            let region_mask = INPUT_WORDS[qp];
            let category_mask = INPUT_WORDS[qp + 1];
            let min_units = INPUT_WORDS[qp + 2];
            let descending = INPUT_WORDS[qp + 3] != 0;
            let sort_column = INPUT_WORDS[qp + 4] as usize;
            let revision = INPUT_WORDS[qp + 5];
            let mut count = [0u32; CATEGORIES];
            let mut units = [0u64; CATEGORIES];
            let mut revenue = [0u64; CATEGORIES];
            let mut matched = 0usize;
            let mut filter_digest = 0x811c9dc5u32;
            for row in 0..ROWS {
                let region = column_value(1, row);
                let category = column_value(2, row) as usize;
                let amount = column_value(4, row);
                COUNTERS[1] += 1;
                COUNTERS[2] += 3;
                if ((region_mask >> region) & 1) == 0 || ((category_mask >> category) & 1) == 0 || amount < min_units {
                    continue;
                }
                INDEXES[matched] = row as u32;
                matched += 1;
                COUNTERS[3] += 1;
                COUNTERS[5] += 1;
                filter_digest = mix(filter_digest, row as u32);
                count[category] += 1;
                units[category] += amount as u64;
                revenue[category] += column_value(5, row) as u64;
            }
            stable_sort(matched, sort_column, descending);
            let mut out = q * OUT_PER_QUERY;
            RESULT_WORDS[out] = q as u32; out += 1;
            RESULT_WORDS[out] = matched as u32; out += 1;
            RESULT_WORDS[out] = sort_column as u32; out += 1;
            RESULT_WORDS[out] = if descending { 1 } else { 0 }; out += 1;
            RESULT_WORDS[out] = filter_digest; out += 1;
            RESULT_WORDS[out] = TOP as u32; out += 1;
            RESULT_WORDS[out] = CATEGORIES as u32; out += 1;
            RESULT_WORDS[out] = revision; out += 1;
            for i in 0..TOP {
                let row = INDEXES[i] as usize;
                RESULT_WORDS[out] = row as u32; out += 1;
                RESULT_WORDS[out] = column_value(4, row); out += 1;
                RESULT_WORDS[out] = column_value(5, row); out += 1;
            }
            for b in 0..CATEGORIES {
                RESULT_WORDS[out] = count[b]; out += 1;
                RESULT_WORDS[out] = units[b] as u32; out += 1;
                RESULT_WORDS[out] = (units[b] >> 32) as u32; out += 1;
                RESULT_WORDS[out] = revenue[b] as u32; out += 1;
                RESULT_WORDS[out] = (revenue[b] >> 32) as u32; out += 1;
            }
        }
        OUTPUT_WORDS as u32
    }
}
