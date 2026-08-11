// form_validate_kernel.rs — multilang compute core for
// dom.dependent-form-validation.v1.
// Same ABI: generates the frozen 240-action trace from seed 0x2468ace0, runs
// the 10-field JS reference model (runFormValidationJS — per-rule email /
// password / confirm / age / terms validation), writes counters to fixed
// offset 16384 (via raw pointer), returns totalErrors.
#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! { loop {} }

const FIELDS: usize = 10;
const FIELD_CAP: usize = 32;
const ACTIONS: usize = 240;
const RES_OFFSET: usize = 16384;

static mut SEED: u32 = 0;

fn rand_next() -> f64 {
    unsafe {
        SEED ^= SEED << 13;
        SEED ^= ((SEED as i32) >> 17) as u32;
        SEED ^= SEED << 5;
        (SEED as f64) / 4294967296.0
    }
}

fn email_valid(v: &[u8; FIELD_CAP]) -> bool {
    let mut len = 0usize;
    while len < FIELD_CAP && v[len] != 0 { len += 1; }
    if len == 0 { return false; }
    let mut at: i32 = -1;
    for i in 0..len {
        let c = v[i];
        if c == b' ' || c == b'\t' || c == b'\n' || c == b'\r' { return false; }
        if c == b'@' {
            if at >= 0 { return false; }
            at = i as i32;
        }
    }
    if at <= 0 || at >= (len as i32) - 1 { return false; }
    let mut dot: i32 = -1;
    let mut i = (at + 1) as usize;
    while i < len {
        if v[i] == b'@' { return false; }
        if v[i] == b'.' { dot = i as i32; }
        i += 1;
    }
    if dot < 0 { return false; }
    if dot == at + 1 || dot == (len as i32) - 1 { return false; }
    true
}

fn parse_age(v: &[u8; FIELD_CAP]) -> i32 {
    let mut i = 0usize;
    while i < FIELD_CAP && (v[i] == b' ' || v[i] == b'\t') { i += 1; }
    let mut neg = false;
    if i < FIELD_CAP && v[i] == b'-' { neg = true; i += 1; }
    let mut n: i32 = 0;
    let mut any = false;
    while i < FIELD_CAP && v[i] >= b'0' && v[i] <= b'9' {
        n = n * 10 + (v[i] - b'0') as i32;
        any = true;
        i += 1;
    }
    if !any { return -1; }
    if neg { -n } else { n }
}

fn str_len(v: &[u8; FIELD_CAP]) -> usize {
    let mut i = 0usize;
    while i < FIELD_CAP && v[i] != 0 { i += 1; }
    i
}

fn str_equal(a: &[u8; FIELD_CAP], b: &[u8; FIELD_CAP]) -> bool {
    let mut i = 0usize;
    loop {
        if i >= FIELD_CAP { return true; }
        if a[i] != b[i] { return false; }
        if a[i] == 0 { return true; }
        i += 1;
    }
}

fn validate(fields: &[[u8; FIELD_CAP]; FIELDS]) -> (u32, u32) {
    let mut m: u32 = 0;
    let mut errs: u32 = 0;
    if fields[0][0] != 0 && !email_valid(&fields[0]) { m |= 1; errs += 1; }
    if fields[1][0] != 0 && str_len(&fields[1]) < 8 { m |= 2; errs += 1; }
    if fields[2][0] != 0 && !str_equal(&fields[2], &fields[1]) { m |= 4; errs += 1; }
    if fields[3][0] != 0 {
        let a = parse_age(&fields[3]);
        if a < 0 || a < 18 { m |= 8; errs += 1; }
    }
    if fields[7][0] != 0 &&
        !(fields[7][0] == b't' && fields[7][1] == b'r' && fields[7][2] == b'u'
          && fields[7][3] == b'e' && fields[7][4] == 0) {
        m |= 16; errs += 1;
    }
    (errs, m)
}

#[unsafe(no_mangle)]
pub extern "C" fn form_validate_trace() -> i32 {
    let mut fields = [[0u8; FIELD_CAP]; FIELDS];
    let mut val = [0u8; FIELD_CAP];

    unsafe { SEED = 0x2468ace0; }
    let mut total_errors: u32 = 0;
    let mut total_validations: u32 = 0;

    for _ in 0..ACTIONS {
        let field = (rand_next() * 10.0) as i32;
        let val_len_alpha = 3 + (rand_next() * 15.0) as i32;
        let mut vlen: usize = 0;
        for _ in 0..val_len_alpha {
            let c = (rand_next() * 26.0) as u32;
            if vlen < FIELD_CAP - 1 {
                val[vlen] = b'a' + c as u8;
                vlen += 1;
            }
        }
        if field == 0 {
            let suffix = b"@example.com";
            for j in 0..12 {
                if vlen < FIELD_CAP - 1 { val[vlen] = suffix[j]; vlen += 1; }
            }
        } else if field == 3 {
            let age = 15 + (rand_next() * 50.0) as i32;
            vlen = 0;
            let mut buf = [0u8; 8];
            let mut nb = 0usize;
            let mut x = age;
            loop {
                buf[nb] = b'0' + (x % 10) as u8;
                nb += 1;
                x /= 10;
                if x == 0 { break; }
            }
            let mut j = nb as isize - 1;
            while j >= 0 {
                val[vlen] = buf[j as usize];
                vlen += 1;
                j -= 1;
            }
        } else if field == 7 {
            let truthy = rand_next() > 0.5;
            vlen = 0;
            if truthy {
                val[vlen] = b't'; vlen += 1;
                val[vlen] = b'r'; vlen += 1;
                val[vlen] = b'u'; vlen += 1;
                val[vlen] = b'e'; vlen += 1;
            } else {
                val[vlen] = b'f'; vlen += 1;
                val[vlen] = b'a'; vlen += 1;
                val[vlen] = b'l'; vlen += 1;
                val[vlen] = b's'; vlen += 1;
                val[vlen] = b'e'; vlen += 1;
            }
        }
        let _ = rand_next();
        if vlen < FIELD_CAP { val[vlen] = 0; }

        let f = field as usize;
        if f < FIELDS {
            let mut cp = 0usize;
            while cp < vlen && cp < FIELD_CAP - 1 {
                fields[f][cp] = val[cp];
                cp += 1;
            }
            fields[f][cp] = 0;
        }
        total_validations += 1;

        let (errs, _mask) = validate(&fields);
        total_errors += errs;
    }

    let (active, _mask) = validate(&fields);
    unsafe {
        let results = RES_OFFSET as *mut u32;
        results.write_volatile(total_errors);
        results.add(1).write_volatile(active);
        results.add(2).write_volatile(total_validations);
    }
    total_errors as i32
}
