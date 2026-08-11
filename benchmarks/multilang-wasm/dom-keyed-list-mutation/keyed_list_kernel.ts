// keyed_list_kernel.ts — AssemblyScript multilang compute core for
// dom.keyed-list-mutation.v1. Same ABI as the C kernel: generates the frozen
// 2,000-action trace from seed 0x1a2b3c4d, runs the 1,000-item JS reference
// model, writes counters to a fixed offset, returns finalKeySum. Raw
// linear-memory access only (no heap allocation, no runtime imports) —
// mirrors grid_kernel.ts.

const INITIAL_ITEMS = 1000;
const ACTIONS = 2000;
const ITEMS_MAX = 4900;
const ITEMS_OFFSET: usize = 0; // i32[4900]
const RESULTS_OFFSET: usize = 16384; // u32[4]

let seed: u32 = 0x1a2b3c4d;

function randNext(): f64 {
  seed ^= seed << 13;
  // replicate the JS engine's rand(): >> 17 applies to the int32
  // interpretation (arithmetic, sign-extending).
  seed ^= (<i32> seed >> 17) as u32;
  seed ^= seed << 5;
  return (<f64> seed) / 4294967296.0;
}

export function keyed_list_trace(): i32 {
  let count: i32 = INITIAL_ITEMS;
  for (let i = 0; i < INITIAL_ITEMS; i++) {
    store<i32>(ITEMS_OFFSET + i * 4, i);
  }

  seed = 0x1a2b3c4d;
  let patches: u32 = 0;
  let textMutations: u32 = 0;
  for (let a = 0; a < ACTIONS; a++) {
    const op = <u32> (randNext() * 5.0);
    const key = <u32> (randNext() * 1000.0);
    const targetKey = <u32> (randNext() * 1000.0);
    randNext();

    if (op === 0) {
      if (count < ITEMS_MAX) {
        store<i32>(ITEMS_OFFSET + count * 4, <i32> key);
        count += 1;
        patches += 1;
      }
    } else if (op === 1) {
      let idx: i32 = -1;
      for (let i = 0; i < count; i++) {
        if (load<i32>(ITEMS_OFFSET + i * 4) === <i32> key) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        for (let i = idx; i < count - 1; i++) {
          store<i32>(ITEMS_OFFSET + i * 4, load<i32>(ITEMS_OFFSET + (i + 1) * 4));
        }
        count -= 1;
        patches += 1;
      }
    } else if (op === 2) {
      if (count >= 2) {
        const idx1 = <i32> (key % <u32> count);
        const idx2 = <i32> (targetKey % <u32> count);
        const tmp = load<i32>(ITEMS_OFFSET + idx1 * 4);
        store<i32>(ITEMS_OFFSET + idx1 * 4, load<i32>(ITEMS_OFFSET + idx2 * 4));
        store<i32>(ITEMS_OFFSET + idx2 * 4, tmp);
        patches += 2;
      }
    } else if (op === 3) {
      let idx: i32 = -1;
      for (let i = 0; i < count; i++) {
        if (load<i32>(ITEMS_OFFSET + i * 4) === <i32> key) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) textMutations += 1;
    } else if (op === 4) {
      if (count >= 2) {
        let idx: i32 = -1;
        for (let i = 0; i < count; i++) {
          if (load<i32>(ITEMS_OFFSET + i * 4) === <i32> key) {
            idx = i;
            break;
          }
        }
        if (idx >= 0) {
          const moved = load<i32>(ITEMS_OFFSET + idx * 4);
          for (let i = idx; i < count - 1; i++) {
            store<i32>(ITEMS_OFFSET + i * 4, load<i32>(ITEMS_OFFSET + (i + 1) * 4));
          }
          count -= 1;
          const targetIdx = <i32> (targetKey % <u32> count);
          for (let i = count; i > targetIdx; i--) {
            store<i32>(ITEMS_OFFSET + i * 4, load<i32>(ITEMS_OFFSET + (i - 1) * 4));
          }
          store<i32>(ITEMS_OFFSET + targetIdx * 4, moved);
          count += 1;
          patches += 1;
        }
      }
    }
  }

  let keySum: u32 = 0;
  for (let i = 0; i < count; i++) {
    keySum += <u32> load<i32>(ITEMS_OFFSET + i * 4);
  }
  store<u32>(RESULTS_OFFSET, patches);
  store<u32>(RESULTS_OFFSET + 4, textMutations);
  store<u32>(RESULTS_OFFSET + 8, <u32> count);
  store<u32>(RESULTS_OFFSET + 12, keySum);
  return <i32> keySum;
}
