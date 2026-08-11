// keyed_list_kernel.c — multilang compute core for dom.keyed-list-mutation.v1.
//
// ABI (mirrors benchmarks/multilang-wasm/dom-grid-movement/grid_kernel.c): the
// kernel GENERATES the frozen 2,000-action trace internally from the pinned
// seed (0x1a2b3c4d), runs the JS reference model (runKeyedListMutationJS: 1,000
// initial items, keyed insert/remove/swap/update/move over a flat array),
// writes counters to a FIXED memory offset, returns finalKeySum.
//
// Results (fixed offset 16384): [0] patchesCount, [1] textMutations,
//                               [2] finalItemCount, [3] finalKeySum
// Exports: i32 keyed_list_trace() -> finalKeySum

#define INITIAL_ITEMS 1000
#define ACTIONS 2000
#define ITEMS_MAX 4900
#define RES_OFFSET 16384

static unsigned int seed = 0x1a2b3c4d;
static double rand_next(void) {
  seed ^= seed << 13;
  // the engine's JS rand() applies >> 17 to the int32 interpretation
  // (arithmetic, sign-extending) — replicate exactly.
  seed ^= (unsigned int)((int)seed >> 17);
  seed ^= seed << 5;
  return (double)seed / 4294967296.0;
}

__attribute__((export_name("keyed_list_trace")))
int keyed_list_trace(void) {
  int items[ITEMS_MAX];
  unsigned int *results = (unsigned int *)RES_OFFSET;
  int count = INITIAL_ITEMS;
  for (int i = 0; i < INITIAL_ITEMS; i++) items[i] = i;

  seed = 0x1a2b3c4d;
  unsigned int patches = 0;
  unsigned int text_mutations = 0;
  for (int a = 0; a < ACTIONS; a++) {
    // JS generator order: op, key, targetKey, text (text is discarded but the
    // seed MUST still advance).
    const unsigned int op = (unsigned int)(rand_next() * 5.0);
    const unsigned int key = (unsigned int)(rand_next() * 1000.0);
    const unsigned int target_key = (unsigned int)(rand_next() * 1000.0);
    (void)rand_next();

    if (op == 0) { // insert: append key
      if (count < ITEMS_MAX) {
        items[count++] = (int)key;
        patches++;
      }
    } else if (op == 1) { // remove first-by-key
      int idx = -1;
      for (int i = 0; i < count; i++) {
        if (items[i] == (int)key) { idx = i; break; }
      }
      if (idx >= 0) {
        for (int i = idx; i < count - 1; i++) items[i] = items[i + 1];
        count--;
        patches++;
      }
    } else if (op == 2) { // swap by index (key % count, targetKey % count)
      if (count >= 2) {
        const unsigned int idx1 = key % (unsigned int)count;
        const unsigned int idx2 = target_key % (unsigned int)count;
        const int tmp = items[idx1];
        items[idx1] = items[idx2];
        items[idx2] = tmp;
        patches += 2;
      }
    } else if (op == 3) { // update text if key exists (no patch counter)
      int idx = -1;
      for (int i = 0; i < count; i++) {
        if (items[i] == (int)key) { idx = i; break; }
      }
      if (idx >= 0) text_mutations++;
    } else if (op == 4) { // move by key; target INDEX = targetKey % (count-1)
      if (count >= 2) {
        int idx = -1;
        for (int i = 0; i < count; i++) {
          if (items[i] == (int)key) { idx = i; break; }
        }
        if (idx >= 0) {
          const int moved = items[idx];
          for (int i = idx; i < count - 1; i++) items[i] = items[i + 1];
          count--;
          const unsigned int target_idx = target_key % (unsigned int)count;
          for (int i = count; i > (int)target_idx; i--) items[i] = items[i - 1];
          items[target_idx] = moved;
          count++;
          patches++;
        }
      }
    }
  }

  unsigned int key_sum = 0;
  for (int i = 0; i < count; i++) key_sum += (unsigned int)items[i];
  results[0] = patches;
  results[1] = text_mutations;
  results[2] = (unsigned int)count;
  results[3] = key_sum;
  return (int)key_sum;
}
