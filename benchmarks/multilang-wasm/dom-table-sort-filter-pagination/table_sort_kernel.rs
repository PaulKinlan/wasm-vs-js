// table_sort_kernel.rs — multilang compute core for
// dom.table-sort-filter-pagination.v1.
// Same ABI: generates the frozen 120-action trace from seed 0x31415926, runs
// the 5,000-row JS reference model (runTableSortFilterJS), writes counters
// to fixed offset 16384 (via raw pointer), returns pageScoreSum.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const ROWS: usize = 5000;
const PAGE: usize = 50;
const ACTIONS: usize = 120;
const RES_OFFSET: usize = 40000; // past the AS-shared 40000-byte data region

static mut SEED: u32 = 0;

fn rand_next() -> f64 {
    unsafe {
        SEED ^= SEED << 13;
        SEED ^= ((SEED as i32) >> 17) as u32;
        SEED ^= SEED << 5;
        (SEED as f64) / 4294967296.0
    }
}

fn cat_rank(c: i32) -> i32 {
    if c == 0 { 0 }
    else if c == 1 { 1 }
    else if c == 2 { 4 }
    else if c == 3 { 2 }
    else { 3 }
}
fn stat_rank(s: i32) -> i32 {
    if s == 0 { 0 }
    else if s == 1 { 2 }
    else { 1 }
}
fn cmp_name(a: i32, b: i32) -> i32 {
    let mut sa = [0u8; 8];
    let mut sb = [0u8; 8];
    let mut na = 0usize;
    let mut nb = 0usize;
    let mut x = a;
    loop {
        sa[na] = b'0' + (x % 10) as u8;
        na += 1;
        x /= 10;
        if x == 0 { break; }
    }
    let mut x = b;
    loop {
        sb[nb] = b'0' + (x % 10) as u8;
        nb += 1;
        x /= 10;
        if x == 0 { break; }
    }
    let mut i = 0;
    while i < na && i < nb {
        let ca = sa[na - 1 - i];
        let cb = sb[nb - 1 - i];
        if ca != cb { return if ca < cb { -1 } else { 1 }; }
        i += 1;
    }
    if na != nb { return if na < nb { -1 } else { 1 }; }
    0
}
fn cmp_row(scores: &[i32; ROWS], a_id: i32, b_id: i32, col: i32, asc: i32) -> i32 {
    let cmp = if col == 0 {
        if a_id < b_id { -1 } else if a_id > b_id { 1 } else { 0 }
    } else if col == 1 {
        cmp_name(a_id, b_id)
    } else if col == 2 {
        let ra = cat_rank(a_id % 5);
        let rb = cat_rank(b_id % 5);
        if ra < rb { -1 } else if ra > rb { 1 } else { 0 }
    } else if col == 3 {
        let sa = scores[a_id as usize];
        let sb = scores[b_id as usize];
        if sa < sb { -1 } else if sa > sb { 1 } else { 0 }
    } else if col == 4 {
        let ra = stat_rank(a_id % 3);
        let rb = stat_rank(b_id % 3);
        if ra < rb { -1 } else if ra > rb { 1 } else { 0 }
    } else {
        0
    };
    if asc != 0 { cmp } else { -cmp }
}

#[unsafe(no_mangle)]
pub extern "C" fn table_sort_trace() -> i32 {
    let mut scores = [0i32; ROWS];
    let mut filt = [0i32; ROWS];
    for i in 0..ROWS {
        scores[i] = ((i as i32) * 37) % 1000;
        filt[i] = i as i32;
    }
    let mut filtered_count: usize = ROWS;
    let mut current_page: i32 = 0;
    let mut page_size: i32 = PAGE as i32;
    let mut total_sorts: u32 = 0;
    let mut total_filters: u32 = 0;

    unsafe { SEED = 0x31415926; }
    for _ in 0..ACTIONS {
        let op_type = rand_next();
        if op_type < 0.35 {
            let col = (rand_next() * 5.0) as i32;
            let asc = if rand_next() > 0.5 { 1 } else { 0 };
            for i in 1..filtered_count {
                let key = filt[i];
                let mut j = i as isize - 1;
                while j >= 0 && cmp_row(&scores, key, filt[j as usize], col, asc) < 0 {
                    filt[(j + 1) as usize] = filt[j as usize];
                    j -= 1;
                }
                filt[(j + 1) as usize] = key;
            }
            total_sorts += 1;
        } else if op_type < 0.70 {
            let f_idx = (rand_next() * 6.0) as i32;
            let mut out: usize = 0;
            if f_idx == 5 {
                for i in 0..ROWS { filt[out] = i as i32; out += 1; }
            } else {
                let target_cat = f_idx;
                for i in 0..ROWS {
                    if (i as i32) % 5 == target_cat { filt[out] = i as i32; out += 1; }
                }
            }
            filtered_count = out;
            total_filters += 1;
        } else if op_type < 0.90 {
            let page = (rand_next() * 20.0) as i32;
            current_page = page;
            page_size = PAGE as i32;
        } else {
            let row_id = (rand_next() * 5000.0) as i32;
            let new_score = (rand_next() * 1000.0) as i32;
            if row_id >= 0 && (row_id as usize) < ROWS {
                scores[row_id as usize] = new_score;
            }
        }
    }

    let page_start = current_page * page_size;
    let mut page_end = page_start + page_size;
    if page_end > filtered_count as i32 { page_end = filtered_count as i32; }
    let mut slice_len = page_end - page_start;
    if slice_len < 0 { slice_len = 0; }
    let mut page_score_sum: u32 = 0;
    for i in page_start..page_end {
        page_score_sum = page_score_sum.wrapping_add(scores[filt[i as usize] as usize] as u32);
    }

    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(filtered_count as u32);
        results.add(1).write_volatile(total_sorts);
        results.add(2).write_volatile(total_filters);
        results.add(3).write_volatile(slice_len as u32);
        results.add(4).write_volatile(page_score_sum);
    }
    page_score_sum as i32
}
