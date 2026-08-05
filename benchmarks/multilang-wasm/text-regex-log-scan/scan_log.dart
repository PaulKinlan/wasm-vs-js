// text-regex-log-scan Dart WasmGC kernel — exact mirror of the C scan_log:
// same 20 SAFE_PATTERNS (fixed prefixes + matcher classes), same first-byte
// dispatch buckets, same url-tail/ipv4/status matchers, same counters
// (candidateStarts, prefixComparisons, tailComparisons). Matches are emitted
// as (patternId, start, end) in scan order into zero-copy Uint32Array views.

import 'dart:js_interop';
import 'dart:typed_data';

const PATTERN_PREFIXES = [
  'http://', 'https://', 'ws://', 'wss://', 'ftp://', 'asset://', 'api://',
  'cdn://', 'ip=', 'client-ip:', 'source-ip:', 'dest-ip:', 'peer-ip:',
  'origin-ip:', 'status=', 'code=', 'http-status:', 'response-status:',
  'result-status:', 'status-code:',
];
const PATTERN_MATCHERS = [
  1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3,
];

bool isUrlTail(int byte) {
  return (byte >= 97 && byte <= 122) || (byte >= 48 && byte <= 57) ||
      byte == 46 || byte == 47 || byte == 95 || byte == 45;
}

@JSExport()
class ScanKernels {
  @JSExport('scan_log')
  int scanLog(
    JSUint8Array bytesJs,
    int len,
    JSUint32Array outIdJs,
    JSUint32Array outStartJs,
    JSUint32Array outEndJs,
    int outCap,
    JSUint32Array scratchJs,
    JSUint32Array csJs,
    JSUint32Array pcJs,
    JSUint32Array tcJs,
  ) {
    final data = bytesJs.toDart; // zero-copy Uint8List view on Wasm
    final outId = outIdJs.toDart;
    final outStart = outStartJs.toDart;
    final outEnd = outEndJs.toDart;
    final buckets = scratchJs.toDart;
    final cs = csJs.toDart;
    final pc = pcJs.toDart;
    final tc = tcJs.toDart;

    const maxBucket = 4;
    for (int b = 0; b < 256; b++) {
      buckets[b * (maxBucket + 1)] = 0;
    }
    for (int p = 0; p < PATTERN_PREFIXES.length; p++) {
      final first = PATTERN_PREFIXES[p].codeUnitAt(0);
      final slot = first * (maxBucket + 1);
      final count = buckets[slot];
      buckets[slot + 1 + count] = p;
      buckets[slot] = count + 1;
    }

    int matchCount = 0;
    int candidateStarts = 0;
    int prefixComparisons = 0;
    int tailComparisons = 0;

    for (int start = 0; start < len; start++) {
      final slot = data[start] * (maxBucket + 1);
      final count = buckets[slot];
      for (int bi = 0; bi < count; bi++) {
        final patternIndex = buckets[slot + 1 + bi];
        candidateStarts++;
        final prefix = PATTERN_PREFIXES[patternIndex];
        var matched = true;
        for (int index = 0; index < prefix.length; index++) {
          if (start + index >= len) {
            matched = false;
            break;
          }
          prefixComparisons++;
          if (data[start + index] != prefix.codeUnitAt(index)) {
            matched = false;
            break;
          }
        }
        if (!matched) continue;
        final cursor = start + prefix.length;
        int end = -1;
        switch (PATTERN_MATCHERS[patternIndex]) {
          case 1:
            // url-tail
            final s0 = cursor;
            var c = cursor;
            while (c < len && c - s0 < 96) {
              tailComparisons++;
              if (!isUrlTail(data[c])) break;
              c++;
            }
            if (c == s0) {
              end = -1;
            } else if (c - s0 == 96 && c < len && isUrlTail(data[c])) {
              tailComparisons++;
              end = -1;
            } else {
              end = c;
            }
            break;
          case 2:
            // ipv4
            var c = cursor;
            var failed = false;
            for (int octet = 0; octet < 4; octet++) {
              final s1 = c;
              var value = 0;
              while (c < len && c - s1 < 3) {
                final byte = data[c];
                tailComparisons++;
                if (byte < 48 || byte > 57) break;
                value = value * 10 + byte - 48;
                c++;
              }
              final digits = c - s1;
              if (digits == 0 || value > 255 || (digits > 1 && data[s1] == 48)) {
                failed = true;
                break;
              }
              if (octet < 3) {
                if (c >= len) {
                  failed = true;
                  break;
                }
                tailComparisons++;
                if (data[c] != 46) {
                  failed = true;
                  break;
                }
                c++;
              }
            }
            if (!failed) {
              if (c < len) {
                tailComparisons++;
                if (data[c] >= 48 && data[c] <= 57) {
                  end = -1;
                } else if (data[c] == 46) {
                  end = -1;
                } else {
                  end = c;
                }
              } else {
                end = c;
              }
            }
            break;
          default:
            // status
            if (cursor + 3 > len) {
              end = -1;
            } else {
              var value = 0;
              var ok = true;
              for (int index = 0; index < 3; index++) {
                final byte = data[cursor + index];
                tailComparisons++;
                if (byte < 48 || byte > 57) {
                  ok = false;
                  break;
                }
                value = value * 10 + byte - 48;
              }
              if (ok && (value < 100 || value > 599)) ok = false;
              if (!ok) {
                end = -1;
              } else {
                final endp = cursor + 3;
                if (endp < len) {
                  tailComparisons++;
                  if (data[endp] >= 48 && data[endp] <= 57) {
                    end = -1;
                  } else {
                    end = endp;
                  }
                } else {
                  end = endp;
                }
              }
            }
            break;
        }
        if (end >= 0 && matchCount < outCap) {
          outId[matchCount] = patternIndex;
          outStart[matchCount] = start;
          outEnd[matchCount] = end;
          matchCount++;
        }
      }
    }
    cs[0] = candidateStarts;
    pc[0] = prefixComparisons;
    tc[0] = tailComparisons;
    return matchCount;
  }
}

void main() {
  dartKernels = createJSInteropWrapper(ScanKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
