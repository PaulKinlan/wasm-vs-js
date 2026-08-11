// pathfinding_kernel.ts — AssemblyScript multilang compute core for
// game.canvas-entity-pathfinding.v1. Same ABI as pathfinding_kernel.c: the
// adapter writes the frozen 106,552-byte fixture at FIXTURE_OFFSET
// (3,145,728), passes the byte length, and this kernel runs 128 A* requests
// + a 1,800-frame ECS loop bit-identical to run_pathfinding() in
// benchmarks/v2/game-family/game-family.c and pathfinding() in engine.js,
// then writes counters + digests to RES_OFFSET (3,276,800). Raw
// linear-memory access only (no heap allocation, no runtime imports) —
// mirrors gc_document_kernel.ts.

const HEAP_CAPACITY: u32 = 131072;

// A* + heap + entity working-set layout at fixed offsets (all before the
// FIXTURE_OFFSET window at 3 MiB):
//   ASTAR_G:       i32[65536]   at 0        (bytes 0..262144)
//   ASTAR_PARENT:  i32[65536]   at 262144   (bytes 262144..524288)
//   ASTAR_SEEN:    u16[65536]   at 524288   (bytes 524288..655360)
//   ASTAR_CLOSED:  u16[65536]   at 655360   (bytes 655360..786432)
//   HEAP_NODE:     u32[131072]  at 786432   (bytes 786432..1310720)
//   HEAP_F:        u32[131072]  at 1310720  (bytes 1310720..1835008)
//   ENTITY_X:      u16[4096]    at 1835008  (bytes 1835008..1843200)
//   ENTITY_Y:      u16[4096]    at 1843200  (bytes 1843200..1851392)
//   ENTITY_VX:     i8[4096]     at 1851392  (bytes 1851392..1855488)
//   ENTITY_VY:     i8[4096]     at 1855488  (bytes 1855488..1859584)
const ASTAR_G: usize = 0;
const ASTAR_PARENT: usize = 262144;
const ASTAR_SEEN: usize = 524288;
const ASTAR_CLOSED: usize = 655360;
const HEAP_NODE: usize = 786432;
const HEAP_F: usize = 1310720;
const ENTITY_X: usize = 1835008;
const ENTITY_Y: usize = 1843200;
const ENTITY_VX: usize = 1851392;
const ENTITY_VY: usize = 1855488;

// FIXTURE and RES offsets sit past every language's .bss window:
// C/C++ .bss ends around 1.9 MiB, Rust's __data_end lands near 2.9 MiB, and
// AS's fixed offsets above occupy < 1.9 MiB. 3 MiB is safely past all three.
const FIXTURE_OFFSET: usize = 3145728;
const RES_OFFSET: usize = 3276800;

let heapLength: u32 = 0;

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

function astarGGet(i: u32): i32 {
  return load<i32>(ASTAR_G + (<usize> i) * 4);
}
function astarGSet(i: u32, v: i32): void {
  store<i32>(ASTAR_G + (<usize> i) * 4, v);
}
function astarParentGet(i: u32): i32 {
  return load<i32>(ASTAR_PARENT + (<usize> i) * 4);
}
function astarParentSet(i: u32, v: i32): void {
  store<i32>(ASTAR_PARENT + (<usize> i) * 4, v);
}
function astarSeenGet(i: u32): u16 {
  return load<u16>(ASTAR_SEEN + (<usize> i) * 2);
}
function astarSeenSet(i: u32, v: u16): void {
  store<u16>(ASTAR_SEEN + (<usize> i) * 2, v);
}
function astarClosedGet(i: u32): u16 {
  return load<u16>(ASTAR_CLOSED + (<usize> i) * 2);
}
function astarClosedSet(i: u32, v: u16): void {
  store<u16>(ASTAR_CLOSED + (<usize> i) * 2, v);
}
function heapNodeGet(i: u32): u32 {
  return load<u32>(HEAP_NODE + (<usize> i) * 4);
}
function heapNodeSet(i: u32, v: u32): void {
  store<u32>(HEAP_NODE + (<usize> i) * 4, v);
}
function heapFGet(i: u32): u32 {
  return load<u32>(HEAP_F + (<usize> i) * 4);
}
function heapFSet(i: u32, v: u32): void {
  store<u32>(HEAP_F + (<usize> i) * 4, v);
}
function entityXGet(i: u32): u16 {
  return load<u16>(ENTITY_X + (<usize> i) * 2);
}
function entityXSet(i: u32, v: u16): void {
  store<u16>(ENTITY_X + (<usize> i) * 2, v);
}
function entityYGet(i: u32): u16 {
  return load<u16>(ENTITY_Y + (<usize> i) * 2);
}
function entityYSet(i: u32, v: u16): void {
  store<u16>(ENTITY_Y + (<usize> i) * 2, v);
}
function entityVxGet(i: u32): i8 {
  return load<i8>(ENTITY_VX + (<usize> i));
}
function entityVxSet(i: u32, v: i8): void {
  store<i8>(ENTITY_VX + (<usize> i), v);
}
function entityVyGet(i: u32): i8 {
  return load<i8>(ENTITY_VY + (<usize> i));
}
function entityVySet(i: u32, v: i8): void {
  store<i8>(ENTITY_VY + (<usize> i), v);
}

