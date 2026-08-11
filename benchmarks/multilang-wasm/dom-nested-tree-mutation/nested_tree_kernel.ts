// nested_tree_kernel.ts — AssemblyScript multilang compute core for
// dom.nested-tree-mutation.v1. Same ABI as the C kernel: generates the frozen
// 1,200-action trace from seed 0x5e6f7788, runs the 500-node JS reference
// model, writes counters to a fixed offset, returns finalNodeIdSum. Raw
// linear-memory access only (no heap allocation, no runtime imports) —
// mirrors grid_kernel.ts.

const INITIAL_NODES = 500;
const ACTIONS = 1200;
const MAX_NODES = 2000;
const PARENT_MISSING: i32 = -2;
const PARENT_ROOT: i32 = -1;
const PARENT_OFFSET: usize = 0; // i32[MAX_NODES]
const RESULTS_OFFSET: usize = 16384; // u32[4]

let seed: u32 = 0x5e6f7788;

function randNext(): f64 {
  seed ^= seed << 13;
  // replicate the JS engine's rand(): >> 17 applies to the int32
  // interpretation (arithmetic, sign-extending).
  seed ^= (<i32> seed >> 17) as u32;
  seed ^= seed << 5;
  return (<f64> seed) / 4294967296.0;
}

export function nested_tree_trace(): i32 {
  for (let i = 0; i < MAX_NODES; i++) {
    store<i32>(PARENT_OFFSET + i * 4, PARENT_MISSING);
  }
  store<i32>(PARENT_OFFSET + 0 * 4, PARENT_ROOT);
  for (let i = 1; i < INITIAL_NODES; i++) {
    store<i32>(PARENT_OFFSET + i * 4, <i32> ((i - 1) / 3));
  }
  let nodeCount: i32 = INITIAL_NODES;

  seed = 0x5e6f7788;
  let totalMutations: u32 = 0;
  let attrUpdates: u32 = 0;
  for (let a = 0; a < ACTIONS; a++) {
    const op = <u32> (randNext() * 5.0);
    const targetId = <u32> (randNext() * 400.0);
    const parentId = <u32> (randNext() * 400.0);
    randNext();
    randNext();
    const actionId = <u32> a + 500;

    if (op === 0) {
      if (
        parentId < <u32> MAX_NODES &&
        load<i32>(PARENT_OFFSET + parentId * 4) !== PARENT_MISSING
      ) {
        if (
          actionId < <u32> MAX_NODES &&
          load<i32>(PARENT_OFFSET + actionId * 4) === PARENT_MISSING
        ) {
          store<i32>(PARENT_OFFSET + actionId * 4, <i32> parentId);
          nodeCount += 1;
          totalMutations += 1;
        }
      }
    } else if (op === 1) {
      if (
        targetId > 0 && targetId < <u32> MAX_NODES &&
        load<i32>(PARENT_OFFSET + targetId * 4) !== PARENT_MISSING
      ) {
        store<i32>(PARENT_OFFSET + targetId * 4, PARENT_MISSING);
        nodeCount -= 1;
        totalMutations += 1;
      }
    } else if (op === 2) {
      if (
        targetId > 0 && targetId < <u32> MAX_NODES &&
        load<i32>(PARENT_OFFSET + targetId * 4) !== PARENT_MISSING &&
        parentId < <u32> MAX_NODES &&
        load<i32>(PARENT_OFFSET + parentId * 4) !== PARENT_MISSING &&
        targetId !== parentId
      ) {
        store<i32>(PARENT_OFFSET + targetId * 4, <i32> parentId);
        totalMutations += 1;
      }
    } else if (op === 3) {
      if (
        targetId < <u32> MAX_NODES &&
        load<i32>(PARENT_OFFSET + targetId * 4) !== PARENT_MISSING
      ) {
        attrUpdates += 1;
      }
    } else if (op === 4) {
      if (
        targetId > 0 && targetId < <u32> MAX_NODES &&
        load<i32>(PARENT_OFFSET + targetId * 4) !== PARENT_MISSING
      ) {
        totalMutations += 1;
      }
    }
  }

  let idSum: u32 = 0;
  for (let i = 0; i < MAX_NODES; i++) {
    if (load<i32>(PARENT_OFFSET + i * 4) !== PARENT_MISSING) idSum += <u32> i;
  }
  store<u32>(RESULTS_OFFSET, totalMutations);
  store<u32>(RESULTS_OFFSET + 4, attrUpdates);
  store<u32>(RESULTS_OFFSET + 8, <u32> nodeCount);
  store<u32>(RESULTS_OFFSET + 12, idSum);
  return <i32> idSum;
}
