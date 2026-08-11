// nested_tree_kernel.cpp — multilang compute core for
// dom.nested-tree-mutation.v1. Same ABI as nested_tree_kernel.c: generates the
// frozen 1,200-action trace from seed 0x5e6f7788, runs the 500-node JS
// reference model, writes counters to fixed offset 16384
// ([0] totalMutations [1] attrUpdates [2] finalNodeCount [3] finalNodeIdSum),
// returns finalNodeIdSum.

constexpr int INITIAL_NODES = 500;
constexpr int ACTIONS = 1200;
constexpr int MAX_NODES = 2000;
constexpr int PARENT_MISSING = -2;
constexpr int PARENT_ROOT = -1;
constexpr int RES_OFFSET = 16384;

static unsigned int seed = 0x5e6f7788;
static double rand_next() {
  seed ^= seed << 13;
  seed ^= static_cast<unsigned int>(static_cast<int>(seed) >> 17);
  seed ^= seed << 5;
  return static_cast<double>(seed) / 4294967296.0;
}

extern "C" __attribute__((export_name("nested_tree_trace")))
int nested_tree_trace() {
  int parent[MAX_NODES];
  unsigned int *results = reinterpret_cast<unsigned int *>(RES_OFFSET);
  for (int i = 0; i < MAX_NODES; i++) parent[i] = PARENT_MISSING;
  parent[0] = PARENT_ROOT;
  for (int i = 1; i < INITIAL_NODES; i++) parent[i] = (i - 1) / 3;
  int node_count = INITIAL_NODES;

  seed = 0x5e6f7788;
  unsigned int total_mutations = 0;
  unsigned int attr_updates = 0;
  for (int a = 0; a < ACTIONS; a++) {
    const unsigned int op = static_cast<unsigned int>(rand_next() * 5.0);
    const unsigned int target_id = static_cast<unsigned int>(rand_next() * 400.0);
    const unsigned int parent_id = static_cast<unsigned int>(rand_next() * 400.0);
    (void)rand_next();
    (void)rand_next();
    const unsigned int action_id = static_cast<unsigned int>(a) + 500;

    if (op == 0) {
      if (parent_id < MAX_NODES && parent[parent_id] != PARENT_MISSING) {
        if (action_id < MAX_NODES && parent[action_id] == PARENT_MISSING) {
          parent[action_id] = static_cast<int>(parent_id);
          node_count++;
          total_mutations++;
        }
      }
    } else if (op == 1) {
      if (target_id > 0 && target_id < MAX_NODES && parent[target_id] != PARENT_MISSING) {
        parent[target_id] = PARENT_MISSING;
        node_count--;
        total_mutations++;
      }
    } else if (op == 2) {
      if (
        target_id > 0 && target_id < MAX_NODES && parent[target_id] != PARENT_MISSING &&
        parent_id < MAX_NODES && parent[parent_id] != PARENT_MISSING &&
        target_id != parent_id
      ) {
        parent[target_id] = static_cast<int>(parent_id);
        total_mutations++;
      }
    } else if (op == 3) {
      if (target_id < MAX_NODES && parent[target_id] != PARENT_MISSING) {
        attr_updates++;
      }
    } else if (op == 4) {
      if (target_id > 0 && target_id < MAX_NODES && parent[target_id] != PARENT_MISSING) {
        total_mutations++;
      }
    }
  }

  unsigned int id_sum = 0;
  for (int i = 0; i < MAX_NODES; i++) {
    if (parent[i] != PARENT_MISSING) id_sum += static_cast<unsigned int>(i);
  }
  results[0] = total_mutations;
  results[1] = attr_updates;
  results[2] = static_cast<unsigned int>(node_count);
  results[3] = id_sum;
  return static_cast<int>(id_sum);
}
