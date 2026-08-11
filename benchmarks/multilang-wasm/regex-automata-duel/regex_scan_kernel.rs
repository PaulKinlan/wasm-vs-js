// regex_scan_kernel.rs — multilang compute core for regex-automata-duel-demo.
// Same ABI + oracle as regex_scan_kernel.c. See the C file for the ABI docs.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const FIXTURE_OFFSET: usize = 3145728;
const RES_OFFSET: usize = 5242880;
const FIXTURE_MAGIC: u32 = 0x31415852;

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read_u32_le(off: u32) -> u32 {
    (fixture_at(off) as u32) | ((fixture_at(off + 1) as u32) << 8) |
        ((fixture_at(off + 2) as u32) << 16) | ((fixture_at(off + 3) as u32) << 24)
}
fn read_i16_le(off: u32) -> i16 {
    ((fixture_at(off) as u16) | ((fixture_at(off + 1) as u16) << 8)) as i16
}

static mut FNV: u32 = 0;
fn fnv_reset() { unsafe { FNV = 0x811c9dc5; } }
fn fnv_mix_byte(b: u8) { unsafe { FNV = (FNV ^ (b as u32)).wrapping_mul(0x01000193); } }
fn fnv_mix_u32(v: u32) {
    fnv_mix_byte((v & 0xff) as u8);
    fnv_mix_byte(((v >> 8) & 0xff) as u8);
    fnv_mix_byte(((v >> 16) & 0xff) as u8);
    fnv_mix_byte(((v >> 24) & 0xff) as u8);
}

fn is_valid_end(corpus_off: u32, corpus_len: u32, end: u32) -> bool {
    if end == corpus_len { return true; }
    if end == corpus_len - 1 {
        let c = fixture_at(corpus_off + end);
        if c == 10 || c == 13 { return true; }
    }
    if corpus_len >= 2 && end == corpus_len - 2 {
        if fixture_at(corpus_off + end) == 13 &&
            fixture_at(corpus_off + end + 1) == 10 {
            return true;
        }
    }
    false
}

#[unsafe(no_mangle)]
pub extern "C" fn regex_scan(fixture_len: u32) -> i32 {
    let mut off: u32 = 0;
    if fixture_len < 12 { return -1; }
    if read_u32_le(off) != FIXTURE_MAGIC { return -2; }
    off += 4;
    let corpus_len = read_u32_le(off);
    off += 4;
    if corpus_len > fixture_len - off { return -3; }
    let corpus_off = off;
    off += corpus_len;
    off = (off + 7) & !7;
    let pattern_count = read_u32_le(off);
    off += 4;

    let mut matches_found: u32 = 0;
    let mut captures_extracted: u32 = 0;
    let mut boundary_crossings: u32 = 0;
    fnv_reset();

    for _ in 0..pattern_count {
        if off + 12 > fixture_len { return -4; }
        let state_count = read_u32_le(off);
        off += 4;
        let anchor_start = fixture_at(off);
        let anchor_end = fixture_at(off + 1);
        let capture_groups = fixture_at(off + 2);
        off += 4;
        let pattern_id = read_u32_le(off);
        off += 4;
        off = (off + 1) & !1;
        let table_off = off;
        let table_bytes = state_count * 128 * 2;
        if table_bytes > fixture_len - off { return -5; }
        off += table_bytes;
        let accept_off = off;
        if state_count > fixture_len - off { return -6; }
        off += state_count;
        let commit_off = off;
        let commit_bytes = state_count * 128;
        if commit_bytes > fixture_len - off { return -7; }
        off += commit_bytes;
        off = (off + 7) & !7;

        boundary_crossings += 1;
        let mut pattern_matches: u32 = 0;
        let mut search: u32 = 0;
        loop {
            if search > corpus_len { break; }
            if anchor_start != 0 && search > 0 { break; }
            let mut cursor = search;
            let mut state: i32 = 0;
            let mut best: i32 = -1;
            if fixture_at(accept_off + state as u32) != 0 {
                let valid = if anchor_end != 0 { is_valid_end(corpus_off, corpus_len, cursor) } else { true };
                if valid { best = cursor as i32; }
            }
            while cursor < corpus_len {
                let code = fixture_at(corpus_off + cursor);
                if code >= 128 { break; }
                if best == cursor as i32 &&
                    fixture_at(commit_off + (state as u32) * 128 + code as u32) != 0 {
                    break;
                }
                let next = read_i16_le(table_off + ((state as u32) * 128 + code as u32) * 2);
                if next < 0 { break; }
                state = next as i32;
                cursor += 1;
                if fixture_at(accept_off + state as u32) != 0 {
                    let valid = if anchor_end != 0 { is_valid_end(corpus_off, corpus_len, cursor) } else { true };
                    if valid { best = cursor as i32; }
                }
            }
            if best >= search as i32 {
                fnv_mix_u32(pattern_id);
                fnv_mix_u32(search);
                fnv_mix_u32(best as u32);
                matches_found += 1;
                pattern_matches += 1;
                if best as u32 > search { search = best as u32; }
                else { search += 1; }
            } else {
                if anchor_start != 0 { break; }
                search += 1;
            }
        }
        captures_extracted += pattern_matches * (capture_groups as u32);
    }

    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.add(0).write_volatile(matches_found);
        results.add(1).write_volatile(pattern_count);
        results.add(2).write_volatile(corpus_len * pattern_count);
        results.add(3).write_volatile(captures_extracted);
        results.add(4).write_volatile(boundary_crossings);
        results.add(5).write_volatile(fixture_len);
        results.add(6).write_volatile(corpus_len);
        results.add(7).write_volatile(FNV);
        results.add(8).write_volatile(0);
    }
    0
}
