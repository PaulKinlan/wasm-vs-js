#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

const BOUNDED_ENTRY_COUNT: u32 = 1000;
const UTF8_FLAG: u16 = 0x0800;
const UNIX_MODE: u32 = 0o100644;

const ARCHIVE_OFFSET: usize = 1048576;
const EXTRACTED_OFFSET: usize = 2097152;
const RES_OFFSET: usize = 3145728;
const LISTING_OFFSET: usize = 4194304;
const INTERNAL_OFFSET: usize = 5242880;

const SELECTED: [u32; 10] = [0, 1, 17, 997, 2048, 4096, 7001, 8191, 9998, 9999];

unsafe fn set16(p: *mut u8, v: u32) {
    *p = v as u8;
    *p.add(1) = (v >> 8) as u8;
}

unsafe fn set32(p: *mut u8, v: u32) {
    *p = v as u8;
    *p.add(1) = (v >> 8) as u8;
    *p.add(2) = (v >> 16) as u8;
    *p.add(3) = (v >> 24) as u8;
}

unsafe fn get16(p: *const u8) -> u32 {
    (*p as u32) | ((*p.add(1) as u32) << 8)
}

unsafe fn get32(p: *const u8) -> u32 {
    (*p as u32) | ((*p.add(1) as u32) << 8) | ((*p.add(2) as u32) << 16) | ((*p.add(3) as u32) << 24)
}

unsafe fn append8(out: *mut u8, cap: u32, at: &mut u32, v: u32) -> bool {
    if *at >= cap { return false; }
    *out.add(*at as usize) = v as u8;
    *at += 1;
    true
}

unsafe fn append16(out: *mut u8, cap: u32, at: &mut u32, v: u32) -> bool {
    if *at + 2 > cap { return false; }
    set16(out.add(*at as usize), v);
    *at += 2;
    true
}

unsafe fn append32(out: *mut u8, cap: u32, at: &mut u32, v: u32) -> bool {
    if *at + 4 > cap { return false; }
    set32(out.add(*at as usize), v);
    *at += 4;
    true
}

unsafe fn append_bytes(out: *mut u8, cap: u32, at: &mut u32, src: *const u8, n: u32) -> bool {
    if *at + n > cap { return false; }
    for i in 0..n {
        *out.add((*at + i) as usize) = *src.add(i as usize);
    }
    *at += n;
    true
}

fn reverse_bits(value: u32, width: u32) -> u32 {
    let mut r = 0;
    for i in 0..width {
        r = (r << 1) | ((value >> i) & 1);
    }
    r
}

fn fixed_code(symbol: u32, code: &mut u32, width: &mut u32) {
    if symbol <= 143 {
        *width = 8;
        *code = reverse_bits(0x30 + symbol, 8);
    } else if symbol <= 255 {
        *width = 9;
        *code = reverse_bits(0x190 + symbol - 144, 9);
    } else if symbol <= 279 {
        *width = 7;
        *code = reverse_bits(symbol - 256, 7);
    } else {
        *width = 8;
        *code = reverse_bits(0xc0 + symbol - 280, 8);
    }
}

struct BitWriter {
    out: *mut u8,
    cap: u32,
    at: u32,
    acc: u32,
    bits: u32,
    ok: bool,
}

impl BitWriter {
    unsafe fn bw_bits(&mut self, value: u32, width: u32) {
        self.acc |= value << self.bits;
        self.bits += width;
        while self.bits >= 8 {
            if self.at >= self.cap {
                self.ok = false;
                return;
            }
            *self.out.add(self.at as usize) = self.acc as u8;
            self.at += 1;
            self.acc >>= 8;
            self.bits -= 8;
        }
    }
}

const LENGTH_BASE: [u16; 29] = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const LENGTH_EXTRA: [u8; 29] = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const DIST_BASE: [u16; 30] = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const DIST_EXTRA: [u8; 30] = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

