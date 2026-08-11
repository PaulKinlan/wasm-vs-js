// server_ssr_kernel.rs — multilang compute core for server.ssr-template.v1.
// Same ABI + oracle as server_ssr_kernel.c. See the C file for the ABI docs.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const FIXTURE_OFFSET: usize = 3145728;
const OUTPUT_OFFSET: usize = 3407872;
const RES_OFFSET: usize = 3932160;
const FIXTURE_MAGIC: u32 = 0x31465353;
const OUTPUT_MAGIC: u32 = 0x314f5353;
const RECORDS: u32 = 1000;
const TOKENS_PER_RESPONSE: u32 = 23;

static mut OUT_AT: u32 = 0;
static mut OUT_FAILED: bool = false;
static mut FNV: u32 = 0;
static mut C_TEXT_ESCAPES: u32 = 0;
static mut C_ATTRIBUTE_ESCAPES: u32 = 0;
static mut C_URL_ESCAPES: u32 = 0;
static mut C_INTEGER_FORMATS: u32 = 0;
static mut C_DATE_FORMATS: u32 = 0;
static mut CUR: u32 = 0;
static mut CUR_FAILED: bool = false;

fn fixture_at(off: u32) -> u8 {
    unsafe { *((FIXTURE_OFFSET as *const u8).add(off as usize)) }
}
fn read_u32_le(off: u32) -> u32 {
    (fixture_at(off) as u32) | ((fixture_at(off + 1) as u32) << 8) |
        ((fixture_at(off + 2) as u32) << 16) | ((fixture_at(off + 3) as u32) << 24)
}
fn fnv_reset() { unsafe { FNV = 0x811c9dc5; } }
fn fnv_mix_byte(b: u8) { unsafe { FNV = (FNV ^ (b as u32)).wrapping_mul(0x01000193); } }

fn out_byte(v: u32) {
    unsafe {
        if OUT_FAILED { return; }
        *((OUTPUT_OFFSET as *mut u8).add(OUT_AT as usize)) = v as u8;
        fnv_mix_byte(v as u8);
        OUT_AT += 1;
    }
}
fn out_u32_le(v: u32) {
    out_byte(v & 0xff);
    out_byte((v >> 8) & 0xff);
    out_byte((v >> 16) & 0xff);
    out_byte((v >> 24) & 0xff);
}
fn out_overwrite_u32_le(at: u32, v: u32) {
    unsafe {
        let out = (OUTPUT_OFFSET as *mut u8).add(at as usize);
        *out.add(0) = (v & 0xff) as u8;
        *out.add(1) = ((v >> 8) & 0xff) as u8;
        *out.add(2) = ((v >> 16) & 0xff) as u8;
        *out.add(3) = ((v >> 24) & 0xff) as u8;
    }
}
fn out_lit(bytes: &[u8]) {
    for &b in bytes { out_byte(b as u32); }
}

