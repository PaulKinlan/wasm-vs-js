// AssemblyScript kernel for archive.zip-workspace.v1
const BOUNDED_ENTRY_COUNT: u32 = 1000;
const UTF8_FLAG: u16 = 0x0800;
const UNIX_MODE: u32 = 0o100644;

const ARCHIVE_OFFSET: usize = 1048576;
const EXTRACTED_OFFSET: usize = 2097152;
const RES_OFFSET: usize = 3145728;
const LISTING_OFFSET: usize = 4194304;
const INTERNAL_OFFSET: usize = 5242880;

const SELECTED: StaticArray<u32> = [0, 1, 17, 997, 2048, 4096, 7001, 8191, 9998, 9999];

function set16(p: usize, v: u32): void {
  store<u8>(p, (v & 255) as u8);
  store<u8>(p + 1, ((v >> 8) & 255) as u8);
}
function set32(p: usize, v: u32): void {
  store<u8>(p, (v & 255) as u8);
  store<u8>(p + 1, ((v >> 8) & 255) as u8);
  store<u8>(p + 2, ((v >> 16) & 255) as u8);
  store<u8>(p + 3, ((v >> 24) & 255) as u8);
}
function get16(p: usize): u32 {
  return (load<u8>(p) as u32) | ((load<u8>(p + 1) as u32) << 8);
}
function get32(p: usize): u32 {
  return (load<u8>(p) as u32) | ((load<u8>(p + 1) as u32) << 8) | ((load<u8>(p + 2) as u32) << 16) |
    ((load<u8>(p + 3) as u32) << 24);
}

// Global "at" state for writers
let global_at: u32 = 0;

function append8(out: usize, cap: u32, v: u32): bool {
  if (global_at >= cap) return false;
  store<u8>(out + global_at, (v & 255) as u8);
  global_at++;
  return true;
}
function append16(out: usize, cap: u32, v: u32): bool {
  if (global_at + 2 > cap) return false;
  set16(out + global_at, v);
  global_at += 2;
  return true;
}
function append32(out: usize, cap: u32, v: u32): bool {
  if (global_at + 4 > cap) return false;
  set32(out + global_at, v);
  global_at += 4;
  return true;
}
function append_bytes(out: usize, cap: u32, src: usize, n: u32): bool {
  if (global_at + n > cap) return false;
  for (let i: u32 = 0; i < n; i++) {
    store<u8>(out + global_at + i, load<u8>(src + i));
  }
  global_at += n;
  return true;
}

function reverse_bits(value: u32, width: u32): u32 {
  let r: u32 = 0;
  for (let i: u32 = 0; i < width; i++) {
    r = (r << 1) | ((value >> i) & 1);
  }
  return r;
}

let fcode_code: u32 = 0;
let fcode_width: u32 = 0;
function fixed_code(symbol: u32): void {
  if (symbol <= 143) {
    fcode_width = 8;
    fcode_code = reverse_bits(0x30 + symbol, 8);
  } else if (symbol <= 255) {
    fcode_width = 9;
    fcode_code = reverse_bits(0x190 + symbol - 144, 9);
  } else if (symbol <= 279) {
    fcode_width = 7;
    fcode_code = reverse_bits(symbol - 256, 7);
  } else {
    fcode_width = 8;
    fcode_code = reverse_bits(0xc0 + symbol - 280, 8);
  }
}

let bw_out: usize = 0;
let bw_cap: u32 = 0;
let bw_at: u32 = 0;
let bw_acc: u32 = 0;
let bw_bits: u32 = 0;
let bw_ok: bool = true;

function bw_write(value: u32, width: u32): void {
  bw_acc |= value << bw_bits;
  bw_bits += width;
  while (bw_bits >= 8) {
    if (bw_at >= bw_cap) {
      bw_ok = false;
      return;
    }
    store<u8>(bw_out + bw_at, (bw_acc & 255) as u8);
    bw_at++;
    bw_acc >>= 8;
    bw_bits -= 8;
  }
}

const LENGTH_BASE: StaticArray<u16> = [
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
];
const LENGTH_EXTRA: StaticArray<u8> = [
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
];
const DIST_BASE: StaticArray<u16> = [
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
];
const DIST_EXTRA: StaticArray<u8> = [
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
];

let def_literal_count: u32 = 0;
let def_match_count: u32 = 0;
let def_matched_bytes: u32 = 0;

