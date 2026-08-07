// Track B — text-regex-log-scan optimized JavaScript variant.
// Track A baseline = the scan_log adapter in public/multilang-runner.js (KEPT
// UNTOUCHED); scanBaseline below is a verbatim mirror (same buckets, same
// per-byte bounds check, same matchers, same counters).
//
// OPTIMIZATION LOG:
// 1. SPLIT-LOOP BOUNDS: the baseline re-checks `start + i >= len` inside the
//    prefix loop for every byte. scanOpt takes a bounds-free fast path when the
//    prefix fits (start + plen <= len) — the check never fired there, so the
//    comparison COUNT is identical. The checked loop is used only for the tail.
// 2. Precomputed first-byte dispatch (built once, same as baseline) + direct
//    Uint8Array index reads (no method indirection).
// Output (matches + ALL counters) is BIT-IDENTICAL to the baseline.

export const PATTERNS = [
  "http://",
  "https://",
  "ws://",
  "wss://",
  "ftp://",
  "asset://",
  "api://",
  "cdn://",
  "ip=",
  "client-ip:",
  "source-ip:",
  "dest-ip:",
  "peer-ip:",
  "origin-ip:",
  "status=",
  "code=",
  "http-status:",
  "response-status:",
  "result-status:",
  "status-code:",
];
export const MATCHERS = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3];

const isUrlTail = (b) =>
  (b >= 97 && b <= 122) || (b >= 48 && b <= 57) || b === 46 || b === 47 || b === 95 || b === 45;

function bucketsFor() {
  const buckets = Array.from({ length: 256 }, () => []);
  for (let i = 0; i < PATTERNS.length; i++) buckets[PATTERNS[i].charCodeAt(0)].push(i);
  return buckets;
}

function tailMatch(bytes, start, plen, matcher, counters) {
  const cursor = start + plen;
  let end = -1;
  if (matcher === 1) {
    const s0 = cursor;
    let c = cursor;
    while (c < bytes.length && c - s0 < 96) {
      const byte = bytes[c];
      counters.tailComparisons++;
      if (!isUrlTail(byte)) break;
      c++;
    }
    if (c === s0) end = -1;
    else if (c - s0 === 96 && c < bytes.length && isUrlTail(bytes[c])) {
      counters.tailComparisons++;
      end = -1;
    } else end = c;
  } else if (matcher === 2) {
    let c = cursor;
    let failed = false;
    for (let octet = 0; octet < 4; octet++) {
      const s1 = c;
      let value = 0;
      while (c < bytes.length && c - s1 < 3) {
        const byte = bytes[c];
        counters.tailComparisons++;
        if (byte < 48 || byte > 57) break;
        value = value * 10 + byte - 48;
        c++;
      }
      const digits = c - s1;
      if (digits === 0 || value > 255 || (digits > 1 && bytes[s1] === 48)) {
        failed = true;
        break;
      }
      if (octet < 3) {
        if (c >= bytes.length) {
          failed = true;
          break;
        }
        counters.tailComparisons++;
        if (bytes[c] !== 46) {
          failed = true;
          break;
        }
        c++;
      }
    }
    if (!failed) {
      if (c < bytes.length) {
        counters.tailComparisons++;
        if (bytes[c] >= 48 && bytes[c] <= 57) end = -1;
        else if (bytes[c] === 46) end = -1;
        else end = c;
      } else end = c;
    }
  } else {
    if (cursor + 3 > bytes.length) end = -1;
    else {
      let value = 0;
      let ok = true;
      for (let idx = 0; idx < 3; idx++) {
        const byte = bytes[cursor + idx];
        counters.tailComparisons++;
        if (byte < 48 || byte > 57) {
          ok = false;
          break;
        }
        value = value * 10 + byte - 48;
      }
      if (ok && (value < 100 || value > 599)) ok = false;
      if (!ok) end = -1;
      else {
        const endp = cursor + 3;
        if (endp < bytes.length) {
          counters.tailComparisons++;
          if (bytes[endp] >= 48 && bytes[endp] <= 57) end = -1;
          else end = endp;
        } else end = endp;
      }
    }
  }
  return end;
}

export function scanBaseline(bytes) {
  const buckets = bucketsFor();
  const counters = { candidateStarts: 0, prefixComparisons: 0, tailComparisons: 0 };
  const matches = [];
  for (let start = 0; start < bytes.length; start++) {
    for (const pi of buckets[bytes[start]]) {
      const prefix = PATTERNS[pi];
      let matched = true;
      counters.candidateStarts++;
      for (let i = 0; i < prefix.length; i++) {
        if (start + i >= bytes.length) {
          matched = false;
          break;
        }
        counters.prefixComparisons++;
        if (bytes[start + i] !== prefix.charCodeAt(i)) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
      const end = tailMatch(bytes, start, prefix.length, MATCHERS[pi], counters);
      if (end >= 0) matches.push([pi, start, end]);
    }
  }
  return { matches, ...counters };
}

export function scanOpt(bytes) {
  const buckets = bucketsFor();
  const counters = { candidateStarts: 0, prefixComparisons: 0, tailComparisons: 0 };
  const matches = [];
  const len = bytes.length;
  for (let start = 0; start < len; start++) {
    for (const pi of buckets[bytes[start]]) {
      const prefix = PATTERNS[pi];
      const plen = prefix.length;
      let matched = true;
      counters.candidateStarts++;
      if (start + plen <= len) {
        // Fast path: prefix fits — baseline's bounds check never fired here.
        for (let i = 0; i < plen; i++) {
          counters.prefixComparisons++;
          if (bytes[start + i] !== prefix.charCodeAt(i)) {
            matched = false;
            break;
          }
        }
      } else {
        // Tail path: baseline-identical checked loop.
        for (let i = 0; i < plen; i++) {
          if (start + i >= len) {
            matched = false;
            break;
          }
          counters.prefixComparisons++;
          if (bytes[start + i] !== prefix.charCodeAt(i)) {
            matched = false;
            break;
          }
        }
      }
      if (!matched) continue;
      const end = tailMatch(bytes, start, plen, MATCHERS[pi], counters);
      if (end >= 0) matches.push([pi, start, end]);
    }
  }
  return { matches, ...counters };
}
