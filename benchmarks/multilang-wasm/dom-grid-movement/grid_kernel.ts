// grid_kernel.ts — AssemblyScript multilang compute core for dom.grid-movement.v1.
// Same ABI as the C kernel: generates the frozen 3,600-action trace from seed
// 0xc001d00d, runs the 128-entity / 64x64 model, writes counters to a fixed
// offset, returns finalPosSum. Raw linear-memory access only (no heap
// allocation, no runtime imports) — mirrors image_kernels.ts.

const GRID_W = 64;
const GRID_H = 64;
const ENTITIES = 128;
const ACTIONS = 3600;
const ENTITIES_OFFSET: usize = 0; // i32[128*2] entity positions
const ACTIONS_OFFSET: usize = 20480; // u32[3600] packed actions
const RESULTS_OFFSET: usize = 16384; // u32[3]

let seed: u32 = 0xc001d00d;

function nextRand(): u32 {
  seed ^= seed << 13;
  // replicate the JS engine's rand(): >> 17 applies to the int32
  // interpretation (arithmetic, sign-extending)
  seed ^= (<i32> seed >> 17) as u32;
  seed ^= seed << 5;
  return seed;
}

function generateActions(): void {
  seed = 0xc001d00d;
  for (let i = 0; i < ACTIONS; i++) {
    const r = nextRand();
    const r2 = nextRand();
    const entity = (r >> 25) & 0x7f;
    const dir = r2 >> 30;
    store<u32>(ACTIONS_OFFSET + i * 4, (dir << 8) | entity);
  }
}

export function grid_trace(): i32 {
  for (let i = 0; i < ENTITIES; i++) {
    store<i32>(ENTITIES_OFFSET + i * 8, <i32> ((i * 3) % GRID_W));
    store<i32>(ENTITIES_OFFSET + i * 8 + 4, <i32> ((i * 3) / GRID_W));
  }
  generateActions();

  let totalMoves: u32 = 0;
  let collisions: u32 = 0;
  for (let a = 0; a < ACTIONS; a++) {
    const packed = load<u32>(ACTIONS_OFFSET + a * 4);
    const entityId: usize = <usize> (packed & 0xff);
    const dir = (packed >> 8) & 0xff;
    let newX = load<i32>(ENTITIES_OFFSET + entityId * 8);
    let newY = load<i32>(ENTITIES_OFFSET + entityId * 8 + 4);
    if (dir === 0) { if (newY > 0) newY -= 1; }
    else if (dir === 1) { if (newY < GRID_H - 1) newY += 1; }
    else if (dir === 2) { if (newX > 0) newX -= 1; }
    else if (dir === 3) { if (newX < GRID_W - 1) newX += 1; }
    let occupied = false;
    for (let j = 0; j < ENTITIES; j++) {
      if (j === entityId) continue;
      if (
        load<i32>(ENTITIES_OFFSET + j * 8) === newX &&
        load<i32>(ENTITIES_OFFSET + j * 8 + 4) === newY
      ) {
        occupied = true;
        collisions += 1;
        break;
      }
    }
    if (!occupied) {
      store<i32>(ENTITIES_OFFSET + entityId * 8, newX);
      store<i32>(ENTITIES_OFFSET + entityId * 8 + 4, newY);
      totalMoves += 1;
    }
  }
  let finalPosSum: i32 = 0;
  for (let i = 0; i < ENTITIES; i++) {
    finalPosSum += load<i32>(ENTITIES_OFFSET + i * 8) +
      load<i32>(ENTITIES_OFFSET + i * 8 + 4) * GRID_W;
  }
  store<u32>(RESULTS_OFFSET, totalMoves);
  store<u32>(RESULTS_OFFSET + 4, collisions);
  store<u32>(RESULTS_OFFSET + 8, <u32> finalPosSum);
  return finalPosSum;
}
