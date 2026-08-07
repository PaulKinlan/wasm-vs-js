// no_std Rust port of the frozen document-pdf-viewer C kernel
// (benchmarks/base/document-pdf-viewer/pdf-engine.c). Same algorithm, same
// ABI (input_ptr/rgba_ptr/counters_ptr/parse/render_page + getters), outputs
// bit-identical by construction. Large statics match the C layout; the wasm
// build must reserve >=16 MiB (matches the frozen pdf-engine.wasm).

#![no_std]

const INPUT_CAPACITY: u32 = 1048576;
const PAGE_CAPACITY: u32 = 128;
const TEXT_CAPACITY: u32 = 96;
const OBJECT_CAPACITY: u32 = 512;
const WIDTH: u32 = 1224;
const HEIGHT: u32 = 1584;
const RGBA_BYTES: u32 = WIDTH * HEIGHT * 4;

static mut INPUT: [u8; 1048576] = [0; 1048576];
static mut OBJECT_OFFSETS: [u32; 512] = [0; 512];
static mut OBJECT_ENDS: [u32; 512] = [0; 512];
static mut PAGE_TEXT: [[u8; 96]; 128] = [[0; 96]; 128];
static mut PAGE_CODES: [[u8; 96]; 128] = [[0; 96]; 128];
static mut PAGE_LENGTHS: [u32; 128] = [0; 128];
static mut PAGE_X: [u32; 128] = [0; 128];
static mut PAGE_Y: [u32; 128] = [0; 128];
static mut PAGE_FONT_SIZE: [u32; 128] = [0; 128];
static mut UNICODE_MAP: [u8; 256] = [0; 256];
static mut UNICODE_VALID: [u8; 256] = [0; 256];
static mut GLYPH_ROWS: [[u8; 7]; 256] = [[0; 7]; 256];
static mut GLYPH_WIDTHS: [u32; 256] = [0; 256];
static mut HIT_PAGES: [u32; 128] = [0; 128];
static mut COUNTERS: [u32; 9] = [0; 9];
static mut RGBA: [u8; 7755264] = [0; 7755264];

static mut INPUT_LENGTH: u32 = 0;
static mut OBJECT_COUNT: u32 = 0;
static mut HITS: u32 = 0;
static mut LAST_ERROR: u32 = 0;
static mut DBG_AT: u32 = 0;

#[inline(always)]
fn inp(at: u32) -> u8 {
    unsafe { INPUT[at as usize] }
}

