// tactics_kernel.ts — AssemblyScript multilang compute core for
// game.dom-tactics-grid.v1. Same ABI as tactics_kernel.c: the adapter writes
// the frozen 7,064-byte fixture at FIXTURE_OFFSET (3,145,728), passes the
// byte length, and this kernel runs the 60-turn / 240-action tactics loop
// bit-identical to run_tactics() in benchmarks/v2/game-family/game-family.c
// and tactics() in engine.js, then writes counters + digests to RES_OFFSET
// (3,276,800). Raw linear-memory access only (no heap allocation, no runtime
// imports) — mirrors pathfinding_kernel.ts / gc_document_kernel.ts.

// Tactics working-set layout at fixed offsets (all before the FIXTURE_OFFSET
// window at 3 MiB, and small enough to sit comfortably in the first 64 KiB):
//   BFS_QUEUE:    u16[4096]  at 0       (bytes 0..8192)
//   BFS_SEEN:     u16[4096]  at 8192    (bytes 8192..16384)
//   BFS_PARENT:   i16[4096]  at 16384   (bytes 16384..24576)
//   OCCUPANCY:    i16[4096]  at 24576   (bytes 24576..32768)
//   UNIT_HP:      u8[128]    at 32768   (bytes 32768..32896)
//   UNIT_TEAM:    u8[128]    at 32896   (bytes 32896..33024)
//   UNIT_POSITION:u16[128]   at 33024   (bytes 33024..33280)
const BFS_QUEUE: usize = 0;
const BFS_SEEN: usize = 8192;
const BFS_PARENT: usize = 16384;
const OCCUPANCY: usize = 24576;
const UNIT_HP: usize = 32768;
const UNIT_TEAM: usize = 32896;
const UNIT_POSITION: usize = 33024;

// FIXTURE and RES offsets sit past every language's .bss window:
// C/C++ .bss ends well before 1 MiB, Rust's __data_end lands near 2.9 MiB,
// and AS's fixed offsets above occupy < 64 KiB. 3 MiB is safely past all
// three.
const FIXTURE_OFFSET: usize = 3145728;
const RES_OFFSET: usize = 3276800;

let tacticsStamp: u32 = 0;
let tacticsState: u32 = 0;
let tacticsExpanded: u32 = 0;
let tacticsLos: u32 = 0;

// --- Accessors -------------------------------------------------------------
function fixtureAt(off: u32): u8 {
  return load<u8>(FIXTURE_OFFSET + (<usize> off));
}
function read16(at: u32): u32 {
  return (<u32> fixtureAt(at)) | ((<u32> fixtureAt(at + 1)) << 8);
}
function read32(at: u32): u32 {
  return read16(at) | (read16(at + 2) << 16);
}
function mix(h: u32, v: u32): u32 {
  return ((h ^ v) * 0x01000193) >>> 0;
}
function absolute(v: i32): u32 {
  return v < 0 ? (<u32> -v) : (<u32> v);
}

function bfsQueueSet(i: u32, v: u16): void {
  store<u16>(BFS_QUEUE + (<usize> i) * 2, v);
}
function bfsQueueGet(i: u32): u16 {
  return load<u16>(BFS_QUEUE + (<usize> i) * 2);
}
function bfsSeenGet(i: u32): u16 {
  return load<u16>(BFS_SEEN + (<usize> i) * 2);
}
function bfsSeenSet(i: u32, v: u16): void {
  store<u16>(BFS_SEEN + (<usize> i) * 2, v);
}
function bfsParentGet(i: u32): i16 {
  return load<i16>(BFS_PARENT + (<usize> i) * 2);
}
function bfsParentSet(i: u32, v: i16): void {
  store<i16>(BFS_PARENT + (<usize> i) * 2, v);
}
function occupancyGet(i: u32): i16 {
  return load<i16>(OCCUPANCY + (<usize> i) * 2);
}
function occupancySet(i: u32, v: i16): void {
  store<i16>(OCCUPANCY + (<usize> i) * 2, v);
}
function unitHpGet(i: u32): u8 {
  return load<u8>(UNIT_HP + (<usize> i));
}
function unitHpSet(i: u32, v: u8): void {
  store<u8>(UNIT_HP + (<usize> i), v);
}
function unitTeamGet(i: u32): u8 {
  return load<u8>(UNIT_TEAM + (<usize> i));
}
function unitTeamSet(i: u32, v: u8): void {
  store<u8>(UNIT_TEAM + (<usize> i), v);
}
function unitPositionGet(i: u32): u16 {
  return load<u16>(UNIT_POSITION + (<usize> i) * 2);
}
function unitPositionSet(i: u32, v: u16): void {
  store<u16>(UNIT_POSITION + (<usize> i) * 2, v);
}

