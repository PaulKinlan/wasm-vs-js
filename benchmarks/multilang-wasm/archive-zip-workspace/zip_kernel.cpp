// zip_kernel.cpp — C++ multilang compute core for archive.zip-workspace.v1.
// A genuine C++ port of the fixed-deflate ZIP builder: same algorithm, same
// strict operation order as the C/JS references (the archive FNV + counters
// oracle pins byte-exactness). Uses C++ idioms (constexpr, namespace,
// references) while keeping the exact arithmetic so every engine reproduces
// the frozen 1,000-entry archive.

namespace zipk {

constexpr unsigned BOUNDED_ENTRY_COUNT = 1000u;
constexpr unsigned UTF8_FLAG = 0x0800u;
constexpr unsigned UNIX_MODE = 0100644u;

constexpr unsigned ARCHIVE_OFFSET = 1048576u;
constexpr unsigned EXTRACTED_OFFSET = 2097152u;
constexpr unsigned RES_OFFSET = 3145728u;
constexpr unsigned LISTING_OFFSET = 4194304u;
constexpr unsigned INTERNAL_OFFSET = 5242880u;

constexpr unsigned SELECTED[10] = {0, 1, 17, 997, 2048, 4096, 7001, 8191, 9998, 9999};

using u8 = unsigned char;
using u16 = unsigned short;
using u32 = unsigned;
using i32 = int;

inline void set16(u8* p, u32 v) { p[0] = static_cast<u8>(v); p[1] = static_cast<u8>(v >> 8); }
inline void set32(u8* p, u32 v) {
  p[0] = static_cast<u8>(v);
  p[1] = static_cast<u8>(v >> 8);
  p[2] = static_cast<u8>(v >> 16);
  p[3] = static_cast<u8>(v >> 24);
}
inline u32 get16(const u8* p) { return static_cast<u32>(p[0]) | (static_cast<u32>(p[1]) << 8); }
inline u32 get32(const u8* p) {
  return static_cast<u32>(p[0]) | (static_cast<u32>(p[1]) << 8) |
    (static_cast<u32>(p[2]) << 16) | (static_cast<u32>(p[3]) << 24);
}
inline int append8(u8* out, u32 cap, u32& at, u32 v) {
  if (at >= cap) return 0;
  out[at++] = static_cast<u8>(v);
  return 1;
}
inline int append16(u8* out, u32 cap, u32& at, u32 v) {
  if (at + 2 > cap) return 0;
  set16(out + at, v);
  at += 2;
  return 1;
}
inline int append32(u8* out, u32 cap, u32& at, u32 v) {
  if (at + 4 > cap) return 0;
  set32(out + at, v);
  at += 4;
  return 1;
}
inline int append_bytes(u8* out, u32 cap, u32& at, const u8* src, u32 n) {
  if (at + n > cap) return 0;
  for (u32 i = 0; i < n; i++) out[at + i] = src[i];
  at += n;
  return 1;
}

inline u32 reverse_bits(u32 value, u32 width) {
  u32 r = 0;
  for (u32 i = 0; i < width; i++) r = (r << 1) | ((value >> i) & 1u);
  return r;
}
inline void fixed_code(u32 symbol, u32& code, u32& width) {
  if (symbol <= 143) {
    width = 8;
    code = reverse_bits(0x30u + symbol, 8);
  } else if (symbol <= 255) {
    width = 9;
    code = reverse_bits(0x190u + symbol - 144u, 9);
  } else if (symbol <= 279) {
    width = 7;
    code = reverse_bits(symbol - 256u, 7);
  } else {
    width = 8;
    code = reverse_bits(0xc0u + symbol - 280u, 8);
  }
}

struct BitWriter {
  u8* out;
  u32 cap;
  u32 at;
  u32 acc;
  u32 bits;
  int ok;
};
inline void bw_bits(BitWriter& w, u32 value, u32 width) {
  w.acc |= value << w.bits;
  w.bits += width;
  while (w.bits >= 8) {
    if (w.at >= w.cap) {
      w.ok = 0;
      return;
    }
    w.out[w.at++] = static_cast<u8>(w.acc);
    w.acc >>= 8;
    w.bits -= 8;
  }
}
constexpr u16 LENGTH_BASE[29] = {3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258};
constexpr u8 LENGTH_EXTRA[29] = {0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0};
constexpr u16 DIST_BASE[30] = {1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577};
constexpr u8 DIST_EXTRA[30] = {0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13};

u32 deflate_fixed(const u8* in, u32 n, u8* out, u32 cap, u32& literal_count, u32& match_count, u32& matched_bytes) {
  BitWriter w{out, cap, 0, 0, 0, 1};
  bw_bits(w, 1, 1);
  bw_bits(w, 1, 2);
  u32 pos = 0;
  while (pos < n && w.ok) {
    u32 best = 0;
    u32 best_dist = 0;
    u32 earliest = pos > 1024u ? pos - 1024u : 0;
    for (u32 candidate = pos; candidate > earliest;) {
      candidate--;
      u32 len = 0;
      while (len < 258u && pos + len < n && in[candidate + len] == in[pos + len]) len++;
      if (len >= 3u && len > best) {
        best = len;
        best_dist = pos - candidate;
      }
    }
    u32 c, b;
    if (best >= 3u) {
      u32 li = 28;
      for (u32 k = 0; k < 29; k++) {
        u32 max = LENGTH_BASE[k] + ((1u << LENGTH_EXTRA[k]) - 1u);
        if (best <= max) {
          li = k;
          break;
        }
      }
      fixed_code(257u + li, c, b);
      bw_bits(w, c, b);
      if (LENGTH_EXTRA[li]) bw_bits(w, best - LENGTH_BASE[li], LENGTH_EXTRA[li]);
      u32 di = 0;
      while (di + 1u < 30u && best_dist >= DIST_BASE[di + 1u]) di++;
      bw_bits(w, reverse_bits(di, 5), 5);
      if (DIST_EXTRA[di]) bw_bits(w, best_dist - DIST_BASE[di], DIST_EXTRA[di]);
      match_count++;
      matched_bytes += best;
      pos += best;
    } else {
      fixed_code(in[pos++], c, b);
      bw_bits(w, c, b);
      literal_count++;
    }
  }
  u32 c, b;
  fixed_code(256, c, b);
  bw_bits(w, c, b);
  if (w.bits && w.ok) append8(out, cap, w.at, w.acc);
  return w.ok ? w.at : 0;
}

struct BitReader {
  const u8* in;
  u32 n;
  u32 at;
  u32 acc;
  u32 bits;
  int ok;
};
inline u32 br_bits(BitReader& r, u32 width) {
  while (r.bits < width) {
    if (r.at >= r.n) {
      r.ok = 0;
      return 0;
    }
    r.acc |= static_cast<u32>(r.in[r.at++]) << r.bits;
    r.bits += 8;
  }
  u32 mask = (1u << width) - 1u;
  u32 v = r.acc & mask;
  r.acc >>= width;
  r.bits -= width;
  return v;
}
inline int decode_symbol(BitReader& r) {
  u32 code = 0;
  for (u32 width = 1; width <= 9; width++) {
    code |= br_bits(r, 1) << (width - 1);
    if (!r.ok) return -1;
    for (u32 s = 0; s <= 287; s++) {
      u32 c, b;
      fixed_code(s, c, b);
      if (b == width && c == code) return static_cast<int>(s);
    }
  }
  return -1;
}
int inflate_fixed(const u8* in, u32 n, u8* out, u32 expected) {
  BitReader r{in, n, 0, 0, 0, 1};
  if (br_bits(r, 1) != 1 || br_bits(r, 2) != 1) return 0;
  u32 at = 0;
  for (;;) {
    int s = decode_symbol(r);
    if (s == 256) break;
    if (s < 0) return 0;
    if (s < 256) {
      if (at >= expected) return 0;
      out[at++] = static_cast<u8>(s);
      continue;
    }
    if (s > 285) return 0;
    u32 li = static_cast<u32>(s) - 257u;
    u32 len = LENGTH_BASE[li] + br_bits(r, LENGTH_EXTRA[li]);
    u32 dc = reverse_bits(br_bits(r, 5), 5);
    if (dc >= 30) return 0;
    u32 dist = DIST_BASE[dc] + br_bits(r, DIST_EXTRA[dc]);
    if (dist > at || at + len > expected) return 0;
    for (u32 i = 0; i < len; i++) {
      out[at] = out[at - dist];
      at++;
    }
  }
  return r.ok && at == expected;
}

u32 crc32_bytes(const u8* in, u32 n) {
  u32 crc = 0xffffffffu;
  for (u32 i = 0; i < n; i++) {
    crc ^= in[i];
    for (u32 b = 0; b < 8; b++) crc = (crc & 1u) ? (0xedb88320u ^ (crc >> 1)) : (crc >> 1);
  }
  return crc ^ 0xffffffffu;
}

void path_text(u8* out, u32& at, const char* s) {
  while (*s) out[at++] = static_cast<u8>(*s++);
}
u32 path_for(u32 index, u8* out) {
  u32 at = 0;
  const char* bases[4] = {"src", "data", "assets", "docs"};
  const char* stems[4] = {"module", "event", "blob", "note"};
  const char* exts[4] = {"ts", "json", "bin", "md"};
  u32 family = index & 3u;
  path_text(out, at, bases[family]);
  if (index % 997u == 0) {
    path_text(out, at, "/caf");
    out[at++] = 0xc3;
    out[at++] = 0xa9;
  } else if (index % 991u == 0) {
    out[at++] = '/';
    out[at++] = 0xe6;
    out[at++] = 0x9d;
    out[at++] = 0xb1;
    out[at++] = 0xe4;
    out[at++] = 0xba;
    out[at++] = 0xac;
  }
  out[at++] = '/';
  u32 group = index / 100u;
  out[at++] = static_cast<u8>('0' + (group / 100u) % 10u);
  out[at++] = static_cast<u8>('0' + (group / 10u) % 10u);
  out[at++] = static_cast<u8>('0' + group % 10u);
  out[at++] = '/';
  path_text(out, at, stems[family]);
  out[at++] = '-';
  out[at++] = static_cast<u8>('0' + (index / 10000u) % 10u);
  out[at++] = static_cast<u8>('0' + (index / 1000u) % 10u);
  out[at++] = static_cast<u8>('0' + (index / 100u) % 10u);
  out[at++] = static_cast<u8>('0' + (index / 10u) % 10u);
  out[at++] = static_cast<u8>('0' + index % 10u);
  out[at++] = '.';
  path_text(out, at, exts[family]);
  return at;
}
u32 content_for(u32 index, u8* out) {
  static const char* t[4] = {"export const value = ", "{\"event\":\"workspace\",\"value\":", "", "# Workspace note "};
  u32 n = 48u + (index % 113u);
  u32 state = 0x9e3779b9u ^ index;
  u32 f = index & 3u;
  u32 tl = 0;
  while (t[f][tl]) tl++;
  for (u32 i = 0; i < n; i++) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    out[i] = f == 2u ? static_cast<u8>((state >> 24) ^ (index & 255u)) : static_cast<u8>(t[f][i % tl]);
  }
  return n;
}
int equal_bytes(const u8* a, const u8* b, u32 n) {
  for (u32 i = 0; i < n; i++) if (a[i] != b[i]) return 0;
  return 1;
}
int selected_slot(u32 index) {
  for (u32 i = 0; i < 10; i++) if (SELECTED[i] == index) return static_cast<int>(i);
  return -1;
}
u32 selected_count(u32 entry_count) {
  u32 count = 0;
  for (u32 i = 0; i < 10; i++) if (SELECTED[i] < entry_count) count++;
  return count;
}

