// gc_document_kernel.rs — multilang compute core for text.gc-document-edit.v1.
// Same ABI as gc_document_kernel.c: parses parseFixture + executeFixture from
// the fixture bytes the adapter writes at offset 196608 (byte length passed
// in), applies the 10,000 inserts/deletes/reparents on a labelled-node tree,
// and writes counters + FNV-1a canonical digest to offset 524288.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const MAX_SLOTS: usize = 4096;
const FIXTURE_OFFSET: usize = 196608;
const RES_OFFSET: usize = 524288;

static mut PARENT_OF: [i32; MAX_SLOTS] = [-2; MAX_SLOTS];
static mut FIRST_CHILD_OF: [i32; MAX_SLOTS] = [-1; MAX_SLOTS];
static mut PREV_SIBLING_OF: [i32; MAX_SLOTS] = [-1; MAX_SLOTS];
static mut NEXT_SIBLING_OF: [i32; MAX_SLOTS] = [-1; MAX_SLOTS];
static mut CHILD_COUNT_OF: [u32; MAX_SLOTS] = [0; MAX_SLOTS];
static mut LABEL_OFF_OF: [u32; MAX_SLOTS] = [0; MAX_SLOTS];
static mut LABEL_HEX_LEN_OF: [u16; MAX_SLOTS] = [0; MAX_SLOTS];
static mut FNV: u32 = 0;

fn fnv_reset() { unsafe { FNV = 0x811c9dc5u32; } }
fn fnv_mix_byte(b: u8) { unsafe { FNV ^= b as u32; FNV = FNV.wrapping_mul(0x01000193u32); } }
fn fnv_mix_u32(v: u32) {
    fnv_mix_byte((v & 0xff) as u8);
    fnv_mix_byte(((v >> 8) & 0xff) as u8);
    fnv_mix_byte(((v >> 16) & 0xff) as u8);
    fnv_mix_byte(((v >> 24) & 0xff) as u8);
}

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn is_digit(c: u8) -> bool { c >= b'0' && c <= b'9' }
fn hex_val(c: u8) -> u8 {
    if c >= b'0' && c <= b'9' { c - b'0' }
    else if c >= b'a' && c <= b'f' { c - b'a' + 10 }
    else { c - b'A' + 10 }
}

fn read_int(off: &mut u32, end: u32) -> i32 {
    let mut neg = false;
    if *off < end && fixture_at(*off) == b'-' { neg = true; *off += 1; }
    let mut v: i32 = 0;
    while *off < end && is_digit(fixture_at(*off)) {
        v = v * 10 + (fixture_at(*off) - b'0') as i32;
        *off += 1;
    }
    if neg { -v } else { v }
}
fn skip_delim(off: &mut u32) { *off += 1; }
fn read_hex_span(off: &mut u32, end: u32) -> (u32, u16) {
    let start = *off;
    while *off < end && fixture_at(*off) != b'\t' && fixture_at(*off) != b'\n' {
        *off += 1;
    }
    (start, (*off - start) as u16)
}
fn skip_line(off: &mut u32, end: u32) {
    while *off < end && fixture_at(*off) != b'\n' { *off += 1; }
    if *off < end { *off += 1; }
}
fn read_header_count(off: &mut u32, end: u32) -> i32 {
    while *off < end && fixture_at(*off) != b'\t' { *off += 1; }
    if *off < end { *off += 1; }
    let c = read_int(off, end);
    skip_line(off, end);
    c
}

fn link_after(parent: i32, anchor: i32, node: i32) {
    unsafe {
        if anchor == -1 {
            let old_head = FIRST_CHILD_OF[parent as usize];
            NEXT_SIBLING_OF[node as usize] = old_head;
            PREV_SIBLING_OF[node as usize] = -1;
            if old_head != -1 { PREV_SIBLING_OF[old_head as usize] = node; }
            FIRST_CHILD_OF[parent as usize] = node;
        } else {
            let old_next = NEXT_SIBLING_OF[anchor as usize];
            NEXT_SIBLING_OF[node as usize] = old_next;
            PREV_SIBLING_OF[node as usize] = anchor;
            if old_next != -1 { PREV_SIBLING_OF[old_next as usize] = node; }
            NEXT_SIBLING_OF[anchor as usize] = node;
        }
        CHILD_COUNT_OF[parent as usize] += 1;
    }
}
fn insert_at_position(parent: i32, position: i32, node: i32) {
    if position == 0 { link_after(parent, -1, node); return; }
    let mut cur = unsafe { FIRST_CHILD_OF[parent as usize] };
    let mut k = 0i32;
    while k < position - 1 && cur != -1 {
        cur = unsafe { NEXT_SIBLING_OF[cur as usize] };
        k += 1;
    }
    link_after(parent, cur, node);
}
fn splice_out(node: i32) {
    unsafe {
        let par = PARENT_OF[node as usize];
        let p = PREV_SIBLING_OF[node as usize];
        let n = NEXT_SIBLING_OF[node as usize];
        if p == -1 { FIRST_CHILD_OF[par as usize] = n; }
        else { NEXT_SIBLING_OF[p as usize] = n; }
        if n != -1 { PREV_SIBLING_OF[n as usize] = p; }
        PREV_SIBLING_OF[node as usize] = -1;
        NEXT_SIBLING_OF[node as usize] = -1;
        CHILD_COUNT_OF[par as usize] -= 1;
    }
}

