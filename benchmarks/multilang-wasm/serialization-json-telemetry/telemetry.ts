// telemetry.ts — AssemblyScript multilang kernel for
// serialization.json-telemetry.v1.
//
// Mirrors telemetry.c exactly: the same strict recursive-descent parse over
// the frozen record shape, the same rejection codes in the same order, the
// same UTF-8 option tables compared byte for byte, and the same summary
// serialised in the same key order.
//
// The parser is deliberately strict — leading zeros rejected, ids required to
// be sequential, timestamps required to be 1700000000 + id, values capped at
// 9999 — because the point of the workload is a fixed amount of validated
// work, not lenient JSON.
//
// Parser state and the option tables live at fixed offsets above the caller's
// buffers rather than in AssemblyScript arrays, which would be heap-allocated
// where the caller may be writing.

let inputPtr: usize = 0;
let inputLen: u32 = 0;
let at: u32 = 0;

let gRecords: u32 = 0;
let gInputBytes: u32 = 0;
let gNumericValues: u32 = 0;
let gStringValues: u32 = 0;
let gBooleans: u32 = 0;

function byteAt(i: u32): u8 {
  return load<u8>(inputPtr + <usize> i);
}

function expectByte(value: u8): bool {
  if (at >= inputLen || byteAt(at) != value) return false;
  at++;
  return true;
}

/** Matches a literal ASCII run; the C walks a NUL-terminated string. */
function expectAscii(value: string): bool {
  for (let i = 0; i < value.length; i++) {
    if (!expectByte(<u8> value.charCodeAt(i))) return false;
  }
  return true;
}

let parsedUint: u64 = 0;

function parseUint(): bool {
  const start: u32 = at;
  let value: u64 = 0;
  while (at < inputLen && byteAt(at) >= 0x30 && byteAt(at) <= 0x39) {
    if (at > start && byteAt(start) == 0x30) return false;
    const next: u64 = value * 10 + <u64> (byteAt(at) - 0x30);
    if (next < value) return false;
    value = next;
    at++;
  }
  if (at == start) return false;
  parsedUint = value;
  return true;
}

// ── Option tables ─────────────────────────────────────────────────────────
// Byte sequences are written into linear memory once, above anything the
// caller uses, and compared from there.
const TABLE_OFF: usize = 1 << 20;
let tablesReady: bool = false;

// Offsets and lengths for each option, filled by initTables().
const OPT_META_OFF: usize = TABLE_OFF;
const OPT_DATA_OFF: usize = TABLE_OFF + 512;

let regionsBase: u32 = 0, kindsBase: u32 = 0, labelsBase: u32 = 0, tagsBase: u32 = 0;

// Options are written as literal byte stores rather than from array literals:
// an array literal allocates, and AssemblyScript's heap sits in the low memory
// the caller fills with the JSON payload. Same trap as the MLP coefficients,
// the N-body slab pointers and the crypto scratch.
let optCursor: u32 = 0;
let optSlot: u32 = 0;

function beginOption(): void {
  store<u32>(OPT_META_OFF + (<usize> optSlot) * 8, optCursor);
}

function pushByte(b: u8): void {
  store<u8>(OPT_DATA_OFF + <usize> optCursor, b);
  optCursor++;
}

function endOption(): void {
  const startAt: u32 = load<u32>(OPT_META_OFF + (<usize> optSlot) * 8);
  store<u32>(OPT_META_OFF + (<usize> optSlot) * 8 + 4, optCursor - startAt);
  optSlot++;
}

