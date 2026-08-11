// grid_trace_kernel.ts — AssemblyScript multilang compute core for
// dom.virtualized-grid.v1. Same ABI as grid_trace_kernel.c: the adapter
// writes the frozen 1,604,864-byte fixture at FIXTURE_OFFSET (3,145,728),
// passes the byte length, and this kernel replays the 300-event trace
// bit-identical to createJavaScriptGridExecution() in
// benchmarks/base/dom-virtualized-grid/engine.js, then writes the FNV-1a
// commandDigest + counters + final checkpoint to RES_OFFSET (5,242,880).
// Raw linear-memory access only (no heap allocation, no runtime imports).

// Fixed offsets for all working arrays (all before FIXTURE_OFFSET at 3 MiB):
//   SCORES:    i32[100_000]  @ 0        (bytes 0..400_000)
//   GROUPS:    u32[100_000]  @ 400_000  (bytes 400_000..800_000)
//   ORDER:     u32[100_000]  @ 800_000  (bytes 800_000..1_200_000)
//   SCRATCH:   u32[100_000]  @ 1_200_000
//   FILTERED:  u32[100_000]  @ 1_600_000
//   SLOT arrays (5 × 28 × 4B = 560B) starting at 2_000_000
const SCORES: usize = 0;
const GROUPS: usize = 400000;
const ORDER: usize = 800000;
const SCRATCH: usize = 1200000;
const FILTERED: usize = 1600000;
const SLOT_ROWS: usize = 2000000;
const SLOT_SCORES: usize = 2000000 + 28 * 4;
const SLOT_INDEXES: usize = 2000000 + 28 * 8;
const SLOT_SELECTED: usize = 2000000 + 28 * 12;
const SLOT_POSITIONS: usize = 2000000 + 28 * 16;
// Reconcile scratch buffers (raw load/store, no runtime allocation).
const VISIBLE_SCRATCH: usize = 2000000 + 28 * 20; // 28 u32
const USED_SCRATCH: usize = 2000000 + 28 * 24;    // 28 u32

// FIXTURE and RES offsets sit past every language's .bss window.
const FIXTURE_OFFSET: usize = 3145728;
const RES_OFFSET: usize = 5242880;

const ROWS: u32 = 100000;
const ACTIONS: u32 = 300;
const HEADER_BYTES: u32 = 64;
const ROW_BYTES: u32 = 16;
const ACTION_BYTES: u32 = 16;
const MAGIC: u32 = 0x31445247;
const EMPTY: u32 = 0xffffffff;
const MAX_MOUNTED: u32 = 28;

let commandDigest: u32 = 0;
let commandCount: u32 = 0;
let rowsScanned: u32 = 0;
let comparisons: u32 = 0;
let events: u32 = 0;
let physicalCreates: u32 = 0;
let physicalReuses: u32 = 0;
let physicalUpdates: u32 = 0;
let physicalPlacements: u32 = 0;
let physicalHides: u32 = 0;
let focusOperations: u32 = 0;
let layoutReads: u32 = 0;
let filteredLength: u32 = 0;
let finalStart: u32 = 0;
let finalEnd: u32 = 0;
let finalVisibleLength: u32 = 0;
let focused: u32 = 0;
let selected: u32 = 0;
let filterGroup: u32 = 0;
let scrollOffset: u32 = 0;
let slotCount: u32 = 0;

// --- Accessors -------------------------------------------------------------
function fixtureAt(off: u32): u8 {
  return load<u8>(FIXTURE_OFFSET + (<usize> off));
}
function read32(at: u32): u32 {
  return (<u32> fixtureAt(at)) |
    ((<u32> fixtureAt(at + 1)) << 8) |
    ((<u32> fixtureAt(at + 2)) << 16) |
    ((<u32> fixtureAt(at + 3)) << 24);
}

