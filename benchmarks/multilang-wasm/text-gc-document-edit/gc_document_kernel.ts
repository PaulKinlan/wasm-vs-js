// gc_document_kernel.ts — AssemblyScript multilang compute core for
// text.gc-document-edit.v1. Same ABI as gc_document_kernel.c: the adapter
// writes the frozen fixture bytes into linear memory at FIXTURE_OFFSET
// (byte length passed in), and the kernel parses parseFixture + executeFixture
// (256 initial labelled nodes on a 3-ary DAG plus 10,000 edits — inserts,
// leaf-deletes, and reparents mirroring benchmarks/v1/text-gc-document-edit/
// workload.js), writes counters + a deterministic FNV-1a digest of the DFS
// canonical traversal (u32 id + label bytes + u32 child count per node) to
// RES_OFFSET, and returns the final node count. Raw linear-memory access
// only (no heap allocation, no runtime imports) — mirrors grid_kernel.ts.

const MAX_SLOTS: i32 = 4096;
// Slot-storage layout (all before the fixture window at 196608):
//   PARENT_OF:        i32[4096] at 0       (bytes 0..16384)
//   FIRST_CHILD_OF:   i32[4096] at 16384   (bytes 16384..32768)
//   PREV_SIBLING_OF:  i32[4096] at 32768   (bytes 32768..49152)
//   NEXT_SIBLING_OF:  i32[4096] at 49152   (bytes 49152..65536)
//   CHILD_COUNT_OF:   u32[4096] at 65536   (bytes 65536..81920)
//   LABEL_OFF_OF:     u32[4096] at 81920   (bytes 81920..98304)
//   LABEL_HEX_LEN_OF: u16[4096] at 98304   (bytes 98304..106496)
const PARENT_OF: usize = 0;
const FIRST_CHILD_OF: usize = 16384;
const PREV_SIBLING_OF: usize = 32768;
const NEXT_SIBLING_OF: usize = 49152;
const CHILD_COUNT_OF: usize = 65536;
const LABEL_OFF_OF: usize = 81920;
const LABEL_HEX_LEN_OF: usize = 98304;
const FIXTURE_OFFSET: usize = 196608; // 192 KiB
const RES_OFFSET: usize = 524288; // 512 KiB

let fnv: u32 = 0;

// --- FNV-1a 32-bit ---------------------------------------------------------
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

// --- Slot accessors --------------------------------------------------------
function getParent(id: i32): i32 {
  return load<i32>(PARENT_OF + (<usize> id) * 4);
}
function setParent(id: i32, v: i32): void {
  store<i32>(PARENT_OF + (<usize> id) * 4, v);
}
function getFirstChild(id: i32): i32 {
  return load<i32>(FIRST_CHILD_OF + (<usize> id) * 4);
}
function setFirstChild(id: i32, v: i32): void {
  store<i32>(FIRST_CHILD_OF + (<usize> id) * 4, v);
}
function getPrevSibling(id: i32): i32 {
  return load<i32>(PREV_SIBLING_OF + (<usize> id) * 4);
}
function setPrevSibling(id: i32, v: i32): void {
  store<i32>(PREV_SIBLING_OF + (<usize> id) * 4, v);
}
function getNextSibling(id: i32): i32 {
  return load<i32>(NEXT_SIBLING_OF + (<usize> id) * 4);
}
function setNextSibling(id: i32, v: i32): void {
  store<i32>(NEXT_SIBLING_OF + (<usize> id) * 4, v);
}
function getChildCount(id: i32): u32 {
  return load<u32>(CHILD_COUNT_OF + (<usize> id) * 4);
}
function setChildCount(id: i32, v: u32): void {
  store<u32>(CHILD_COUNT_OF + (<usize> id) * 4, v);
}
function getLabelOff(id: i32): u32 {
  return load<u32>(LABEL_OFF_OF + (<usize> id) * 4);
}
function setLabelOff(id: i32, v: u32): void {
  store<u32>(LABEL_OFF_OF + (<usize> id) * 4, v);
}
function getLabelHexLen(id: i32): u16 {
  return load<u16>(LABEL_HEX_LEN_OF + (<usize> id) * 2);
}
function setLabelHexLen(id: i32, v: u16): void {
  store<u16>(LABEL_HEX_LEN_OF + (<usize> id) * 2, v);
}

// --- Fixture byte accessors ------------------------------------------------
function fixtureAt(off: u32): u8 {
  return load<u8>(FIXTURE_OFFSET + (<usize> off));
}
function isDigit(c: u8): bool {
  return c >= 0x30 && c <= 0x39;
}
function hexVal(c: u8): u8 {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  return c - 0x41 + 10;
}

