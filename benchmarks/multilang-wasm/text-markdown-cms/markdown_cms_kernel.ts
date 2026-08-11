// markdown_cms_kernel.ts — AssemblyScript multilang compute core for
// text.markdown-cms.v1. Same ABI + oracle as markdown_cms_kernel.c: adapter
// writes the frozen 10,978,068-byte fixture at FIXTURE_OFFSET, kernel parses
// + renders bit-identical to renderMarkdown() into OUTPUT_OFFSET and writes
// aggregate counters + FNV-1a digest to RES_OFFSET. Raw linear-memory access
// only (no heap allocation, no runtime imports).

const FIXTURE_OFFSET: usize = 3145728;
const OUTPUT_OFFSET: usize = 15728640;
const AST_OFFSET: usize = 27262976;
const RES_OFFSET: usize = 28311552;
const FIXTURE_MAGIC: u32 = 0x3146434d;
const DOCUMENTS: u32 = 500;
const RECORD_FIELDS: u32 = 6;
const MAX_RECORDS: u32 = 4096;
const MAX_INPUT: u32 = 40960;

const T_H1: u32 = 1;
const T_H2: u32 = 2;
const T_PARAGRAPH: u32 = 3;
const T_LINK: u32 = 4;
const T_FIGURE: u32 = 5;
const T_RAW: u32 = 6;

let outAt: u32 = 0;
let fnv: u32 = 0;

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
function outByteRaw(v: u8): void {
  store<u8>(OUTPUT_OFFSET + (<usize> outAt), v);
  outAt++;
}
function litString(s: string): void {
  for (let i = 0; i < s.length; i++) outByteRaw(<u8> s.charCodeAt(i));
}
function outFixtureRange(off: u32, n: u32): void {
  for (let i: u32 = 0; i < n; i++) outByteRaw(fixtureAt(off + i));
}

function astWrite(index: u32, field: u32, value: u32): void {
  store<u32>(AST_OFFSET + (<usize> ((index * RECORD_FIELDS + field) * 4)), value);
}
function astRead(index: u32, field: u32): u32 {
  return load<u32>(AST_OFFSET + (<usize> ((index * RECORD_FIELDS + field) * 4)));
}

function isAlnumAscii(c: u8): bool {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57);
}
function toLowerAscii(c: u8): u8 {
  return (c >= 65 && c <= 90) ? <u8> (c + 32) : c;
}
function utf8Len(c: u8): u32 {
  if (c < 0x80) return 1;
  if ((c & 0xe0) == 0xc0) return 2;
  if ((c & 0xf0) == 0xe0) return 3;
  if ((c & 0xf8) == 0xf0) return 4;
  return 1;
}

function writeEscaped(off: u32, n: u32): void {
  for (let i: u32 = 0; i < n; i++) {
    const c = fixtureAt(off + i);
    if (c == 38) litString("&amp;");
    else if (c == 60) litString("&lt;");
    else if (c == 62) litString("&gt;");
    else if (c == 34) litString("&quot;");
    else outByteRaw(c);
  }
}

function writeSlug(off: u32, n: u32): void {
  const startAt = outAt;
  let dash: bool = false;
  let i: u32 = 0;
  while (i < n) {
    const c = fixtureAt(off + i);
    if (c < 0x80) {
      if (isAlnumAscii(c)) {
        outByteRaw(toLowerAscii(c));
        dash = false;
      } else if (outAt > startAt && !dash) {
        outByteRaw(45);
        dash = true;
      }
      i++;
    } else {
      if (outAt > startAt && !dash) {
        outByteRaw(45);
        dash = true;
      }
      i += utf8Len(c);
    }
  }
  // Trim one trailing '-'.
  if (outAt > startAt) {
    const last = load<u8>(OUTPUT_OFFSET + (<usize> (outAt - 1)));
    if (last == 45) outAt--;
  }
  if (outAt == startAt) litString("section");
}

function allowedRaw(off: u32, n: u32): bool {
  if (
    n >= 9 &&
    fixtureAt(off) == 60 && fixtureAt(off + 1) == 101 &&
    fixtureAt(off + 2) == 109 && fixtureAt(off + 3) == 62 &&
    fixtureAt(off + n - 5) == 60 && fixtureAt(off + n - 4) == 47 &&
    fixtureAt(off + n - 3) == 101 && fixtureAt(off + n - 2) == 109 &&
    fixtureAt(off + n - 1) == 62
  ) {
    let i: u32 = 4;
    while (i < n - 5) {
      const c = fixtureAt(off + i);
      if (c == 60 || c == 62) return false;
      i++;
    }
    return true;
  }
  if (
    n >= 17 &&
    fixtureAt(off) == 60 && fixtureAt(off + 1) == 115 &&
    fixtureAt(off + 2) == 116 && fixtureAt(off + 3) == 114 &&
    fixtureAt(off + 4) == 111 && fixtureAt(off + 5) == 110 &&
    fixtureAt(off + 6) == 103 && fixtureAt(off + 7) == 62 &&
    fixtureAt(off + n - 9) == 60 && fixtureAt(off + n - 8) == 47 &&
    fixtureAt(off + n - 7) == 115 && fixtureAt(off + n - 6) == 116 &&
    fixtureAt(off + n - 5) == 114 && fixtureAt(off + n - 4) == 111 &&
    fixtureAt(off + n - 3) == 110 && fixtureAt(off + n - 2) == 103 &&
    fixtureAt(off + n - 1) == 62
  ) {
    let i: u32 = 8;
    while (i < n - 9) {
      const c = fixtureAt(off + i);
      if (c == 60 || c == 62) return false;
      i++;
    }
    return true;
  }
  return false;
}

