// keyed_list_kernel.cpp — multilang compute core for dom.keyed-list-mutation.v1.
// Same ABI as keyed_list_kernel.c: generates the frozen 2,000-action trace from
// seed 0x1a2b3c4d, runs the 1,000-item JS reference model, writes counters to
// fixed offset 16384 ([0] patches [1] textMutations [2] count [3] keySum),
// returns finalKeySum.

constexpr int INITIAL_ITEMS = 1000;
constexpr int ACTIONS = 2000;
constexpr int ITEMS_MAX = 4900;
constexpr int RES_OFFSET = 16384;

static unsigned int seed = 0x1a2b3c4d;
static double rand_next() {
  seed ^= seed << 13;
  seed ^= static_cast<unsigned int>(static_cast<int>(seed) >> 17);
  seed ^= seed << 5;
  return static_cast<double>(seed) / 4294967296.0;
}

extern "C" __attribute__((export_name("keyed_list_trace")))
int keyed_list_trace() {
  int items[ITEMS_MAX];
  unsigned int *results = reinterpret_cast<unsigned int *>(RES_OFFSET);
  int count = INITIAL_ITEMS;
  for (int i = 0; i < INITIAL_ITEMS; i++) items[i] = i;

  seed = 0x1a2b3c4d;
  unsigned int patches = 0;
  unsigned int text_mutations = 0;
  for (int a = 0; a < ACTIONS; a++) {
    const unsigned int op = static_cast<unsigned int>(rand_next() * 5.0);
    const unsigned int key = static_cast<unsigned int>(rand_next() * 1000.0);
    const unsigned int target_key = static_cast<unsigned int>(rand_next() * 1000.0);
    (void)rand_next();

    if (op == 0) {
      if (count < ITEMS_MAX) {
        items[count++] = static_cast<int>(key);
        patches++;
      }
    } else if (op == 1) {
      int idx = -1;
      for (int i = 0; i < count; i++) {
        if (items[i] == static_cast<int>(key)) { idx = i; break; }
      }
      if (idx >= 0) {
        for (int i = idx; i < count - 1; i++) items[i] = items[i + 1];
        count--;
        patches++;
      }
    } else if (op == 2) {
      if (count >= 2) {
        const unsigned int idx1 = key % static_cast<unsigned int>(count);
        const unsigned int idx2 = target_key % static_cast<unsigned int>(count);
        const int tmp = items[idx1];
        items[idx1] = items[idx2];
        items[idx2] = tmp;
        patches += 2;
      }
    } else if (op == 3) {
      int idx = -1;
      for (int i = 0; i < count; i++) {
        if (items[i] == static_cast<int>(key)) { idx = i; break; }
      }
      if (idx >= 0) text_mutations++;
    } else if (op == 4) {
      if (count >= 2) {
        int idx = -1;
        for (int i = 0; i < count; i++) {
          if (items[i] == static_cast<int>(key)) { idx = i; break; }
        }
        if (idx >= 0) {
          const int moved = items[idx];
          for (int i = idx; i < count - 1; i++) items[i] = items[i + 1];
          count--;
          const unsigned int target_idx = target_key % static_cast<unsigned int>(count);
          for (int i = count; i > static_cast<int>(target_idx); i--) items[i] = items[i - 1];
          items[target_idx] = moved;
          count++;
          patches++;
        }
      }
    }
  }

  unsigned int key_sum = 0;
  for (int i = 0; i < count; i++) key_sum += static_cast<unsigned int>(items[i]);
  results[0] = patches;
  results[1] = text_mutations;
  results[2] = static_cast<unsigned int>(count);
  results[3] = key_sum;
  return static_cast<int>(key_sum);
}
