// regex_scan_kernel.ts — AssemblyScript multilang compute core for
// regex-automata-duel-demo. Same ABI + oracle as regex_scan_kernel.c: adapter
// writes the frozen 1,163,248-byte fixture at FIXTURE_OFFSET (magic 'RXA1',
// corpus + 20 precompiled DFA tables); kernel walks each DFA over the corpus
// and writes counters + FNV-1a digest of the ordered match tuples to
// RES_OFFSET. Raw linear-memory access only (no heap allocation, no runtime
// imports) — mirrors gc_document_kernel.ts.

const FIXTURE_OFFSET: usize = 3145728;
const RES_OFFSET: usize = 5242880;
const FIXTURE_MAGIC: u32 = 0x31415852;

function fixtureAt(off: u32): u8 {
  return load<u8>(FIXTURE_OFFSET + (<usize> off));
}
function readU32Le(off: u32): u32 {
  return (<u32> fixtureAt(off)) |
    ((<u32> fixtureAt(off + 1)) << 8) |
    ((<u32> fixtureAt(off + 2)) << 16) |
    ((<u32> fixtureAt(off + 3)) << 24);
}
function readI16Le(off: u32): i32 {
  const lo = <u32> fixtureAt(off);
  const hi = <u32> fixtureAt(off + 1);
  const combined = lo | (hi << 8);
  // Sign-extend from 16 bits to i32.
  return <i32> (<i16> combined);
}

let fnv: u32 = 0;
function fnvReset(): void {
  fnv = 0x811c9dc5;
}
function fnvMixByte(b: u8): void {
  fnv = ((fnv ^ (<u32> b)) * 0x01000193) >>> 0;
}
function fnvMixU32(v: u32): void {
  fnvMixByte(<u8> (v & 0xff));
  fnvMixByte(<u8> ((v >>> 8) & 0xff));
  fnvMixByte(<u8> ((v >>> 16) & 0xff));
  fnvMixByte(<u8> ((v >>> 24) & 0xff));
}

function isValidEnd(corpusOff: u32, corpusLen: u32, end: u32): bool {
  if (end == corpusLen) return true;
  if (end == corpusLen - 1) {
    const c = fixtureAt(corpusOff + end);
    if (c == 10 || c == 13) return true;
  }
  if (corpusLen >= 2 && end == corpusLen - 2) {
    if (
      fixtureAt(corpusOff + end) == 13 &&
      fixtureAt(corpusOff + end + 1) == 10
    ) {
      return true;
    }
  }
  return false;
}

export function regex_scan(fixtureLen: u32): i32 {
  let off: u32 = 0;
  if (fixtureLen < 12) return -1;
  if (readU32Le(off) != FIXTURE_MAGIC) return -2;
  off += 4;
  const corpusLen = readU32Le(off);
  off += 4;
  if (corpusLen > fixtureLen - off) return -3;
  const corpusOff = off;
  off += corpusLen;
  off = (off + 7) & ~7;
  const patternCount = readU32Le(off);
  off += 4;

  let matchesFound: u32 = 0;
  let capturesExtracted: u32 = 0;
  let boundaryCrossings: u32 = 0;
  fnvReset();

  for (let p: u32 = 0; p < patternCount; p++) {
    if (off + 12 > fixtureLen) return -4;
    const stateCount = readU32Le(off);
    off += 4;
    const anchorStart = fixtureAt(off);
    const anchorEnd = fixtureAt(off + 1);
    const captureGroups = fixtureAt(off + 2);
    off += 4;
    const patternId = readU32Le(off);
    off += 4;
    off = (off + 1) & ~1;
    const tableOff = off;
    const tableBytes = stateCount * 128 * 2;
    if (tableBytes > fixtureLen - off) return -5;
    off += tableBytes;
    const acceptOff = off;
    if (stateCount > fixtureLen - off) return -6;
    off += stateCount;
    const commitOff = off;
    const commitBytes = stateCount * 128;
    if (commitBytes > fixtureLen - off) return -7;
    off += commitBytes;
    off = (off + 7) & ~7;

    boundaryCrossings++;
    let patternMatches: u32 = 0;
    let search: u32 = 0;
    while (search <= corpusLen) {
      if (anchorStart != 0 && search > 0) break;
      let cursor = search;
      let state: i32 = 0;
      let best: i32 = -1;
      if (fixtureAt(acceptOff + (<u32> state)) != 0) {
        const valid = anchorEnd != 0 ? isValidEnd(corpusOff, corpusLen, cursor) : true;
        if (valid) best = <i32> cursor;
      }
      while (cursor < corpusLen) {
        const code = fixtureAt(corpusOff + cursor);
        if (code >= 128) break;
        if (
          best == <i32> cursor &&
          fixtureAt(commitOff + (<u32> state) * 128 + (<u32> code)) != 0
        ) {
          break;
        }
        const next = readI16Le(tableOff + ((<u32> state) * 128 + (<u32> code)) * 2);
        if (next < 0) break;
        state = next;
        cursor++;
        if (fixtureAt(acceptOff + (<u32> state)) != 0) {
          const valid = anchorEnd != 0 ? isValidEnd(corpusOff, corpusLen, cursor) : true;
          if (valid) best = <i32> cursor;
        }
      }
      if (best >= <i32> search) {
        fnvMixU32(patternId);
        fnvMixU32(search);
        fnvMixU32(<u32> best);
        matchesFound++;
        patternMatches++;
        if ((<u32> best) > search) search = <u32> best;
        else search++;
      } else {
        if (anchorStart != 0) break;
        search++;
      }
    }
    capturesExtracted += patternMatches * (<u32> captureGroups);
  }

  store<u32>(RES_OFFSET, matchesFound);
  store<u32>(RES_OFFSET + 4, patternCount);
  store<u32>(RES_OFFSET + 8, corpusLen * patternCount);
  store<u32>(RES_OFFSET + 12, capturesExtracted);
  store<u32>(RES_OFFSET + 16, boundaryCrossings);
  store<u32>(RES_OFFSET + 20, fixtureLen);
  store<u32>(RES_OFFSET + 24, corpusLen);
  store<u32>(RES_OFFSET + 28, fnv);
  store<u32>(RES_OFFSET + 32, 0);
  return 0;
}
