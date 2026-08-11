// markdown_cms_kernel.rs — multilang compute core for text.markdown-cms.v1.
// Same ABI + oracle as markdown_cms_kernel.c. See the C file for the ABI docs.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const FIXTURE_OFFSET: usize = 3145728;
const OUTPUT_OFFSET: usize = 15728640;
const AST_OFFSET: usize = 27262976;
const RES_OFFSET: usize = 28311552;
const FIXTURE_MAGIC: u32 = 0x3146434d;
const DOCUMENTS: u32 = 500;
const RECORD_FIELDS: u32 = 6;
const MAX_RECORDS: u32 = 4096;
const MAX_INPUT: u32 = 40960;

const T_H1: u32 = 1;
const T_H2: u32 = 2;
const T_PARAGRAPH: u32 = 3;
const T_LINK: u32 = 4;
const T_FIGURE: u32 = 5;
const T_RAW: u32 = 6;

static mut OUT_AT: u32 = 0;
static mut FNV: u32 = 0;

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read_u32_le(off: u32) -> u32 {
    (fixture_at(off) as u32) | ((fixture_at(off + 1) as u32) << 8) |
        ((fixture_at(off + 2) as u32) << 16) | ((fixture_at(off + 3) as u32) << 24)
}
fn fnv_reset() { unsafe { FNV = 0x811c9dc5; } }
fn fnv_mix_byte(b: u8) { unsafe { FNV = (FNV ^ (b as u32)).wrapping_mul(0x01000193); } }

fn out_byte_raw(v: u8) {
    unsafe {
        *((OUTPUT_OFFSET as *mut u8).add(OUT_AT as usize)) = v;
        OUT_AT += 1;
    }
}
fn out_bytes(p: &[u8]) {
    for &b in p { out_byte_raw(b); }
}
fn out_fixture_range(off: u32, n: u32) {
    for i in 0..n { out_byte_raw(fixture_at(off + i)); }
}

fn ast_write(index: u32, field: u32, value: u32) {
    unsafe {
        let base = (AST_OFFSET as *mut u32).add((index * RECORD_FIELDS + field) as usize);
        *base = value;
    }
}
fn ast_read(index: u32, field: u32) -> u32 {
    unsafe {
        let base = (AST_OFFSET as *const u32).add((index * RECORD_FIELDS + field) as usize);
        *base
    }
}

fn is_alnum_ascii(c: u8) -> bool {
    (c >= b'A' && c <= b'Z') || (c >= b'a' && c <= b'z') || (c >= b'0' && c <= b'9')
}
fn to_lower_ascii(c: u8) -> u8 {
    if c >= b'A' && c <= b'Z' { c + 32 } else { c }
}
fn utf8_len(c: u8) -> u32 {
    if c < 0x80 { 1 }
    else if (c & 0xe0) == 0xc0 { 2 }
    else if (c & 0xf0) == 0xe0 { 3 }
    else if (c & 0xf8) == 0xf0 { 4 }
    else { 1 }
}

fn write_escaped(off: u32, n: u32) {
    for i in 0..n {
        let c = fixture_at(off + i);
        match c {
            38 => out_bytes(b"&amp;"),
            60 => out_bytes(b"&lt;"),
            62 => out_bytes(b"&gt;"),
            34 => out_bytes(b"&quot;"),
            _ => out_byte_raw(c),
        }
    }
}

fn write_slug(off: u32, n: u32) {
    let start_at = unsafe { OUT_AT };
    let mut dash = false;
    let mut i: u32 = 0;
    while i < n {
        let c = fixture_at(off + i);
        if c < 0x80 {
            if is_alnum_ascii(c) {
                out_byte_raw(to_lower_ascii(c));
                dash = false;
            } else if unsafe { OUT_AT } > start_at && !dash {
                out_byte_raw(b'-');
                dash = true;
            }
            i += 1;
        } else {
            if unsafe { OUT_AT } > start_at && !dash {
                out_byte_raw(b'-');
                dash = true;
            }
            i += utf8_len(c);
        }
    }
    // Trim one trailing '-'.
    unsafe {
        if OUT_AT > start_at {
            let last = *((OUTPUT_OFFSET as *const u8).add(OUT_AT as usize - 1));
            if last == b'-' { OUT_AT -= 1; }
        }
        if OUT_AT == start_at { out_bytes(b"section"); }
    }
}

