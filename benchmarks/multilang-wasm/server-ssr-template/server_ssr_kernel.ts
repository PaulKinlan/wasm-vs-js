// server_ssr_kernel.ts — AssemblyScript multilang compute core for
// server.ssr-template.v1. Same ABI + oracle as server_ssr_kernel.c: adapter
// writes the frozen 91,442-byte fixture at FIXTURE_OFFSET, kernel parses +
// renders bit-identical to renderJavaScript() into OUTPUT_OFFSET and writes
// counters + FNV-1a digest to RES_OFFSET. Raw linear-memory access only
// (no heap allocation, no runtime imports) — mirrors gc_document_kernel.ts.

const FIXTURE_OFFSET: usize = 3145728;
const OUTPUT_OFFSET: usize = 3407872;
const RES_OFFSET: usize = 3932160;
const FIXTURE_MAGIC: u32 = 0x31465353;
const OUTPUT_MAGIC: u32 = 0x314f5353;
const RECORDS: u32 = 1000;
const TOKENS_PER_RESPONSE: u32 = 23;

let outAt: u32 = 0;
let outFailed: bool = false;
let fnv: u32 = 0;
let cTextEscapes: u32 = 0;
let cAttributeEscapes: u32 = 0;
let cUrlEscapes: u32 = 0;
let cIntegerFormats: u32 = 0;
let cDateFormats: u32 = 0;
let cur: u32 = 0;
let curFailed: bool = false;

function fixtureAt(off: u32): u8 {
  return load<u8>(FIXTURE_OFFSET + (<usize>off));
}
function readU32Le(off: u32): u32 {
  return (<u32>fixtureAt(off)) |
    ((<u32>fixtureAt(off + 1)) << 8) |
    ((<u32>fixtureAt(off + 2)) << 16) |
    ((<u32>fixtureAt(off + 3)) << 24);
}
function fnvReset(): void { fnv = 0x811c9dc5; }
function fnvMixByte(b: u8): void { fnv = ((fnv ^ (<u32>b)) * 0x01000193) >>> 0; }

function outByte(v: u32): void {
  if (outFailed) return;
  store<u8>(OUTPUT_OFFSET + (<usize>outAt), <u8>v);
  fnvMixByte(<u8>v);
  outAt++;
}
function outU32Le(v: u32): void {
  outByte(v & 0xff);
  outByte((v >>> 8) & 0xff);
  outByte((v >>> 16) & 0xff);
  outByte((v >>> 24) & 0xff);
}
function outOverwriteU32Le(at: u32, v: u32): void {
  store<u8>(OUTPUT_OFFSET + (<usize>at), <u8>(v & 0xff));
  store<u8>(OUTPUT_OFFSET + (<usize>at) + 1, <u8>((v >>> 8) & 0xff));
  store<u8>(OUTPUT_OFFSET + (<usize>at) + 2, <u8>((v >>> 16) & 0xff));
  store<u8>(OUTPUT_OFFSET + (<usize>at) + 3, <u8>((v >>> 24) & 0xff));
}
// Static ASCII literals from a fixed memory region below FIXTURE_OFFSET.
// We store each literal's bytes at a fixed offset and emit them via outByte.
// Since we can't use string constants without runtime, we open-code each
// literal as a series of outByte calls.

function litAmp(): void {
  outByte(38); outByte(97); outByte(109); outByte(112); outByte(59);
}
function litLt(): void {
  outByte(38); outByte(108); outByte(116); outByte(59);
}
function litGt(): void {
  outByte(38); outByte(103); outByte(116); outByte(59);
}
function litQuot(): void {
  outByte(38); outByte(113); outByte(117); outByte(111); outByte(116); outByte(59);
}
function litApos(): void {
  outByte(38); outByte(35); outByte(51); outByte(57); outByte(59);
}

// Emit a compile-time ASCII string one byte at a time. The compiler unrolls
// this at -O3 into a straight-line sequence of outByte calls.
// @ts-ignore: decorator
@inline
function litString(s: string): void {
  for (let i = 0; i < s.length; i++) outByte(<u32>s.charCodeAt(i));
}