function prefixMatch(off: u32, n: u32, prefix: string): bool {
  if (n < <u32> prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (fixtureAt(off + <u32> i) != <u8> prefix.charCodeAt(i)) return false;
  }
  return true;
}

function safeUrl(off: u32, n: u32, image: bool): bool {
  for (let i: u32 = 0; i < n; i++) {
    const c = fixtureAt(off + i);
    if (
      c <= 32 || c >= 127 || c == 34 || c == 39 || c == 60 || c == 62 ||
      c == 92
    ) {
      return false;
    }
  }
  if (image) {
    return prefixMatch(off, n, "https://images.example.test/");
  }
  return prefixMatch(off, n, "https://example.test/") ||
    prefixMatch(off, n, "https://docs.example.test/");
}

function parseMarkdown(docOff: u32, docLen: u32): i32 {
  if (docLen > MAX_INPUT) return -1;
  let nodeCount: u32 = 0;
  let nonEmpty: u32 = 0;
  let start: u32 = 0;
  let end: u32 = 0;
  while (end <= docLen) {
    if (end != docLen && fixtureAt(docOff + end) != 10) {
      end++;
      continue;
    }
    if (end == start) {
      start = end + 1;
      end++;
      continue;
    }
    nonEmpty++;
    if (nonEmpty > MAX_RECORDS) return -2;
    let rType: u32 = T_PARAGRAPH;
    let textStart = start;
    let textLength = end - start;
    let urlStart: u32 = 0;
    let urlLength: u32 = 0;
    const s0 = fixtureAt(docOff + start);
    const s1: u8 = start + 1 < end ? fixtureAt(docOff + start + 1) : 0;
    const s2: u8 = start + 2 < end ? fixtureAt(docOff + start + 2) : 0;
    if (textLength >= 3 && s0 == 35 && s1 == 32) {
      rType = T_H1;
      textStart = start + 2;
      textLength -= 2;
    } else if (textLength >= 4 && s0 == 35 && s1 == 35 && s2 == 32) {
      rType = T_H2;
      textStart = start + 3;
      textLength -= 3;
    } else if (s0 == 60) {
      rType = T_RAW;
    } else if (s0 == 91 || (textLength >= 5 && s0 == 33 && s1 == 91)) {
      const image: bool = s0 == 33;
      let cursor: u32 = start + (image ? 1 : 0);
      const candidateTextStart = cursor + 1;
      let close: u32 = 0;
      while (cursor + 2 < end) {
        if (
          fixtureAt(docOff + cursor) == 93 &&
          fixtureAt(docOff + cursor + 1) == 40
        ) {
          close = cursor;
          break;
        }
        cursor++;
      }
      if (close != 0 && fixtureAt(docOff + end - 1) == 41) {
        rType = image ? T_FIGURE : T_LINK;
        textStart = candidateTextStart;
        textLength = close - candidateTextStart;
        urlStart = close + 2;
        urlLength = end - urlStart - 1;
      }
    }
    astWrite(nodeCount, 0, rType);
    astWrite(nodeCount, 1, docOff + textStart);
    astWrite(nodeCount, 2, textLength);
    astWrite(nodeCount, 3, urlStart != 0 ? docOff + urlStart : 0);
    astWrite(nodeCount, 4, urlLength);
    astWrite(nodeCount, 5, 0);
    nodeCount++;
    start = end + 1;
    end++;
  }
  return <i32> nodeCount;
}

let sHeadings: u32 = 0;
let sLinks: u32 = 0;
let sFigures: u32 = 0;
let sTransforms: u32 = 0;
let sSanitizer: u32 = 0;
let sRejected: u32 = 0;