function initTables(): void {
  if (tablesReady) return;
  optCursor = 0;
  optSlot = 0;

  regionsBase = optSlot;
  beginOption();
  pushByte(0x61);
  pushByte(0x70);
  endOption(); // "ap"
  beginOption();
  pushByte(0x65);
  pushByte(0x75);
  endOption(); // "eu"
  beginOption();
  pushByte(0x6e);
  pushByte(0x61);
  endOption(); // "na"
  beginOption();
  pushByte(0x73);
  pushByte(0x61);
  endOption(); // "sa"

  kindsBase = optSlot;
  beginOption();
  pushByte(0x63);
  pushByte(0x6c);
  pushByte(0x69);
  pushByte(0x63);
  pushByte(0x6b);
  endOption(); // "click"
  beginOption();
  pushByte(0x70);
  pushByte(0x75);
  pushByte(0x72);
  pushByte(0x63);
  pushByte(0x68);
  pushByte(0x61);
  pushByte(0x73);
  pushByte(0x65);
  endOption(); // "purchase"
  beginOption();
  pushByte(0x76);
  pushByte(0x69);
  pushByte(0x65);
  pushByte(0x77);
  endOption(); // "view"

  labelsBase = optSlot;
  beginOption();
  pushByte(0x43);
  pushByte(0x61);
  pushByte(0x66);
  pushByte(0xc3);
  pushByte(0xa9);
  endOption(); // "Café"
  beginOption();
  pushByte(0xe6);
  pushByte(0x9d);
  pushByte(0xb1);
  pushByte(0xe4);
  pushByte(0xba);
  pushByte(0xac);
  endOption(); // 東京
  beginOption();
  pushByte(0xd9);
  pushByte(0x85);
  pushByte(0xd8);
  pushByte(0xb1);
  pushByte(0xd8);
  pushByte(0xad);
  pushByte(0xd8);
  pushByte(0xa8);
  pushByte(0xd8);
  pushByte(0xa7);
  endOption(); // مرحبا
  beginOption();
  pushByte(0xf0);
  pushByte(0x9f);
  pushByte(0x9a);
  pushByte(0x80);
  endOption(); // 🚀

  tagsBase = optSlot;
  beginOption();
  pushByte(0xce);
  pushByte(0xb1);
  endOption(); // α
  beginOption();
  pushByte(0xe6);
  pushByte(0x95);
  pushByte(0xb0);
  pushByte(0xe6);
  pushByte(0x8d);
  pushByte(0xae);
  endOption(); // 数据
  beginOption();
  pushByte(0x6d);
  pushByte(0x61);
  pushByte(0xc3);
  pushByte(0xb1);
  pushByte(0x61);
  pushByte(0x6e);
  pushByte(0x61);
  endOption(); // "mañana"
  beginOption();
  pushByte(0xf0);
  pushByte(0x9f);
  pushByte(0xa7);
  pushByte(0xaa);
  endOption(); // 🧪

  tablesReady = true;
}

/** The C's bytes_equal: match the option then require a closing quote. */
function bytesEqual(slot: u32): bool {
  const off: u32 = load<u32>(OPT_META_OFF + (<usize> slot) * 8);
  const length: u32 = load<u32>(OPT_META_OFF + (<usize> slot) * 8 + 4);
  if (at + length >= inputLen) return false;
  for (let i: u32 = 0; i < length; i++) {
    if (byteAt(at + i) != load<u8>(OPT_DATA_OFF + <usize> (off + i))) return false;
  }
  if (byteAt(at + length) != 0x22) return false;
  at += length + 1;
  return true;
}

let selectedOption: u32 = 0;

function parseOption(base: u32, count: u32): bool {
  if (!expectByte(0x22)) return false;
  for (let i: u32 = 0; i < count; i++) {
    const saved: u32 = at;
    if (bytesEqual(base + i)) {
      selectedOption = i;
      return true;
    }
    at = saved;
  }
  return false;
}

let parsedBoolean: u32 = 0;

function parseBoolean(): bool {
  const saved: u32 = at;
  if (expectAscii("true")) {
    parsedBoolean = 1;
    return true;
  }
  at = saved;
  if (expectAscii("false")) {
    parsedBoolean = 0;
    return true;
  }
  return false;
}

// ── Output ────────────────────────────────────────────────────────────────
let outPtr: usize = 0;
let outCapacity: u32 = 0;
let outPos: u32 = 0;

function writeByte(value: u8): bool {
  if (outPos >= outCapacity) return false;
  store<u8>(outPtr + <usize> outPos, value);
  outPos++;
  return true;
}

function writeAscii(value: string): bool {
  for (let i = 0; i < value.length; i++) {
    if (!writeByte(<u8> value.charCodeAt(i))) return false;
  }
  return true;
}

const DIGITS_OFF: usize = TABLE_OFF + 4096;

function writeUint(value0: u64): bool {
  let value: u64 = value0;
  let length: u32 = 0;
  do {
    store<u8>(DIGITS_OFF + <usize> length, <u8> (0x30 + <u32> (value % 10)));
    length++;
    value /= 10;
  } while (value);
  while (length) {
    length--;
    if (!writeByte(load<u8>(DIGITS_OFF + <usize> length))) return false;
  }
  return true;
}

// Per-run tallies.
const REGION_COUNTS_OFF: usize = TABLE_OFF + 4160;
const KIND_COUNTS_OFF: usize = TABLE_OFF + 4192;