function scoresGet(i: u32): i32 {
  return load<i32>(SCORES + (<usize> i) * 4);
}
function scoresSet(i: u32, v: i32): void {
  store<i32>(SCORES + (<usize> i) * 4, v);
}
function groupsGet(i: u32): u32 {
  return load<u32>(GROUPS + (<usize> i) * 4);
}
function groupsSet(i: u32, v: u32): void {
  store<u32>(GROUPS + (<usize> i) * 4, v);
}
function orderGet(i: u32): u32 {
  return load<u32>(ORDER + (<usize> i) * 4);
}
function orderSet(i: u32, v: u32): void {
  store<u32>(ORDER + (<usize> i) * 4, v);
}
function scratchGet(i: u32): u32 {
  return load<u32>(SCRATCH + (<usize> i) * 4);
}
function scratchSet(i: u32, v: u32): void {
  store<u32>(SCRATCH + (<usize> i) * 4, v);
}
function filteredGet(i: u32): u32 {
  return load<u32>(FILTERED + (<usize> i) * 4);
}
function filteredSet(i: u32, v: u32): void {
  store<u32>(FILTERED + (<usize> i) * 4, v);
}
function slotRowsGet(i: u32): u32 {
  return load<u32>(SLOT_ROWS + (<usize> i) * 4);
}
function slotRowsSet(i: u32, v: u32): void {
  store<u32>(SLOT_ROWS + (<usize> i) * 4, v);
}
function slotScoresGet(i: u32): i32 {
  return load<i32>(SLOT_SCORES + (<usize> i) * 4);
}
function slotScoresSet(i: u32, v: i32): void {
  store<i32>(SLOT_SCORES + (<usize> i) * 4, v);
}
function slotIndexesGet(i: u32): u32 {
  return load<u32>(SLOT_INDEXES + (<usize> i) * 4);
}
function slotIndexesSet(i: u32, v: u32): void {
  store<u32>(SLOT_INDEXES + (<usize> i) * 4, v);
}
function slotSelectedGet(i: u32): u32 {
  return load<u32>(SLOT_SELECTED + (<usize> i) * 4);
}
function slotSelectedSet(i: u32, v: u32): void {
  store<u32>(SLOT_SELECTED + (<usize> i) * 4, v);
}
function slotPositionsGet(i: u32): u32 {
  return load<u32>(SLOT_POSITIONS + (<usize> i) * 4);
}
function slotPositionsSet(i: u32, v: u32): void {
  store<u32>(SLOT_POSITIONS + (<usize> i) * 4, v);
}

function hashU32(value: u32): void {
  for (let i: u32 = 0; i < 4; i++) {
    commandDigest = (commandDigest ^ (value & 0xff)) >>> 0;
    commandDigest = (commandDigest * 0x01000193) >>> 0;
    value = value >>> 8;
  }
}
function emit(op: u32, a: u32, b: u32, c: u32, d: u32, e: u32): void {
  hashU32(op);
  hashU32(a);
  hashU32(b);
  hashU32(c);
  hashU32(d);
  hashU32(e);
  commandCount++;
}

