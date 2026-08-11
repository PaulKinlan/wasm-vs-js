// vdom_kernel.ts — AssemblyScript multilang compute core for
// dom.vdom-diff-patch.v1. Same ABI as the C kernel: generates the 1,000-node
// treeA + treeB from SplitMix64 seed 3976273958, runs the exact
// createVDOMPatches diff, writes counters + FNV-1a canonical/patch-stream
// digests to a fixed offset, returns the patch count. Raw linear-memory
// access only (no heap allocation, no runtime imports) — mirrors the
// grid_kernel.ts style.

const NODE_COUNT = 1000;
const TEXT_THRESHOLD: i32 = 333; // ceil((NODE_COUNT-1)/3)
const MAX_CHILDREN = 3;
const RES_OFFSET: usize = 16384;

// Memory layout (all bytes, u16 arrays are aligned):
//   A_TAG:      i16[1000] at 0        (bytes 0..2000)
//   A_KEY:      i16[1000] at 2048
//   A_ATTR_KEY: i16[1000] at 4096
//   A_ATTR_VAL: i16[1000] at 6144
//   A_TEXT_ID:  i16[1000] at 8192
//   A_CHILD_COUNT: u16[1000] at 10240
//   A_CHILDREN: u16[1000*3] at 12288 (bytes 12288..18288)
//   HAS_REORDER: u8[1000] at 18432
//   HAS_ATTR:    u8[1000] at 19456
//   HAS_TEXT:    u8[1000] at 20480
//   ITEMS:       u16[1000] at 22528
// RESULTS at 16384 overlaps with the A_CHILDREN region, so we relocate
// A_CHILDREN outside the 16384 window: use base 32768 (byte offset).
const A_TAG_OFFSET: usize = 0;
const A_KEY_OFFSET: usize = 2048;
const A_ATTR_KEY_OFFSET: usize = 4096;
const A_ATTR_VAL_OFFSET: usize = 6144;
const A_TEXT_ID_OFFSET: usize = 8192;
const A_CHILD_COUNT_OFFSET: usize = 10240;
const HAS_REORDER_OFFSET: usize = 12288;
const HAS_ATTR_OFFSET: usize = 13312;
const HAS_TEXT_OFFSET: usize = 14336;
const A_CHILDREN_OFFSET: usize = 32768; // 12000 bytes reserved
const ITEMS_OFFSET: usize = 45056;
const ORDER_SCRATCH_OFFSET: usize = 47104; // reserve MAX_CHILDREN * 2 bytes

let smState: u64 = 0;
let fnv: u32 = 0;

function nextUint32(): u32 {
  smState = smState + 0x9e3779b97f4a7c15;
  let z = smState;
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9;
  z = (z ^ (z >> 27)) * 0x94d049bb133111eb;
  z = z ^ (z >> 31);
  return <u32> (z & 0xffffffff);
}
function nextIntRange(min: i32, max: i32): i32 {
  const span: u32 = <u32> (max - min + 1);
  return min + <i32> (nextUint32() % span);
}

function fnvReset(): void { fnv = 0x811c9dc5; }
function fnvMixByte(b: u8): void {
  fnv ^= <u32> b;
  fnv = fnv * 0x01000193;
}
function fnvMixU16(v: u16): void {
  fnvMixByte(<u8> (v & 0xff));
  fnvMixByte(<u8> ((v >> 8) & 0xff));
}
function fnvMixI16(v: i16): void {
  const u: u16 = <u16> v;
  fnvMixByte(<u8> (u & 0xff));
  fnvMixByte(<u8> ((u >> 8) & 0xff));
}

function getTag(id: i32): i16 { return load<i16>(A_TAG_OFFSET + <usize> id * 2); }
function setTag(id: i32, v: i16): void { store<i16>(A_TAG_OFFSET + <usize> id * 2, v); }
function getKey(id: i32): i16 { return load<i16>(A_KEY_OFFSET + <usize> id * 2); }
function setKey(id: i32, v: i16): void { store<i16>(A_KEY_OFFSET + <usize> id * 2, v); }
function getAttrKey(id: i32): i16 { return load<i16>(A_ATTR_KEY_OFFSET + <usize> id * 2); }
function setAttrKey(id: i32, v: i16): void { store<i16>(A_ATTR_KEY_OFFSET + <usize> id * 2, v); }
function getAttrVal(id: i32): i16 { return load<i16>(A_ATTR_VAL_OFFSET + <usize> id * 2); }
function setAttrVal(id: i32, v: i16): void { store<i16>(A_ATTR_VAL_OFFSET + <usize> id * 2, v); }
function getTextId(id: i32): i16 { return load<i16>(A_TEXT_ID_OFFSET + <usize> id * 2); }
function setTextId(id: i32, v: i16): void { store<i16>(A_TEXT_ID_OFFSET + <usize> id * 2, v); }
function getChildCount(id: i32): u16 { return load<u16>(A_CHILD_COUNT_OFFSET + <usize> id * 2); }
function setChildCount(id: i32, v: u16): void { store<u16>(A_CHILD_COUNT_OFFSET + <usize> id * 2, v); }
function getChild(id: i32, slot: i32): u16 {
  return load<u16>(A_CHILDREN_OFFSET + (<usize> id * MAX_CHILDREN + <usize> slot) * 2);
}
function setChild(id: i32, slot: i32, v: u16): void {
  store<u16>(A_CHILDREN_OFFSET + (<usize> id * MAX_CHILDREN + <usize> slot) * 2, v);
}
function getHas(base: usize, id: i32): u8 { return load<u8>(base + <usize> id); }
function setHas(base: usize, id: i32, v: u8): void { store<u8>(base + <usize> id, v); }
function getItem(idx: i32): u16 { return load<u16>(ITEMS_OFFSET + <usize> idx * 2); }
function setItem(idx: i32, v: u16): void { store<u16>(ITEMS_OFFSET + <usize> idx * 2, v); }

