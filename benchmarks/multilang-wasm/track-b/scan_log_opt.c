#include <stdint.h>

// Track B — text-regex-log-scan optimized C variant (INDEPENDENTLY OPTIMIZED).
// Track A baseline (benchmarks/multilang-wasm/text-regex-log-scan/scan_log.c)
// is KEPT UNTOUCHED. The matcher bodies below (prefix dispatch, url-tail,
// ipv4, status) are VERBATIM mirrors of the Track A kernel — every counter
// increment and every branch is identical.
//
// OPTIMIZATION LOG (what / why / measured):
// 1. SPLIT-LOOP BOUNDS HANDLING: the baseline re-checks `start + index >= len`
//    for every prefix byte. When the prefix fits (start + plen <= len) that
//    check NEVER fires — pure overhead with zero counter impact. The optimized
//    kernel takes a fast path (no bounds check, pointer-walk src[index]) for
//    the fitting region and the baseline's checked loop for the tail. The
//    number of prefixComparisons is IDENTICAL (the check never fired in the
//    fast region) → output (matches + ALL counters) is BIT-IDENTICAL.
// 2. POINTER WALK: src = bytes + start; src[index] instead of bytes[start+index].
// Measured delta in docs/track-b-optimizations.md.

#define PATTERN_COUNT 20
#define MAX_BUCKET 4

static const uint8_t PATTERN_PREFIXES[PATTERN_COUNT][17] = {
  "http://", "https://", "ws://", "wss://", "ftp://", "asset://", "api://",
  "cdn://", "ip=", "client-ip:", "source-ip:", "dest-ip:", "peer-ip:",
  "origin-ip:", "status=", "code=", "http-status:", "response-status:",
  "result-status:", "status-code:",
};
static const uint8_t PATTERN_LENS[PATTERN_COUNT] = {
  7, 8, 5, 6, 6, 8, 6, 6, 3, 10, 10, 8, 8, 10, 7, 5, 12, 16, 14, 12,
};
static const uint8_t PATTERN_MATCHERS[PATTERN_COUNT] = {
  1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3,
};

static int isUrlTail(uint8_t byte) {
  return (byte >= 97 && byte <= 122) || (byte >= 48 && byte <= 57) ||
    byte == 46 || byte == 47 || byte == 95 || byte == 45;
}

// prefix_matches: fast=1 uses the split-loop (no bounds check when the prefix
// fits); fast=0 uses the baseline checked loop. Both count identically.
static int prefix_matches(const uint8_t* bytes, uint32_t len, uint32_t start,
                          const uint8_t* prefix, uint32_t plen,
                          uint32_t* prefixComparisons, int fast) {
  if (fast && start + plen <= len) {
    // Fast path: the prefix fits, so the baseline's bounds check never fires
    // and is pure overhead. Same number of comparisons → same counters.
    const uint8_t* src = bytes + start;
    for (uint32_t index = 0; index < plen; index++) {
      (*prefixComparisons)++;
      if (src[index] != prefix[index]) return 0;
    }
    return 1;
  }
  // Slow path (baseline-identical, also used when the prefix crosses the end):
  // same per-index bounds check, same comparison count.
  for (uint32_t index = 0; index < plen; index++) {
    if (start + index >= len) return 0;
    (*prefixComparisons)++;
    if (bytes[start + index] != prefix[index]) return 0;
  }
  return 1;
}