fn write_decimal(mut value: u32, minimum: u32) {
    let mut digits = [0u8; 10];
    let mut n = 0u32;
    loop {
        digits[n as usize] = 48 + (value % 10) as u8;
        n += 1;
        value /= 10;
        if value == 0 && n >= minimum { break; }
    }
    while n > 0 { n -= 1; out_byte(digits[n as usize] as u32); }
}
fn write_text_escaped(off: u32, n: u32) {
    for i in 0..n {
        let c = fixture_at(off + i);
        match c {
            38 => out_lit(b"&amp;"),
            60 => out_lit(b"&lt;"),
            62 => out_lit(b"&gt;"),
            _ => out_byte(c as u32),
        }
    }
}
fn write_attr_escaped(off: u32, n: u32) {
    for i in 0..n {
        let c = fixture_at(off + i);
        match c {
            38 => out_lit(b"&amp;"),
            60 => out_lit(b"&lt;"),
            62 => out_lit(b"&gt;"),
            34 => out_lit(b"&quot;"),
            39 => out_lit(b"&#39;"),
            _ => out_byte(c as u32),
        }
    }
}
fn is_unreserved(c: u8) -> bool {
    (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
        (c >= 48 && c <= 57) || c == 45 || c == 46 || c == 95 || c == 126
}
fn write_url_component(off: u32, n: u32) {
    static HEX: &[u8; 16] = b"0123456789ABCDEF";
    for i in 0..n {
        let c = fixture_at(off + i);
        if is_unreserved(c) { out_byte(c as u32); }
        else {
            out_byte(37);
            out_byte(HEX[(c >> 4) as usize] as u32);
            out_byte(HEX[(c & 15) as usize] as u32);
        }
    }
}
fn write_date(ymd: u32) -> bool {
    let year = ymd / 10000;
    let month = (ymd / 100) % 100;
    let day = ymd % 100;
    if year < 2026 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 28 {
        return false;
    }
    write_decimal(year, 4);
    out_byte(45);
    write_decimal(month, 2);
    out_byte(45);
    write_decimal(day, 2);
    true
}
fn write_price(cents: u32) {
    write_decimal(cents / 100, 1);
    out_byte(46);
    write_decimal(cents % 100, 2);
}
fn valid_utf8(off: u32, n: u32) -> bool {
    let mut i = 0u32;
    while i < n {
        let c = fixture_at(off + i) as u32;
        i += 1;
        if c < 0x80 { continue; }
        let (need, min, mut value): (u32, u32, u32);
        if (c & 0xe0) == 0xc0 { need = 1; min = 0x80; value = c & 0x1f; }
        else if (c & 0xf0) == 0xe0 { need = 2; min = 0x800; value = c & 0x0f; }
        else if (c & 0xf8) == 0xf0 { need = 3; min = 0x10000; value = c & 0x07; }
        else { return false; }
        if i + need > n { return false; }
        for _ in 0..need {
            let d = fixture_at(off + i) as u32;
            i += 1;
            if (d & 0xc0) != 0x80 { return false; }
            value = (value << 6) | (d & 0x3f);
        }
        if value < min || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff) {
            return false;
        }
    }
    true
}
fn parse_u32(end: u32) -> u32 {
    unsafe {
        if CUR_FAILED || CUR > end || end - CUR < 4 {
            CUR_FAILED = true;
            return 0;
        }
        let v = read_u32_le(CUR);
        CUR += 4;
        v
    }
}
fn parse_string(end: u32) -> (u32, u32) {
    let length = parse_u32(end);
    unsafe {
        if CUR_FAILED || length > 65536 || CUR > end || length > end - CUR {
            CUR_FAILED = true;
            return (0, 0);
        }
        if !valid_utf8(CUR, length) {
            CUR_FAILED = true;
            return (0, 0);
        }
        let off = CUR;
        CUR += length;
        (off, length)
    }
}

fn render_record(
    product_id: u32, user_id: u32, price_cents: u32, date_ymd: u32,
    name_off: u32, name_n: u32, user_off: u32, user_n: u32,
    slug_off: u32, slug_n: u32,
) -> bool {
    out_lit(b"<!doctype html><html lang=\"en\"><body><article data-product=\"");
    write_decimal(product_id, 1);
    unsafe { C_INTEGER_FORMATS += 1; }
    out_lit(b"\"><h1>");
    write_text_escaped(name_off, name_n);
    unsafe { C_TEXT_ESCAPES += 1; }
    out_lit(b"</h1><p data-user=\"");
    write_decimal(user_id, 1);
    unsafe { C_INTEGER_FORMATS += 1; }
    out_lit(b"\" aria-label=\"Catalog for ");
    write_attr_escaped(user_off, user_n);
    unsafe { C_ATTRIBUTE_ESCAPES += 1; }
    out_lit(b"\">Hello, ");
    write_text_escaped(user_off, user_n);
    unsafe { C_TEXT_ESCAPES += 1; }
    out_lit(b".</p><p class=\"price\" data-cents=\"");
    write_decimal(price_cents, 1);
    unsafe { C_INTEGER_FORMATS += 1; }
    out_lit(b"\">USD ");
    write_price(price_cents);
    unsafe { C_INTEGER_FORMATS += 1; }
    out_lit(b"</p><a href=\"/catalog/");
    write_url_component(slug_off, slug_n);
    unsafe { C_URL_ESCAPES += 1; }
    out_lit(b"?for=");
    write_url_component(user_off, user_n);
    unsafe { C_URL_ESCAPES += 1; }
    out_lit(b"\">Open</a><time datetime=\"");
    if !write_date(date_ymd) { return false; }
    unsafe { C_DATE_FORMATS += 1; }
    out_lit(b"\">");
    if !write_date(date_ymd) { return false; }
    unsafe { C_DATE_FORMATS += 1; }
    out_lit(b"</time></article></body></html>");
    unsafe { !OUT_FAILED }
}

