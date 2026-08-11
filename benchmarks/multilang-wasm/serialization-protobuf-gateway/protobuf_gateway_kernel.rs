// protobuf_gateway_kernel.rs — multilang compute core for
// serialization.protobuf-gateway.v1. Same ABI + oracle as
// protobuf_gateway_kernel.c. See the C file for the ABI docs.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const FIXTURE_OFFSET: usize = 3145728;
const RES_OFFSET: usize = 6291456;
const MESSAGE_COUNT: u32 = 10000;

static mut FNV: u32 = 0;
static mut M_ID_LO: u32 = 0;
static mut M_ID_HI: u32 = 0;
static mut M_ACTIVE: u32 = 0;
static mut M_STATUS: u32 = 0;
static mut M_NAME_LEN: u32 = 0;
static mut M_TAG_COUNT: u32 = 0;
static mut M_MAP_COUNT: u32 = 0;
static mut M_PAYLOAD_LEN: u32 = 0;
static mut M_CHOICE_KIND: u32 = 0;
static mut M_NOTE_LEN: u32 = 0;
static mut M_CODE: u32 = 0;

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read_u32_le(off: u32) -> u32 {
    (fixture_at(off) as u32) | ((fixture_at(off + 1) as u32) << 8) |
        ((fixture_at(off + 2) as u32) << 16) | ((fixture_at(off + 3) as u32) << 24)
}
fn fnv_reset() { unsafe { FNV = 0x811c9dc5; } }
fn fnv_mix_byte(b: u8) { unsafe { FNV = (FNV ^ (b as u32)).wrapping_mul(0x01000193); } }
fn fnv_mix_u32(v: u32) {
    fnv_mix_byte((v & 0xff) as u8);
    fnv_mix_byte(((v >> 8) & 0xff) as u8);
    fnv_mix_byte(((v >> 16) & 0xff) as u8);
    fnv_mix_byte(((v >> 24) & 0xff) as u8);
}

// Returns (ok, lo, hi, bytes_used, new_cur).
fn read_varint(cur: u32, end: u32) -> (bool, u32, u32, u32, u32) {
    let mut value: u64 = 0;
    let mut shift: u32 = 0;
    let mut bytes: u32 = 0;
    let mut c = cur;
    for _ in 0..10u32 {
        if c >= end { return (false, 0, 0, 0, c); }
        let b = fixture_at(c);
        c += 1;
        bytes += 1;
        value |= ((b & 0x7f) as u64) << shift;
        if (b & 0x80) == 0 {
            return (
                true,
                (value & 0xffffffff) as u32,
                (value >> 32) as u32,
                bytes,
                c,
            );
        }
        shift += 7;
    }
    (false, 0, 0, 0, c)
}

// Returns (ok, new_cur, varint_bytes_used).
fn skip_field(cur: u32, end: u32, wire: u32) -> (bool, u32, u32) {
    if wire == 0 {
        let (ok, _lo, _hi, used, next) = read_varint(cur, end);
        if !ok { return (false, cur, 0); }
        return (true, next, used);
    }
    if wire == 1 {
        if cur > end || end - cur < 8 { return (false, cur, 0); }
        return (true, cur + 8, 0);
    }
    if wire == 2 {
        let (ok, lo, hi, used, next) = read_varint(cur, end);
        if !ok { return (false, cur, 0); }
        if hi != 0 || lo > end - next { return (false, cur, 0); }
        return (true, next + lo, used);
    }
    if wire == 5 {
        if cur > end || end - cur < 4 { return (false, cur, 0); }
        return (true, cur + 4, 0);
    }
    (false, cur, 0)
}

fn parse_map_entry(start: u32, end: u32) -> bool {
    let mut cur = start;
    while cur < end {
        let (ok, tag_lo, _tag_hi, _used, next) = read_varint(cur, end);
        if !ok { return false; }
        cur = next;
        let wire = tag_lo & 7;
        let (ok2, next2, _vb) = skip_field(cur, end, wire);
        if !ok2 { return false; }
        cur = next2;
    }
    unsafe { M_MAP_COUNT += 1; }
    true
}

