// grid_trace_kernel.rs — multilang compute core for dom.virtualized-grid.v1.
// Same ABI as grid_trace_kernel.c: the adapter writes the frozen
// 1,604,864-byte virtualized-grid fixture at FIXTURE_OFFSET and passes the
// byte length; this kernel replays the 300-event trace bit-identical to
// createJavaScriptGridExecution() in benchmarks/base/dom-virtualized-grid/
// engine.js and grid.c, and writes the FNV-1a commandDigest + counters +
// final checkpoint to RES_OFFSET (via raw pointer).
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

// FIXTURE and RES offsets sit past every language's .bss window:
// C/C++ .bss ends near 2.0 MiB, Rust's __data_end lands near 4.0 MiB (rustc
// auto-sizes initial memory via link-arg=--initial-memory), and AS's fixed
// offsets occupy < 2.0 MiB. 3 MiB fixture / 5 MiB result is safely past all
// three.
const FIXTURE_OFFSET: usize = 3145728;      // 3 MiB
const RES_OFFSET: usize = 5242880;          // 5 MiB

const ROWS: usize = 100_000;
const ACTIONS: usize = 300;
const HEADER_BYTES: u32 = 64;
const ROW_BYTES: u32 = 16;
const ACTION_BYTES: u32 = 16;
const FIXTURE_BYTES: u32 =
    HEADER_BYTES + (ROWS as u32) * ROW_BYTES + (ACTIONS as u32) * ACTION_BYTES;
const MAGIC: u32 = 0x31445247;
const EMPTY: u32 = 0xffffffff;
const MAX_MOUNTED: usize = 28;

static mut SCORES: [i32; ROWS] = [0; ROWS];
static mut GROUPS: [u32; ROWS] = [0; ROWS];
static mut ORDER_ROWS: [u32; ROWS] = [0; ROWS];
static mut SCRATCH_ROWS: [u32; ROWS] = [0; ROWS];
static mut FILTERED_ROWS: [u32; ROWS] = [0; ROWS];

static mut SLOT_ROWS: [u32; MAX_MOUNTED] = [0; MAX_MOUNTED];
static mut SLOT_SCORES: [i32; MAX_MOUNTED] = [0; MAX_MOUNTED];
static mut SLOT_INDEXES: [u32; MAX_MOUNTED] = [0; MAX_MOUNTED];
static mut SLOT_SELECTED: [u32; MAX_MOUNTED] = [0; MAX_MOUNTED];
static mut SLOT_POSITIONS: [u32; MAX_MOUNTED] = [0; MAX_MOUNTED];
static mut SLOT_COUNT: u32 = 0;

static mut COMMAND_DIGEST: u32 = 0;
static mut COMMAND_COUNT: u32 = 0;
static mut ROWS_SCANNED: u32 = 0;
static mut COMPARISONS: u32 = 0;
static mut EVENTS: u32 = 0;
static mut PHYSICAL_CREATES: u32 = 0;
static mut PHYSICAL_REUSES: u32 = 0;
static mut PHYSICAL_UPDATES: u32 = 0;
static mut PHYSICAL_PLACEMENTS: u32 = 0;
static mut PHYSICAL_HIDES: u32 = 0;
static mut FOCUS_OPERATIONS: u32 = 0;
static mut LAYOUT_READS: u32 = 0;
static mut FILTERED_LENGTH: u32 = 0;
static mut FINAL_START: u32 = 0;
static mut FINAL_END: u32 = 0;
static mut FINAL_VISIBLE_LENGTH: u32 = 0;
static mut FOCUSED: u32 = 0;
static mut SELECTED: u32 = 0;
static mut FILTER_GROUP: u32 = 0;
static mut SCROLL_OFFSET: u32 = 0;

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read32(at: u32) -> u32 {
    (fixture_at(at) as u32)
        | ((fixture_at(at + 1) as u32) << 8)
        | ((fixture_at(at + 2) as u32) << 16)
        | ((fixture_at(at + 3) as u32) << 24)
}
fn hash_u32(v: u32) {
    let mut value = v;
    unsafe {
        for _ in 0..4 {
            COMMAND_DIGEST ^= value & 0xff;
            COMMAND_DIGEST = COMMAND_DIGEST.wrapping_mul(0x01000193);
            value >>= 8;
        }
    }
}
fn emit(op: u32, a: u32, b: u32, c: u32, d: u32, e: u32) {
    hash_u32(op);
    hash_u32(a);
    hash_u32(b);
    hash_u32(c);
    hash_u32(d);
    hash_u32(e);
    unsafe { COMMAND_COUNT += 1; }
}