function deflate_fixed(in_ptr: usize, n: u32, out_ptr: usize, cap: u32): u32 {
  bw_out = out_ptr;
  bw_cap = cap;
  bw_at = 0;
  bw_acc = 0;
  bw_bits = 0;
  bw_ok = true;
  bw_write(1, 1);
  bw_write(1, 2);
  let pos: u32 = 0;
  while (pos < n && bw_ok) {
    let best: u32 = 0;
    let best_dist: u32 = 0;
    let earliest: u32 = pos > 1024 ? pos - 1024 : 0;
    let candidate: u32 = pos;
    while (candidate > earliest) {
      candidate--;
      let len: u32 = 0;
      while (
        len < 258 && pos + len < n &&
        load<u8>(in_ptr + candidate + len) == load<u8>(in_ptr + pos + len)
      ) {
        len++;
      }
      if (len >= 3 && len > best) {
        best = len;
        best_dist = pos - candidate;
      }
    }
    if (best >= 3) {
      let li: u32 = 28;
      for (let k: u32 = 0; k < 29; k++) {
        let max = LENGTH_BASE[k] as u32 + ((1 << LENGTH_EXTRA[k]) - 1);
        if (best <= max) {
          li = k;
          break;
        }
      }
      fixed_code(257 + li);
      bw_write(fcode_code, fcode_width);
      if (LENGTH_EXTRA[li] > 0) bw_write(best - (LENGTH_BASE[li] as u32), LENGTH_EXTRA[li] as u32);
      let di: u32 = 0;
      while (di + 1 < 30 && best_dist >= (DIST_BASE[di + 1] as u32)) di++;
      bw_write(reverse_bits(di, 5), 5);
      if (DIST_EXTRA[di] > 0) bw_write(best_dist - (DIST_BASE[di] as u32), DIST_EXTRA[di] as u32);
      def_match_count++;
      def_matched_bytes += best;
      pos += best;
    } else {
      fixed_code(load<u8>(in_ptr + pos) as u32);
      bw_write(fcode_code, fcode_width);
      def_literal_count++;
      pos++;
    }
  }
  fixed_code(256);
  bw_write(fcode_code, fcode_width);
  if (bw_bits > 0 && bw_ok) {
    if (bw_at < bw_cap) {
      store<u8>(bw_out + bw_at, (bw_acc & 255) as u8);
      bw_at++;
    } else bw_ok = false;
  }
  return bw_ok ? bw_at : 0;
}

let br_in: usize = 0;
let br_n: u32 = 0;
let br_at: u32 = 0;
let br_acc: u32 = 0;
let br_bits: u32 = 0;
let br_ok: bool = true;

function br_read(width: u32): u32 {
  while (br_bits < width) {
    if (br_at >= br_n) {
      br_ok = false;
      return 0;
    }
    br_acc |= (load<u8>(br_in + br_at) as u32) << br_bits;
    br_at++;
    br_bits += 8;
  }
  let mask = (1 << width) - 1;
  let v = br_acc & mask;
  br_acc >>= width;
  br_bits -= width;
  return v;
}

function decode_symbol(): i32 {
  let code: u32 = 0;
  for (let width: u32 = 1; width <= 9; width++) {
    code |= br_read(1) << (width - 1);
    if (!br_ok) return -1;
    for (let s: u32 = 0; s <= 287; s++) {
      fixed_code(s);
      if (fcode_width == width && fcode_code == code) return s as i32;
    }
  }
  return -1;
}

function inflate_fixed(in_ptr: usize, n: u32, out_ptr: usize, expected: u32): bool {
  br_in = in_ptr;
  br_n = n;
  br_at = 0;
  br_acc = 0;
  br_bits = 0;
  br_ok = true;
  if (br_read(1) != 1 || br_read(2) != 1) return false;
  let at: u32 = 0;
  while (true) {
    let s = decode_symbol();
    if (s == 256) break;
    if (s < 0) return false;
    if (s < 256) {
      if (at >= expected) return false;
      store<u8>(out_ptr + at, s as u8);
      at++;
      continue;
    }
    if (s > 285) return false;
    let li = (s as u32) - 257;
    let len = (LENGTH_BASE[li] as u32) + br_read(LENGTH_EXTRA[li] as u32);
    let dc = reverse_bits(br_read(5), 5);
    if (dc >= 30) return false;
    let dist = (DIST_BASE[dc] as u32) + br_read(DIST_EXTRA[dc] as u32);
    if (dist > at || at + len > expected) return false;
    for (let i: u32 = 0; i < len; i++) {
      store<u8>(out_ptr + at, load<u8>(out_ptr + at - dist));
      at++;
    }
  }
  return br_ok && at == expected;
}