// --- BFS pathfinding -------------------------------------------------------
function tacticsPath(start: u32, goal: u32, mapOffset: u32): bool {
  tacticsStamp = (tacticsStamp + 1) & 0xffff;
  const stamp: u16 = <u16> tacticsStamp;
  let head: u32 = 0;
  let tail: u32 = 1;
  bfsQueueSet(0, <u16> start);
  bfsSeenSet(start, stamp);
  bfsParentSet(start, -1);
  while (head < tail) {
    const node: u32 = <u32> bfsQueueGet(head);
    head++;
    tacticsExpanded++;
    if (node == goal) break;
    const x: u32 = node & 63;
    const y: u32 = node >>> 6;
    for (let i: u32 = 0; i < 4; i++) {
      let signedNext: i32 = -1;
      if (i == 0) { if (y > 0) signedNext = <i32> node - 64; }
      else if (i == 1) { if (x > 0) signedNext = <i32> node - 1; }
      else if (i == 2) { if (x < 63) signedNext = <i32> node + 1; }
      else if (y < 63) signedNext = <i32> node + 64;
      if (signedNext < 0) continue;
      const next: u32 = <u32> signedNext;
      if (
        bfsSeenGet(next) == stamp ||
        fixtureAt(mapOffset + next) == 3 ||
        (occupancyGet(next) >= 0 && next != goal)
      ) continue;
      bfsSeenSet(next, stamp);
      bfsParentSet(next, <i16> node);
      bfsQueueSet(tail, <u16> next);
      tail++;
    }
  }
  if (bfsSeenGet(goal) != stamp) return false;
  let node: i32 = <i32> goal;
  while (node >= 0) {
    tacticsState = mix(tacticsState, <u32> node);
    node = <i32> bfsParentGet(<u32> node);
  }
  return true;
}

// --- Bresenham line-of-sight ----------------------------------------------
function tacticsLosVisible(start: u32, goal: u32, mapOffset: u32): bool {
  let x0: i32 = <i32> (start & 63);
  let y0: i32 = <i32> (start >>> 6);
  const x1: i32 = <i32> (goal & 63);
  const y1: i32 = <i32> (goal >>> 6);
  const dx: i32 = <i32> absolute(x1 - x0);
  const sx: i32 = x0 < x1 ? 1 : -1;
  const dy: i32 = -(<i32> absolute(y1 - y0));
  const sy: i32 = y0 < y1 ? 1 : -1;
  let error: i32 = dx + dy;
  while (true) {
    tacticsLos++;
    const node: u32 = <u32> (x0 + y0 * 64);
    if (node != start && node != goal && fixtureAt(mapOffset + node) == 3) return false;
    if (x0 == x1 && y0 == y1) return true;
    const twice: i32 = 2 * error;
    if (twice >= dy) {
      error += dy;
      x0 += sx;
    }
    if (twice <= dx) {
      error += dx;
      y0 += sy;
    }
  }
}