static uint32_t scan_log(
    const uint8_t* bytes, uint32_t len,
    uint32_t* out_id, uint32_t* out_start, uint32_t* out_end, uint32_t out_cap,
    uint32_t* scratch, uint32_t* out_candidate_starts,
    uint32_t* out_prefix_comparisons, uint32_t* out_tail_comparisons,
    int fast) {
  uint32_t* buckets = scratch;
  for (uint32_t b = 0; b < 256; b++) buckets[b * (MAX_BUCKET + 1)] = 0;
  for (uint32_t p = 0; p < PATTERN_COUNT; p++) {
    const uint32_t first = PATTERN_PREFIXES[p][0];
    uint32_t* slot = buckets + first * (MAX_BUCKET + 1);
    const uint32_t count = slot[0];
    slot[1 + count] = p;
    slot[0] = count + 1;
  }

  uint32_t matchCount = 0;
  uint32_t candidateStarts = 0;
  uint32_t prefixComparisons = 0;
  uint32_t tailComparisons = 0;

  for (uint32_t start = 0; start < len; start++) {
    const uint32_t* slot = buckets + bytes[start] * (MAX_BUCKET + 1);
    const uint32_t count = slot[0];
    for (uint32_t bi = 0; bi < count; bi++) {
      const uint32_t patternIndex = slot[1 + bi];
      candidateStarts++;
      const uint8_t* prefix = PATTERN_PREFIXES[patternIndex];
      const uint32_t plen = PATTERN_LENS[patternIndex];
      if (!prefix_matches(bytes, len, start, prefix, plen, &prefixComparisons, fast)) {
        continue;
      }
      const uint32_t cursor = start + plen;
      int32_t end = -1;
      const uint8_t matcher = PATTERN_MATCHERS[patternIndex];
      if (matcher == 1) {
        const uint32_t s0 = cursor;
        uint32_t c = cursor;
        while (c < len && c - s0 < 96) {
          const uint8_t byte = bytes[c];
          tailComparisons++;
          if (!isUrlTail(byte)) break;
          c++;
        }
        if (c == s0) { end = -1; }
        else if (c - s0 == 96 && c < len && isUrlTail(bytes[c])) {
          tailComparisons++;
          end = -1;
        } else end = (int32_t)c;
      } else if (matcher == 2) {
        uint32_t c = cursor;
        int32_t result = -1;
        int failed = 0;
        for (uint32_t octet = 0; octet < 4; octet++) {
          const uint32_t s1 = c;
          uint32_t value = 0;
          while (c < len && c - s1 < 3) {
            const uint8_t byte = bytes[c];
            tailComparisons++;
            if (byte < 48 || byte > 57) break;
            value = value * 10 + byte - 48;
            c++;
          }
          const uint32_t digits = c - s1;
          if (digits == 0 || value > 255 || (digits > 1 && bytes[s1] == 48)) { failed = 1; break; }
          if (octet < 3) {
            if (c >= len) { failed = 1; break; }
            tailComparisons++;
            if (bytes[c] != 46) { failed = 1; break; }
            c++;
          }
        }
        if (!failed) {
          if (c < len) {
            tailComparisons++;
            if (bytes[c] >= 48 && bytes[c] <= 57) result = -1;
            else if (bytes[c] == 46) result = -1;
            else result = (int32_t)c;
          } else result = (int32_t)c;
        }
        end = result;
      } else {
        if (cursor + 3 > len) { end = -1; }
        else {
          uint32_t value = 0;
          int32_t ok = 1;
          for (uint32_t index = 0; index < 3; index++) {
            const uint8_t byte = bytes[cursor + index];
            tailComparisons++;
            if (byte < 48 || byte > 57) { ok = 0; break; }
            value = value * 10 + byte - 48;
          }
          if (ok && (value < 100 || value > 599)) ok = 0;
          if (!ok) { end = -1; }
          else {
            const uint32_t endp = cursor + 3;
            if (endp < len) {
              tailComparisons++;
              if (bytes[endp] >= 48 && bytes[endp] <= 57) end = -1;
              else end = (int32_t)endp;
            } else end = (int32_t)endp;
          }
        }
      }
      if (end >= 0 && matchCount < out_cap) {
        out_id[matchCount] = patternIndex;
        out_start[matchCount] = start;
        out_end[matchCount] = (uint32_t)end;
        matchCount++;
      }
    }
  }
  if (out_candidate_starts) *out_candidate_starts = candidateStarts;
  if (out_prefix_comparisons) *out_prefix_comparisons = prefixComparisons;
  if (out_tail_comparisons) *out_tail_comparisons = tailComparisons;
  return matchCount;
}

__attribute__((visibility("default")))
uint32_t scan_log_baseline(
    const uint8_t* bytes, uint32_t len,
    uint32_t* out_id, uint32_t* out_start, uint32_t* out_end, uint32_t out_cap,
    uint32_t* scratch, uint32_t* out_candidate_starts,
    uint32_t* out_prefix_comparisons, uint32_t* out_tail_comparisons) {
  return scan_log(bytes, len, out_id, out_start, out_end, out_cap, scratch,
                  out_candidate_starts, out_prefix_comparisons, out_tail_comparisons,
                  0);
}

__attribute__((visibility("default")))
uint32_t scan_log_opt(
    const uint8_t* bytes, uint32_t len,
    uint32_t* out_id, uint32_t* out_start, uint32_t* out_end, uint32_t out_cap,
    uint32_t* scratch, uint32_t* out_candidate_starts,
    uint32_t* out_prefix_comparisons, uint32_t* out_tail_comparisons) {
  return scan_log(bytes, len, out_id, out_start, out_end, out_cap, scratch,
                  out_candidate_starts, out_prefix_comparisons, out_tail_comparisons,
                  1);
}