fn ws(c: u8) -> bool {
    c == 0 || c == 9 || c == 10 || c == 12 || c == 13 || c == 32
}
fn digit(c: u8) -> bool {
    c >= b'0' && c <= b'9'
}
fn delimiter(c: u8) -> bool {
    ws(c) || c == b'/' || c == b'<' || c == b'>' || c == b'[' || c == b']' || c == b'(' || c == b')' || c == b'%'
}
fn skip_ws(at: &mut u32, end: u32) {
    while *at < end {
        if ws(inp(*at)) {
            *at += 1;
            continue;
        }
        if inp(*at) == b'%' {
            while *at < end && inp(*at) != b'\n' && inp(*at) != b'\r' {
                *at += 1;
            }
            continue;
        }
        break;
    }
}
fn literal_at(at: u32, end: u32, text: &[u8]) -> bool {
    if (at + text.len() as u32) > end {
        return false;
    }
    for (i, b) in text.iter().enumerate() {
        if inp(at + i as u32) != *b {
            return false;
        }
    }
    true
}
fn find_range(mut at: u32, end: u32, text: &[u8]) -> u32 {
    let len = text.len() as u32;
    while at + len <= end {
        if literal_at(at, end, text) {
            return at;
        }
        at += 1;
    }
    0xffff_ffff
}
fn read_uint(at: &mut u32, end: u32, value: &mut u32) -> bool {
    skip_ws(at, end);
    if *at >= end || !digit(inp(*at)) {
        return false;
    }
    let mut result: u32 = 0;
    while *at < end && digit(inp(*at)) {
        let next = result.wrapping_mul(10).wrapping_add((inp(*at) - b'0') as u32);
        if next < result {
            return false;
        }
        result = next;
        *at += 1;
    }
    *value = result;
    true
}
fn read_int(at: &mut u32, end: u32, value: &mut i32) -> bool {
    skip_ws(at, end);
    let mut negative = false;
    if *at < end && inp(*at) == b'-' {
        negative = true;
        *at += 1;
    }
    let mut n: u32 = 0;
    if !read_uint(at, end, &mut n) || n > 0x7fff_ffff {
        return false;
    }
    *value = if negative { -(n as i32) } else { n as i32 };
    true
}
fn match_token(at: &mut u32, end: u32, token: &[u8]) -> bool {
    skip_ws(at, end);
    if !literal_at(*at, end, token) {
        return false;
    }
    if (*at + token.len() as u32) < end && !delimiter(inp(*at + token.len() as u32)) {
        return false;
    }
    *at += token.len() as u32;
    true
}
fn key_at(at: u32, end: u32, key: &[u8]) -> bool {
    literal_at(at, end, key)
        && (at == 0 || delimiter(inp(at - 1)))
        && (at + key.len() as u32 == end || delimiter(inp(at + key.len() as u32)))
}
fn find_key(start: u32, end: u32, key: &[u8]) -> u32 {
    let mut at = start;
    while at + key.len() as u32 <= end {
        if key_at(at, end, key) {
            return at;
        }
        at += 1;
    }
    0xffff_ffff
}
fn find_direct_key(start: u32, end: u32, key: &[u8]) -> u32 {
    let mut at = start;
    skip_ws(&mut at, end);
    if !literal_at(at, end, b"<<") {
        return 0xffff_ffff;
    }
    let mut depth: u32 = 0;
    while at < end {
        if inp(at) == b'%' {
            while at < end && inp(at) != b'\n' && inp(at) != b'\r' {
                at += 1;
            }
            continue;
        }
        if inp(at) == b'(' {
            let mut string_depth: u32 = 1;
            at += 1;
            while at < end && string_depth != 0 {
                if inp(at) == b'\\' {
                    at += if at + 1 < end { 2 } else { 1 };
                    continue;
                }
                if inp(at) == b'(' {
                    string_depth += 1;
                } else if inp(at) == b')' {
                    string_depth -= 1;
                }
                at += 1;
            }
            if string_depth != 0 {
                return 0xffff_ffff;
            }
            continue;
        }
        if literal_at(at, end, b"<<") {
            depth += 1;
            at += 2;
            continue;
        }
        if literal_at(at, end, b">>") {
            if depth == 0 {
                return 0xffff_ffff;
            }
            depth -= 1;
            at += 2;
            if depth == 0 {
                return 0xffff_ffff;
            }
            continue;
        }
        if depth == 1 && key_at(at, end, key) {
            return at;
        }
        at += 1;
    }
    0xffff_ffff
}
fn dictionary_after(start: u32, end: u32, key: &[u8], dict_start: &mut u32, dict_end: &mut u32) -> bool {
    let mut at = find_direct_key(start, end, key);
    if at == 0xffff_ffff {
        return false;
    }
    at += key.len() as u32;
    skip_ws(&mut at, end);
    if !literal_at(at, end, b"<<") {
        return false;
    }
    *dict_start = at;
    let mut depth: u32 = 0;
    while at < end {
        if inp(at) == b'(' {
            let mut string_depth: u32 = 1;
            at += 1;
            while at < end && string_depth != 0 {
                if inp(at) == b'\\' {
                    at += if at + 1 < end { 2 } else { 1 };
                    continue;
                }
                if inp(at) == b'(' {
                    string_depth += 1;
                } else if inp(at) == b')' {
                    string_depth -= 1;
                }
                at += 1;
            }
            if string_depth != 0 {
                return false;
            }
            continue;
        }
        if literal_at(at, end, b"<<") {
            depth += 1;
            at += 2;
            continue;
        }
        if literal_at(at, end, b">>") {
            if depth == 0 {
                return false;
            }
            depth -= 1;
            at += 2;
            if depth == 0 {
                *dict_end = at;
                return true;
            }
            continue;
        }
        at += 1;
    }
    false
}
fn direct_ref_after(start: u32, end: u32, key: &[u8], id: &mut u32) -> bool {
    let mut at = find_direct_key(start, end, key);
    if at == 0xffff_ffff {
        return false;
    }
    at += key.len() as u32;
    let mut generation: u32 = 0;
    read_uint(&mut at, end, id) && read_uint(&mut at, end, &mut generation) && generation == 0
        && match_token(&mut at, end, b"R")
}
fn ref_after(start: u32, end: u32, key: &[u8], id: &mut u32) -> bool {
    let mut at = find_key(start, end, key);
    if at == 0xffff_ffff {
        return false;
    }
    at += key.len() as u32;
    let mut generation: u32 = 0;
    read_uint(&mut at, end, id) && read_uint(&mut at, end, &mut generation) && generation == 0
        && match_token(&mut at, end, b"R")
}
fn object_range(id: u32, start: &mut u32, end: &mut u32) -> bool {
    if id == 0 || id > unsafe { OBJECT_COUNT } {
        return false;
    }
    let (off, ends) = unsafe { (OBJECT_OFFSETS[id as usize], OBJECT_ENDS[id as usize]) };
    if off == 0 || ends <= off {
        return false;
    }
    *start = off;
    *end = ends;
    true
}
fn object_has(id: u32, key: &[u8], name: &[u8]) -> bool {
    let (mut start, mut end) = (0, 0);
    if !object_range(id, &mut start, &mut end) {
        return false;
    }
    let mut at = find_key(start, end, key);
    if at == 0xffff_ffff {
        return false;
    }
    at += key.len() as u32;
    skip_ws(&mut at, end);
    key_at(at, end, name)
}
fn stream_range(id: u32, start: &mut u32, end: &mut u32) -> bool {
    let (mut os, mut oe, mut at, mut length) = (0, 0, 0, 0);
    if !object_range(id, &mut os, &mut oe) {
        return false;
    }
    let length_at = find_key(os, oe, b"/Length");
    let stream_at = find_range(os, oe, b"stream");
    if length_at == 0xffff_ffff || stream_at == 0xffff_ffff {
        return false;
    }
    at = length_at + 7;
    if !read_uint(&mut at, oe, &mut length) {
        return false;
    }
    at = stream_at + 6;
    if at < oe && inp(at) == b'\r' {
        at += 1;
    }
    if at >= oe || inp(at) != b'\n' || at + length > oe {
        return false;
    }
    at += 1; // C: input_bytes[at++] != '\n' — the increment happens on success too
    *start = at;
    *end = at + length;
    at += length;
    if at < oe && inp(at) == b'\r' {
        at += 1;
    }
    if at < oe && inp(at) == b'\n' {
        at += 1;
    }
    literal_at(at, oe, b"endstream")
}
fn hex_value(c: u8) -> i32 {
    if c >= b'0' && c <= b'9' {
        (c - b'0') as i32
    } else if c >= b'a' && c <= b'f' {
        (c - b'a' + 10) as i32
    } else if c >= b'A' && c <= b'F' {
        (c - b'A' + 10) as i32
    } else {
        -1
    }
}
fn parse_to_unicode(id: u32) -> bool {
    let (mut at, mut end) = (0, 0);
    if !stream_range(id, &mut at, &mut end) || find_range(at, end, b"begincmap") == 0xffff_ffff
        || find_range(at, end, b"endcmap") == 0xffff_ffff
    {
        return false;
    }
    let mut mappings: u32 = 0;
    while at + 11 <= end {
        if inp(at) != b'<' || inp(at + 3) != b'>' {
            at += 1;
            continue;
        }
        let a = hex_value(inp(at + 1));
        let b = hex_value(inp(at + 2));
        let mut p = at + 4;
        skip_ws(&mut p, end);
        if a < 0 || b < 0 || p + 6 > end || inp(p) != b'<' || inp(p + 5) != b'>' {
            at += 1;
            continue;
        }
        let h0 = hex_value(inp(p + 1));
        let h1 = hex_value(inp(p + 2));
        let h2 = hex_value(inp(p + 3));
        let h3 = hex_value(inp(p + 4));
        let code = (a as u32) * 16 + (b as u32);
        let scalar = (h0 as u32) * 4096 + (h1 as u32) * 256 + (h2 as u32) * 16 + (h3 as u32);
        if h0 < 0 || h1 < 0 || h2 < 0 || h3 < 0 || scalar > 127 || unsafe { UNICODE_VALID[code as usize] } != 0 {
            return false;
        }
        unsafe {
            UNICODE_MAP[code as usize] = scalar as u8;
            UNICODE_VALID[code as usize] = 1;
        }
        mappings += 1;
        at = p + 6;
    }
    mappings > 0
}
fn same_name(at: u32, length: u32, other: u32, other_length: u32) -> bool {
    if length != other_length {
        return false;
    }
    for i in 0..length {
        if inp(at + i) != inp(other + i) {
            return false;
        }
    }
    true
}
fn charproc_ref(cp_start: u32, cp_end: u32, name_at: u32, name_length: u32, id: &mut u32) -> bool {
    let mut at = cp_start;
    while at < cp_end {
        skip_ws(&mut at, cp_end);
        if at >= cp_end || inp(at) != b'/' {
            return false;
        }
        at += 1;
        let start = at;
        while at < cp_end && !delimiter(inp(at)) {
            at += 1;
        }
        let length = at - start;
        let mut object: u32 = 0;
        let mut generation: u32 = 0;
        if !read_uint(&mut at, cp_end, &mut object) || !read_uint(&mut at, cp_end, &mut generation)
            || generation != 0 || !match_token(&mut at, cp_end, b"R")
        {
            return false;
        }
        if same_name(start, length, name_at, name_length) {
            *id = object;
            return true;
        }
    }
    false
}
fn parse_charproc(id: u32, code: u32) -> bool {
    let (mut at, mut end) = (0, 0);
    if !stream_range(id, &mut at, &mut end) {
        return false;
    }
    let mut number: i32 = 0;
    for _ in 0..6 {
        if !read_int(&mut at, end, &mut number) {
            return false;
        }
    }
    if !match_token(&mut at, end, b"d1") {
        return false;
    }
    loop {
        skip_ws(&mut at, end);
        if at == end {
            return true;
        }
        let (mut x, mut y, mut w, mut h) = (0i32, 0i32, 0i32, 0i32);
        if !read_int(&mut at, end, &mut x) || !read_int(&mut at, end, &mut y)
            || !read_int(&mut at, end, &mut w) || !read_int(&mut at, end, &mut h)
            || !match_token(&mut at, end, b"re") || !match_token(&mut at, end, b"f")
        {
            return false;
        }
        if x < 0 || x > 4 || y < 0 || y > 6 || w != 1 || h != 1 {
            return false;
        }
        unsafe {
            GLYPH_ROWS[code as usize][(6 - y as u32) as usize] |= 1u8 << (4 - x as u32);
        }
    }
}
fn parse_font(id: u32) -> bool {
    let (mut start, mut end, mut to_unicode) = (0, 0, 0);
    if !object_range(id, &mut start, &mut end)
        || !object_has(id, b"/Type", b"/Font")
        || !object_has(id, b"/Subtype", b"/Type3")
        || find_range(start, end, b"/FontMatrix [0.125 0 0 0.125 0 0]") == 0xffff_ffff
        || !ref_after(start, end, b"/ToUnicode", &mut to_unicode)
        || !parse_to_unicode(to_unicode)
    {
        return false;
    }
    let mut cp = find_key(start, end, b"/CharProcs");
    if cp == 0xffff_ffff {
        return false;
    }
    cp = find_range(cp, end, b"<<");
    if cp == 0xffff_ffff {
        return false;
    }
    let cp_end = find_range(cp + 2, end, b">>");
    if cp_end == 0xffff_ffff {
        return false;
    }
    cp += 2;
    let mut differences = find_key(start, end, b"/Differences");
    if differences == 0xffff_ffff {
        return false;
    }
    differences = find_range(differences, end, b"[");
    if differences == 0xffff_ffff {
        return false;
    }
    let diff_end = find_range(differences + 1, end, b"]");
    if diff_end == 0xffff_ffff {
        return false;
    }
    let mut at = differences + 1;
    let mut code: u32 = 0xffff_ffff;
    while at < diff_end {
        skip_ws(&mut at, diff_end);
        if at >= diff_end {
            break;
        }
        if digit(inp(at)) {
            if !read_uint(&mut at, diff_end, &mut code) || code > 255 {
                return false;
            }
        } else if inp(at) == b'/' {
            at += 1;
            let name = at;
            while at < diff_end && !delimiter(inp(at)) {
                at += 1;
            }
            let mut proc: u32 = 0;
            if code > 255 || !charproc_ref(cp, cp_end, name, at - name, &mut proc)
                || !parse_charproc(proc, code)
            {
                return false;
            }
            code += 1;
        } else {
            return false;
        }
    }
    let mut first: u32 = 0;
    let mut last: u32 = 0;
    let mut first_at = find_key(start, end, b"/FirstChar");
    let mut last_at = find_key(start, end, b"/LastChar");
    if first_at == 0xffff_ffff || last_at == 0xffff_ffff {
        return false;
    }
    first_at += 10;
    last_at += 9;
    if !read_uint(&mut first_at, end, &mut first) || !read_uint(&mut last_at, end, &mut last)
        || first > last || last > 255
    {
        return false;
    }
    let mut widths = find_key(start, end, b"/Widths");
    widths = if widths == 0xffff_ffff {
        widths
    } else {
        find_range(widths, end, b"[")
    };
    if widths == 0xffff_ffff {
        return false;
    }
    at = widths + 1;
    let mut c = first;
    while c <= last {
        if !read_uint(&mut at, end, unsafe { &mut GLYPH_WIDTHS[c as usize] }) {
            return false;
        }
        c += 1;
    }
    skip_ws(&mut at, end);
    at < end && inp(at) == b']'
}
fn parse_content(id: u32, page: u32) -> bool {
    let (mut at, mut end) = (0, 0);
    if !stream_range(id, &mut at, &mut end) || !match_token(&mut at, end, b"BT") {
        unsafe { LAST_ERROR = 200 + 0; }
        return false;
    }
    skip_ws(&mut at, end);
    if at >= end || inp(at) != b'/' {
        unsafe { LAST_ERROR = 200 + 1; }
        return false;
    }
    at += 1;
    if !match_token(&mut at, end, b"F1") || !read_uint(&mut at, end, unsafe { &mut PAGE_FONT_SIZE[page as usize] })
        || !match_token(&mut at, end, b"Tf") || !read_uint(&mut at, end, unsafe { &mut PAGE_X[page as usize] })
        || !read_uint(&mut at, end, unsafe { &mut PAGE_Y[page as usize] }) || !match_token(&mut at, end, b"Td")
    {
        unsafe { LAST_ERROR = 200 + 2; }
        return false;
    }
    skip_ws(&mut at, end);
    if at >= end || inp(at) != b'(' {
        unsafe { LAST_ERROR = 200 + 3; }
        return false;
    }
    at += 1;
    let mut length: u32 = 0;
    while at < end && inp(at) != b')' {
        let mut code = inp(at);
        at += 1;
        if code == b'\\' {
            if at >= end {
                unsafe { LAST_ERROR = 200 + 4; }
                return false;
            }
            code = inp(at);
            at += 1;
        }
        if length >= TEXT_CAPACITY || unsafe { UNICODE_VALID[code as usize] } == 0 {
            unsafe { LAST_ERROR = 200 + 5; }
            return false;
        }
        unsafe {
            PAGE_CODES[page as usize][length as usize] = code;
            PAGE_TEXT[page as usize][length as usize] = UNICODE_MAP[code as usize];
        }
        length += 1;
    }
    if at >= end {
        unsafe {
            LAST_ERROR = 200 + 6;
            DBG_AT = at;
        }
        return false;
    }
    // C: input_bytes[at++] != ')' — the increment happens during the read, on
    // success and failure alike (mirror of the stream_range newline pattern).
    let closes = inp(at) == b')';
    at += 1;
    if !closes || !match_token(&mut at, end, b"Tj") || !match_token(&mut at, end, b"ET") {
        unsafe {
            LAST_ERROR = 200 + 6;
            DBG_AT = at;
        }
        return false;
    }
    skip_ws(&mut at, end);
    if at != end {
        unsafe { LAST_ERROR = 200 + 7; }
        return false;
    }
    unsafe { PAGE_LENGTHS[page as usize] = length }
    true
}