unsafe fn deflate_fixed(
    in_: *const u8, n: u32, out: *mut u8, cap: u32,
    literal_count: &mut u32, match_count: &mut u32, matched_bytes: &mut u32
) -> u32 {
    let mut w = BitWriter { out, cap, at: 0, acc: 0, bits: 0, ok: true };
    w.bw_bits(1, 1);
    w.bw_bits(1, 2);
    let mut pos = 0;
    while pos < n && w.ok {
        let mut best = 0;
        let mut best_dist = 0;
        let earliest = if pos > 1024 { pos - 1024 } else { 0 };
        let mut candidate = pos;
        while candidate > earliest {
            candidate -= 1;
            let mut len = 0;
            while len < 258 && pos + len < n && *in_.add((candidate + len) as usize) == *in_.add((pos + len) as usize) {
                len += 1;
            }
            if len >= 3 && len > best {
                best = len;
                best_dist = pos - candidate;
            }
        }
        
        let mut c = 0;
        let mut b = 0;
        if best >= 3 {
            let mut li = 28;
            for k in 0..29 {
                let max = LENGTH_BASE[k] as u32 + ((1 << LENGTH_EXTRA[k]) - 1);
                if best <= max {
                    li = k;
                    break;
                }
            }
            fixed_code(257 + li as u32, &mut c, &mut b);
            w.bw_bits(c, b);
            if LENGTH_EXTRA[li] > 0 {
                w.bw_bits(best - LENGTH_BASE[li] as u32, LENGTH_EXTRA[li] as u32);
            }
            let mut di = 0;
            while di + 1 < 30 && best_dist >= DIST_BASE[di + 1] as u32 {
                di += 1;
            }
            w.bw_bits(reverse_bits(di as u32, 5), 5);
            if DIST_EXTRA[di] > 0 {
                w.bw_bits(best_dist - DIST_BASE[di] as u32, DIST_EXTRA[di] as u32);
            }
            *match_count += 1;
            *matched_bytes += best;
            pos += best;
        } else {
            fixed_code(*in_.add(pos as usize) as u32, &mut c, &mut b);
            w.bw_bits(c, b);
            *literal_count += 1;
            pos += 1;
        }
    }
    let mut c = 0;
    let mut b = 0;
    fixed_code(256, &mut c, &mut b);
    w.bw_bits(c, b);
    if w.bits > 0 && w.ok {
        append8(out, cap, &mut w.at, w.acc);
    }
    if w.ok { w.at } else { 0 }
}

struct BitReader {
    in_: *const u8,
    n: u32,
    at: u32,
    acc: u32,
    bits: u32,
    ok: bool,
}

impl BitReader {
    unsafe fn br_bits(&mut self, width: u32) -> u32 {
        while self.bits < width {
            if self.at >= self.n {
                self.ok = false;
                return 0;
            }
            self.acc |= (*self.in_.add(self.at as usize) as u32) << self.bits;
            self.at += 1;
            self.bits += 8;
        }
        let mask = (1 << width) - 1;
        let v = self.acc & mask;
        self.acc >>= width;
        self.bits -= width;
        v
    }

    unsafe fn decode_symbol(&mut self) -> i32 {
        let mut code = 0;
        for width in 1..=9 {
            code |= self.br_bits(1) << (width - 1);
            if !self.ok { return -1; }
            for s in 0..=287 {
                let mut c = 0;
                let mut b = 0;
                fixed_code(s, &mut c, &mut b);
                if b == width && c == code { return s as i32; }
            }
        }
        -1
    }
}

unsafe fn inflate_fixed(in_: *const u8, n: u32, out: *mut u8, expected: u32) -> bool {
    let mut r = BitReader { in_, n, at: 0, acc: 0, bits: 0, ok: true };
    if r.br_bits(1) != 1 || r.br_bits(2) != 1 { return false; }
    let mut at = 0;
    loop {
        let s = r.decode_symbol();
        if s == 256 { break; }
        if s < 0 { return false; }
        if s < 256 {
            if at >= expected { return false; }
            *out.add(at as usize) = s as u8;
            at += 1;
            continue;
        }
        if s > 285 { return false; }
        let li = (s as u32) - 257;
        let len = LENGTH_BASE[li as usize] as u32 + r.br_bits(LENGTH_EXTRA[li as usize] as u32);
        let dc = reverse_bits(r.br_bits(5), 5);
        if dc >= 30 { return false; }
        let dist = DIST_BASE[dc as usize] as u32 + r.br_bits(DIST_EXTRA[dc as usize] as u32);
        if dist > at || at + len > expected { return false; }
        for _ in 0..len {
            *out.add(at as usize) = *out.add((at - dist) as usize);
            at += 1;
        }
    }
    r.ok && at == expected
}