// --- Parser primitives -----------------------------------------------------
function readInt(offBase: u32, end: u32): u64 {
  // Encodes (value:i32 lo32, newOffset:u32 hi32) into a u64 for a single return.
  let off = offBase;
  let neg = false;
  if (off < end && fixtureAt(off) == 0x2d /* '-' */) {
    neg = true;
    off++;
  }
  let v: i32 = 0;
  while (off < end && isDigit(fixtureAt(off))) {
    v = v * 10 + (<i32> (fixtureAt(off) - 0x30));
    off++;
  }
  if (neg) v = -v;
  return (<u64> off << 32) | (<u64> (<u32> v));
}
function skipLine(offBase: u32, end: u32): u32 {
  let off = offBase;
  while (off < end && fixtureAt(off) != 0x0a /* '\n' */) off++;
  if (off < end) off++;
  return off;
}
function readHeaderCount(offBase: u32, end: u32): u64 {
  let off = offBase;
  while (off < end && fixtureAt(off) != 0x09 /* '\t' */) off++;
  if (off < end) off++;
  const packed = readInt(off, end);
  off = <u32> (packed >>> 32);
  const c = <i32> (packed & 0xffffffff);
  off = skipLine(off, end);
  return (<u64> off << 32) | (<u64> (<u32> c));
}
// readHexSpan returns (start_off:u32 lo, hex_len:u16, newOff:u32 in hi32)
// We split into two calls to keep u64 packing simple: readHexSpanStart / End.
function readHexSpanEnd(offBase: u32, end: u32): u32 {
  let off = offBase;
  while (
    off < end && fixtureAt(off) != 0x09 /* '\t' */ && fixtureAt(off) != 0x0a /* '\n' */
  ) {
    off++;
  }
  return off;
}

// --- List/tree helpers -----------------------------------------------------
function linkAfter(parent: i32, anchor: i32, node: i32): void {
  if (anchor == -1) {
    const oldHead = getFirstChild(parent);
    setNextSibling(node, oldHead);
    setPrevSibling(node, -1);
    if (oldHead != -1) setPrevSibling(oldHead, node);
    setFirstChild(parent, node);
  } else {
    const oldNext = getNextSibling(anchor);
    setNextSibling(node, oldNext);
    setPrevSibling(node, anchor);
    if (oldNext != -1) setPrevSibling(oldNext, node);
    setNextSibling(anchor, node);
  }
  setChildCount(parent, getChildCount(parent) + 1);
}
function insertAtPosition(parent: i32, position: i32, node: i32): void {
  if (position == 0) {
    linkAfter(parent, -1, node);
    return;
  }
  let cur = getFirstChild(parent);
  let k: i32 = 0;
  while (k < position - 1 && cur != -1) {
    cur = getNextSibling(cur);
    k++;
  }
  linkAfter(parent, cur, node);
}
function spliceOut(node: i32): void {
  const par = getParent(node);
  const p = getPrevSibling(node);
  const n = getNextSibling(node);
  if (p == -1) setFirstChild(par, n);
  else setNextSibling(p, n);
  if (n != -1) setPrevSibling(n, p);
  setPrevSibling(node, -1);
  setNextSibling(node, -1);
  setChildCount(par, getChildCount(par) - 1);
}

function dfsMix(slot: i32): void {
  fnvMixU32(<u32> slot);
  const hexLen = <u32> getLabelHexLen(slot);
  const byteLen = hexLen / 2;
  fnvMixU32(byteLen);
  const off = getLabelOff(slot);
  for (let i: u32 = 0; i < byteLen; i++) {
    const hi = fixtureAt(off + i * 2);
    const lo = fixtureAt(off + i * 2 + 1);
    fnvMixByte(<u8> ((hexVal(hi) << 4) | hexVal(lo)));
  }
  fnvMixU32(getChildCount(slot));
  let c = getFirstChild(slot);
  while (c != -1) {
    dfsMix(c);
    c = getNextSibling(c);
  }
}