function generateTreeA(): void {
  setTag(0, 0);
  setKey(0, -1);
  setAttrKey(0, 0);
  setAttrVal(0, 1);
  setTextId(0, -1);
  setChildCount(0, 0);
  for (let id = 1; id < NODE_COUNT; id++) {
    const parentId = (id - 1) / 3;
    let isText = false;
    if (id > TEXT_THRESHOLD) isText = nextIntRange(0, 4) === 0;
    const tag: i16 = isText ? -1 : <i16> nextIntRange(0, 6);
    const keyGate = nextIntRange(0, 4);
    const key: i16 = keyGate === 0 ? <i16> nextIntRange(100, 999) : -1;
    const attrKey: i16 = isText ? -1 : <i16> nextIntRange(0, 15);
    const attrVal: i16 = isText ? -1 : <i16> nextIntRange(0, 50);
    const textId: i16 = isText ? <i16> nextIntRange(0, 100) : -1;
    setTag(id, tag);
    setKey(id, key);
    setAttrKey(id, attrKey);
    setAttrVal(id, attrVal);
    setTextId(id, textId);
    setChildCount(id, 0);
    const slot = <i32> getChildCount(parentId);
    setChild(parentId, slot, <u16> id);
    setChildCount(parentId, <u16> (slot + 1));
  }
}

function shuffle(len: i32): void {
  if (len < 2) return;
  let i = len - 1;
  while (i > 0) {
    const j = nextIntRange(0, i);
    const t = getItem(i);
    setItem(i, getItem(j));
    setItem(j, t);
    i--;
  }
}

function filterShuffleMark(predicate: i32, take: i32, flagsBase: usize): void {
  let len = 0;
  for (let id = 0; id < NODE_COUNT; id++) {
    let keep = false;
    if (predicate === 0) keep = getChildCount(id) >= 2;
    else if (predicate === 1) keep = getTag(id) !== -1;
    else keep = getTag(id) === -1;
    if (keep) { setItem(len, <u16> id); len++; }
  }
  shuffle(len);
  const limit = take < len ? take : len;
  for (let i = 0; i < limit; i++) setHas(flagsBase, <i32> getItem(i), 1);
}

function mixTreeBDfs(id: i32): void {
  const isText = getTag(id) === -1;
  let textId = getTextId(id);
  let attrVal = getAttrVal(id);
  if (getHas(HAS_TEXT_OFFSET, id) !== 0 && isText) {
    textId = <i16> (((<i32> getTextId(id)) + 31) % 100);
  }
  if (getHas(HAS_ATTR_OFFSET, id) !== 0 && !isText) {
    attrVal = <i16> (((<i32> getAttrVal(id)) + 17) % 100);
  }
  fnvMixU16(<u16> id);
  fnvMixI16(getTag(id));
  fnvMixI16(getKey(id));
  fnvMixI16(getAttrKey(id));
  fnvMixI16(attrVal);
  fnvMixI16(textId);
  const cc: i32 = <i32> getChildCount(id);
  fnvMixU16(<u16> cc);
  for (let c = 0; c < cc; c++) {
    store<u16>(ORDER_SCRATCH_OFFSET + <usize> c * 2, getChild(id, c));
  }
  if (getHas(HAS_REORDER_OFFSET, id) !== 0 && cc >= 2) {
    const first = load<u16>(ORDER_SCRATCH_OFFSET);
    for (let c = 0; c < cc - 1; c++) {
      store<u16>(
        ORDER_SCRATCH_OFFSET + <usize> c * 2,
        load<u16>(ORDER_SCRATCH_OFFSET + <usize> (c + 1) * 2),
      );
    }
    store<u16>(ORDER_SCRATCH_OFFSET + <usize> (cc - 1) * 2, first);
  }
  for (let c = 0; c < cc; c++) {
    fnvMixU16(load<u16>(ORDER_SCRATCH_OFFSET + <usize> c * 2));
  }
  // recurse — first snapshot the order into a local scratch region
  // (deeper levels reuse ORDER_SCRATCH_OFFSET but we need a copy per frame).
  // Use per-depth offsets in the scratch region.
  // A simpler approach: snapshot into locals via a fixed maximum (MAX_CHILDREN).
  let c0: i32 = -1, c1: i32 = -1, c2: i32 = -1;
  if (cc > 0) c0 = <i32> load<u16>(ORDER_SCRATCH_OFFSET);
  if (cc > 1) c1 = <i32> load<u16>(ORDER_SCRATCH_OFFSET + 2);
  if (cc > 2) c2 = <i32> load<u16>(ORDER_SCRATCH_OFFSET + 4);
  if (c0 >= 0) mixTreeBDfs(c0);
  if (c1 >= 0) mixTreeBDfs(c1);
  if (c2 >= 0) mixTreeBDfs(c2);
}