function transformAst(nodeCount: u32): void {
  sHeadings = 0;
  sLinks = 0;
  sFigures = 0;
  sTransforms = 0;
  sSanitizer = 0;
  sRejected = 0;
  for (let i: u32 = 0; i < nodeCount; i++) {
    const t = astRead(i, 0);
    if (t == T_H1 || t == T_H2) {
      sHeadings++;
      sTransforms++;
      astWrite(i, 5, 1);
    } else if (t == T_LINK || t == T_FIGURE) {
      if (t == T_LINK) sLinks++;
      else sFigures++;
      sTransforms++;
      sSanitizer++;
      const image: bool = t == T_FIGURE;
      const ok = safeUrl(astRead(i, 3), astRead(i, 4), image);
      astWrite(i, 5, ok ? 1 : 0);
      if (!ok) sRejected++;
    } else if (t == T_RAW) {
      sSanitizer++;
      const ok = allowedRaw(astRead(i, 1), astRead(i, 2));
      astWrite(i, 5, ok ? 1 : 0);
      if (!ok) sRejected++;
    } else {
      astWrite(i, 5, 1);
    }
  }
}

function renderAst(nodeCount: u32, headings: u32): void {
  if (headings != 0) {
    litString('<nav aria-label="Table of contents"><ol>');
    for (let i: u32 = 0; i < nodeCount; i++) {
      const t = astRead(i, 0);
      if (t == T_H1 || t == T_H2) {
        const tOff = astRead(i, 1);
        const tLen = astRead(i, 2);
        litString('<li><a href="#');
        writeSlug(tOff, tLen);
        litString('">');
        writeEscaped(tOff, tLen);
        litString("</a></li>");
      }
    }
    litString("</ol></nav>");
  }
  for (let i: u32 = 0; i < nodeCount; i++) {
    const t = astRead(i, 0);
    const flag = astRead(i, 5);
    const tOff = astRead(i, 1);
    const tLen = astRead(i, 2);
    if (t == T_H1) {
      litString('<h1 id="');
      writeSlug(tOff, tLen);
      litString('">');
      writeEscaped(tOff, tLen);
      litString("</h1>");
    } else if (t == T_H2) {
      litString('<h2 id="');
      writeSlug(tOff, tLen);
      litString('">');
      writeEscaped(tOff, tLen);
      litString("</h2>");
    } else if (t == T_PARAGRAPH) {
      litString("<p>");
      writeEscaped(tOff, tLen);
      litString("</p>");
    } else if (t == T_LINK && flag != 0) {
      litString('<p><a href="');
      writeEscaped(astRead(i, 3), astRead(i, 4));
      litString('">');
      writeEscaped(tOff, tLen);
      litString("</a></p>");
    } else if (t == T_FIGURE && flag != 0) {
      litString('<figure><img src="');
      writeEscaped(astRead(i, 3), astRead(i, 4));
      litString('" alt="');
      writeEscaped(tOff, tLen);
      litString('"></figure>');
    } else if (t == T_RAW && flag != 0) {
      outFixtureRange(tOff, tLen);
    }
  }
}

export function markdown_cms_render(fixture_len: u32): i32 {
  outAt = 0;
  fnvReset();
  if (fixture_len < 8) return -1;
  if (readU32Le(0) != FIXTURE_MAGIC) return -2;
  if (readU32Le(4) != DOCUMENTS) return -3;
  let cur: u32 = 8;
  let cDocs: u32 = 0;
  let cInputBytes: u32 = 0;
  let cTokens: u32 = 0;
  let cAstNodes: u32 = 0;
  let cTransforms: u32 = 0;
  let cSanitizer: u32 = 0;
  let cRejected: u32 = 0;
  for (let d: u32 = 0; d < DOCUMENTS; d++) {
    if (cur + 4 > fixture_len) return -4;
    const docLen = readU32Le(cur);
    cur += 4;
    if (cur + docLen > fixture_len) return -5;
    const ncSigned = parseMarkdown(cur, docLen);
    if (ncSigned < 0) return -6;
    const nc = <u32> ncSigned;
    transformAst(nc);
    renderAst(nc, sHeadings);
    cDocs++;
    cInputBytes += docLen;
    cTokens += nc;
    cAstNodes += nc + sHeadings * 2 + (sHeadings != 0 ? 2 : 0) + sLinks + sFigures;
    cTransforms += sTransforms;
    cSanitizer += sSanitizer;
    cRejected += sRejected;
    cur += docLen;
  }
  if (cur != fixture_len) return -7;

  fnvReset();
  for (let i: u32 = 0; i < outAt; i++) {
    fnvMixByte(load<u8>(OUTPUT_OFFSET + (<usize> i)));
  }

  store<u32>(RES_OFFSET, cDocs);
  store<u32>(RES_OFFSET + 4, cInputBytes);
  store<u32>(RES_OFFSET + 8, cTokens);
  store<u32>(RES_OFFSET + 12, cAstNodes);
  store<u32>(RES_OFFSET + 16, cTransforms);
  store<u32>(RES_OFFSET + 20, cSanitizer);
  store<u32>(RES_OFFSET + 24, outAt);
  store<u32>(RES_OFFSET + 28, cRejected);
  store<u32>(RES_OFFSET + 32, fnv);
  store<u32>(RES_OFFSET + 36, 0);
  return 0;
}