#[no_mangle]
pub extern "C" fn input_ptr() -> u32 {
    unsafe { INPUT.as_ptr() as usize as u32 }
}
#[no_mangle]
pub extern "C" fn rgba_ptr() -> u32 {
    unsafe { RGBA.as_ptr() as usize as u32 }
}
#[no_mangle]
pub extern "C" fn counters_ptr() -> u32 {
    unsafe { COUNTERS.as_ptr() as usize as u32 }
}
#[no_mangle]
pub extern "C" fn error_code() -> u32 {
    unsafe { LAST_ERROR }
}
#[no_mangle]
pub extern "C" fn page_count() -> u32 {
    unsafe { COUNTERS[1] }
}
#[no_mangle]
pub extern "C" fn hit_count() -> u32 {
    unsafe { HITS }
}
#[no_mangle]
pub extern "C" fn hit_page(index: u32) -> u32 {
    unsafe { if index < HITS { HIT_PAGES[index as usize] } else { 0 } }
}
#[no_mangle]
pub extern "C" fn text_ptr(page: u32) -> u32 {
    unsafe {
        if page < COUNTERS[1] {
            PAGE_TEXT[page as usize].as_ptr() as usize as u32
        } else {
            0
        }
    }
}
#[no_mangle]
pub extern "C" fn text_len(page: u32) -> u32 {
    unsafe { if page < COUNTERS[1] { PAGE_LENGTHS[page as usize] } else { 0 } }
}