unsafe fn crc32_bytes(in_: *const u8, n: u32) -> u32 {
    let mut crc = 0xffffffff;
    for i in 0..n {
        crc ^= *in_.add(i as usize) as u32;
        for _ in 0..8 {
            crc = if (crc & 1) != 0 { 0xedb88320 ^ (crc >> 1) } else { crc >> 1 };
        }
    }
    crc ^ 0xffffffff
}

unsafe fn path_text(out: *mut u8, at: &mut u32, s: &[u8]) {
    for &b in s {
        *out.add(*at as usize) = b;
        *at += 1;
    }
}

unsafe fn path_for(index: u32, out: *mut u8) -> u32 {
    let mut at = 0;
    let bases: [&[u8]; 4] = [b"src", b"data", b"assets", b"docs"];
    let stems: [&[u8]; 4] = [b"module", b"event", b"blob", b"note"];
    let exts: [&[u8]; 4] = [b"ts", b"json", b"bin", b"md"];
    let family = index & 3;
    path_text(out, &mut at, bases[family as usize]);
    if index % 997 == 0 {
        path_text(out, &mut at, b"/caf\xc3\xa9");
    } else if index % 991 == 0 {
        path_text(out, &mut at, b"/\xe6\x9d\xb1\xe4\xba\xac");
    }
    *out.add(at as usize) = b'/'; at += 1;
    let group = index / 100;
    *out.add(at as usize) = b'0' + ((group / 100) % 10) as u8; at += 1;
    *out.add(at as usize) = b'0' + ((group / 10) % 10) as u8; at += 1;
    *out.add(at as usize) = b'0' + (group % 10) as u8; at += 1;
    *out.add(at as usize) = b'/'; at += 1;
    path_text(out, &mut at, stems[family as usize]);
    *out.add(at as usize) = b'-'; at += 1;
    *out.add(at as usize) = b'0' + ((index / 10000) % 10) as u8; at += 1;
    *out.add(at as usize) = b'0' + ((index / 1000) % 10) as u8; at += 1;
    *out.add(at as usize) = b'0' + ((index / 100) % 10) as u8; at += 1;
    *out.add(at as usize) = b'0' + ((index / 10) % 10) as u8; at += 1;
    *out.add(at as usize) = b'0' + (index % 10) as u8; at += 1;
    *out.add(at as usize) = b'.'; at += 1;
    path_text(out, &mut at, exts[family as usize]);
    at
}

unsafe fn content_for(index: u32, out: *mut u8) -> u32 {
    let t: [&[u8]; 4] = [b"export const value = ", b"{\"event\":\"workspace\",\"value\":", b"", b"# Workspace note "];
    let n = 48 + (index % 113);
    let mut state = 0x9e3779b9 ^ index;
    let f = index & 3;
    let template = t[f as usize];
    let tl = template.len() as u32;
    for i in 0..n {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        *out.add(i as usize) = if f == 2 {
            ((state >> 24) ^ (index & 255)) as u8
        } else {
            template[(i % tl) as usize]
        };
    }
    n
}

fn selected_slot(index: u32) -> i32 {
    for (i, &s) in SELECTED.iter().enumerate() {
        if s == index { return i as i32; }
    }
    -1
}

fn selected_count(entry_count: u32) -> u32 {
    let mut count = 0;
    for &s in SELECTED.iter() {
        if s < entry_count { count += 1; }
    }
    count
}