fn reset_message() {
    unsafe {
        M_ID_LO = 0;
        M_ID_HI = 0;
        M_ACTIVE = 0;
        M_STATUS = 0;
        M_NAME_LEN = 0;
        M_TAG_COUNT = 0;
        M_MAP_COUNT = 0;
        M_PAYLOAD_LEN = 0;
        M_CHOICE_KIND = 0;
        M_NOTE_LEN = 0;
        M_CODE = 0;
    }
}

// Returns (ok, fields, varint_bytes, unknown_fields).
fn decode_message(start: u32, end: u32) -> (bool, u32, u32, u32) {
    reset_message();
    let mut cur = start;
    let mut fields: u32 = 0;
    let mut varint_bytes: u32 = 0;
    let mut unknown_fields: u32 = 0;
    while cur < end {
        let (ok, tag_lo, tag_hi, used, next) = read_varint(cur, end);
        if !ok || tag_hi != 0 { return (false, 0, 0, 0); }
        cur = next;
        let field = tag_lo >> 3;
        let wire = tag_lo & 7;
        if field == 0 { return (false, 0, 0, 0); }
        fields += 1;
        varint_bytes += used;
        if field == 1 && wire == 0 {
            let (ok2, lo, hi, u2, next2) = read_varint(cur, end);
            if !ok2 { return (false, 0, 0, 0); }
            unsafe { M_ID_LO = lo; M_ID_HI = hi; }
            cur = next2;
            varint_bytes += u2;
        } else if field == 2 && wire == 2 {
            let (ok2, lo, hi, u2, next2) = read_varint(cur, end);
            if !ok2 || hi != 0 || lo > end - next2 { return (false, 0, 0, 0); }
            unsafe { M_NAME_LEN = lo; }
            cur = next2 + lo;
            varint_bytes += u2;
        } else if field == 3 && wire == 0 {
            let (ok2, lo, hi, u2, next2) = read_varint(cur, end);
            if !ok2 { return (false, 0, 0, 0); }
            unsafe { M_ACTIVE = if lo != 0 || hi != 0 { 1 } else { 0 }; }
            cur = next2;
            varint_bytes += u2;
        } else if field == 4 && wire == 1 {
            if end - cur < 8 { return (false, 0, 0, 0); }
            cur += 8;
        } else if field == 5 && wire == 0 {
            let (ok2, lo, _hi, u2, next2) = read_varint(cur, end);
            if !ok2 { return (false, 0, 0, 0); }
            unsafe { M_STATUS = lo; }
            cur = next2;
            varint_bytes += u2;
        } else if field == 6 && wire == 2 {
            let (ok2, lo, hi, u2, next2) = read_varint(cur, end);
            if !ok2 || hi != 0 || lo > end - next2 { return (false, 0, 0, 0); }
            cur = next2 + lo;
            unsafe { M_TAG_COUNT += 1; }
            varint_bytes += u2;
        } else if field == 7 && wire == 2 {
            let (ok2, lo, hi, u2, next2) = read_varint(cur, end);
            if !ok2 || hi != 0 || lo > end - next2 { return (false, 0, 0, 0); }
            if !parse_map_entry(next2, next2 + lo) { return (false, 0, 0, 0); }
            cur = next2 + lo;
            varint_bytes += u2;
        } else if field == 8 && wire == 2 {
            let (ok2, lo, hi, u2, next2) = read_varint(cur, end);
            if !ok2 || hi != 0 || lo > end - next2 { return (false, 0, 0, 0); }
            unsafe { M_PAYLOAD_LEN = lo; }
            cur = next2 + lo;
            varint_bytes += u2;
        } else if field == 9 && wire == 2 {
            let (ok2, lo, hi, u2, next2) = read_varint(cur, end);
            if !ok2 || hi != 0 || lo > end - next2 { return (false, 0, 0, 0); }
            unsafe { M_NOTE_LEN = lo; M_CHOICE_KIND = 9; }
            cur = next2 + lo;
            varint_bytes += u2;
        } else if field == 10 && wire == 0 {
            let (ok2, lo, _hi, u2, next2) = read_varint(cur, end);
            if !ok2 { return (false, 0, 0, 0); }
            unsafe { M_CODE = lo; M_CHOICE_KIND = 10; }
            cur = next2;
            varint_bytes += u2;
        } else if field == 11 && wire == 5 {
            if end - cur < 4 { return (false, 0, 0, 0); }
            cur += 4;
        } else {
            let (ok2, next2, vb) = skip_field(cur, end, wire);
            if !ok2 { return (false, 0, 0, 0); }
            cur = next2;
            unknown_fields += 1;
            varint_bytes += vb;
        }
    }
    if cur != end { return (false, 0, 0, 0); }
    (true, fields, varint_bytes, unknown_fields)
}