function mixPatchStream(): void {
  for (let id = 0; id < NODE_COUNT; id++) {
    if (getHas(HAS_TEXT_OFFSET, id) !== 0 && getTag(id) === -1) {
      const newTextId: i16 = <i16> (((<i32> getTextId(id)) + 31) % 100);
      fnvMixByte(1);
      fnvMixU16(<u16> id);
      fnvMixI16(newTextId);
      fnvMixI16(-1);
      fnvMixI16(-1);
      fnvMixI16(-1);
    }
  }
  for (let id = 0; id < NODE_COUNT; id++) {
    if (getHas(HAS_ATTR_OFFSET, id) !== 0 && getTag(id) !== -1) {
      const newAttrVal: i16 = <i16> (((<i32> getAttrVal(id)) + 17) % 100);
      fnvMixByte(2);
      fnvMixU16(<u16> id);
      fnvMixI16(-1);
      fnvMixI16(getAttrKey(id));
      fnvMixI16(newAttrVal);
      fnvMixI16(-1);
    }
  }
  for (let id = 0; id < NODE_COUNT; id++) {
    if (getHas(HAS_REORDER_OFFSET, id) !== 0 && getChildCount(id) >= 2) {
      const cc: i32 = <i32> getChildCount(id);
      for (let c = 0; c < cc; c++) {
        store<u16>(ORDER_SCRATCH_OFFSET + <usize> c * 2, getChild(id, c));
      }
      const first = load<u16>(ORDER_SCRATCH_OFFSET);
      for (let c = 0; c < cc - 1; c++) {
        store<u16>(
          ORDER_SCRATCH_OFFSET + <usize> c * 2,
          load<u16>(ORDER_SCRATCH_OFFSET + <usize> (c + 1) * 2),
        );
      }
      store<u16>(ORDER_SCRATCH_OFFSET + <usize> (cc - 1) * 2, first);
      fnvMixByte(6);
      fnvMixU16(<u16> id);
      fnvMixI16(<i16> cc);
      fnvMixI16(-1);
      fnvMixI16(-1);
      fnvMixI16(<i16> cc);
      fnvMixU16(<u16> cc);
      for (let c = 0; c < cc; c++) {
        fnvMixU16(load<u16>(ORDER_SCRATCH_OFFSET + <usize> c * 2));
      }
    }
  }
}

export function vdom_diff_trace(): i32 {
  for (let i = 0; i < NODE_COUNT; i++) {
    setHas(HAS_REORDER_OFFSET, i, 0);
    setHas(HAS_ATTR_OFFSET, i, 0);
    setHas(HAS_TEXT_OFFSET, i, 0);
  }
  smState = 3976273958;
  generateTreeA();

  filterShuffleMark(0, 100, HAS_REORDER_OFFSET);
  filterShuffleMark(1, 100, HAS_ATTR_OFFSET);
  filterShuffleMark(2, 50, HAS_TEXT_OFFSET);

  let op1: u32 = 0;
  let op2: u32 = 0;
  let op6: u32 = 0;
  for (let id = 0; id < NODE_COUNT; id++) {
    if (getHas(HAS_TEXT_OFFSET, id) !== 0 && getTag(id) === -1) op1++;
    if (getHas(HAS_ATTR_OFFSET, id) !== 0 && getTag(id) !== -1) op2++;
    if (getHas(HAS_REORDER_OFFSET, id) !== 0 && getChildCount(id) >= 2) op6++;
  }
  const patches: u32 = op1 + op2 + op6;

  fnvReset();
  mixTreeBDfs(0);
  const treeBFnv = fnv;
  fnvReset();
  mixPatchStream();
  const patchFnv = fnv;

  store<u32>(RES_OFFSET, patches);
  store<u32>(RES_OFFSET + 4, op1);
  store<u32>(RES_OFFSET + 8, op2);
  store<u32>(RES_OFFSET + 12, op6);
  store<u32>(RES_OFFSET + 16, treeBFnv);
  store<u32>(RES_OFFSET + 20, patchFnv);
  return <i32> patches;
}
