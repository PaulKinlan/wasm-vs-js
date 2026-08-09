// dom_keyed_list.c — real linear-memory kernel for dom.keyed-list-mutation.v1.
//
// Mirrors runKeyedListMutationJS exactly (index-based swap/move, splice
// remove, insert-append) so JS and Wasm totals agree bit-for-bit:
//   1,000 keyed items, 2,000 frozen actions (insert/remove/swap/update/move).
// The kernel mutates a flat item array in linear memory and emits an ordered
// step log (op, key, targetKey, textId); the JS host applies each step to a
// REAL DOM list.
//
// Memory layout (little-endian):
//   items_ptr   : i32[1 + 3*4900]  items[0]=count; triplets (key, textId, textLen)
//   actions_ptr : u32[2000] packed: op(3b) | key(12b) | targetKey(12b) | textId(5b)
//   steps_ptr   : u32[4*2000]      per applied op: (op, key, targetKey, textId)
//   results_ptr : u32[4]           [0] patches, [1] textMutations, [2] count, [3] keySum
// Exports: i32 run_trace(...) -> applied step count

#define MAX_ITEMS 4900

// ops: 0 insert, 1 remove, 2 swap, 3 update, 4 move

__attribute__((export_name("run_trace")))
int run_trace(
    int *items,
    const unsigned int *actions,
    unsigned int actions_len,
    unsigned int *steps,
    unsigned int *results) {
  int *count = &items[0];
  int *triplets = &items[1];
  unsigned int patches = 0;
  unsigned int text_mutations = 0;
  unsigned int step_count = 0;

  for (unsigned int a = 0; a < actions_len; a++) {
    const unsigned int packed = actions[a];
    const unsigned int op = packed & 0x7;
    const unsigned int key = (packed >> 3) & 0xfff;
    const unsigned int target_key = (packed >> 15) & 0xfff;
    const unsigned int text_id = (packed >> 27) & 0x1f;

    if (op == 0) { // insert: append (key, textId, textLen)
      if (*count >= MAX_ITEMS) continue;
      triplets[*count * 3] = (int)key;
      triplets[*count * 3 + 1] = (int)text_id;
      triplets[*count * 3 + 2] = (int)(text_id * 7 + 3);
      (*count)++;
      patches++;
      steps[step_count * 4] = 0; steps[step_count * 4 + 1] = key;
      steps[step_count * 4 + 2] = 0; steps[step_count * 4 + 3] = text_id;
      step_count++;
    } else if (op == 1) { // remove first by key
      int idx = -1;
      for (int i = 0; i < *count; i++) {
        if (triplets[i * 3] == (int)key) { idx = i; break; }
      }
      if (idx >= 0) {
        for (int i = idx; i < *count - 1; i++) {
          triplets[i * 3] = triplets[(i + 1) * 3];
          triplets[i * 3 + 1] = triplets[(i + 1) * 3 + 1];
          triplets[i * 3 + 2] = triplets[(i + 1) * 3 + 2];
        }
        (*count)--;
        patches++;
        steps[step_count * 4] = 1; steps[step_count * 4 + 1] = key;
        steps[step_count * 4 + 2] = 0; steps[step_count * 4 + 3] = 0;
        step_count++;
      }
    } else if (op == 2) { // swap by INDEX (key % count), patches += 2
      if (*count < 2) continue;
      const unsigned int idx1 = key % (unsigned int)*count;
      const unsigned int idx2 = target_key % (unsigned int)*count;
      if (idx1 == idx2) continue;
      int tk = triplets[idx1 * 3], tt = triplets[idx1 * 3 + 1], tl = triplets[idx1 * 3 + 2];
      triplets[idx1 * 3] = triplets[idx2 * 3];
      triplets[idx1 * 3 + 1] = triplets[idx2 * 3 + 1];
      triplets[idx1 * 3 + 2] = triplets[idx2 * 3 + 2];
      triplets[idx2 * 3] = tk; triplets[idx2 * 3 + 1] = tt; triplets[idx2 * 3 + 2] = tl;
      patches += 2;
      steps[step_count * 4] = 2; steps[step_count * 4 + 1] = key;
      steps[step_count * 4 + 2] = target_key; steps[step_count * 4 + 3] = 0;
      step_count++;
    } else if (op == 3) { // update text by key (no patch counter)
      int idx = -1;
      for (int i = 0; i < *count; i++) {
        if (triplets[i * 3] == (int)key) { idx = i; break; }
      }
      if (idx >= 0) {
        triplets[idx * 3 + 1] = (int)text_id;
        triplets[idx * 3 + 2] = (int)(text_id * 7 + 3);
        text_mutations++;
        steps[step_count * 4] = 3; steps[step_count * 4 + 1] = key;
        steps[step_count * 4 + 2] = 0; steps[step_count * 4 + 3] = text_id;
        step_count++;
      }
    } else if (op == 4) { // move by key; target INDEX = targetKey % count (after splice)
      if (*count < 2) continue;
      int idx = -1;
      for (int i = 0; i < *count; i++) {
        if (triplets[i * 3] == (int)key) { idx = i; break; }
      }
      if (idx >= 0) {
        int mk = triplets[idx * 3], mt = triplets[idx * 3 + 1], ml = triplets[idx * 3 + 2];
        for (int i = idx; i < *count - 1; i++) {
          triplets[i * 3] = triplets[(i + 1) * 3];
          triplets[i * 3 + 1] = triplets[(i + 1) * 3 + 1];
          triplets[i * 3 + 2] = triplets[(i + 1) * 3 + 2];
        }
        (*count)--;
        unsigned int target_idx = target_key % (unsigned int)*count;
        for (int i = *count; i > (int)target_idx; i--) {
          triplets[i * 3] = triplets[(i - 1) * 3];
          triplets[i * 3 + 1] = triplets[(i - 1) * 3 + 1];
          triplets[i * 3 + 2] = triplets[(i - 1) * 3 + 2];
        }
        triplets[target_idx * 3] = mk;
        triplets[target_idx * 3 + 1] = mt;
        triplets[target_idx * 3 + 2] = ml;
        (*count)++;
        patches++;
        steps[step_count * 4] = 4; steps[step_count * 4 + 1] = key;
        steps[step_count * 4 + 2] = target_key; steps[step_count * 4 + 3] = 0;
        step_count++;
      }
    }
  }
  unsigned int key_sum = 0;
  for (int i = 0; i < *count; i++) key_sum += (unsigned int)triplets[i * 3];
  results[0] = patches;
  results[1] = text_mutations;
  results[2] = (unsigned int)*count;
  results[3] = key_sum;
  return (int)step_count;
}