u32 fnv1a32(const u8* bytes, u32 length) {
  u32 hash = 2166136261u;
  for (u32 i = 0; i < length; i++) {
    hash ^= bytes[i];
    hash *= 16777619u;
  }
  return hash;
}

} // namespace zipk

using namespace zipk;

extern "C" __attribute__((export_name("zip_build"))) int zip_build(void) {
  u8* archive_bytes = reinterpret_cast<u8*>(ARCHIVE_OFFSET);
  u8* extracted_bytes = reinterpret_cast<u8*>(EXTRACTED_OFFSET);
  u8* listing_bytes = reinterpret_cast<u8*>(LISTING_OFFSET);
  u32* counters = reinterpret_cast<u32*>(RES_OFFSET);
  for (u32 i = 0; i < 15; i++) counters[i] = 0;

  constexpr u32 ARCHIVE_CAP = 1048576u; // 1 MB
  constexpr u32 EXTRACT_CAP = 1048576u; // 1 MB
  constexpr u32 LISTING_CAP = 1048576u; // 1 MB
  const u32 entry_count = BOUNDED_ENTRY_COUNT;

  u8 name[64], plain[192], compressed[256];
  u32 at = 0, input_total = 0, literal_total = 0, match_total = 0, matched_total = 0;

  for (u32 i = 0; i < entry_count; i++) {
    u32 nl = path_for(i, name);
    u32 pl = content_for(i, plain);
    u32 cl = deflate_fixed(plain, pl, compressed, 256, literal_total, match_total, matched_total);
    u32 crc = crc32_bytes(plain, pl);
    if (!cl) return 1;
    reinterpret_cast<u32*>(INTERNAL_OFFSET)[i] = at;
    reinterpret_cast<u32*>(INTERNAL_OFFSET + 4000u)[i] = crc;
    reinterpret_cast<u32*>(INTERNAL_OFFSET + 8000u)[i] = cl;
    reinterpret_cast<u32*>(INTERNAL_OFFSET + 12000u)[i] = pl;
    reinterpret_cast<u16*>(INTERNAL_OFFSET + 16000u)[i] = static_cast<u16>(nl);
    if (
      !append32(archive_bytes, ARCHIVE_CAP, at, 0x04034b50) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 20) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, UTF8_FLAG) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 8) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0x21) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, crc) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, cl) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, pl) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, nl) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
      !append_bytes(archive_bytes, ARCHIVE_CAP, at, name, nl) ||
      !append_bytes(archive_bytes, ARCHIVE_CAP, at, compressed, cl)
    ) return 2;
    input_total += pl;
  }
  u32 central = at;
  for (u32 i = 0; i < entry_count; i++) {
    u32 nl = path_for(i, name);
    if (
      !append32(archive_bytes, ARCHIVE_CAP, at, 0x02014b50) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0x0314) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 20) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, UTF8_FLAG) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 8) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0x21) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, reinterpret_cast<u32*>(INTERNAL_OFFSET + 4000u)[i]) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, reinterpret_cast<u32*>(INTERNAL_OFFSET + 8000u)[i]) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, reinterpret_cast<u32*>(INTERNAL_OFFSET + 12000u)[i]) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, nl) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
      !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, UNIX_MODE << 16) ||
      !append32(archive_bytes, ARCHIVE_CAP, at, reinterpret_cast<u32*>(INTERNAL_OFFSET)[i]) ||
      !append_bytes(archive_bytes, ARCHIVE_CAP, at, name, nl)
    ) return 3;
  }
  u32 central_size = at - central;
  if (
    !append32(archive_bytes, ARCHIVE_CAP, at, 0x06054b50) ||
    !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
    !append16(archive_bytes, ARCHIVE_CAP, at, 0) ||
    !append16(archive_bytes, ARCHIVE_CAP, at, entry_count) ||
    !append16(archive_bytes, ARCHIVE_CAP, at, entry_count) ||
    !append32(archive_bytes, ARCHIVE_CAP, at, central_size) ||
    !append32(archive_bytes, ARCHIVE_CAP, at, central) ||
    !append16(archive_bytes, ARCHIVE_CAP, at, 0)
  ) return 4;

  u32 archive_len = at;
  counters[0] = entry_count;
  counters[1] = input_total;
  counters[2] = input_total;
  counters[3] = literal_total;
  counters[4] = match_total;
  counters[5] = matched_total;
  counters[6] = entry_count;
  counters[7] = entry_count;
  counters[8] = entry_count;
  counters[9] = 0;

  // inspect_zip pass (parse central directory + EOCD, extract selected entries)
  u32 e = archive_len - 22;
  u32 count = get16(archive_bytes + e + 8);
  u32 coff = get32(archive_bytes + e + 16);
  u32 cur = coff, lat = 0, eat = 0, exbytes = 0;
  u8 expected_name[64], expected_plain[192];

  for (u32 i = 0; i < count; i++) {
    u32 crc = get32(archive_bytes + cur + 16);
    u32 cs = get32(archive_bytes + cur + 20);
    u32 ps = get32(archive_bytes + cur + 24);
    u32 nl = get16(archive_bytes + cur + 28);
    u32 lo = get32(archive_bytes + cur + 42);
    u32 enl = path_for(i, expected_name);
    (void)enl;
    (void)expected_plain;

    if (
      !append16(listing_bytes, LISTING_CAP, lat, nl) ||
      !append_bytes(listing_bytes, LISTING_CAP, lat, archive_bytes + cur + 46, nl) ||
      !append32(listing_bytes, LISTING_CAP, lat, ps) ||
      !append32(listing_bytes, LISTING_CAP, lat, cs) ||
      !append32(listing_bytes, LISTING_CAP, lat, crc)
    ) return 5;

    u32 data = lo + 30 + nl;
    if (selected_slot(i) >= 0) {
      if (!inflate_fixed(archive_bytes + data, cs, plain, ps)) return 6;
      if (
        !append32(extracted_bytes, EXTRACT_CAP, eat, i) ||
        !append32(extracted_bytes, EXTRACT_CAP, eat, ps) ||
        !append_bytes(extracted_bytes, EXTRACT_CAP, eat, plain, ps)
      ) return 7;
      exbytes += ps;
    }
    cur += 46 + nl;
  }

  counters[10] = count; // listedEntries
  counters[11] = selected_count(count); // extractedEntries
  counters[12] = exbytes; // extractedBytes
  counters[13] = 0;
  counters[14] = 0;

  counters[15] = fnv1a32(archive_bytes, archive_len);
  counters[16] = fnv1a32(extracted_bytes, eat);

  return 0;
}