// --- Public entry point ---------------------------------------------------
export function tactics_trace(fixture_len: u32): i32 {
  if (fixture_len != 7064) return 1;
  if (read32(0) != 64 || read32(8) != 128) return 2;

  for (let cell: u32 = 0; cell < 4096; cell++) {
    bfsSeenSet(cell, 0);
    occupancySet(cell, -1);
  }

  const mapOffset: u32 = 24;
  const unitOffset: u32 = mapOffset + 4096;
  const actionOffset: u32 = unitOffset + 128 * 8;

  for (let unit: u32 = 0; unit < 128; unit++) {
    const at = unitOffset + unit * 8;
    unitPositionSet(unit, <u16> (read16(at) + read16(at + 2) * 64));
    unitHpSet(unit, fixtureAt(at + 4));
    unitTeamSet(unit, <u8> (fixtureAt(at + 5) & 1));
    const pos: u32 = <u32> unitPositionGet(unit);
    if (occupancyGet(pos) < 0) occupancySet(pos, <i16> unit);
  }

  tacticsStamp = 0;
  tacticsState = 0x5d7219af;
  tacticsExpanded = 0;
  tacticsLos = 0;
  let turns: u32 = 0;
  let updates: u32 = 0;
  let mutations: u32 = 0;
  let selected: u32 = <u32> unitPositionGet(0);
  let focused: u32 = selected;
  let initiative: u32 = 0;

  let finalUnitDigest: u32 = 0;
  let finalOccupancyDigest: u32 = 0;
  let finalInitiativeDigest: u32 = 0;
  let finalObjectiveDigest: u32 = 0;
  let finalDomDigest: u32 = 0;
  let finalFocusDigest: u32 = 0;
  let finalAccessibilityDigest: u32 = 0;

  for (let action: u32 = 0; action < 240; action++) {
    const at = actionOffset + action * 8;
    const type: u32 = <u32> fixtureAt(at);
    const unit: u32 = <u32> fixtureAt(at + 1);
    const from: u32 = read16(at + 2);
    const target: u32 = read16(at + 4);
    const turnId: u32 = read16(at + 6);

    if ((action & 3) == 0) {
      turns++;
      initiative = (turnId * 7) & 127;
      mutations++;
    }
    if (type == 0) {
      selected = <u32> unitPositionGet(unit);
      focused = selected;
      updates++;
      mutations += 2;
    }
    if (type == 1) {
      const pos: u32 = <u32> unitPositionGet(unit);
      const pathOk: bool = tacticsPath(pos, target, mapOffset);
      const occTarget: i16 = occupancyGet(target);
      if (pathOk && (occTarget < 0 || <u32> occTarget == unit)) {
        const oldPos: u32 = <u32> unitPositionGet(unit);
        if (<u32> occupancyGet(oldPos) == unit) occupancySet(oldPos, -1);
        unitPositionSet(unit, <u16> target);
        occupancySet(target, <i16> unit);
        selected = target;
        focused = target;
        updates++;
        mutations += 3;
      }
    }
    if ((type == 2 || type == 4) && tacticsLosVisible(from, target, mapOffset)) {
      const targetUnit: i32 = <i32> occupancyGet(target);
      if (targetUnit >= 0) {
        const damage: u32 = type == 4 ? 3 : 1;
        const hp: u32 = <u32> unitHpGet(<u32> targetUnit);
        unitHpSet(<u32> targetUnit, hp > damage ? <u8> (hp - damage) : 0);
        updates++;
        mutations++;
      }
    }
    if (type == 3) {
      initiative = (initiative + 1) & 127;
      mutations++;
    }
    tacticsState = mix(
      tacticsState,
      type ^ unit ^ (<u32> unitHpGet(unit)) ^ (<u32> unitPositionGet(unit)) ^ selected ^ turnId,
    );

    if (((action + 1) & 3) == 0) {
      let unitDigest: u32 = 0x9216d5d9;
      let occupancyDigest: u32 = 0x8979fb1b;
      let initiativeDigest: u32 = mix(0xd1310ba6, initiative);
      let objectiveDigest: u32 = 0x98dfb5ac;
      let domDigest: u32 = 0x2ffd72db;
      const focusDigest: u32 = mix(0xd01adfb7, focused);
      let accessibilityDigest: u32 = 0xb8e1afed;
      let objectives0: u32 = 0;
      let objectives1: u32 = 0;

      for (let i: u32 = 0; i < 128; i++) {
        unitDigest = mix(
          mix(mix(unitDigest, i), <u32> unitPositionGet(i)),
          (<u32> unitHpGet(i)) ^ ((<u32> unitTeamGet(i)) << 8),
        );
        initiativeDigest = mix(initiativeDigest, (i + initiative) & 127);
        if (fixtureAt(mapOffset + (<u32> unitPositionGet(i))) == 2 && unitHpGet(i) > 0) {
          if (unitTeamGet(i) != 0) objectives1++;
          else objectives0++;
        }
      }
      objectiveDigest = mix(mix(objectiveDigest, objectives0), objectives1);
      for (let cell: u32 = 0; cell < 4096; cell++) {
        const occupant: i32 = <i32> occupancyGet(cell);
        const isSelected: u32 = cell == selected ? 1 : 0;
        const isFocused: u32 = cell == focused ? 1 : 0;
        occupancyDigest = mix(
          occupancyDigest,
          occupant < 0 ? 0xffffffff : <u32> occupant,
        );
        domDigest = mix(
          mix(mix(domDigest, cell), <u32> fixtureAt(mapOffset + cell)),
          (<u32> (occupant + 1)) ^ (isSelected << 16) ^ (isFocused << 17),
        );
        const unitState: u32 = occupant < 0
          ? 0
          : (<u32> unitHpGet(<u32> occupant)) ^ ((<u32> unitTeamGet(<u32> occupant)) << 8);
        accessibilityDigest = mix(
          mix(accessibilityDigest, 0x67726964),
          isSelected ^ (isFocused << 1) ^ (unitState << 2),
        );
      }

      tacticsState = mix(tacticsState, unitDigest);
      tacticsState = mix(tacticsState, occupancyDigest);
      tacticsState = mix(tacticsState, initiativeDigest);
      tacticsState = mix(tacticsState, objectiveDigest);
      tacticsState = mix(tacticsState, domDigest);
      tacticsState = mix(tacticsState, focusDigest);
      tacticsState = mix(tacticsState, accessibilityDigest);
      mutations += 2;

      finalUnitDigest = unitDigest;
      finalOccupancyDigest = occupancyDigest;
      finalInitiativeDigest = initiativeDigest;
      finalObjectiveDigest = objectiveDigest;
      finalDomDigest = domDigest;
      finalFocusDigest = focusDigest;
      finalAccessibilityDigest = accessibilityDigest;
    }
  }

  store<u32>(RES_OFFSET, tacticsState);
  store<u32>(RES_OFFSET + 4, finalUnitDigest);
  store<u32>(RES_OFFSET + 8, finalOccupancyDigest);
  store<u32>(RES_OFFSET + 12, finalInitiativeDigest);
  store<u32>(RES_OFFSET + 16, finalObjectiveDigest);
  store<u32>(RES_OFFSET + 20, finalDomDigest);
  store<u32>(RES_OFFSET + 24, finalFocusDigest);
  store<u32>(RES_OFFSET + 28, finalAccessibilityDigest);
  store<u32>(RES_OFFSET + 32, turns);
  store<u32>(RES_OFFSET + 36, tacticsExpanded);
  store<u32>(RES_OFFSET + 40, tacticsLos);
  store<u32>(RES_OFFSET + 44, updates);
  store<u32>(RES_OFFSET + 48, mutations);
  return 0;
}
