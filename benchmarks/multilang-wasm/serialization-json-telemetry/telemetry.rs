#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// serialization-json-telemetry multilang kernel — exact mirror of the C
// telemetry.c parser: same byte-level JSON parsing, same vocabulary tables
// (regions/kinds/labels/tags as UTF-8 byte sequences), same summary output.

const REGIONS: [&[u8]; 4] = [b"ap", b"eu", b"na", b"sa"];
const KINDS: [&[u8]; 3] = [b"click", b"purchase", b"view"];
const LABELS: [&[u8]; 4] = [
    b"Caf\xc3\xa9", b"\xe6\x9d\xb1\xe4\xba\xac", b"\xd9\x85\xd8\xb1\xd8\xad\xd8\xa8\xd8\xa7", b"\xf0\x9f\x9a\x80",
];
const TAGS: [&[u8]; 4] = [
    b"\xce\xb1", b"\xe6\x95\xb0\xe6\x8d\xae", b"ma\xc3\xb1ana", b"\xf0\x9f\xa7\xaa",
];

struct Parser<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl<'a> Parser<'a> {
    fn expect_byte(&mut self, value: u8) -> bool {
        if self.at < self.bytes.len() && self.bytes[self.at] == value {
            self.at += 1;
            true
        } else {
            false
        }
    }
    fn expect_ascii(&mut self, value: &[u8]) -> bool {
        for &b in value {
            if !self.expect_byte(b) {
                return false;
            }
        }
        true
    }
    fn parse_uint(&mut self) -> Option<u64> {
        let start = self.at;
        let mut value: u64 = 0;
        while self.at < self.bytes.len() && self.bytes[self.at] >= b'0' && self.bytes[self.at] <= b'9' {
            if self.at > start && self.bytes[start] == b'0' {
                return None;
            }
            let next = value.wrapping_mul(10).wrapping_add((self.bytes[self.at] - b'0') as u64);
            if next < value {
                return None;
            }
            value = next;
            self.at += 1;
        }
        if self.at == start {
            return None;
        }
        Some(value)
    }
    fn bytes_equal(&mut self, value: &[u8]) -> bool {
        if self.at + value.len() >= self.bytes.len() {
            return false;
        }
        for (i, &b) in value.iter().enumerate() {
            if self.bytes[self.at + i] != b {
                return false;
            }
        }
        if self.bytes[self.at + value.len()] != b'"' {
            return false;
        }
        self.at += value.len() + 1;
        true
    }
    fn parse_option(&mut self, values: &[&[u8]]) -> Option<u32> {
        if !self.expect_byte(b'"') {
            return None;
        }
        for (i, value) in values.iter().enumerate() {
            let saved = self.at;
            if self.bytes_equal(value) {
                return Some(i as u32);
            }
            self.at = saved;
        }
        None
    }
    fn parse_boolean(&mut self) -> Option<u32> {
        let saved = self.at;
        if self.expect_ascii(b"true") {
            return Some(1);
        }
        self.at = saved;
        if self.expect_ascii(b"false") {
            return Some(0);
        }
        None
    }
}

fn write_byte(output: &mut [u8], position: &mut usize, value: u8) -> bool {
    if *position >= output.len() {
        return false;
    }
    output[*position] = value;
    *position += 1;
    true
}

fn write_ascii(output: &mut [u8], position: &mut usize, value: &[u8]) -> bool {
    for &b in value {
        if !write_byte(output, position, b) {
            return false;
        }
    }
    true
}

fn write_uint(output: &mut [u8], position: &mut usize, mut value: u64) -> bool {
    let mut digits = [0u8; 20];
    let mut length = 0usize;
    loop {
        digits[length] = b'0' + (value % 10) as u8;
        value /= 10;
        length += 1;
        if value == 0 {
            break;
        }
    }
    while length > 0 {
        length -= 1;
        if !write_byte(output, position, digits[length]) {
            return false;
        }
    }
    true
}

static mut G_RECORDS: u32 = 0;
static mut G_INPUT_BYTES: u32 = 0;
static mut G_NUMERIC: u32 = 0;
static mut G_STRINGS: u32 = 0;
static mut G_BOOLEANS: u32 = 0;

