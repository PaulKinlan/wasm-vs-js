#include <stdint.h>

// text-regex-log-scan multilang kernel — mirrors benchmarks/text-regex-log-scan/
// workload.js scanControlled EXACTLY: same 20 SAFE_PATTERNS (fixed prefixes +
// matcher classes), same first-byte dispatch buckets, same prefix comparison,
// same url-tail/ipv4/status matchers, same counter increments
// (candidateStarts, prefixComparisons, tailComparisons). Matches are emitted as
// (patternId, start, end) in scan order.

#define PATTERN_COUNT 20
#define MAX_BUCKET 4

// matcher ids: 1 = url-tail, 2 = ipv4, 3 = status
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

// scratch layout (u32): 256 * (MAX_BUCKET + 1) for the dispatch buckets.
__attribute__((visibility("default")))
uint32_t scan_log(
    const uint8_t* bytes, uint32_t len,
    uint32_t* out_id, uint32_t* out_start, uint32_t* out_end, uint32_t out_cap,
    uint32_t* scratch, uint32_t* out_candidate_starts,
    uint32_t* out_prefix_comparisons, uint32_t* out_tail_comparisons) {
  uint32_t* buckets = scratch; // buckets[b * (MAX_BUCKET + 1)] = count, then indices
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
      uint32_t matched = 1;
      for (uint32_t index = 0; index < plen; index++) {
        if (start + index >= len) { matched = 0; break; }
        prefixComparisons++;
        if (bytes[start + index] != prefix[index]) { matched = 0; break; }
      }
      if (!matched) continue;
      const uint32_t cursor = start + plen;
      int32_t end = -1;
      const uint8_t matcher = PATTERN_MATCHERS[patternIndex];
      if (matcher == 1) {
        // url-tail
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
        // ipv4
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
          // final lookahead: next byte must not be a digit or a dot
          if (c < len) {
            tailComparisons++;
            if (bytes[c] >= 48 && bytes[c] <= 57) result = -1;
            else if (bytes[c] == 46) result = -1;
            else result = (int32_t)c;
          } else result = (int32_t)c;
        }
        end = result;
      } else {
        // status
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
  *out_candidate_starts = candidateStarts;
  *out_prefix_comparisons = prefixComparisons;
  *out_tail_comparisons = tailComparisons;
  return matchCount;
}