function compareRows(a: u32, b: u32, direction: u32): i32 {
  const sa: i32 = scoresGet(a);
  const sb: i32 = scoresGet(b);
  if (sa != sb) {
    return direction != 0 ? sb - sa : sa - sb;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function rebuildFilter(fg: u32): void {
  filteredLength = 0;
  for (let i: u32 = 0; i < ROWS; i++) {
    const row = orderGet(i);
    rowsScanned++;
    if (fg == EMPTY || groupsGet(row) == fg) {
      filteredSet(filteredLength, row);
      filteredLength++;
    }
  }
}

// stable merge sort with two buffers, alternating source/target between
// ORDER and SCRATCH — matches engine.js's swap-based approach exactly.
function stableSort(direction: u32, fg: u32): void {
  let sourceIsOrder: bool = true;
  let width: u32 = 1;
  while (width < ROWS) {
    let left: u32 = 0;
    while (left < ROWS) {
      const middle: u32 = left + width < ROWS ? left + width : ROWS;
      const right: u32 = left + width * 2 < ROWS ? left + width * 2 : ROWS;
      let i: u32 = left, j: u32 = middle, out: u32 = left;
      while (i < middle && j < right) {
        comparisons++;
        const srcI = sourceIsOrder ? orderGet(i) : scratchGet(i);
        const srcJ = sourceIsOrder ? orderGet(j) : scratchGet(j);
        if (compareRows(srcI, srcJ, direction) <= 0) {
          if (sourceIsOrder) scratchSet(out, srcI);
          else orderSet(out, srcI);
          out++;
          i++;
        } else {
          if (sourceIsOrder) scratchSet(out, srcJ);
          else orderSet(out, srcJ);
          out++;
          j++;
        }
      }
      while (i < middle) {
        const v = sourceIsOrder ? orderGet(i) : scratchGet(i);
        if (sourceIsOrder) scratchSet(out, v);
        else orderSet(out, v);
        out++;
        i++;
      }
      while (j < right) {
        const v = sourceIsOrder ? orderGet(j) : scratchGet(j);
        if (sourceIsOrder) scratchSet(out, v);
        else orderSet(out, v);
        out++;
        j++;
      }
      left += width * 2;
    }
    sourceIsOrder = !sourceIsOrder;
    width *= 2;
  }
  if (!sourceIsOrder) {
    for (let i: u32 = 0; i < ROWS; i++) orderSet(i, scratchGet(i));
  }
  rebuildFilter(fg);
}

function visibleScratchGet(i: u32): u32 {
  return load<u32>(VISIBLE_SCRATCH + (<usize> i) * 4);
}
function visibleScratchSet(i: u32, v: u32): void {
  store<u32>(VISIBLE_SCRATCH + (<usize> i) * 4, v);
}
function usedScratchGet(i: u32): u32 {
  return load<u32>(USED_SCRATCH + (<usize> i) * 4);
}
function usedScratchSet(i: u32, v: u32): void {
  store<u32>(USED_SCRATCH + (<usize> i) * 4, v);
}

function visibleIndexOf(row: u32, length: u32): i32 {
  for (let i: u32 = 0; i < length; i++) {
    if (visibleScratchGet(i) == row) return <i32> i;
  }
  return -1;
}

function reconcile(actionIndex: u32): void {
  const visibleRows: u32 = 20;
  const overscan: u32 = 4;
  const quotient: u32 = scrollOffset / 24;
  const base: u32 = filteredLength < quotient ? filteredLength : quotient;
  const start: u32 = base > overscan ? base - overscan : 0;
  const upper: u32 = base + visibleRows + overscan;
  const end: u32 = upper < filteredLength ? upper : filteredLength;
  const visibleLength: u32 = end - start;

  for (let i: u32 = 0; i < MAX_MOUNTED; i++) usedScratchSet(i, 0);
  for (let i: u32 = 0; i < visibleLength; i++) {
    visibleScratchSet(i, filteredGet(start + i));
  }

  for (let position: u32 = 0; position < visibleLength; position++) {
    const row: u32 = visibleScratchGet(position);
    let slot: i32 = -1;
    for (let candidate: u32 = 0; candidate < slotCount; candidate++) {
      if (slotRowsGet(candidate) == row) { slot = <i32> candidate; break; }
    }
    const isSelected: u32 = row == selected ? 1 : 0;
    if (slot < 0) {
      for (let candidate: u32 = 0; candidate < slotCount; candidate++) {
        if (
          visibleIndexOf(slotRowsGet(candidate), visibleLength) < 0 &&
          usedScratchGet(candidate) == 0
        ) { slot = <i32> candidate; break; }
      }
      if (slot < 0) {
        if (slotCount >= MAX_MOUNTED) return;
        slot = <i32> slotCount;
        slotCount++;
        emit(1, <u32> slot, row, start + position, <u32> scoresGet(row), isSelected);
        physicalCreates++;
      } else {
        emit(2, <u32> slot, row, start + position, <u32> scoresGet(row), isSelected);
        physicalReuses++;
      }
      slotRowsSet(<u32> slot, row);
      slotScoresSet(<u32> slot, scoresGet(row));
      slotIndexesSet(<u32> slot, start + position);
      slotSelectedSet(<u32> slot, isSelected);
    } else {
      const sSlot: i32 = slotScoresGet(<u32> slot);
      const iSlot: u32 = slotIndexesGet(<u32> slot);
      const selSlot: u32 = slotSelectedGet(<u32> slot);
      const rScore: i32 = scoresGet(row);
      if (sSlot != rScore || iSlot != start + position || selSlot != isSelected) {
        emit(3, <u32> slot, row, start + position, <u32> rScore, isSelected);
        physicalUpdates++;
        slotScoresSet(<u32> slot, rScore);
        slotIndexesSet(<u32> slot, start + position);
        slotSelectedSet(<u32> slot, isSelected);
      }
    }
    usedScratchSet(<u32> slot, 1);
    if (slotPositionsGet(<u32> slot) != position) {
      emit(4, <u32> slot, position, row, start + position, 0);
      physicalPlacements++;
      slotPositionsSet(<u32> slot, position);
    }
  }
  for (let slot: u32 = 0; slot < slotCount; slot++) {
    if (usedScratchGet(slot) == 0 && slotRowsGet(slot) != EMPTY) {
      emit(5, slot, slotRowsGet(slot), 0, 0, 0);
      physicalHides++;
      slotRowsSet(slot, EMPTY);
      slotPositionsSet(slot, EMPTY);
    }
  }
  for (let slot: u32 = 0; slot < slotCount; slot++) {
    if (slotRowsGet(slot) == focused) {
      emit(6, slot, focused, 0, 0, 0);
      focusOperations++;
      break;
    }
  }
  emit(7, actionIndex, visibleLength, start, end, filteredLength);
  layoutReads++;
  finalStart = start;
  finalEnd = end;
  finalVisibleLength = visibleLength;
}

export function grid_trace(fixture_len: u32): i32 {
  const fixtureBytes: u32 = HEADER_BYTES + ROWS * ROW_BYTES + ACTIONS * ACTION_BYTES;
  if (fixture_len != fixtureBytes) return 1;
  if (
    read32(0) != MAGIC || read32(4) != 1 ||
    read32(8) != ROWS || read32(12) != ACTIONS
  ) return 2;

  commandDigest = 0x811c9dc5;
  commandCount = 0;
  rowsScanned = 0;
  comparisons = 0;
  events = 0;
  physicalCreates = 0;
  physicalReuses = 0;
  physicalUpdates = 0;
  physicalPlacements = 0;
  physicalHides = 0;
  focusOperations = 0;
  layoutReads = 0;
  filteredLength = ROWS;
  focused = EMPTY;
  selected = EMPTY;
  filterGroup = EMPTY;
  scrollOffset = 0;
  slotCount = 0;
  for (let i: u32 = 0; i < MAX_MOUNTED; i++) {
    slotRowsSet(i, EMPTY);
    slotIndexesSet(i, EMPTY);
    slotPositionsSet(i, EMPTY);
    slotSelectedSet(i, 0);
    slotScoresSet(i, 0);
  }

  let rowOffset: u32 = HEADER_BYTES;
  for (let i: u32 = 0; i < ROWS; i++) {
    const id: u32 = read32(rowOffset);
    if (id != i) return 3;
    scoresSet(id, <i32> read32(rowOffset + 4));
    groupsSet(id, read32(rowOffset + 8));
    orderSet(i, id);
    filteredSet(i, id);
    rowOffset += ROW_BYTES;
  }

  const actionOffset: u32 = HEADER_BYTES + ROWS * ROW_BYTES;
  for (let action: u32 = 0; action < ACTIONS; action++) {
    const at: u32 = actionOffset + action * ACTION_BYTES;
    if (read32(at) != action * 100) return 4;
    const type: u32 = read32(at + 4);
    const a: u32 = read32(at + 8);
    const b: u32 = read32(at + 12);
    if (type == 0) {
      const maxOffset: u32 = filteredLength > 20 ? (filteredLength - 20) * 24 : 0;
      scrollOffset = a < maxOffset ? a : maxOffset;
    } else if (type == 1) {
      filterGroup = a;
      rebuildFilter(filterGroup);
      scrollOffset = 0;
    } else if (type == 2) {
      stableSort(a & 1, filterGroup);
    } else if (type == 3) {
      if (a >= ROWS) return 5;
      scoresSet(a, <i32> b);
      selected = a;
    } else if (type == 4) {
      if (a == EMPTY) {
        const quot: u32 = scrollOffset / 24;
        let basePos: u32 = quot + 5;
        if (basePos >= filteredLength) basePos = filteredLength - 1;
        focused = filteredGet(basePos);
      } else {
        if (a >= ROWS) return 6;
        focused = a;
      }
      selected = focused;
    } else return 7;
    events++;
    reconcile(action);
  }

  store<u32>(RES_OFFSET, commandDigest);
  store<u32>(RES_OFFSET + 4, rowsScanned);
  store<u32>(RES_OFFSET + 8, comparisons);
  store<u32>(RES_OFFSET + 12, events);
  store<u32>(RES_OFFSET + 16, commandCount);
  store<u32>(RES_OFFSET + 20, physicalCreates);
  store<u32>(RES_OFFSET + 24, physicalReuses);
  store<u32>(RES_OFFSET + 28, physicalUpdates);
  store<u32>(RES_OFFSET + 32, physicalPlacements);
  store<u32>(RES_OFFSET + 36, physicalHides);
  store<u32>(RES_OFFSET + 40, focusOperations);
  store<u32>(RES_OFFSET + 44, layoutReads);
  store<u32>(RES_OFFSET + 48, finalStart);
  store<u32>(RES_OFFSET + 52, finalEnd);
  store<u32>(RES_OFFSET + 56, finalVisibleLength);
  store<u32>(RES_OFFSET + 60, focused);
  store<u32>(RES_OFFSET + 64, selected);
  store<u32>(RES_OFFSET + 68, filteredLength);
  return 0;
}