fn allowed_raw(off: u32, n: u32) -> bool {
    if n >= 9 &&
        fixture_at(off) == 60 && fixture_at(off + 1) == b'e' &&
        fixture_at(off + 2) == b'm' && fixture_at(off + 3) == 62 &&
        fixture_at(off + n - 5) == 60 && fixture_at(off + n - 4) == 47 &&
        fixture_at(off + n - 3) == b'e' && fixture_at(off + n - 2) == b'm' &&
        fixture_at(off + n - 1) == 62 {
        let mut i = 4u32;
        while i < n - 5 {
            let c = fixture_at(off + i);
            if c == 60 || c == 62 { return false; }
            i += 1;
        }
        return true;
    }
    if n >= 17 &&
        fixture_at(off) == 60 && fixture_at(off + 1) == b's' &&
        fixture_at(off + 2) == b't' && fixture_at(off + 3) == b'r' &&
        fixture_at(off + 4) == b'o' && fixture_at(off + 5) == b'n' &&
        fixture_at(off + 6) == b'g' && fixture_at(off + 7) == 62 &&
        fixture_at(off + n - 9) == 60 && fixture_at(off + n - 8) == 47 &&
        fixture_at(off + n - 7) == b's' && fixture_at(off + n - 6) == b't' &&
        fixture_at(off + n - 5) == b'r' && fixture_at(off + n - 4) == b'o' &&
        fixture_at(off + n - 3) == b'n' && fixture_at(off + n - 2) == b'g' &&
        fixture_at(off + n - 1) == 62 {
        let mut i = 8u32;
        while i < n - 9 {
            let c = fixture_at(off + i);
            if c == 60 || c == 62 { return false; }
            i += 1;
        }
        return true;
    }
    false
}

fn safe_url(off: u32, n: u32, image: bool) -> bool {
    for i in 0..n {
        let c = fixture_at(off + i);
        if c <= 32 || c >= 127 || c == 34 || c == 39 || c == 60 || c == 62 || c == 92 {
            return false;
        }
    }
    if image {
        let prefix: &[u8] = b"https://images.example.test/";
        if n < prefix.len() as u32 { return false; }
        for i in 0..prefix.len() as u32 {
            if fixture_at(off + i) != prefix[i as usize] { return false; }
        }
        return true;
    }
    let a: &[u8] = b"https://example.test/";
    let b: &[u8] = b"https://docs.example.test/";
    if n >= a.len() as u32 {
        let mut ok = true;
        for i in 0..a.len() as u32 {
            if fixture_at(off + i) != a[i as usize] { ok = false; break; }
        }
        if ok { return true; }
    }
    if n >= b.len() as u32 {
        let mut ok = true;
        for i in 0..b.len() as u32 {
            if fixture_at(off + i) != b[i as usize] { ok = false; break; }
        }
        if ok { return true; }
    }
    false
}