// --- Heap ------------------------------------------------------------------
function heapLess(af: u32, an: u32, bf: u32, bn: u32): bool {
  return af != bf ? af < bf : an < bn;
}
function heapPush(node: u32, f: u32, operations: u32): u32 {
  // Returns the new `operations` count; heap overflow is turned into a return
  // of u32.MAX (caller checks by comparing against expected max) — but we
  // sized HEAP_CAPACITY generously so we never overflow.
  if (heapLength >= HEAP_CAPACITY) return 0xffffffff;
  operations = (operations + 1) >>> 0;
  let index: u32 = heapLength;
  heapLength++;
  while (index > 0) {
    const up: u32 = (index - 1) >> 1;
    if (!heapLess(f, node, heapFGet(up), heapNodeGet(up))) break;
    heapFSet(index, heapFGet(up));
    heapNodeSet(index, heapNodeGet(up));
    index = up;
  }
  heapFSet(index, f);
  heapNodeSet(index, node);
  return operations;
}
function heapPop(operations: u32): u64 {
  // Packs (popped node in lo32, updated operations count in hi32). The caller
  // captures heapFGet(0) BEFORE calling heapPop to keep the popped-f for the
  // tie-break digest.
  operations = (operations + 1) >>> 0;
  const firstNode = heapNodeGet(0);
  heapLength--;
  const lastIndex = heapLength;
  if (heapLength > 0) {
    const lastNode = heapNodeGet(lastIndex);
    const lastF = heapFGet(lastIndex);
    let index: u32 = 0;
    while (true) {
      const left: u32 = index * 2 + 1;
      if (left >= heapLength) break;
      const right: u32 = left + 1;
      let child: u32 = left;
      if (
        right < heapLength &&
        heapLess(heapFGet(right), heapNodeGet(right), heapFGet(left), heapNodeGet(left))
      ) child = right;
      if (!heapLess(heapFGet(child), heapNodeGet(child), lastF, lastNode)) break;
      heapFSet(index, heapFGet(child));
      heapNodeSet(index, heapNodeGet(child));
      index = child;
    }
    heapFSet(index, lastF);
    heapNodeSet(index, lastNode);
  }
  return ((<u64> operations) << 32) | (<u64> firstNode);
}
export function pathfinding_trace(fixture_len: u32): i32 {
  if (fixture_len != 106552) return 1;
  if (read32(0) != 256 || read32(8) != 4096) return 2;

  for (let node: u32 = 0; node < 65536; node++) {
    astarSeenSet(node, 0);
    astarClosedSet(node, 0);
  }

  const mapOffset: u32 = 24;
  const entityOffset: u32 = mapOffset + 65536;
  const pathOffset: u32 = entityOffset + 4096 * 8;
  const controlOffset: u32 = pathOffset + 128 * 8;

  let stamp: u16 = 0;
  let state: u32 = 0xa1427b39;
  let pathDigest: u32 = 0x13198a2e;
  let tieDigest: u32 = 0x03707344;
  let expanded: u32 = 0;
  let frontierOperations: u32 = 0;
  let systemUpdates: u32 = 0;
  let drawCommands: u32 = 0;
  let audioEvents: u32 = 0;

  for (let request: u32 = 0; request < 128; request++) {
    stamp = <u16> (stamp + 1);
    heapLength = 0;
    const start = read16(pathOffset + request * 8) +
      read16(pathOffset + request * 8 + 2) * 256;
    const goal = read16(pathOffset + request * 8 + 4) +
      read16(pathOffset + request * 8 + 6) * 256;
    const gx: u32 = goal & 255;
    const gy: u32 = goal >>> 8;
    astarSeenSet(start, stamp);
    astarGSet(start, 0);
    astarParentSet(start, -1);
    const heuristic = absolute(<i32> (start & 255) - <i32> gx) +
      absolute(<i32> (start >>> 8) - <i32> gy);
    frontierOperations = heapPush(start, heuristic, frontierOperations);
    if (frontierOperations == 0xffffffff) return 3;
    let requestTie: u32 = 0x85a308d3;
    while (heapLength > 0) {
      // Capture f BEFORE popping (heapPop clears/moves heap[0]).
      const f = heapFGet(0);
      const packed = heapPop(frontierOperations);
      const node = <u32> (packed & 0xffffffff);
      frontierOperations = <u32> (packed >>> 32);
      if (astarClosedGet(node) == stamp) continue;
      requestTie = mix(mix(requestTie, f), node);
      astarClosedSet(node, stamp);
      expanded++;
      state = mix(state, node ^ (request << 16) ^ (<u32> astarGGet(node)));
      if (node == goal) break;
      const x: u32 = node & 255;
      const y: u32 = node >>> 8;
      // 4 candidates (up, left, right, down)
      for (let i: u32 = 0; i < 4; i++) {
        let signedNext: i32 = -1;
        if (i == 0) { if (y > 0) signedNext = <i32> node - 256; }
        else if (i == 1) { if (x > 0) signedNext = <i32> node - 1; }
        else if (i == 2) { if (x < 255) signedNext = <i32> node + 1; }
        else if (y < 255) signedNext = <i32> node + 256;
        if (signedNext < 0) continue;
        const next = <u32> signedNext;
        if (fixtureAt(mapOffset + next) != 0 || astarClosedGet(next) == stamp) {
          continue;
        }
        const cost: i32 = astarGGet(node) + 1;
        if (astarSeenGet(next) != stamp || cost < astarGGet(next)) {
          astarSeenSet(next, stamp);
          astarGSet(next, cost);
          astarParentSet(next, <i32> node);
          const estimate: u32 = (<u32> cost) +
            absolute(<i32> (next & 255) - <i32> gx) +
            absolute(<i32> (next >>> 8) - <i32> gy);
          frontierOperations = heapPush(next, estimate, frontierOperations);
          if (frontierOperations == 0xffffffff) return 3;
        }
      }
    }
    let requestPath: u32 = 0xa4093822;
    if (astarClosedGet(goal) == stamp) {
      let node: i32 = <i32> goal;
      while (node >= 0) {
        requestPath = mix(requestPath, <u32> node);
        node = astarParentGet(<u32> node);
      }
    } else {
      requestPath = mix(requestPath, 0xffffffff);
    }
    pathDigest = mix(mix(pathDigest, request), requestPath);
    tieDigest = mix(mix(tieDigest, request), requestTie);
  }

  for (let entity: u32 = 0; entity < 4096; entity++) {
    const at = entityOffset + entity * 8;
    entityXSet(entity, <u16> read16(at));
    entityYSet(entity, <u16> read16(at + 2));
    entityVxSet(entity, <i8> (<i32> read16(at + 4) - 3));
    entityVySet(entity, <i8> (<i32> read16(at + 6) - 3));
  }

  let ecs: u32 = 0x299f31d0;
  let animation: u32 = 0x082efa98;
  let draw: u32 = 0xec4e6c89;
  let audio: u32 = 0x452821e6;

  for (let frame: u32 = 0; frame < 1800; frame++) {
    const control = read32(controlOffset + frame * 4);
    for (let entity: u32 = 0; entity < 4096; entity++) {
      const ex: i32 = <i32> entityXGet(entity);
      const ey: i32 = <i32> entityYGet(entity);
      const vx: i32 = <i32> entityVxGet(entity);
      const vy: i32 = <i32> entityVyGet(entity);
      const nx: u16 = <u16> ((ex + vx + <i32> (control & 1) + 256) & 255);
      const ny: u16 = <u16> ((ey + vy + <i32> ((control >>> 1) & 1) + 256) & 255);
      entityXSet(entity, nx);
      entityYSet(entity, ny);
      const packed = (<u32> nx) ^ ((<u32> ny) << 8) ^ entity ^ control;
      ecs = mix(ecs, packed);
      state = mix(state, packed);
      systemUpdates++;
      animation = mix(animation, entity ^ (frame << 12) ^ ((control >>> 16) & 15));
      draw = mix(mix(mix(draw, entity), <u32> nx), <u32> ny);
      drawCommands++;
    }
    if ((control & 1023) == 0) {
      audio = mix(mix(audio, frame), control);
      audioEvents++;
    }
  }

  let semantic: u32 = state;
  semantic = mix(semantic, pathDigest);
  semantic = mix(semantic, tieDigest);
  semantic = mix(semantic, ecs);
  semantic = mix(semantic, animation);
  semantic = mix(semantic, draw);
  semantic = mix(semantic, audio);

  store<u32>(RES_OFFSET, semantic);
  store<u32>(RES_OFFSET + 4, pathDigest);
  store<u32>(RES_OFFSET + 8, tieDigest);
  store<u32>(RES_OFFSET + 12, ecs);
  store<u32>(RES_OFFSET + 16, animation);
  store<u32>(RES_OFFSET + 20, draw);
  store<u32>(RES_OFFSET + 24, audio);
  store<u32>(RES_OFFSET + 28, systemUpdates);
  store<u32>(RES_OFFSET + 32, expanded);
  store<u32>(RES_OFFSET + 36, frontierOperations);
  store<u32>(RES_OFFSET + 40, drawCommands);
  store<u32>(RES_OFFSET + 44, audioEvents);
  return 0;
}