unsafe fn fnv1a32(bytes: *const u8, length: u32) -> u32 {
    let mut hash = 2166136261u32;
    for i in 0..length {
        hash ^= *bytes.add(i as usize) as u32;
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

#[no_mangle]
pub extern "C" fn zip_build() -> u32 {
    unsafe {
        // Grow memory to at least 112 pages (7 MiB)
        let current_pages = core::arch::wasm32::memory_size(0);
        if current_pages < 112 {
            core::arch::wasm32::memory_grow(0, 112 - current_pages);
        }

        let archive_bytes = ARCHIVE_OFFSET as *mut u8;
        let extracted_bytes = EXTRACTED_OFFSET as *mut u8;
        let listing_bytes = LISTING_OFFSET as *mut u8;
        let counters = RES_OFFSET as *mut u32;

        let local_offsets = INTERNAL_OFFSET as *mut u32;
        let crcs = (INTERNAL_OFFSET + 4000) as *mut u32;
        let compressed_sizes = (INTERNAL_OFFSET + 8000) as *mut u32;
        let plain_sizes = (INTERNAL_OFFSET + 12000) as *mut u32;
        let name_sizes = (INTERNAL_OFFSET + 16000) as *mut u16;

        for i in 0..15 {
            *counters.add(i) = 0;
        }

        let archive_cap = 1048576;
        let extract_cap = 1048576;
        let listing_cap = 1048576;
        let entry_count = BOUNDED_ENTRY_COUNT;

        let name = (INTERNAL_OFFSET + 20000) as *mut u8;
        let plain = (INTERNAL_OFFSET + 20100) as *mut u8;
        let compressed = (INTERNAL_OFFSET + 20300) as *mut u8;

        let mut at = 0;
        let mut input_total = 0;
        let mut literal_total = 0;
        let mut match_total = 0;
        let mut matched_total = 0;

        for i in 0..entry_count {
            let nl = path_for(i, name);
            let pl = content_for(i, plain);
            let cl = deflate_fixed(
                plain, pl, compressed, 256,
                &mut literal_total, &mut match_total, &mut matched_total
            );
            let crc = crc32_bytes(plain, pl);
            if cl == 0 { return 1; }

            *local_offsets.add(i as usize) = at;
            *crcs.add(i as usize) = crc;
            *compressed_sizes.add(i as usize) = cl;
            *plain_sizes.add(i as usize) = pl;
            *name_sizes.add(i as usize) = nl as u16;

            if !append32(archive_bytes, archive_cap, &mut at, 0x04034b50) ||
               !append16(archive_bytes, archive_cap, &mut at, 20) ||
               !append16(archive_bytes, archive_cap, &mut at, UTF8_FLAG as u32) ||
               !append16(archive_bytes, archive_cap, &mut at, 8) ||
               !append16(archive_bytes, archive_cap, &mut at, 0) ||
               !append16(archive_bytes, archive_cap, &mut at, 0x21) ||
               !append32(archive_bytes, archive_cap, &mut at, crc) ||
               !append32(archive_bytes, archive_cap, &mut at, cl) ||
               !append32(archive_bytes, archive_cap, &mut at, pl) ||
               !append16(archive_bytes, archive_cap, &mut at, nl) ||
               !append16(archive_bytes, archive_cap, &mut at, 0) ||
               !append_bytes(archive_bytes, archive_cap, &mut at, name, nl) ||
               !append_bytes(archive_bytes, archive_cap, &mut at, compressed, cl) {
                return 2;
            }
            input_total += pl;
        }

        let central = at;
        for i in 0..entry_count {
            let nl = path_for(i, name);
            if !append32(archive_bytes, archive_cap, &mut at, 0x02014b50) ||
               !append16(archive_bytes, archive_cap, &mut at, 0x0314) ||
               !append16(archive_bytes, archive_cap, &mut at, 20) ||
               !append16(archive_bytes, archive_cap, &mut at, UTF8_FLAG as u32) ||
               !append16(archive_bytes, archive_cap, &mut at, 8) ||
               !append16(archive_bytes, archive_cap, &mut at, 0) ||
               !append16(archive_bytes, archive_cap, &mut at, 0x21) ||
               !append32(archive_bytes, archive_cap, &mut at, *crcs.add(i as usize)) ||
               !append32(archive_bytes, archive_cap, &mut at, *compressed_sizes.add(i as usize)) ||
               !append32(archive_bytes, archive_cap, &mut at, *plain_sizes.add(i as usize)) ||
               !append16(archive_bytes, archive_cap, &mut at, nl) ||
               !append16(archive_bytes, archive_cap, &mut at, 0) ||
               !append16(archive_bytes, archive_cap, &mut at, 0) ||
               !append16(archive_bytes, archive_cap, &mut at, 0) ||
               !append16(archive_bytes, archive_cap, &mut at, 0) ||
               !append32(archive_bytes, archive_cap, &mut at, UNIX_MODE << 16) ||
               !append32(archive_bytes, archive_cap, &mut at, *local_offsets.add(i as usize)) ||
               !append_bytes(archive_bytes, archive_cap, &mut at, name, nl) {
                return 3;
            }
        }

        let central_size = at - central;
        if !append32(archive_bytes, archive_cap, &mut at, 0x06054b50) ||
           !append16(archive_bytes, archive_cap, &mut at, 0) ||
           !append16(archive_bytes, archive_cap, &mut at, 0) ||
           !append16(archive_bytes, archive_cap, &mut at, entry_count) ||
           !append16(archive_bytes, archive_cap, &mut at, entry_count) ||
           !append32(archive_bytes, archive_cap, &mut at, central_size) ||
           !append32(archive_bytes, archive_cap, &mut at, central) ||
           !append16(archive_bytes, archive_cap, &mut at, 0) {
            return 4;
        }

        let archive_len = at;
        *counters.add(0) = entry_count;
        *counters.add(1) = input_total;
        *counters.add(2) = input_total;
        *counters.add(3) = literal_total;
        *counters.add(4) = match_total;
        *counters.add(5) = matched_total;
        *counters.add(6) = entry_count;
        *counters.add(7) = entry_count;
        *counters.add(8) = entry_count;
        *counters.add(9) = 0;

        let e = archive_len - 22;
        let count = get16(archive_bytes.add((e + 8) as usize));
        let coff = get32(archive_bytes.add((e + 16) as usize));
        
        let mut cur = coff;
        let mut lat = 0;
        let mut eat = 0;
        let mut exbytes = 0;

        let plain2 = (INTERNAL_OFFSET + 20700) as *mut u8;
        
        for i in 0..count {
            let crc = get32(archive_bytes.add((cur + 16) as usize));
            let cs = get32(archive_bytes.add((cur + 20) as usize));
            let ps = get32(archive_bytes.add((cur + 24) as usize));
            let nl = get16(archive_bytes.add((cur + 28) as usize));
            let lo = get32(archive_bytes.add((cur + 42) as usize));
            
            if !append16(listing_bytes, listing_cap, &mut lat, nl) ||
               !append_bytes(listing_bytes, listing_cap, &mut lat, archive_bytes.add((cur + 46) as usize), nl) ||
               !append32(listing_bytes, listing_cap, &mut lat, ps) ||
               !append32(listing_bytes, listing_cap, &mut lat, cs) ||
               !append32(listing_bytes, listing_cap, &mut lat, crc) {
                return 5;
            }

            let data = lo + 30 + nl;
            if selected_slot(i) >= 0 {
                if !inflate_fixed(archive_bytes.add(data as usize), cs, plain2, ps) {
                    return 6;
                }
                if !append32(extracted_bytes, extract_cap, &mut eat, i) ||
                   !append32(extracted_bytes, extract_cap, &mut eat, ps) ||
                   !append_bytes(extracted_bytes, extract_cap, &mut eat, plain2, ps) {
                    return 7;
                }
                exbytes += ps;
            }
            cur += 46 + nl;
        }

        *counters.add(10) = count;
        *counters.add(11) = selected_count(count);
        *counters.add(12) = exbytes;
        *counters.add(13) = 0;
        *counters.add(14) = 0;

        *counters.add(15) = fnv1a32(archive_bytes, archive_len);
        *counters.add(16) = fnv1a32(extracted_bytes, eat);
    }
    0
}