#[no_mangle]
pub extern "C" fn parse(length: u32) -> u32 {
    unsafe {
        LAST_ERROR = 0;
        INPUT_LENGTH = length;
        HITS = 0;
        for c in COUNTERS.iter_mut() {
            *c = 0;
        }
        for i in OBJECT_OFFSETS.iter_mut() {
            *i = 0;
        }
        for i in OBJECT_ENDS.iter_mut() {
            *i = 0;
        }
        for i in 0..256usize {
            UNICODE_MAP[i] = 0;
            UNICODE_VALID[i] = 0;
            GLYPH_WIDTHS[i] = 0;
            for r in 0..7usize {
                GLYPH_ROWS[i][r] = 0;
            }
        }
    }
    if length < 128 || length > INPUT_CAPACITY || !literal_at(0, length, b"%PDF-1.7\n") {
        return set_error(1);
    }
    let sx0 = if length > 64 { length - 64 } else { 0 };
    let mut sx = find_range(sx0, length, b"startxref");
    let mut xref: u32 = 0;
    if sx == 0xffff_ffff {
        return set_error(2);
    }
    sx += 9;
    if !read_uint(&mut sx, length, &mut xref) || xref >= length || !literal_at(xref, length, b"xref") {
        return set_error(3);
    }
    let mut at = xref + 4;
    let (mut first, mut size) = (0, 0);
    if !read_uint(&mut at, length, &mut first) || first != 0 || !read_uint(&mut at, length, &mut size)
        || size < 2 || size > OBJECT_CAPACITY
    {
        return set_error(4);
    }
    unsafe { OBJECT_COUNT = size - 1 }
    for id in 0..size {
        let (mut offset, mut generation) = (0, 0);
        if !read_uint(&mut at, length, &mut offset) || !read_uint(&mut at, length, &mut generation) {
            return set_error(5);
        }
        skip_ws(&mut at, length);
        let state = inp(at);
        at += 1;
        while at < length && inp(at) != b'\n' {
            at += 1;
        }
        if at < length {
            at += 1;
        }
        if id == 0 {
            if state != b'f' || generation != 65535 {
                return set_error(6);
            }
        } else if state != b'n' || generation != 0 || offset == 0 || offset >= xref {
            return set_error(7);
        } else {
            unsafe { OBJECT_OFFSETS[id as usize] = offset }
        }
    }
    if !literal_at(at, length, b"trailer") {
        return set_error(8);
    }
    let trailer_end = find_range(at, length, b"startxref");
    let size_key0 = find_key(at, trailer_end, b"/Size");
    let root_key0 = find_key(at, trailer_end, b"/Root");
    let (mut trailer_size, mut root, mut root_generation) = (0, 0, 0);
    if trailer_end == 0xffff_ffff || size_key0 == 0xffff_ffff || root_key0 == 0xffff_ffff {
        return set_error(9);
    }
    let mut size_key = size_key0 + 5;
    let mut root_key = root_key0 + 5;
    if !read_uint(&mut size_key, trailer_end, &mut trailer_size) || trailer_size != size
        || !read_uint(&mut root_key, trailer_end, &mut root)
        || !read_uint(&mut root_key, trailer_end, &mut root_generation) || root_generation != 0
        || !match_token(&mut root_key, trailer_end, b"R") || root == 0 || root >= size
    {
        return set_error(10);
    }
    for id in 1..size {
        let mut p = unsafe { OBJECT_OFFSETS[id as usize] };
        let (mut found_id, mut generation) = (0, 0);
        if !read_uint(&mut p, xref, &mut found_id) || found_id != id || !read_uint(&mut p, xref, &mut generation)
            || generation != 0 || !match_token(&mut p, xref, b"obj")
        {
            return set_error(11);
        }
        let next = if id + 1 < size { unsafe { OBJECT_OFFSETS[(id + 1) as usize] } } else { xref };
        let close = find_range(p, next, b"endobj");
        if close == 0xffff_ffff {
            return set_error(12);
        }
        unsafe {
            OBJECT_OFFSETS[id as usize] = p;
            OBJECT_ENDS[id as usize] = close;
        }
    }
    let (mut root_start, mut root_end, mut pages_root) = (0, 0, 0);
    if !object_range(root, &mut root_start, &mut root_end) || !object_has(root, b"/Type", b"/Catalog")
        || !ref_after(root_start, root_end, b"/Pages", &mut pages_root)
    {
        return set_error(13);
    }
    let (mut pages_start, mut pages_end, mut count) = (0, 0, 0);
    if !object_range(pages_root, &mut pages_start, &mut pages_end) || !object_has(pages_root, b"/Type", b"/Pages") {
        return set_error(14);
    }
    let mut count_at = find_key(pages_start, pages_end, b"/Count");
    let mut kids = find_key(pages_start, pages_end, b"/Kids");
    if count_at == 0xffff_ffff || kids == 0xffff_ffff {
        return set_error(15);
    }
    count_at += 6;
    if !read_uint(&mut count_at, pages_end, &mut count) || count == 0 || count > PAGE_CAPACITY {
        return set_error(16);
    }
    kids = find_range(kids, pages_end, b"[");
    if kids == 0xffff_ffff {
        return set_error(17);
    }
    kids += 1;
    let mut shared_font: u32 = 0;
    let mut page = 0;
    while page < count {
        let (mut page_id, mut generation) = (0, 0);
        if !read_uint(&mut kids, pages_end, &mut page_id) || !read_uint(&mut kids, pages_end, &mut generation)
            || generation != 0 || !match_token(&mut kids, pages_end, b"R")
        {
            return set_error(18);
        }
        let (mut ps, mut pe, mut parent, mut contents, mut font) = (0, 0, 0, 0, 0);
        let (mut resources_start, mut resources_end, mut fonts_start, mut fonts_end) = (0, 0, 0, 0);
        if !object_range(page_id, &mut ps, &mut pe) || !object_has(page_id, b"/Type", b"/Page")
            || !ref_after(ps, pe, b"/Parent", &mut parent) || parent != pages_root
            || find_range(ps, pe, b"/MediaBox [0 0 612 792]") == 0xffff_ffff
            || !dictionary_after(ps, pe, b"/Resources", &mut resources_start, &mut resources_end)
            || !dictionary_after(resources_start, resources_end, b"/Font", &mut fonts_start, &mut fonts_end)
            || !direct_ref_after(fonts_start, fonts_end, b"/F1", &mut font)
            || !ref_after(ps, pe, b"/Contents", &mut contents)
        {
            return set_error(19);
        }
        if page == 0 {
            shared_font = font;
            if !parse_font(font) {
                return set_error(20);
            }
        } else if font != shared_font {
            return set_error(21);
        }
        if !parse_content(contents, page) {
            return set_error(22);
        }
        page += 1;
    }
    skip_ws(&mut kids, pages_end);
    if kids >= pages_end || inp(kids) != b']' {
        return set_error(23);
    }
    let (mut glyphs, mut comparisons) = (0, 0);
    for page in 0..count {
        let mut found = false;
        let plen = unsafe { PAGE_LENGTHS[page as usize] };
        let mut i: u32 = 0;
        while i + 6 <= plen {
            comparisons += 1;
            if unsafe {
                PAGE_TEXT[page as usize][i as usize] == b'N'
                    && PAGE_TEXT[page as usize][(i + 1) as usize] == b'E'
                    && PAGE_TEXT[page as usize][(i + 2) as usize] == b'E'
                    && PAGE_TEXT[page as usize][(i + 3) as usize] == b'D'
                    && PAGE_TEXT[page as usize][(i + 4) as usize] == b'L'
                    && PAGE_TEXT[page as usize][(i + 5) as usize] == b'E'
            } {
                found = true;
            }
            i += 1;
        }
        if found {
            unsafe {
                HIT_PAGES[HITS as usize] = page + 1;
                HITS += 1;
            }
        }
        glyphs += plen;
    }
    unsafe {
        COUNTERS[0] = OBJECT_COUNT;
        COUNTERS[1] = count;
        COUNTERS[2] = glyphs;
        COUNTERS[3] = comparisons;
        COUNTERS[4] = 0;
        COUNTERS[5] = WIDTH;
        COUNTERS[6] = HEIGHT;
        COUNTERS[7] = 1;
        COUNTERS[8] = RGBA_BYTES;
    }
    0
}