fn dfs_mix(slot: i32) {
    fnv_mix_u32(slot as u32);
    let hex_len = unsafe { LABEL_HEX_LEN_OF[slot as usize] as u32 };
    let byte_len = hex_len / 2;
    fnv_mix_u32(byte_len);
    let off = unsafe { LABEL_OFF_OF[slot as usize] };
    for i in 0..byte_len {
        let hi = fixture_at(off + i * 2);
        let lo = fixture_at(off + i * 2 + 1);
        fnv_mix_byte((hex_val(hi) << 4) | hex_val(lo));
    }
    fnv_mix_u32(unsafe { CHILD_COUNT_OF[slot as usize] });
    let mut c = unsafe { FIRST_CHILD_OF[slot as usize] };
    while c != -1 {
        dfs_mix(c);
        c = unsafe { NEXT_SIBLING_OF[c as usize] };
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn gc_document_edit_trace(fixture_len: u32) -> i32 {
    unsafe {
        for i in 0..MAX_SLOTS {
            PARENT_OF[i] = -2;
            FIRST_CHILD_OF[i] = -1;
            PREV_SIBLING_OF[i] = -1;
            NEXT_SIBLING_OF[i] = -1;
            CHILD_COUNT_OF[i] = 0;
            LABEL_OFF_OF[i] = 0;
            LABEL_HEX_LEN_OF[i] = 0;
        }
    }
    let mut off: u32 = 0;
    let end = fixture_len;
    skip_line(&mut off, end);
    let initial_count = read_header_count(&mut off, end);
    let _ops = read_header_count(&mut off, end);

    let mut child_insertions: u32 = 0;
    let mut child_removals: u32 = 0;
    let mut parent_writes: u32 = 0;
    let mut node_count: u32 = 0;

    for _ in 0..initial_count {
        off += 2;
        let id = read_int(&mut off, end); skip_delim(&mut off);
        let parent_id = read_int(&mut off, end); skip_delim(&mut off);
        let position = read_int(&mut off, end); skip_delim(&mut off);
        let (lo, ll) = read_hex_span(&mut off, end);
        skip_line(&mut off, end);
        unsafe {
            LABEL_OFF_OF[id as usize] = lo;
            LABEL_HEX_LEN_OF[id as usize] = ll;
            PARENT_OF[id as usize] = if parent_id == -1 { -1 } else { parent_id };
        }
        if parent_id != -1 {
            insert_at_position(parent_id, position, id);
            child_insertions += 1;
            parent_writes += 1;
        }
        node_count += 1;
    }

    let mut inserts: u32 = 0;
    let mut deletes: u32 = 0;
    let mut reparents: u32 = 0;
    while off < end {
        let tag = fixture_at(off);
        if tag == b'\n' { off += 1; continue; }
        off += 1;
        skip_delim(&mut off);
        if tag == b'I' {
            let id = read_int(&mut off, end); skip_delim(&mut off);
            let parent_id = read_int(&mut off, end); skip_delim(&mut off);
            let position = read_int(&mut off, end); skip_delim(&mut off);
            let (lo, ll) = read_hex_span(&mut off, end);
            skip_line(&mut off, end);
            unsafe {
                LABEL_OFF_OF[id as usize] = lo;
                LABEL_HEX_LEN_OF[id as usize] = ll;
                PARENT_OF[id as usize] = parent_id;
            }
            insert_at_position(parent_id, position, id);
            inserts += 1;
            child_insertions += 1;
            parent_writes += 1;
            node_count += 1;
        } else if tag == b'D' {
            let id = read_int(&mut off, end);
            skip_line(&mut off, end);
            splice_out(id);
            unsafe { PARENT_OF[id as usize] = -2; }
            deletes += 1;
            child_removals += 1;
            parent_writes += 1;
            node_count -= 1;
        } else if tag == b'R' {
            let id = read_int(&mut off, end); skip_delim(&mut off);
            let parent_id = read_int(&mut off, end); skip_delim(&mut off);
            let position = read_int(&mut off, end);
            skip_line(&mut off, end);
            splice_out(id);
            unsafe { PARENT_OF[id as usize] = parent_id; }
            insert_at_position(parent_id, position, id);
            reparents += 1;
            child_insertions += 1;
            child_removals += 1;
            parent_writes += 1;
        } else {
            skip_line(&mut off, end);
        }
    }

    fnv_reset();
    dfs_mix(0);
    let canonical_fnv = unsafe { FNV };

    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(inserts);
        results.add(1).write_volatile(deletes);
        results.add(2).write_volatile(reparents);
        results.add(3).write_volatile(node_count);
        results.add(4).write_volatile(child_insertions);
        results.add(5).write_volatile(child_removals);
        results.add(6).write_volatile(parent_writes);
        results.add(7).write_volatile(canonical_fnv);
    }
    node_count as i32
}