export function process(
  inputOffset: u32,
  length: u32,
  outputOffset: u32,
  outputCapacity: u32,
): i32 {
  initTables();
  inputPtr = <usize> inputOffset;
  inputLen = length;
  at = 0;
  gRecords = 0;
  gInputBytes = length;
  gNumericValues = 0;
  gStringValues = 0;
  gBooleans = 0;
  for (let i: u32 = 0; i < 4; i++) store<u32>(REGION_COUNTS_OFF + (<usize> i) * 4, 0);
  for (let i: u32 = 0; i < 3; i++) store<u32>(KIND_COUNTS_OFF + (<usize> i) * 4, 0);
  let okCount: u32 = 0, errorCount: u32 = 0;
  let valueSum: u64 = 0;

  if (!expectByte(0x5b)) return -1; // '['
  while (at < inputLen && byteAt(at) != 0x5d) { // ']'
    if (gRecords && !expectByte(0x2c)) return -2; // ','
    if (!expectAscii('{"id":')) return -3;
    if (!parseUint() || parsedUint != <u64> gRecords) return -4;
    const id: u64 = parsedUint;
    if (!expectAscii(',"ts":') || !parseUint() || parsedUint != 1700000000 + id) return -5;
    if (!expectAscii(',"region":')) return -6;
    if (!parseOption(regionsBase, 4)) return -7;
    const region: u32 = selectedOption;
    if (!expectAscii(',"kind":') || !parseOption(kindsBase, 3)) return -8;
    const kind: u32 = selectedOption;
    if (!expectAscii(',"ok":') || !parseBoolean()) return -9;
    const ok: u32 = parsedBoolean;
    if (!expectAscii(',"value":') || !parseUint() || parsedUint > 9999) return -10;
    const value: u64 = parsedUint;
    if (!expectAscii(',"meta":{"label":') || !parseOption(labelsBase, 4)) return -11;
    if (!expectAscii(',"tag":') || !parseOption(tagsBase, 4)) return -12;
    if (!expectAscii("}}")) return -13;
    gRecords++;
    gNumericValues += 3;
    gStringValues += 4;
    gBooleans++;
    store<u32>(
      REGION_COUNTS_OFF + (<usize> region) * 4,
      load<u32>(REGION_COUNTS_OFF + (<usize> region) * 4) + 1,
    );
    store<u32>(
      KIND_COUNTS_OFF + (<usize> kind) * 4,
      load<u32>(KIND_COUNTS_OFF + (<usize> kind) * 4) + 1,
    );
    okCount += ok;
    errorCount += ok ? 0 : 1;
    valueSum += value;
  }
  if (!expectByte(0x5d) || at != inputLen) return -14;

  outPtr = <usize> outputOffset;
  outCapacity = outputCapacity;
  outPos = 0;
  if (!writeAscii('{"count":')) return -15;
  if (!writeUint(<u64> gRecords)) return -15;
  if (!writeAscii(',"errorCount":')) return -15;
  if (!writeUint(<u64> errorCount)) return -15;
  if (!writeAscii(',"kind":{"click":')) return -15;
  if (!writeUint(<u64> load<u32>(KIND_COUNTS_OFF))) return -15;
  if (!writeAscii(',"purchase":')) return -15;
  if (!writeUint(<u64> load<u32>(KIND_COUNTS_OFF + 4))) return -15;
  if (!writeAscii(',"view":')) return -15;
  if (!writeUint(<u64> load<u32>(KIND_COUNTS_OFF + 8))) return -15;
  if (!writeAscii('},"okCount":')) return -15;
  if (!writeUint(<u64> okCount)) return -15;
  if (!writeAscii(',"region":{"ap":')) return -15;
  if (!writeUint(<u64> load<u32>(REGION_COUNTS_OFF))) return -15;
  if (!writeAscii(',"eu":')) return -15;
  if (!writeUint(<u64> load<u32>(REGION_COUNTS_OFF + 4))) return -15;
  if (!writeAscii(',"na":')) return -15;
  if (!writeUint(<u64> load<u32>(REGION_COUNTS_OFF + 8))) return -15;
  if (!writeAscii(',"sa":')) return -15;
  if (!writeUint(<u64> load<u32>(REGION_COUNTS_OFF + 12))) return -15;
  if (!writeAscii('},"valueSum":')) return -15;
  if (!writeUint(valueSum)) return -15;
  if (!writeAscii("}")) return -15;
  return <i32> outPos;
}

export function get_records(): u32 {
  return gRecords;
}
export function get_input_bytes(): u32 {
  return gInputBytes;
}
export function get_numeric_values(): u32 {
  return gNumericValues;
}
export function get_string_values(): u32 {
  return gStringValues;
}
export function get_booleans(): u32 {
  return gBooleans;
}
export function get_query_aggregates(): u32 {
  return 11;
}
export function get_allocations(): u32 {
  return 0;
}