fn compare_rows(a: u32, b: u32, direction: u32) -> i32 {
    unsafe {
        let sa = SCORES[a as usize];
        let sb = SCORES[b as usize];
        if sa != sb {
            return if direction != 0 {
                sb.wrapping_sub(sa)
            } else {
                sa.wrapping_sub(sb)
            };
        }
    }
    if a < b { -1 } else if a > b { 1 } else { 0 }
}

fn rebuild_filter(fg: u32) {
    unsafe {
        FILTERED_LENGTH = 0;
        for i in 0..ROWS {
            let row = ORDER_ROWS[i];
            ROWS_SCANNED += 1;
            if fg == EMPTY || GROUPS[row as usize] == fg {
                FILTERED_ROWS[FILTERED_LENGTH as usize] = row;
                FILTERED_LENGTH += 1;
            }
        }
    }
}

fn stable_sort(direction: u32, fg: u32) {
    // Two-buffer merge sort matching engine.js / grid.c: alternate `source`
    // and `target` between ORDER_ROWS and SCRATCH_ROWS. Represent the
    // toggle with a boolean since we cannot easily swap raw pointers under
    // Miri-friendly borrow rules; the end-of-loop copyback below matches
    // the reference C.
    unsafe {
        let mut source_is_order = true;
        let mut width: u32 = 1;
        while width < ROWS as u32 {
            let mut left: u32 = 0;
            while left < ROWS as u32 {
                let middle = if left + width < ROWS as u32 { left + width } else { ROWS as u32 };
                let right = if left + width * 2 < ROWS as u32 {
                    left + width * 2
                } else { ROWS as u32 };
                let mut i = left;
                let mut j = middle;
                let mut out = left;
                while i < middle && j < right {
                    COMPARISONS += 1;
                    let src_i = if source_is_order { ORDER_ROWS[i as usize] } else { SCRATCH_ROWS[i as usize] };
                    let src_j = if source_is_order { ORDER_ROWS[j as usize] } else { SCRATCH_ROWS[j as usize] };
                    if compare_rows(src_i, src_j, direction) <= 0 {
                        if source_is_order { SCRATCH_ROWS[out as usize] = src_i; }
                        else { ORDER_ROWS[out as usize] = src_i; }
                        out += 1;
                        i += 1;
                    } else {
                        if source_is_order { SCRATCH_ROWS[out as usize] = src_j; }
                        else { ORDER_ROWS[out as usize] = src_j; }
                        out += 1;
                        j += 1;
                    }
                }
                while i < middle {
                    let v = if source_is_order { ORDER_ROWS[i as usize] } else { SCRATCH_ROWS[i as usize] };
                    if source_is_order { SCRATCH_ROWS[out as usize] = v; } else { ORDER_ROWS[out as usize] = v; }
                    out += 1;
                    i += 1;
                }
                while j < right {
                    let v = if source_is_order { ORDER_ROWS[j as usize] } else { SCRATCH_ROWS[j as usize] };
                    if source_is_order { SCRATCH_ROWS[out as usize] = v; } else { ORDER_ROWS[out as usize] = v; }
                    out += 1;
                    j += 1;
                }
                left += width * 2;
            }
            source_is_order = !source_is_order;
            width *= 2;
        }
        // After the loop, `source` (source_is_order) holds the sorted array.
        // If SCRATCH_ROWS is the source, copy it back into ORDER_ROWS so
        // subsequent rebuild_filter reads from ORDER_ROWS.
        if !source_is_order {
            for i in 0..ROWS {
                ORDER_ROWS[i] = SCRATCH_ROWS[i];
            }
        }
    }
    rebuild_filter(fg);
}

fn visible_index(row: u32, visible: &[u32], length: u32) -> i32 {
    for i in 0..length as usize {
        if visible[i] == row { return i as i32; }
    }
    -1
}