function crc32_bytes(in_ptr: usize, n: u32): u32 {
  let crc: u32 = 0xffffffff;
  for (let i: u32 = 0; i < n; i++) {
    crc ^= load<u8>(in_ptr + i) as u32;
    for (let b: u32 = 0; b < 8; b++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  return crc ^ 0xffffffff;
}

const TEMPLATES_0: StaticArray<u8> = [
  101,
  120,
  112,
  111,
  114,
  116,
  32,
  99,
  111,
  110,
  115,
  116,
  32,
  118,
  97,
  108,
  117,
  101,
  32,
  61,
  32,
]; // "export const value = "
const TEMPLATES_1: StaticArray<u8> = [
  123,
  34,
  101,
  118,
  101,
  110,
  116,
  34,
  58,
  34,
  119,
  111,
  114,
  107,
  115,
  112,
  97,
  99,
  101,
  34,
  44,
  34,
  118,
  97,
  108,
  117,
  101,
  34,
  58,
]; // '{"event":"workspace","value":'
const TEMPLATES_3: StaticArray<u8> = [
  35,
  32,
  87,
  111,
  114,
  107,
  115,
  112,
  97,
  99,
  101,
  32,
  110,
  111,
  116,
  101,
  32,
]; // "# Workspace note "

function path_text(out_ptr: usize, at: u32, txt: StaticArray<u8>): u32 {
  for (let i = 0; i < txt.length; i++) {
    store<u8>(out_ptr + at + i, txt[i]);
  }
  return at + (txt.length as u32);
}

const STR_SRC: StaticArray<u8> = [115, 114, 99];
const STR_DATA: StaticArray<u8> = [100, 97, 116, 97];
const STR_ASSETS: StaticArray<u8> = [97, 115, 115, 101, 116, 115];
const STR_DOCS: StaticArray<u8> = [100, 111, 99, 115];
const STR_MODULE: StaticArray<u8> = [109, 111, 100, 117, 108, 101];
const STR_EVENT: StaticArray<u8> = [101, 118, 101, 110, 116];
const STR_BLOB: StaticArray<u8> = [98, 108, 111, 98];
const STR_NOTE: StaticArray<u8> = [110, 111, 116, 101];
const STR_TS: StaticArray<u8> = [116, 115];
const STR_JSON: StaticArray<u8> = [106, 115, 111, 110];
const STR_BIN: StaticArray<u8> = [98, 105, 110];
const STR_MD: StaticArray<u8> = [109, 100];
const STR_CAFE: StaticArray<u8> = [47, 99, 97, 102, 195, 169]; // /café
const STR_TOKYO: StaticArray<u8> = [47, 230, 157, 177, 228, 186, 172]; // /東京

function path_for(index: u32, out_ptr: usize): u32 {
  let at: u32 = 0;
  let family = index & 3;
  if (family == 0) at = path_text(out_ptr, at, STR_SRC);
  else if (family == 1) at = path_text(out_ptr, at, STR_DATA);
  else if (family == 2) at = path_text(out_ptr, at, STR_ASSETS);
  else at = path_text(out_ptr, at, STR_DOCS);

  if (index % 997 == 0) at = path_text(out_ptr, at, STR_CAFE);
  else if (index % 991 == 0) at = path_text(out_ptr, at, STR_TOKYO);

  store<u8>(out_ptr + at, 47);
  at++; // '/'
  let group = index / 100;
  store<u8>(out_ptr + at, 48 + ((group / 100) % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 48 + ((group / 10) % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 48 + (group % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 47);
  at++; // '/'

  if (family == 0) at = path_text(out_ptr, at, STR_MODULE);
  else if (family == 1) at = path_text(out_ptr, at, STR_EVENT);
  else if (family == 2) at = path_text(out_ptr, at, STR_BLOB);
  else at = path_text(out_ptr, at, STR_NOTE);

  store<u8>(out_ptr + at, 45);
  at++; // '-'
  store<u8>(out_ptr + at, 48 + ((index / 10000) % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 48 + ((index / 1000) % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 48 + ((index / 100) % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 48 + ((index / 10) % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 48 + (index % 10) as u8);
  at++;
  store<u8>(out_ptr + at, 46);
  at++; // '.'

  if (family == 0) at = path_text(out_ptr, at, STR_TS);
  else if (family == 1) at = path_text(out_ptr, at, STR_JSON);
  else if (family == 2) at = path_text(out_ptr, at, STR_BIN);
  else at = path_text(out_ptr, at, STR_MD);

  return at;
}

function content_for(index: u32, out_ptr: usize): u32 {
  let n = 48 + (index % 113);
  let state = 0x9e3779b9 ^ index;
  let f = index & 3;
  for (let i: u32 = 0; i < (n as u32); i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    if (f == 2) {
      store<u8>(out_ptr + i, ((state >>> 24) ^ (index & 255)) as u8);
    } else {
      let b: u8 = 0;
      if (f == 0) b = TEMPLATES_0[i % (TEMPLATES_0.length as u32)];
      else if (f == 1) b = TEMPLATES_1[i % (TEMPLATES_1.length as u32)];
      else if (f == 3) b = TEMPLATES_3[i % (TEMPLATES_3.length as u32)];
      store<u8>(out_ptr + i, b);
    }
  }
  return n;
}

function selected_slot(index: u32): i32 {
  for (let i = 0; i < 10; i++) if (SELECTED[i] == index) return i as i32;
  return -1;
}
function selected_count(entry_count: u32): u32 {
  let c: u32 = 0;
  for (let i = 0; i < 10; i++) if (SELECTED[i] < entry_count) c++;
  return c;
}
function fnv1a32(bytes: usize, length: u32): u32 {
  let hash: u32 = 2166136261;
  for (let i: u32 = 0; i < length; i++) {
    hash ^= load<u8>(bytes + i) as u32;
    hash = hash * 16777619;
  }
  return hash >>> 0;
}

export function zip_build(): u32 {
  let archive_bytes: usize = ARCHIVE_OFFSET;
  let extracted_bytes: usize = EXTRACTED_OFFSET;
  let listing_bytes: usize = LISTING_OFFSET;
  let counters: usize = RES_OFFSET;

  let local_offsets: usize = INTERNAL_OFFSET;
  let crcs: usize = INTERNAL_OFFSET + 4000;
  let compressed_sizes: usize = INTERNAL_OFFSET + 8000;
  let plain_sizes: usize = INTERNAL_OFFSET + 12000;
  let name_sizes: usize = INTERNAL_OFFSET + 16000;

  for (let i: u32 = 0; i < 18; i++) store<u32>(counters + i * 4, 0);

  let archive_cap: u32 = 1048576;
  let extract_cap: u32 = 1048576;
  let listing_cap: u32 = 1048576;
  let entry_count = BOUNDED_ENTRY_COUNT;

  let name: usize = INTERNAL_OFFSET + 20000;
  let plain: usize = INTERNAL_OFFSET + 20100;
  let compressed: usize = INTERNAL_OFFSET + 20300;

  global_at = 0;
  let input_total: u32 = 0;
  def_literal_count = 0;
  def_match_count = 0;
  def_matched_bytes = 0;

  for (let i: u32 = 0; i < entry_count; i++) {
    let nl = path_for(i, name);
    let pl = content_for(i, plain);
    let cl = deflate_fixed(plain, pl, compressed, 256);
    let crc = crc32_bytes(plain, pl);
    if (cl == 0) return 1;

    store<u32>(local_offsets + i * 4, global_at);
    store<u32>(crcs + i * 4, crc);
    store<u32>(compressed_sizes + i * 4, cl);
    store<u32>(plain_sizes + i * 4, pl);
    store<u16>(name_sizes + i * 2, nl as u16);

    if (
      !append32(archive_bytes, archive_cap, 0x04034b50) ||
      !append16(archive_bytes, archive_cap, 20) ||
      !append16(archive_bytes, archive_cap, UTF8_FLAG as u32) ||
      !append16(archive_bytes, archive_cap, 8) ||
      !append16(archive_bytes, archive_cap, 0) ||
      !append16(archive_bytes, archive_cap, 0x21) ||
      !append32(archive_bytes, archive_cap, crc) ||
      !append32(archive_bytes, archive_cap, cl) ||
      !append32(archive_bytes, archive_cap, pl) ||
      !append16(archive_bytes, archive_cap, nl) ||
      !append16(archive_bytes, archive_cap, 0) ||
      !append_bytes(archive_bytes, archive_cap, name, nl) ||
      !append_bytes(archive_bytes, archive_cap, compressed, cl)
    ) return 2;
    input_total += pl;
  }
  let central = global_at;
  for (let i: u32 = 0; i < entry_count; i++) {
    let nl = path_for(i, name);
    if (
      !append32(archive_bytes, archive_cap, 0x02014b50) ||
      !append16(archive_bytes, archive_cap, 0x0314) ||
      !append16(archive_bytes, archive_cap, 20) ||
      !append16(archive_bytes, archive_cap, UTF8_FLAG as u32) ||
      !append16(archive_bytes, archive_cap, 8) ||
      !append16(archive_bytes, archive_cap, 0) ||
      !append16(archive_bytes, archive_cap, 0x21) ||
      !append32(archive_bytes, archive_cap, load<u32>(crcs + i * 4)) ||
      !append32(archive_bytes, archive_cap, load<u32>(compressed_sizes + i * 4)) ||
      !append32(archive_bytes, archive_cap, load<u32>(plain_sizes + i * 4)) ||
      !append16(archive_bytes, archive_cap, nl) ||
      !append16(archive_bytes, archive_cap, 0) ||
      !append16(archive_bytes, archive_cap, 0) ||
      !append16(archive_bytes, archive_cap, 0) ||
      !append16(archive_bytes, archive_cap, 0) ||
      !append32(archive_bytes, archive_cap, UNIX_MODE << 16) ||
      !append32(archive_bytes, archive_cap, load<u32>(local_offsets + i * 4)) ||
      !append_bytes(archive_bytes, archive_cap, name, nl)
    ) return 3;
  }
  let central_size = global_at - central;
  if (
    !append32(archive_bytes, archive_cap, 0x06054b50) ||
    !append16(archive_bytes, archive_cap, 0) ||
    !append16(archive_bytes, archive_cap, 0) ||
    !append16(archive_bytes, archive_cap, entry_count) ||
    !append16(archive_bytes, archive_cap, entry_count) ||
    !append32(archive_bytes, archive_cap, central_size) ||
    !append32(archive_bytes, archive_cap, central) ||
    !append16(archive_bytes, archive_cap, 0)
  ) return 4;

  let archive_len = global_at;
  store<u32>(counters, entry_count);
  store<u32>(counters + 4, input_total);
  store<u32>(counters + 8, input_total);
  store<u32>(counters + 12, def_literal_count);
  store<u32>(counters + 16, def_match_count);
  store<u32>(counters + 20, def_matched_bytes);
  store<u32>(counters + 24, entry_count);
  store<u32>(counters + 28, entry_count);
  store<u32>(counters + 32, entry_count);
  store<u32>(counters + 36, 0);

  let e = archive_len - 22;
  let count = get16(archive_bytes + e + 8);
  let coff = get32(archive_bytes + e + 16);

  let cur = coff;
  global_at = 0; // for listing
  let eat: u32 = 0;
  let exbytes: u32 = 0;

  let plain2: usize = INTERNAL_OFFSET + 20700;

  for (let i: u32 = 0; i < count; i++) {
    let crc = get32(archive_bytes + cur + 16);
    let cs = get32(archive_bytes + cur + 20);
    let ps = get32(archive_bytes + cur + 24);
    let nl = get16(archive_bytes + cur + 28);
    let lo = get32(archive_bytes + cur + 42);

    if (
      !append16(listing_bytes, listing_cap, nl) ||
      !append_bytes(listing_bytes, listing_cap, archive_bytes + cur + 46, nl) ||
      !append32(listing_bytes, listing_cap, ps) ||
      !append32(listing_bytes, listing_cap, cs) ||
      !append32(listing_bytes, listing_cap, crc)
    ) return 5;

    let data = lo + 30 + nl;
    if (selected_slot(i) >= 0) {
      if (!inflate_fixed(archive_bytes + data, cs, plain2, ps)) return 6;
      let prev_at = global_at;
      global_at = eat;
      if (
        !append32(extracted_bytes, extract_cap, i) ||
        !append32(extracted_bytes, extract_cap, ps) ||
        !append_bytes(extracted_bytes, extract_cap, plain2, ps)
      ) return 7;
      eat = global_at;
      global_at = prev_at;
      exbytes += ps;
    }
    cur += 46 + nl;
  }

  store<u32>(counters + 40, count);
  store<u32>(counters + 44, selected_count(count));
  store<u32>(counters + 48, exbytes);
  store<u32>(counters + 52, 0);
  store<u32>(counters + 56, 0);

  store<u32>(counters + 60, fnv1a32(archive_bytes, archive_len));
  store<u32>(counters + 64, fnv1a32(extracted_bytes, eat));
  return 0;
}