fn mod3_u64(lo: u32, hi: u32) -> u32 {
    let mut r: u32 = 0;
    let mut i: i32 = 31;
    while i >= 0 {
        r = (r << 1) | ((hi >> i as u32) & 1);
        if r >= 3 { r -= 3; }
        i -= 1;
    }
    let mut j: i32 = 31;
    while j >= 0 {
        r = (r << 1) | ((lo >> j as u32) & 1);
        if r >= 3 { r -= 3; }
        j -= 1;
    }
    r
}

#[no_mangle]
pub extern "C" fn protobuf_gateway(fixture_len: u32) -> i32 {
    fnv_reset();
    if fixture_len < 4 { return -1; }
    let count = read_u32_le(0);
    if count != MESSAGE_COUNT { return -2; }
    let mut cur: u32 = 4;
    let mut c_messages: u32 = 0;
    let mut c_fields: u32 = 0;
    let mut c_varint_bytes: u32 = 0;
    let mut c_unknown_fields: u32 = 0;
    let mut c_filtered: u32 = 0;
    for _i in 0..MESSAGE_COUNT {
        if cur + 4 > fixture_len { return -3; }
        let n = read_u32_le(cur);
        cur += 4;
        if cur + n > fixture_len { return -4; }
        let (ok, f, vb, uf) = decode_message(cur, cur + n);
        if !ok { return -5; }
        cur += n;
        c_messages += 1;
        c_fields += f;
        c_varint_bytes += vb;
        c_unknown_fields += uf;
        let (pass, id_lo, id_hi, active, status, name_len, tag_count, map_count, payload_len, choice_kind, note_len, code);
        unsafe {
            id_lo = M_ID_LO;
            id_hi = M_ID_HI;
            active = M_ACTIVE;
            status = M_STATUS;
            name_len = M_NAME_LEN;
            tag_count = M_TAG_COUNT;
            map_count = M_MAP_COUNT;
            payload_len = M_PAYLOAD_LEN;
            choice_kind = M_CHOICE_KIND;
            note_len = M_NOTE_LEN;
            code = M_CODE;
        }
        pass = if active != 0 && status != 3 && mod3_u64(id_lo, id_hi) == 0 { 1 } else { 0 };
        if pass == 1 { c_filtered += 1; }
        fnv_mix_u32(id_lo);
        fnv_mix_u32(id_hi);
        fnv_mix_u32(active);
        fnv_mix_u32(status);
        fnv_mix_u32(name_len);
        fnv_mix_u32(tag_count);
        fnv_mix_u32(map_count);
        fnv_mix_u32(payload_len);
        fnv_mix_u32(choice_kind);
        fnv_mix_u32(note_len);
        fnv_mix_u32(code);
        fnv_mix_u32(pass);
    }
    if cur != fixture_len { return -6; }

    unsafe {
        let results = RES_OFFSET as *mut u32;
        *results.add(0) = c_messages;
        *results.add(1) = c_fields;
        *results.add(2) = c_varint_bytes;
        *results.add(3) = c_unknown_fields;
        *results.add(4) = c_filtered;
        *results.add(5) = fixture_len;
        *results.add(6) = FNV;
        *results.add(7) = 0;
    }
    0
}