fn set_error(code: u32) -> u32 {
    unsafe { LAST_ERROR = code }
    code
}

fn raster_page_allowed(page: u32) -> bool {
    page == 1 || page == 25 || page == 50 || page == 75 || page == 100
}

#[no_mangle]
pub extern "C" fn render_page(page: u32) -> u32 {
    let page_count_val = unsafe { COUNTERS[1] };
    if !raster_page_allowed(page) || page > page_count_val {
        return set_error(24);
    }
    unsafe {
        for b in RGBA.iter_mut() {
            *b = 255;
        }
    }
    let index = page - 1;
    if unsafe { PAGE_FONT_SIZE[index as usize] } != 16 {
        return set_error(25);
    }
    let mut x = unsafe { PAGE_X[index as usize] } * 2;
    let plen = unsafe { PAGE_LENGTHS[index as usize] };
    let mut g: u32 = 0;
    while g < plen {
        let code = unsafe { PAGE_CODES[index as usize][g as usize] };
        if unsafe { UNICODE_VALID[code as usize] == 0 || GLYPH_WIDTHS[code as usize] == 0 } {
            return set_error(26);
        }
        let mut row: u32 = 0;
        while row < 7 {
            let mut col: u32 = 0;
            while col < 5 {
                if unsafe { (GLYPH_ROWS[code as usize][row as usize] >> (4 - col)) & 1 } != 0 {
                    let left = x + col * 4;
                    let top = HEIGHT - unsafe { PAGE_Y[index as usize] } * 2 - 28 + row * 4;
                    if left + 4 >= WIDTH || top + 4 >= HEIGHT {
                        return set_error(27);
                    }
                    let mut dy: u32 = 0;
                    while dy <= 4 {
                        let mut dx: u32 = 0;
                        while dx <= 4 {
                            let out = ((top + dy) * WIDTH + left + dx) * 4;
                            unsafe {
                                RGBA[out as usize] = 0;
                                RGBA[out as usize + 1] = 0;
                                RGBA[out as usize + 2] = 0;
                            }
                            dx += 1;
                        }
                        dy += 1;
                    }
                }
                col += 1;
            }
            row += 1;
        }
        x += unsafe { GLYPH_WIDTHS[code as usize] } * 4;
        g += 1;
    }
    unsafe { COUNTERS[4] += 1 }
    0
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
