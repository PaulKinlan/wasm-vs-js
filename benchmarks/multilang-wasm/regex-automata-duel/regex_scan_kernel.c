// regex_scan_kernel.c — multilang compute core for regex-automata-duel-demo.
//
// Runs the frozen 20-pattern DFA scan bit-identical to the WAT scan_dfa
// (benchmarks/regex-automata-duel/regex-automata.wat) and to the reference
// NFA sim (scanJSAutomata() in benchmarks/regex-automata-duel/js-automata.ts).
// The adapter writes the frozen 1,163,248-byte fixture (magic 'RXA1', a
// 1,048,576-byte BMP-only ASCII corpus, and the 20 precompiled DFA tables)
// into linear memory at FIXTURE_OFFSET; the kernel walks every DFA over the
// corpus, computes an FNV-1a digest of the ordered (patternId,startCP,endCP)
// tuples, and writes counters + digest to RES_OFFSET.
//
// Results (u32 words at RES_OFFSET):
//   [0] matches_found     (=141605)
//   [1] patterns_executed (=20)
//   [2] code_points       (=20971520 = 1048576 * 20)
//   [3] captures_extracted (=1623)
//   [4] boundary_crossings (=20 — one per DFA scan)
//   [5] input_bytes        (=1163248 = fixture_len)
//   [6] corpus_bytes       (=1048576)
//   [7] tuple_fnv1a        (=0xa5be957f)
//   [8] status_code        (0 = ok)
// Exports: i32 regex_scan(u32 fixture_len) -> 0 ok / negative error.

typedef unsigned char u8;
typedef unsigned short u16;
typedef signed short i16;
typedef unsigned int u32;
typedef int i32;

#define FIXTURE_OFFSET 3145728u
#define RES_OFFSET     5242880u
#define FIXTURE_MAGIC  0x31415852u

static u8 fixture_at(u32 off) { return *(((u8 *)FIXTURE_OFFSET) + off); }
static u32 read_u32_le(u32 off) {
  return (u32)fixture_at(off) | ((u32)fixture_at(off + 1) << 8) |
    ((u32)fixture_at(off + 2) << 16) | ((u32)fixture_at(off + 3) << 24);
}
static i16 read_i16_le(u32 off) {
  return (i16)((u16)fixture_at(off) | ((u16)fixture_at(off + 1) << 8));
}

static u32 fnv;
static void fnv_reset(void) { fnv = 0x811c9dc5u; }
static void fnv_mix_byte(u8 b) { fnv = (fnv ^ (u32)b) * 0x01000193u; }
static void fnv_mix_u32(u32 v) {
  fnv_mix_byte((u8)(v & 0xffu));
  fnv_mix_byte((u8)((v >> 8) & 0xffu));
  fnv_mix_byte((u8)((v >> 16) & 0xffu));
  fnv_mix_byte((u8)((v >> 24) & 0xffu));
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

__attribute__((export_name("regex_scan")))
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
    off = (off + 1u) & ~1u; // 2-byte align for i16 transitions
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

    // DFA scan (bit-identical to scan_dfa in regex-automata.wat).
    boundary_crossings++;
    u32 pattern_matches = 0;
    u32 search = 0;
    while (search <= corpus_len) {
      if (anchor_start && search > 0) break;
      u32 cursor = search;
      i32 state = 0;
      i32 best = -1;
      if (fixture_at(accept_off + (u32)state)) {
        i32 valid = anchor_end ? is_valid_end(corpus_off, corpus_len, cursor) : 1;
        if (valid) best = (i32)cursor;
      }
      while (cursor < corpus_len) {
        u8 code = fixture_at(corpus_off + cursor);
        if (code >= 128u) break;
        if (best == (i32)cursor &&
            fixture_at(commit_off + (u32)state * 128u + (u32)code)) {
          break;
        }
        i16 next = read_i16_le(table_off + ((u32)state * 128u + (u32)code) * 2u);
        if (next < 0) break;
        state = (i32)next;
        cursor++;
        if (fixture_at(accept_off + (u32)state)) {
          i32 valid = anchor_end ? is_valid_end(corpus_off, corpus_len, cursor) : 1;
          if (valid) best = (i32)cursor;
        }
      }
      if (best >= (i32)search) {
        // Emit tuple (patternId, startCP, endCP) into the FNV stream.
        fnv_mix_u32(pattern_id);
        fnv_mix_u32(search);
        fnv_mix_u32((u32)best);
        matches_found++;
        pattern_matches++;
        if ((u32)best > search) search = (u32)best;
        else search++;
      } else {
        if (anchor_start) break;
        search++;
      }
    }
    captures_extracted += pattern_matches * (u32)capture_groups;
  }

  u32 *results = (u32 *)RES_OFFSET;
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