fn parse_markdown(doc_off: u32, doc_len: u32) -> i32 {
    if doc_len > MAX_INPUT { return -1; }
    let mut node_count: u32 = 0;
    let mut non_empty: u32 = 0;
    let mut start: u32 = 0;
    let mut end: u32 = 0;
    while end <= doc_len {
        if end != doc_len && fixture_at(doc_off + end) != 10 { end += 1; continue; }
        if end == start { start = end + 1; end += 1; continue; }
        non_empty += 1;
        if non_empty > MAX_RECORDS { return -2; }
        let mut r_type: u32 = T_PARAGRAPH;
        let mut text_start = start;
        let mut text_length = end - start;
        let mut url_start: u32 = 0;
        let mut url_length: u32 = 0;
        let s0 = fixture_at(doc_off + start);
        let s1 = if start + 1 < end { fixture_at(doc_off + start + 1) } else { 0 };
        let s2 = if start + 2 < end { fixture_at(doc_off + start + 2) } else { 0 };
        if text_length >= 3 && s0 == b'#' && s1 == b' ' {
            r_type = T_H1;
            text_start = start + 2;
            text_length -= 2;
        } else if text_length >= 4 && s0 == b'#' && s1 == b'#' && s2 == b' ' {
            r_type = T_H2;
            text_start = start + 3;
            text_length -= 3;
        } else if s0 == 60 {
            r_type = T_RAW;
        } else if s0 == 91 || (text_length >= 5 && s0 == 33 && s1 == 91) {
            let image = s0 == 33;
            let mut cursor = start + if image { 1 } else { 0 };
            let candidate_text_start = cursor + 1;
            let mut close: u32 = 0;
            while cursor + 2 < end {
                if fixture_at(doc_off + cursor) == 93 &&
                    fixture_at(doc_off + cursor + 1) == 40 {
                    close = cursor;
                    break;
                }
                cursor += 1;
            }
            if close != 0 && fixture_at(doc_off + end - 1) == 41 {
                r_type = if image { T_FIGURE } else { T_LINK };
                text_start = candidate_text_start;
                text_length = close - candidate_text_start;
                url_start = close + 2;
                url_length = end - url_start - 1;
            }
        }
        ast_write(node_count, 0, r_type);
        ast_write(node_count, 1, doc_off + text_start);
        ast_write(node_count, 2, text_length);
        ast_write(node_count, 3, if url_start != 0 { doc_off + url_start } else { 0 });
        ast_write(node_count, 4, url_length);
        ast_write(node_count, 5, 0);
        node_count += 1;
        start = end + 1;
        end += 1;
    }
    node_count as i32
}

fn transform_ast(node_count: u32) -> (u32, u32, u32, u32, u32, u32) {
    let mut headings: u32 = 0;
    let mut links: u32 = 0;
    let mut figures: u32 = 0;
    let mut transforms: u32 = 0;
    let mut sanitizer: u32 = 0;
    let mut rejected: u32 = 0;
    for i in 0..node_count {
        let t = ast_read(i, 0);
        if t == T_H1 || t == T_H2 {
            headings += 1;
            transforms += 1;
            ast_write(i, 5, 1);
        } else if t == T_LINK || t == T_FIGURE {
            if t == T_LINK { links += 1; } else { figures += 1; }
            transforms += 1;
            sanitizer += 1;
            let image = t == T_FIGURE;
            let ok = safe_url(ast_read(i, 3), ast_read(i, 4), image);
            ast_write(i, 5, if ok { 1 } else { 0 });
            if !ok { rejected += 1; }
        } else if t == T_RAW {
            sanitizer += 1;
            let ok = allowed_raw(ast_read(i, 1), ast_read(i, 2));
            ast_write(i, 5, if ok { 1 } else { 0 });
            if !ok { rejected += 1; }
        } else {
            ast_write(i, 5, 1);
        }
    }
    (headings, links, figures, transforms, sanitizer, rejected)
}