#[no_mangle]
pub extern "C" fn process(input_offset: u32, length: u32, output_offset: u32, output_capacity: u32) -> i32 {
    unsafe {
        let input = core::slice::from_raw_parts(input_offset as *const u8, length as usize);
        let mut p = Parser { bytes: input, at: 0 };
        G_RECORDS = 0;
        G_INPUT_BYTES = length;
        G_NUMERIC = 0;
        G_STRINGS = 0;
        G_BOOLEANS = 0;
        let mut region_counts = [0u32; 4];
        let mut kind_counts = [0u32; 3];
        let mut ok_count: u32 = 0;
        let mut error_count: u32 = 0;
        let mut value_sum: u64 = 0;
        if !p.expect_byte(b'[') {
            return -1;
        }
        while p.at < input.len() && input[p.at] != b']' {
            if G_RECORDS != 0 && !p.expect_byte(b',') {
                return -2;
            }
            if !p.expect_ascii(b"{\"id\":") {
                return -3;
            }
            let id = match p.parse_uint() {
                Some(v) => v,
                None => return -4,
            };
            if id != G_RECORDS as u64 {
                return -4;
            }
            if !p.expect_ascii(b",\"ts\":") {
                return -5;
            }
            let timestamp = match p.parse_uint() {
                Some(v) => v,
                None => return -5,
            };
            if timestamp != 1700000000u64 + id {
                return -5;
            }
            if !p.expect_ascii(b",\"region\":") {
                return -6;
            }
            let region = match p.parse_option(&REGIONS) {
                Some(v) => v,
                None => return -7,
            };
            if !p.expect_ascii(b",\"kind\":") {
                return -8;
            }
            let kind = match p.parse_option(&KINDS) {
                Some(v) => v,
                None => return -8,
            };
            if !p.expect_ascii(b",\"ok\":") {
                return -9;
            }
            let ok = match p.parse_boolean() {
                Some(v) => v,
                None => return -9,
            };
            if !p.expect_ascii(b",\"value\":") {
                return -10;
            }
            let value = match p.parse_uint() {
                Some(v) => v,
                None => return -10,
            };
            if value > 9999 {
                return -10;
            }
            if !p.expect_ascii(b",\"meta\":{\"label\":") {
                return -11;
            }
            let _ = match p.parse_option(&LABELS) {
                Some(v) => v,
                None => return -11,
            };
            if !p.expect_ascii(b",\"tag\":") {
                return -12;
            }
            let _ = match p.parse_option(&TAGS) {
                Some(v) => v,
                None => return -12,
            };
            if !p.expect_ascii(b"}}") {
                return -13;
            }
            G_RECORDS += 1;
            G_NUMERIC += 3;
            G_STRINGS += 4;
            G_BOOLEANS += 1;
            region_counts[region as usize] += 1;
            kind_counts[kind as usize] += 1;
            ok_count += ok;
            error_count += 1 - ok;
            value_sum += value;
        }
        if !p.expect_byte(b']') || p.at != input.len() {
            return -14;
        }
        let output = core::slice::from_raw_parts_mut(output_offset as *mut u8, output_capacity as usize);
        let mut pos = 0usize;
        macro_rules! w {
            ($t:expr) => {
                if !write_ascii(output, &mut pos, $t) {
                    return -15;
                }
            };
        }
        macro_rules! n {
            ($v:expr) => {
                if !write_uint(output, &mut pos, $v) {
                    return -15;
                }
            };
        }
        w!(b"{\"count\":");
        n!(G_RECORDS as u64);
        w!(b",\"errorCount\":");
        n!(error_count as u64);
        w!(b",\"kind\":{\"click\":");
        n!(kind_counts[0] as u64);
        w!(b",\"purchase\":");
        n!(kind_counts[1] as u64);
        w!(b",\"view\":");
        n!(kind_counts[2] as u64);
        w!(b"},\"okCount\":");
        n!(ok_count as u64);
        w!(b",\"region\":{\"ap\":");
        n!(region_counts[0] as u64);
        w!(b",\"eu\":");
        n!(region_counts[1] as u64);
        w!(b",\"na\":");
        n!(region_counts[2] as u64);
        w!(b",\"sa\":");
        n!(region_counts[3] as u64);
        w!(b"},\"valueSum\":");
        n!(value_sum);
        w!(b"}");
        pos as i32
    }
}

#[no_mangle]
pub extern "C" fn get_records() -> u32 {
    unsafe { G_RECORDS }
}
#[no_mangle]
pub extern "C" fn get_input_bytes() -> u32 {
    unsafe { G_INPUT_BYTES }
}
#[no_mangle]
pub extern "C" fn get_numeric_values() -> u32 {
    unsafe { G_NUMERIC }
}
#[no_mangle]
pub extern "C" fn get_string_values() -> u32 {
    unsafe { G_STRINGS }
}
#[no_mangle]
pub extern "C" fn get_booleans() -> u32 {
    unsafe { G_BOOLEANS }
}
#[no_mangle]
pub extern "C" fn get_query_aggregates() -> u32 {
    11
}
#[no_mangle]
pub extern "C" fn get_allocations() -> u32 {
    0
}
