// protobuf_gateway_kernel.ts — AssemblyScript multilang compute core for
// serialization.protobuf-gateway.v1. Same ABI + oracle as
// protobuf_gateway_kernel.c. See the C file for the ABI docs. Raw
// linear-memory access only (no heap allocation, no runtime imports).

const FIXTURE_OFFSET: usize = 3145728;
const RES_OFFSET: usize = 6291456;
const MESSAGE_COUNT: u32 = 10000;

let fnv: u32 = 0;
let mIdLo: u32 = 0;
let mIdHi: u32 = 0;
let mActive: u32 = 0;
let mStatus: u32 = 0;
let mNameLen: u32 = 0;
let mTagCount: u32 = 0;
let mMapCount: u32 = 0;
let mPayloadLen: u32 = 0;
let mChoiceKind: u32 = 0;
let mNoteLen: u32 = 0;
let mCode: u32 = 0;

function fixtureAt(off: u32): u8 {
  return load<u8>(FIXTURE_OFFSET + (<usize> off));
}
function readU32Le(off: u32): u32 {
  return (<u32> fixtureAt(off)) |
    ((<u32> fixtureAt(off + 1)) << 8) |
    ((<u32> fixtureAt(off + 2)) << 16) |
    ((<u32> fixtureAt(off + 3)) << 24);
}
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

// The varint reader publishes lo/hi/bytes/next via module-level scratch.
let vLo: u32 = 0;
let vHi: u32 = 0;
let vUsed: u32 = 0;
let vNext: u32 = 0;

function readVarint(cur: u32, end: u32): bool {
  let value: u64 = 0;
  let shift: u32 = 0;
  let bytes: u32 = 0;
  let c = cur;
  for (let i: u32 = 0; i < 10; i++) {
    if (c >= end) return false;
    const b = fixtureAt(c);
    c++;
    bytes++;
    value = value | ((<u64> (b & 0x7f)) << (<u64> shift));
    if ((b & 0x80) == 0) {
      vLo = <u32> (value & 0xffffffff);
      vHi = <u32> (value >>> 32);
      vUsed = bytes;
      vNext = c;
      return true;
    }
    shift += 7;
  }
  return false;
}

// Returns (ok, new_cur, varint_bytes_used) via scratch: skipNext, skipVb.
let skipNext: u32 = 0;
let skipVb: u32 = 0;

function skipField(cur: u32, end: u32, wire: u32): bool {
  skipVb = 0;
  if (wire == 0) {
    if (!readVarint(cur, end)) return false;
    skipNext = vNext;
    skipVb = vUsed;
    return true;
  }
  if (wire == 1) {
    if (cur > end || end - cur < 8) return false;
    skipNext = cur + 8;
    return true;
  }
  if (wire == 2) {
    if (!readVarint(cur, end)) return false;
    if (vHi != 0 || vLo > end - vNext) return false;
    skipNext = vNext + vLo;
    skipVb = vUsed;
    return true;
  }
  if (wire == 5) {
    if (cur > end || end - cur < 4) return false;
    skipNext = cur + 4;
    return true;
  }
  return false;
}

function parseMapEntry(start: u32, end: u32): bool {
  let cur = start;
  while (cur < end) {
    if (!readVarint(cur, end)) return false;
    const wire = vLo & 7;
    cur = vNext;
    if (!skipField(cur, end, wire)) return false;
    cur = skipNext;
  }
  mMapCount++;
  return true;
}

function resetMessage(): void {
  mIdLo = 0;
  mIdHi = 0;
  mActive = 0;
  mStatus = 0;
  mNameLen = 0;
  mTagCount = 0;
  mMapCount = 0;
  mPayloadLen = 0;
  mChoiceKind = 0;
  mNoteLen = 0;
  mCode = 0;
}

// Returns (ok) via scratch: dmFields, dmVarintBytes, dmUnknownFields.
let dmFields: u32 = 0;
let dmVarintBytes: u32 = 0;
let dmUnknownFields: u32 = 0;