#[unsafe(no_mangle)]
pub extern "C" fn ssr_render(fixture_len: u32) -> i32 {
    unsafe {
        OUT_AT = 0;
        OUT_FAILED = false;
        CUR = 0;
        CUR_FAILED = false;
        C_TEXT_ESCAPES = 0;
        C_ATTRIBUTE_ESCAPES = 0;
        C_URL_ESCAPES = 0;
        C_INTEGER_FORMATS = 0;
        C_DATE_FORMATS = 0;
    }
    fnv_reset();

    if fixture_len < 8 { return -1; }
    if parse_u32(fixture_len) != FIXTURE_MAGIC { return -2; }
    unsafe { if CUR_FAILED { return -2; } }
    if parse_u32(fixture_len) != RECORDS { return -3; }
    unsafe { if CUR_FAILED { return -3; } }

    out_u32_le(OUTPUT_MAGIC);
    out_u32_le(RECORDS);
    unsafe { if OUT_FAILED { return -4; } }

    for _ in 0..RECORDS {
        let product_id = parse_u32(fixture_len);
        let user_id = parse_u32(fixture_len);
        let price_cents = parse_u32(fixture_len);
        let date_ymd = parse_u32(fixture_len);
        let (name_off, name_n) = parse_string(fixture_len);
        let (user_off, user_n) = parse_string(fixture_len);
        let (slug_off, slug_n) = parse_string(fixture_len);
        unsafe { if CUR_FAILED { return -5; } }

        let length_at = unsafe { OUT_AT };
        out_u32_le(0);
        let start = unsafe { OUT_AT };
        if !render_record(
            product_id, user_id, price_cents, date_ymd,
            name_off, name_n, user_off, user_n, slug_off, slug_n,
        ) { return -6; }
        let body_len = unsafe { OUT_AT - start };
        out_overwrite_u32_le(length_at, body_len);
    }
    unsafe {
        if CUR_FAILED || CUR != fixture_len { return -7; }
        if OUT_FAILED { return -8; }
    }

    fnv_reset();
    unsafe {
        let out = OUTPUT_OFFSET as *const u8;
        for i in 0..OUT_AT {
            fnv_mix_byte(*out.add(i as usize));
        }
    }

    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.add(0).write_volatile(RECORDS);
        results.add(1).write_volatile(RECORDS * 7);
        results.add(2).write_volatile(RECORDS * TOKENS_PER_RESPONSE);
        results.add(3).write_volatile(C_TEXT_ESCAPES);
        results.add(4).write_volatile(C_ATTRIBUTE_ESCAPES);
        results.add(5).write_volatile(C_URL_ESCAPES);
        results.add(6).write_volatile(C_INTEGER_FORMATS);
        results.add(7).write_volatile(C_DATE_FORMATS);
        results.add(8).write_volatile(fixture_len);
        results.add(9).write_volatile(OUT_AT);
        results.add(10).write_volatile(FNV);
        results.add(11).write_volatile(0);
    }
    0
}