fn reconcile(action_index: u32) {
    let visible_rows: u32 = 20;
    let overscan: u32 = 4;
    let filtered_length = unsafe { FILTERED_LENGTH };
    let scroll_offset = unsafe { SCROLL_OFFSET };
    let quotient = scroll_offset / 24;
    let base = if filtered_length < quotient { filtered_length } else { quotient };
    let start = if base > overscan { base - overscan } else { 0 };
    let upper = base + visible_rows + overscan;
    let end = if upper < filtered_length { upper } else { filtered_length };
    let visible_length = end - start;

    let mut visible: [u32; MAX_MOUNTED] = [0; MAX_MOUNTED];
    let mut used: [u32; MAX_MOUNTED] = [0; MAX_MOUNTED];
    unsafe {
        for i in 0..visible_length as usize {
            visible[i] = FILTERED_ROWS[start as usize + i];
        }
    }

    let selected = unsafe { SELECTED };
    let focused = unsafe { FOCUSED };

    for position in 0..visible_length {
        let row = visible[position as usize];
        let mut slot: i32 = -1;
        let count = unsafe { SLOT_COUNT };
        for candidate in 0..count {
            if unsafe { SLOT_ROWS[candidate as usize] } == row {
                slot = candidate as i32;
                break;
            }
        }
        let is_selected: u32 = if row == selected { 1 } else { 0 };
        if slot < 0 {
            for candidate in 0..count {
                let cand_row = unsafe { SLOT_ROWS[candidate as usize] };
                if visible_index(cand_row, &visible, visible_length) < 0 &&
                    used[candidate as usize] == 0 {
                    slot = candidate as i32;
                    break;
                }
            }
            if slot < 0 {
                if unsafe { SLOT_COUNT } >= MAX_MOUNTED as u32 { return; }
                slot = unsafe { SLOT_COUNT } as i32;
                unsafe { SLOT_COUNT += 1; }
                let score_val = unsafe { SCORES[row as usize] } as u32;
                emit(1, slot as u32, row, start + position, score_val, is_selected);
                unsafe { PHYSICAL_CREATES += 1; }
            } else {
                let score_val = unsafe { SCORES[row as usize] } as u32;
                emit(2, slot as u32, row, start + position, score_val, is_selected);
                unsafe { PHYSICAL_REUSES += 1; }
            }
            unsafe {
                SLOT_ROWS[slot as usize] = row;
                SLOT_SCORES[slot as usize] = SCORES[row as usize];
                SLOT_INDEXES[slot as usize] = start + position;
                SLOT_SELECTED[slot as usize] = is_selected;
            }
        } else {
            let (slot_score, slot_index, slot_sel) = unsafe {
                (SLOT_SCORES[slot as usize], SLOT_INDEXES[slot as usize], SLOT_SELECTED[slot as usize])
            };
            let row_score = unsafe { SCORES[row as usize] };
            if slot_score != row_score || slot_index != start + position || slot_sel != is_selected {
                emit(3, slot as u32, row, start + position, row_score as u32, is_selected);
                unsafe {
                    PHYSICAL_UPDATES += 1;
                    SLOT_SCORES[slot as usize] = row_score;
                    SLOT_INDEXES[slot as usize] = start + position;
                    SLOT_SELECTED[slot as usize] = is_selected;
                }
            }
        }
        used[slot as usize] = 1;
        let slot_position = unsafe { SLOT_POSITIONS[slot as usize] };
        if slot_position != position {
            emit(4, slot as u32, position, row, start + position, 0);
            unsafe {
                PHYSICAL_PLACEMENTS += 1;
                SLOT_POSITIONS[slot as usize] = position;
            }
        }
    }
    let count = unsafe { SLOT_COUNT };
    for slot in 0..count {
        let row = unsafe { SLOT_ROWS[slot as usize] };
        if used[slot as usize] == 0 && row != EMPTY {
            emit(5, slot, row, 0, 0, 0);
            unsafe {
                PHYSICAL_HIDES += 1;
                SLOT_ROWS[slot as usize] = EMPTY;
                SLOT_POSITIONS[slot as usize] = EMPTY;
            }
        }
    }
    for slot in 0..count {
        if unsafe { SLOT_ROWS[slot as usize] } == focused {
            emit(6, slot, focused, 0, 0, 0);
            unsafe { FOCUS_OPERATIONS += 1; }
            break;
        }
    }
    emit(7, action_index, visible_length, start, end, filtered_length);
    unsafe {
        LAYOUT_READS += 1;
        FINAL_START = start;
        FINAL_END = end;
        FINAL_VISIBLE_LENGTH = visible_length;
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn grid_trace(fixture_len: u32) -> i32 {
    if fixture_len != FIXTURE_BYTES { return 1; }
    if read32(0) != MAGIC || read32(4) != 1
        || read32(8) != ROWS as u32 || read32(12) != ACTIONS as u32
    { return 2; }

    unsafe {
        COMMAND_DIGEST = 0x811c9dc5;
        COMMAND_COUNT = 0;
        ROWS_SCANNED = 0;
        COMPARISONS = 0;
        EVENTS = 0;
        PHYSICAL_CREATES = 0;
        PHYSICAL_REUSES = 0;
        PHYSICAL_UPDATES = 0;
        PHYSICAL_PLACEMENTS = 0;
        PHYSICAL_HIDES = 0;
        FOCUS_OPERATIONS = 0;
        LAYOUT_READS = 0;
        FILTERED_LENGTH = ROWS as u32;
        FOCUSED = EMPTY;
        SELECTED = EMPTY;
        FILTER_GROUP = EMPTY;
        SCROLL_OFFSET = 0;
        SLOT_COUNT = 0;
        for i in 0..MAX_MOUNTED {
            SLOT_ROWS[i] = EMPTY;
            SLOT_INDEXES[i] = EMPTY;
            SLOT_POSITIONS[i] = EMPTY;
            SLOT_SELECTED[i] = 0;
            SLOT_SCORES[i] = 0;
        }
    }

    let mut row_offset: u32 = HEADER_BYTES;
    for i in 0..ROWS as u32 {
        let id = read32(row_offset);
        if id != i { return 3; }
        unsafe {
            SCORES[id as usize] = read32(row_offset + 4) as i32;
            GROUPS[id as usize] = read32(row_offset + 8);
            ORDER_ROWS[i as usize] = id;
            FILTERED_ROWS[i as usize] = id;
        }
        row_offset += ROW_BYTES;
    }

    let action_offset: u32 = HEADER_BYTES + (ROWS as u32) * ROW_BYTES;
    for action in 0..ACTIONS as u32 {
        let at = action_offset + action * ACTION_BYTES;
        if read32(at) != action * 100 { return 4; }
        let type_ = read32(at + 4);
        let a = read32(at + 8);
        let b = read32(at + 12);
        if type_ == 0 {
            let fl = unsafe { FILTERED_LENGTH };
            let max_offset = if fl > 20 { (fl - 20) * 24 } else { 0 };
            unsafe { SCROLL_OFFSET = if a < max_offset { a } else { max_offset }; }
        } else if type_ == 1 {
            unsafe { FILTER_GROUP = a; SCROLL_OFFSET = 0; }
            rebuild_filter(a);
        } else if type_ == 2 {
            let fg = unsafe { FILTER_GROUP };
            stable_sort(a & 1, fg);
        } else if type_ == 3 {
            if a >= ROWS as u32 { return 5; }
            unsafe {
                SCORES[a as usize] = b as i32;
                SELECTED = a;
            }
        } else if type_ == 4 {
            if a == EMPTY {
                let fl = unsafe { FILTERED_LENGTH };
                let quot = unsafe { SCROLL_OFFSET } / 24;
                let mut base_pos = quot + 5;
                if base_pos >= fl { base_pos = fl - 1; }
                unsafe { FOCUSED = FILTERED_ROWS[base_pos as usize]; }
            } else {
                if a >= ROWS as u32 { return 6; }
                unsafe { FOCUSED = a; }
            }
            unsafe { SELECTED = FOCUSED; }
        } else { return 7; }
        unsafe { EVENTS += 1; }
        reconcile(action);
    }

    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(COMMAND_DIGEST);
        results.add(1).write_volatile(ROWS_SCANNED);
        results.add(2).write_volatile(COMPARISONS);
        results.add(3).write_volatile(EVENTS);
        results.add(4).write_volatile(COMMAND_COUNT);
        results.add(5).write_volatile(PHYSICAL_CREATES);
        results.add(6).write_volatile(PHYSICAL_REUSES);
        results.add(7).write_volatile(PHYSICAL_UPDATES);
        results.add(8).write_volatile(PHYSICAL_PLACEMENTS);
        results.add(9).write_volatile(PHYSICAL_HIDES);
        results.add(10).write_volatile(FOCUS_OPERATIONS);
        results.add(11).write_volatile(LAYOUT_READS);
        results.add(12).write_volatile(FINAL_START);
        results.add(13).write_volatile(FINAL_END);
        results.add(14).write_volatile(FINAL_VISIBLE_LENGTH);
        results.add(15).write_volatile(FOCUSED);
        results.add(16).write_volatile(SELECTED);
        results.add(17).write_volatile(FILTERED_LENGTH);
    }
    0
}