function decodeMessage(start: u32, end: u32): bool {
  resetMessage();
  let cur = start;
  dmFields = 0;
  dmVarintBytes = 0;
  dmUnknownFields = 0;
  while (cur < end) {
    if (!readVarint(cur, end)) return false;
    if (vHi != 0) return false;
    const tagLo = vLo;
    cur = vNext;
    const used = vUsed;
    const field = tagLo >>> 3;
    const wire = tagLo & 7;
    if (field == 0) return false;
    dmFields++;
    dmVarintBytes += used;
    if (field == 1 && wire == 0) {
      if (!readVarint(cur, end)) return false;
      mIdLo = vLo;
      mIdHi = vHi;
      cur = vNext;
      dmVarintBytes += vUsed;
    } else if (field == 2 && wire == 2) {
      if (!readVarint(cur, end)) return false;
      if (vHi != 0 || vLo > end - vNext) return false;
      mNameLen = vLo;
      dmVarintBytes += vUsed;
      cur = vNext + vLo;
    } else if (field == 3 && wire == 0) {
      if (!readVarint(cur, end)) return false;
      mActive = (vLo != 0 || vHi != 0) ? 1 : 0;
      cur = vNext;
      dmVarintBytes += vUsed;
    } else if (field == 4 && wire == 1) {
      if (end - cur < 8) return false;
      cur += 8;
    } else if (field == 5 && wire == 0) {
      if (!readVarint(cur, end)) return false;
      mStatus = vLo;
      cur = vNext;
      dmVarintBytes += vUsed;
    } else if (field == 6 && wire == 2) {
      if (!readVarint(cur, end)) return false;
      if (vHi != 0 || vLo > end - vNext) return false;
      cur = vNext + vLo;
      mTagCount++;
      dmVarintBytes += vUsed;
    } else if (field == 7 && wire == 2) {
      if (!readVarint(cur, end)) return false;
      if (vHi != 0 || vLo > end - vNext) return false;
      const mapStart = vNext;
      const mapEnd = vNext + vLo;
      dmVarintBytes += vUsed;
      if (!parseMapEntry(mapStart, mapEnd)) return false;
      cur = mapEnd;
    } else if (field == 8 && wire == 2) {
      if (!readVarint(cur, end)) return false;
      if (vHi != 0 || vLo > end - vNext) return false;
      mPayloadLen = vLo;
      dmVarintBytes += vUsed;
      cur = vNext + vLo;
    } else if (field == 9 && wire == 2) {
      if (!readVarint(cur, end)) return false;
      if (vHi != 0 || vLo > end - vNext) return false;
      mNoteLen = vLo;
      mChoiceKind = 9;
      dmVarintBytes += vUsed;
      cur = vNext + vLo;
    } else if (field == 10 && wire == 0) {
      if (!readVarint(cur, end)) return false;
      mCode = vLo;
      mChoiceKind = 10;
      cur = vNext;
      dmVarintBytes += vUsed;
    } else if (field == 11 && wire == 5) {
      if (end - cur < 4) return false;
      cur += 4;
    } else {
      if (!skipField(cur, end, wire)) return false;
      cur = skipNext;
      dmUnknownFields++;
      dmVarintBytes += skipVb;
    }
  }
  return cur == end;
}

function mod3U64(lo: u32, hi: u32): u32 {
  let r: u32 = 0;
  for (let i: i32 = 31; i >= 0; i--) {
    r = (r << 1) | ((hi >>> (<u32> i)) & 1);
    if (r >= 3) r -= 3;
  }
  for (let j: i32 = 31; j >= 0; j--) {
    r = (r << 1) | ((lo >>> (<u32> j)) & 1);
    if (r >= 3) r -= 3;
  }
  return r;
}

export function protobuf_gateway(fixture_len: u32): i32 {
  fnvReset();
  if (fixture_len < 4) return -1;
  const count = readU32Le(0);
  if (count != MESSAGE_COUNT) return -2;
  let cur: u32 = 4;
  let cMessages: u32 = 0;
  let cFields: u32 = 0;
  let cVarintBytes: u32 = 0;
  let cUnknownFields: u32 = 0;
  let cFiltered: u32 = 0;
  for (let i: u32 = 0; i < MESSAGE_COUNT; i++) {
    if (cur + 4 > fixture_len) return -3;
    const n = readU32Le(cur);
    cur += 4;
    if (cur + n > fixture_len) return -4;
    if (!decodeMessage(cur, cur + n)) return -5;
    cur += n;
    cMessages++;
    cFields += dmFields;
    cVarintBytes += dmVarintBytes;
    cUnknownFields += dmUnknownFields;
    const pass: u32 = (mActive != 0 && mStatus != 3 && mod3U64(mIdLo, mIdHi) == 0) ? 1 : 0;
    if (pass != 0) cFiltered++;
    fnvMixU32(mIdLo);
    fnvMixU32(mIdHi);
    fnvMixU32(mActive);
    fnvMixU32(mStatus);
    fnvMixU32(mNameLen);
    fnvMixU32(mTagCount);
    fnvMixU32(mMapCount);
    fnvMixU32(mPayloadLen);
    fnvMixU32(mChoiceKind);
    fnvMixU32(mNoteLen);
    fnvMixU32(mCode);
    fnvMixU32(pass);
  }
  if (cur != fixture_len) return -6;

  store<u32>(RES_OFFSET, cMessages);
  store<u32>(RES_OFFSET + 4, cFields);
  store<u32>(RES_OFFSET + 8, cVarintBytes);
  store<u32>(RES_OFFSET + 12, cUnknownFields);
  store<u32>(RES_OFFSET + 16, cFiltered);
  store<u32>(RES_OFFSET + 20, fixture_len);
  store<u32>(RES_OFFSET + 24, fnv);
  store<u32>(RES_OFFSET + 28, 0);
  return 0;
}