export function gc_document_edit_trace(fixture_len: u32): i32 {
  // Reset slot storage.
  for (let i: i32 = 0; i < MAX_SLOTS; i++) {
    setParent(i, -2);
    setFirstChild(i, -1);
    setPrevSibling(i, -1);
    setNextSibling(i, -1);
    setChildCount(i, 0);
    setLabelOff(i, 0);
    setLabelHexLen(i, 0);
  }

  let off: u32 = 0;
  const end = fixture_len;
  off = skipLine(off, end);
  let hc = readHeaderCount(off, end);
  off = <u32> (hc >>> 32);
  const initialCount = <i32> (hc & 0xffffffff);
  hc = readHeaderCount(off, end);
  off = <u32> (hc >>> 32);
  // operations count consumed but unused (must equal 10,000; parser trusts fixture)

  let childInsertions: u32 = 0;
  let childRemovals: u32 = 0;
  let parentWrites: u32 = 0;
  let nodeCount: u32 = 0;

  // Initial rows: "N\t<id>\t<parentId>\t<position>\t<hexLabel>\n"
  for (let i: i32 = 0; i < initialCount; i++) {
    off += 2; // skip 'N' + '\t'
    let packed = readInt(off, end);
    off = <u32> (packed >>> 32);
    const id = <i32> (packed & 0xffffffff);
    off++; // skip '\t'
    packed = readInt(off, end);
    off = <u32> (packed >>> 32);
    const parentId = <i32> (packed & 0xffffffff);
    off++; // skip '\t'
    packed = readInt(off, end);
    off = <u32> (packed >>> 32);
    const position = <i32> (packed & 0xffffffff);
    off++; // skip '\t'
    const labelOff = off;
    off = readHexSpanEnd(off, end);
    const labelHexLen = <u16> (off - labelOff);
    off = skipLine(off, end);

    setLabelOff(id, labelOff);
    setLabelHexLen(id, labelHexLen);
    if (parentId == -1) {
      setParent(id, -1);
    } else {
      setParent(id, parentId);
      insertAtPosition(parentId, position, id);
      childInsertions++;
      parentWrites++;
    }
    nodeCount++;
  }

  let inserts: u32 = 0;
  let deletes: u32 = 0;
  let reparents: u32 = 0;

  while (off < end) {
    const tag = fixtureAt(off);
    if (tag == 0x0a /* '\n' */) {
      off++;
      continue;
    }
    off++; // skip tag
    off++; // skip '\t'
    if (tag == 0x49 /* 'I' */) {
      let packed = readInt(off, end);
      off = <u32> (packed >>> 32);
      const id = <i32> (packed & 0xffffffff);
      off++;
      packed = readInt(off, end);
      off = <u32> (packed >>> 32);
      const parentId = <i32> (packed & 0xffffffff);
      off++;
      packed = readInt(off, end);
      off = <u32> (packed >>> 32);
      const position = <i32> (packed & 0xffffffff);
      off++;
      const labelOff = off;
      off = readHexSpanEnd(off, end);
      const labelHexLen = <u16> (off - labelOff);
      off = skipLine(off, end);

      setLabelOff(id, labelOff);
      setLabelHexLen(id, labelHexLen);
      setParent(id, parentId);
      insertAtPosition(parentId, position, id);
      inserts++;
      childInsertions++;
      parentWrites++;
      nodeCount++;
    } else if (tag == 0x44 /* 'D' */) {
      const packed = readInt(off, end);
      off = <u32> (packed >>> 32);
      const id = <i32> (packed & 0xffffffff);
      off = skipLine(off, end);
      spliceOut(id);
      setParent(id, -2);
      deletes++;
      childRemovals++;
      parentWrites++;
      nodeCount--;
    } else if (tag == 0x52 /* 'R' */) {
      let packed = readInt(off, end);
      off = <u32> (packed >>> 32);
      const id = <i32> (packed & 0xffffffff);
      off++;
      packed = readInt(off, end);
      off = <u32> (packed >>> 32);
      const parentId = <i32> (packed & 0xffffffff);
      off++;
      packed = readInt(off, end);
      off = <u32> (packed >>> 32);
      const position = <i32> (packed & 0xffffffff);
      off = skipLine(off, end);
      spliceOut(id);
      setParent(id, parentId);
      insertAtPosition(parentId, position, id);
      reparents++;
      childInsertions++;
      childRemovals++;
      parentWrites++;
    } else {
      off = skipLine(off, end);
    }
  }

  fnvReset();
  dfsMix(0);
  const canonicalFnv = fnv;

  store<u32>(RES_OFFSET, inserts);
  store<u32>(RES_OFFSET + 4, deletes);
  store<u32>(RES_OFFSET + 8, reparents);
  store<u32>(RES_OFFSET + 12, nodeCount);
  store<u32>(RES_OFFSET + 16, childInsertions);
  store<u32>(RES_OFFSET + 20, childRemovals);
  store<u32>(RES_OFFSET + 24, parentWrites);
  store<u32>(RES_OFFSET + 28, canonicalFnv);
  return <i32> nodeCount;
}