fn render_ast(node_count: u32, headings: u32) {
    if headings != 0 {
        out_bytes(b"<nav aria-label=\"Table of contents\"><ol>");
        for i in 0..node_count {
            let t = ast_read(i, 0);
            if t == T_H1 || t == T_H2 {
                let t_off = ast_read(i, 1);
                let t_len = ast_read(i, 2);
                out_bytes(b"<li><a href=\"#");
                write_slug(t_off, t_len);
                out_bytes(b"\">");
                write_escaped(t_off, t_len);
                out_bytes(b"</a></li>");
            }
        }
        out_bytes(b"</ol></nav>");
    }
    for i in 0..node_count {
        let t = ast_read(i, 0);
        let flag = ast_read(i, 5);
        let t_off = ast_read(i, 1);
        let t_len = ast_read(i, 2);
        if t == T_H1 {
            out_bytes(b"<h1 id=\"");
            write_slug(t_off, t_len);
            out_bytes(b"\">");
            write_escaped(t_off, t_len);
            out_bytes(b"</h1>");
        } else if t == T_H2 {
            out_bytes(b"<h2 id=\"");
            write_slug(t_off, t_len);
            out_bytes(b"\">");
            write_escaped(t_off, t_len);
            out_bytes(b"</h2>");
        } else if t == T_PARAGRAPH {
            out_bytes(b"<p>");
            write_escaped(t_off, t_len);
            out_bytes(b"</p>");
        } else if t == T_LINK && flag != 0 {
            out_bytes(b"<p><a href=\"");
            write_escaped(ast_read(i, 3), ast_read(i, 4));
            out_bytes(b"\">");
            write_escaped(t_off, t_len);
            out_bytes(b"</a></p>");
        } else if t == T_FIGURE && flag != 0 {
            out_bytes(b"<figure><img src=\"");
            write_escaped(ast_read(i, 3), ast_read(i, 4));
            out_bytes(b"\" alt=\"");
            write_escaped(t_off, t_len);
            out_bytes(b"\"></figure>");
        } else if t == T_RAW && flag != 0 {
            out_fixture_range(t_off, t_len);
        }
    }
}

#[no_mangle]
pub extern "C" fn markdown_cms_render(fixture_len: u32) -> i32 {
    unsafe { OUT_AT = 0; }
    fnv_reset();
    if fixture_len < 8 { return -1; }
    if read_u32_le(0) != FIXTURE_MAGIC { return -2; }
    if read_u32_le(4) != DOCUMENTS { return -3; }
    let mut cur: u32 = 8;
    let mut c_docs: u32 = 0;
    let mut c_input_bytes: u32 = 0;
    let mut c_tokens: u32 = 0;
    let mut c_ast_nodes: u32 = 0;
    let mut c_transforms: u32 = 0;
    let mut c_sanitizer: u32 = 0;
    let mut c_rejected: u32 = 0;
    for _d in 0..DOCUMENTS {
        if cur + 4 > fixture_len { return -4; }
        let doc_len = read_u32_le(cur);
        cur += 4;
        if cur + doc_len > fixture_len { return -5; }
        let nc_signed = parse_markdown(cur, doc_len);
        if nc_signed < 0 { return -6; }
        let nc = nc_signed as u32;
        let (headings, links, figures, transforms, sanitizer, rejected) = transform_ast(nc);
        render_ast(nc, headings);
        c_docs += 1;
        c_input_bytes += doc_len;
        c_tokens += nc;
        c_ast_nodes += nc + headings * 2 + if headings != 0 { 2 } else { 0 } + links + figures;
        c_transforms += transforms;
        c_sanitizer += sanitizer;
        c_rejected += rejected;
        cur += doc_len;
    }
    if cur != fixture_len { return -7; }

    fnv_reset();
    unsafe {
        let out = OUTPUT_OFFSET as *const u8;
        for i in 0..OUT_AT {
            fnv_mix_byte(*out.add(i as usize));
        }
    }

    unsafe {
        let results = RES_OFFSET as *mut u32;
        *results.add(0) = c_docs;
        *results.add(1) = c_input_bytes;
        *results.add(2) = c_tokens;
        *results.add(3) = c_ast_nodes;
        *results.add(4) = c_transforms;
        *results.add(5) = c_sanitizer;
        *results.add(6) = OUT_AT;
        *results.add(7) = c_rejected;
        *results.add(8) = FNV;
        *results.add(9) = 0;
    }
    0
}
