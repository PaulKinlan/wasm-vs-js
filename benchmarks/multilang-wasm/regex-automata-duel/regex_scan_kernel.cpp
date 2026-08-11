// regex_scan_kernel.cpp — multilang compute core for regex-automata-duel-demo.
// Same ABI + oracle as regex_scan_kernel.c. See the C file for the ABI docs.

using u8 = unsigned char;
using u16 = unsigned short;
using i16 = signed short;
using u32 = unsigned int;
using i32 = int;

constexpr u32 FIXTURE_OFFSET = 3145728u;
constexpr u32 RES_OFFSET = 5242880u;
constexpr u32 FIXTURE_MAGIC = 0x31415852u;

static u8 fixture_at(u32 off) {
  return *(reinterpret_cast<u8 *>(FIXTURE_OFFSET) + off);
}
static u32 read_u32_le(u32 off) {
  return static_cast<u32>(fixture_at(off)) |
    (static_cast<u32>(fixture_at(off + 1)) << 8) |
    (static_cast<u32>(fixture_at(off + 2)) << 16) |
    (static_cast<u32>(fixture_at(off + 3)) << 24);
}
static i16 read_i16_le(u32 off) {
  return static_cast<i16>(
    static_cast<u16>(fixture_at(off)) |
    (static_cast<u16>(fixture_at(off + 1)) << 8));
}

static u32 fnv;
static void fnv_reset() { fnv = 0x811c9dc5u; }
static void fnv_mix_byte(u8 b) { fnv = (fnv ^ static_cast<u32>(b)) * 0x01000193u; }
static void fnv_mix_u32(u32 v) {
  fnv_mix_byte(static_cast<u8>(v & 0xffu));
  fnv_mix_byte(static_cast<u8>((v >> 8) & 0xffu));
  fnv_mix_byte(static_cast<u8>((v >> 16) & 0xffu));
  fnv_mix_byte(static_cast<u8>((v >> 24) & 0xffu));
}

static i32 is_valid_end(u32 corpus_off, u32 corpus_len, u32 end) {
  if (end == corpus_len) return 1;
  if (end == corpus_len - 1) {
    u8 c = fixture_at(corpus_off + end);
    if (c == 10 || c == 13) return 1;
  }
  if (corpus_len >= 2 && end == corpus_len - 2) {
    if (fixture_at(corpus_off + end) == 13 &&
        fixture_at(corpus_off + end + 1) == 10) {
      return 1;
    }
  }
  return 0;
}

extern "C" __attribute__((export_name("regex_scan")))
i32 regex_scan(u32 fixture_len) {
  u32 off = 0;
  if (fixture_len < 12u) return -1;
  if (read_u32_le(off) != FIXTURE_MAGIC) return -2;
  off += 4;
  u32 corpus_len = read_u32_le(off);
  off += 4;
  if (corpus_len > fixture_len - off) return -3;
  u32 corpus_off = off;
  off += corpus_len;
  off = (off + 7u) & ~7u;
  u32 pattern_count = read_u32_le(off);
  off += 4;

  u32 matches_found = 0;
  u32 captures_extracted = 0;
  u32 boundary_crossings = 0;
  fnv_reset();

  for (u32 p = 0; p < pattern_count; p++) {
    if (off + 12u > fixture_len) return -4;
    u32 state_count = read_u32_le(off);
    off += 4;
    u8 anchor_start = fixture_at(off);
    u8 anchor_end = fixture_at(off + 1);
    u8 capture_groups = fixture_at(off + 2);
    off += 4;
    u32 pattern_id = read_u32_le(off);
    off += 4;
    off = (off + 1u) & ~1u;
    u32 table_off = off;
    u32 table_bytes = state_count * 128u * 2u;
    if (table_bytes > fixture_len - off) return -5;
    off += table_bytes;
    u32 accept_off = off;
    if (state_count > fixture_len - off) return -6;
    off += state_count;
    u32 commit_off = off;
    u32 commit_bytes = state_count * 128u;
    if (commit_bytes > fixture_len - off) return -7;
    off += commit_bytes;
    off = (off + 7u) & ~7u;

    boundary_crossings++;
    u32 pattern_matches = 0;
    u32 search = 0;
    while (search <= corpus_len) {
      if (anchor_start && search > 0) break;
      u32 cursor = search;
      i32 state = 0;
      i32 best = -1;
      if (fixture_at(accept_off + static_cast<u32>(state))) {
        i32 valid = anchor_end ? is_valid_end(corpus_off, corpus_len, cursor) : 1;
        if (valid) best = static_cast<i32>(cursor);
      }
      while (cursor < corpus_len) {
        u8 code = fixture_at(corpus_off + cursor);
        if (code >= 128u) break;
        if (best == static_cast<i32>(cursor) &&
            fixture_at(commit_off + static_cast<u32>(state) * 128u + static_cast<u32>(code))) {
          break;
        }
        i16 next = read_i16_le(table_off + (static_cast<u32>(state) * 128u + static_cast<u32>(code)) * 2u);
        if (next < 0) break;
        state = static_cast<i32>(next);
        cursor++;
        if (fixture_at(accept_off + static_cast<u32>(state))) {
          i32 valid = anchor_end ? is_valid_end(corpus_off, corpus_len, cursor) : 1;
          if (valid) best = static_cast<i32>(cursor);
        }
      }
      if (best >= static_cast<i32>(search)) {
        fnv_mix_u32(pattern_id);
        fnv_mix_u32(search);
        fnv_mix_u32(static_cast<u32>(best));
        matches_found++;
        pattern_matches++;
        if (static_cast<u32>(best) > search) search = static_cast<u32>(best);
        else search++;
      } else {
        if (anchor_start) break;
        search++;
      }
    }
    captures_extracted += pattern_matches * static_cast<u32>(capture_groups);
  }

  u32 *results = reinterpret_cast<u32 *>(RES_OFFSET);
  results[0] = matches_found;
  results[1] = pattern_count;
  results[2] = corpus_len * pattern_count;
  results[3] = captures_extracted;
  results[4] = boundary_crossings;
  results[5] = fixture_len;
  results[6] = corpus_len;
  results[7] = fnv;
  results[8] = 0;
  return 0;
}
