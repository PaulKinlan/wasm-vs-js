// nested_tree_kernel.c — multilang compute core for dom.nested-tree-mutation.v1.
//
// ABI (mirrors benchmarks/multilang-wasm/dom-grid-movement/grid_kernel.c): the
// kernel GENERATES the frozen 1,200-action trace internally from the pinned
// seed (0x5e6f7788), runs the JS reference model (runNestedTreeMutationJS: 500
// initial nodes, keyed insert_child/remove_node/move_subtree/update_attr/
// replace_node), writes counters to a FIXED memory offset, returns
// finalNodeIdSum (sum of live node ids, computed after the trace).
//
// Results (fixed offset 16384): [0] totalMutations, [1] attrUpdates,
//                               [2] finalNodeCount, [3] finalNodeIdSum
// Exports: i32 nested_tree_trace() -> finalNodeIdSum

#define INITIAL_NODES 500
#define ACTIONS 1200
// max id: action.id = i + 500, i in 0..1199 -> ids 500..1699. Reserve 2000.
#define MAX_NODES 2000
#define PARENT_MISSING -2
#define PARENT_ROOT -1
#define RES_OFFSET 16384

static unsigned int seed = 0x5e6f7788;
static double rand_next(void) {
  seed ^= seed << 13;
  // the engine's JS rand() applies >> 17 to the int32 interpretation
  // (arithmetic, sign-extending) — replicate exactly.
  seed ^= (unsigned int)((int)seed >> 17);
  seed ^= seed << 5;
  return (double)seed / 4294967296.0;
}

__attribute__((export_name("nested_tree_trace")))
int nested_tree_trace(void) {
  // parent[id]: PARENT_MISSING = node absent, PARENT_ROOT = root, else parent id
  int parent[MAX_NODES];
  unsigned int *results = (unsigned int *)RES_OFFSET;

  for (int i = 0; i < MAX_NODES; i++) parent[i] = PARENT_MISSING;
  parent[0] = PARENT_ROOT;
  for (int i = 1; i < INITIAL_NODES; i++) parent[i] = (i - 1) / 3;
  int node_count = INITIAL_NODES;

  seed = 0x5e6f7788;
  unsigned int total_mutations = 0;
  unsigned int attr_updates = 0;
  for (int a = 0; a < ACTIONS; a++) {
    // JS generator order: op, targetNodeId, parentTargetId, attrName, attrValue.
    // attrName/attrValue only advance the seed (their rand() values do not
    // affect any counter oracle in the JS reference model).
    const unsigned int op = (unsigned int)(rand_next() * 5.0);
    const unsigned int target_id = (unsigned int)(rand_next() * 400.0);
    const unsigned int parent_id = (unsigned int)(rand_next() * 400.0);
    (void)rand_next();
    (void)rand_next();
    const unsigned int action_id = (unsigned int)a + 500;

    if (op == 0) { // insert_child if parent exists in the map
      if (parent_id < MAX_NODES && parent[parent_id] != PARENT_MISSING) {
        if (action_id < MAX_NODES && parent[action_id] == PARENT_MISSING) {
          parent[action_id] = (int)parent_id;
          node_count++;
          total_mutations++;
        }
      }
    } else if (op == 1) { // remove_node: target > 0 and exists
      if (target_id > 0 && target_id < MAX_NODES && parent[target_id] != PARENT_MISSING) {
        parent[target_id] = PARENT_MISSING;
        node_count--;
        total_mutations++;
      }
    } else if (op == 2) { // move_subtree: target>0 exists, parent exists, target != parent
      if (
        target_id > 0 && target_id < MAX_NODES && parent[target_id] != PARENT_MISSING &&
        parent_id < MAX_NODES && parent[parent_id] != PARENT_MISSING &&
        target_id != parent_id
      ) {
        parent[target_id] = (int)parent_id;
        total_mutations++;
      }
    } else if (op == 3) { // update_attr if target exists
      if (target_id < MAX_NODES && parent[target_id] != PARENT_MISSING) {
        attr_updates++;
      }
    } else if (op == 4) { // replace_node: target>0 exists
      if (target_id > 0 && target_id < MAX_NODES && parent[target_id] != PARENT_MISSING) {
        total_mutations++;
      }
    }
  }

  unsigned int id_sum = 0;
  for (int i = 0; i < MAX_NODES; i++) {
    if (parent[i] != PARENT_MISSING) id_sum += (unsigned int)i;
  }
  results[0] = total_mutations;
  results[1] = attr_updates;
  results[2] = (unsigned int)node_count;
  results[3] = id_sum;
  return (int)id_sum;
}