function writeDecimal(value: u32, minimum: u32): void {
  const digits = new StaticArray<u8>(10);
  let n: u32 = 0;
  do {
    digits[n] = <u8>(48 + (value % 10));
    n++;
    value = value / 10;
  } while (value != 0 || n < minimum);
  while (n > 0) {
    n--;
    outByte(<u32>digits[n]);
  }
}
function writeTextEscaped(off: u32, n: u32): void {
  for (let i: u32 = 0; i < n; i++) {
    const c = fixtureAt(off + i);
    if (c == 38) litAmp();
    else if (c == 60) litLt();
    else if (c == 62) litGt();
    else outByte(<u32>c);
  }
}
function writeAttrEscaped(off: u32, n: u32): void {
  for (let i: u32 = 0; i < n; i++) {
    const c = fixtureAt(off + i);
    if (c == 38) litAmp();
    else if (c == 60) litLt();
    else if (c == 62) litGt();
    else if (c == 34) litQuot();
    else if (c == 39) litApos();
    else outByte(<u32>c);
  }
}
function isUnreserved(c: u8): bool {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
    (c >= 48 && c <= 57) || c == 45 || c == 46 || c == 95 || c == 126;
}
function writeUrlComponent(off: u32, n: u32): void {
  for (let i: u32 = 0; i < n; i++) {
    const c = fixtureAt(off + i);
    if (isUnreserved(c)) outByte(<u32>c);
    else {
      outByte(37);
      const hi = c >> 4;
      const lo = c & 15;
      outByte(hi < 10 ? <u32>(48 + hi) : <u32>(65 + hi - 10));
      outByte(lo < 10 ? <u32>(48 + lo) : <u32>(65 + lo - 10));
    }
  }
}
function writeDate(ymd: u32): bool {
  const year = ymd / 10000;
  const month = (ymd / 100) % 100;
  const day = ymd % 100;
  if (year < 2026 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 28) {
    return false;
  }
  writeDecimal(year, 4);
  outByte(45);
  writeDecimal(month, 2);
  outByte(45);
  writeDecimal(day, 2);
  return true;
}
function writePrice(cents: u32): void {
  writeDecimal(cents / 100, 1);
  outByte(46);
  writeDecimal(cents % 100, 2);
}
function validUtf8(off: u32, n: u32): bool {
  let i: u32 = 0;
  while (i < n) {
    const c = <u32>fixtureAt(off + i);
    i++;
    if (c < 0x80) continue;
    let need: u32 = 0, min: u32 = 0, value: u32 = 0;
    if ((c & 0xe0) == 0xc0) { need = 1; min = 0x80; value = c & 0x1f; }
    else if ((c & 0xf0) == 0xe0) { need = 2; min = 0x800; value = c & 0x0f; }
    else if ((c & 0xf8) == 0xf0) { need = 3; min = 0x10000; value = c & 0x07; }
    else return false;
    if (i + need > n) return false;
    for (let j: u32 = 0; j < need; j++) {
      const d = <u32>fixtureAt(off + i);
      i++;
      if ((d & 0xc0) != 0x80) return false;
      value = (value << 6) | (d & 0x3f);
    }
    if (value < min || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
      return false;
    }
  }
  return true;
}
function parseU32(end: u32): u32 {
  if (curFailed || cur > end || end - cur < 4) { curFailed = true; return 0; }
  const v = readU32Le(cur);
  cur += 4;
  return v;
}
// parseString returns (off << 32) | length encoded via two-return trick:
// we return the length and stash the offset in a global slot.
let lastStringOff: u32 = 0;
function parseString(end: u32): u32 {
  const length = parseU32(end);
  if (curFailed || length > 65536 || cur > end || length > end - cur) {
    curFailed = true;
    return 0;
  }
  if (!validUtf8(cur, length)) { curFailed = true; return 0; }
  lastStringOff = cur;
  cur += length;
  return length;
}

function renderRecord(
  productId: u32, userId: u32, priceCents: u32, dateYmd: u32,
  nameOff: u32, nameN: u32, userOff: u32, userN: u32,
  slugOff: u32, slugN: u32,
): bool {
  litString("<!doctype html><html lang=\"en\"><body><article data-product=\"");
  writeDecimal(productId, 1);
  cIntegerFormats++;
  litString("\"><h1>");
  writeTextEscaped(nameOff, nameN);
  cTextEscapes++;
  litString("</h1><p data-user=\"");
  writeDecimal(userId, 1);
  cIntegerFormats++;
  litString("\" aria-label=\"Catalog for ");
  writeAttrEscaped(userOff, userN);
  cAttributeEscapes++;
  litString("\">Hello, ");
  writeTextEscaped(userOff, userN);
  cTextEscapes++;
  litString(".</p><p class=\"price\" data-cents=\"");
  writeDecimal(priceCents, 1);
  cIntegerFormats++;
  litString("\">USD ");
  writePrice(priceCents);
  cIntegerFormats++;
  litString("</p><a href=\"/catalog/");
  writeUrlComponent(slugOff, slugN);
  cUrlEscapes++;
  litString("?for=");
  writeUrlComponent(userOff, userN);
  cUrlEscapes++;
  litString("\">Open</a><time datetime=\"");
  if (!writeDate(dateYmd)) return false;
  cDateFormats++;
  litString("\">");
  if (!writeDate(dateYmd)) return false;
  cDateFormats++;
  litString("</time></article></body></html>");
  return !outFailed;
}

export function ssr_render(fixtureLen: u32): i32 {
  outAt = 0;
  outFailed = false;
  cur = 0;
  curFailed = false;
  cTextEscapes = 0;
  cAttributeEscapes = 0;
  cUrlEscapes = 0;
  cIntegerFormats = 0;
  cDateFormats = 0;
  fnvReset();

  if (fixtureLen < 8) return -1;
  if (parseU32(fixtureLen) != FIXTURE_MAGIC) return -2;
  if (curFailed) return -2;
  if (parseU32(fixtureLen) != RECORDS) return -3;
  if (curFailed) return -3;

  outU32Le(OUTPUT_MAGIC);
  outU32Le(RECORDS);
  if (outFailed) return -4;

  for (let index: u32 = 0; index < RECORDS; index++) {
    const productId = parseU32(fixtureLen);
    const userId = parseU32(fixtureLen);
    const priceCents = parseU32(fixtureLen);
    const dateYmd = parseU32(fixtureLen);
    const nameN = parseString(fixtureLen);
    const nameOff = lastStringOff;
    const userN = parseString(fixtureLen);
    const userOff = lastStringOff;
    const slugN = parseString(fixtureLen);
    const slugOff = lastStringOff;
    if (curFailed) return -5;

    const lengthAt = outAt;
    outU32Le(0);
    const start = outAt;
    if (!renderRecord(
      productId, userId, priceCents, dateYmd,
      nameOff, nameN, userOff, userN, slugOff, slugN,
    )) return -6;
    const bodyLen = outAt - start;
    outOverwriteU32Le(lengthAt, bodyLen);
  }
  if (curFailed || cur != fixtureLen) return -7;
  if (outFailed) return -8;

  fnvReset();
  for (let i: u32 = 0; i < outAt; i++) {
    fnvMixByte(load<u8>(OUTPUT_OFFSET + (<usize>i)));
  }

  store<u32>(RES_OFFSET, RECORDS);
  store<u32>(RES_OFFSET + 4, RECORDS * 7);
  store<u32>(RES_OFFSET + 8, RECORDS * TOKENS_PER_RESPONSE);
  store<u32>(RES_OFFSET + 12, cTextEscapes);
  store<u32>(RES_OFFSET + 16, cAttributeEscapes);
  store<u32>(RES_OFFSET + 20, cUrlEscapes);
  store<u32>(RES_OFFSET + 24, cIntegerFormats);
  store<u32>(RES_OFFSET + 28, cDateFormats);
  store<u32>(RES_OFFSET + 32, fixtureLen);
  store<u32>(RES_OFFSET + 36, outAt);
  store<u32>(RES_OFFSET + 40, fnv);
  store<u32>(RES_OFFSET + 44, 0);
  return 0;
}
