// dom_nested_tree.c — real linear-memory kernel for dom.nested-tree-mutation.v1.
//
// Mirrors runNestedTreeMutationJS exactly: a 500-node tree, 1,200 frozen
// actions (insert_child/remove_node/move_subtree/update_attr/replace_node).
// The kernel tracks parent pointers + attr versions + replaced flags in flat
// arrays and emits a step log; the JS host applies each step to a REAL DOM
// tree (nested <ul>/<li> nodes created/removed/reparented/updated).
//
// Memory layout (little-endian):
//   nodes_ptr  : i32[3*2000]  per node id: (parentId, attrVer, replaced)
//                parentId -1 = root, -2 = deleted; valid nodes: 0..MAX
//   steps_ptr  : u32[5*1200]  per applied op: (op, id, parentId, attrCode, 0)
//   results    : u32[3]       [0] totalMutations, [1] attrUpdates, [2] nodeCount
// Exports: i32 run_trace(...) -> step count

#define MAX_NODES 2000
#define INITIAL_NODES 500

// ops: 0 insert_child, 1 remove_node, 2 move_subtree, 3 update_attr, 4 replace_node

__attribute__((export_name("run_trace")))
int run_trace(
    int *nodes,
    const unsigned int *actions,
    unsigned int actions_len,
    unsigned int *steps,
    unsigned int *results,
    unsigned int *attr_codes) { // attrCodes: per-step attrCode for update ops
  unsigned int total_mutations = 0;
  unsigned int attr_updates = 0;
  unsigned int step_count = 0;
  unsigned int node_count = INITIAL_NODES;

  // attrCode passed per action via actions' high bits is not enough; we
  // derive attrCode from the action index and pass it via the step's 4th word.
  for (unsigned int a = 0; a < actions_len; a++) {
    const unsigned int packed = actions[a];
    const unsigned int op = packed & 0x7;
    const unsigned int id = (packed >> 3) & 0x7ff;      // insert id = action id (i+500)
    const unsigned int target_id = (packed >> 14) & 0x1ff; // targetNodeId (0..399)
    const unsigned int parent_id = (packed >> 23) & 0x1ff; // parentTargetId (0..399)
    const unsigned int attr_code = a % 100; // data-v-{code%10} val-{code%100}

    if (op == 0) { // insert_child if parent exists
      if (id >= MAX_NODES) continue;
      if (parent_id >= MAX_NODES) continue;
      if (nodes[parent_id * 3] == -2) continue; // parent deleted
      nodes[id * 3] = (int)parent_id;
      nodes[id * 3 + 1] = 0;
      nodes[id * 3 + 2] = 0;
      node_count++;
      total_mutations++;
      steps[step_count * 5] = 0; steps[step_count * 5 + 1] = id;
      steps[step_count * 5 + 2] = parent_id; steps[step_count * 5 + 3] = 0;
      step_count++;
    } else if (op == 1) { // remove_node: target > 0 and exists
      if (target_id == 0 || target_id >= MAX_NODES) continue;
      if (nodes[target_id * 3] == -2) continue;
      nodes[target_id * 3] = -2; // mark deleted
      node_count--;
      total_mutations++;
      steps[step_count * 5] = 1; steps[step_count * 5 + 1] = target_id;
      steps[step_count * 5 + 2] = 0; steps[step_count * 5 + 3] = 0;
      step_count++;
    } else if (op == 2) { // move_subtree: target>0, exists, parent exists, target != parent
      if (target_id == 0 || target_id >= MAX_NODES) continue;
      if (parent_id >= MAX_NODES) continue;
      if (nodes[target_id * 3] == -2) continue;
      if (nodes[parent_id * 3] == -2) continue;
      if (target_id == parent_id) continue;
      nodes[target_id * 3] = (int)parent_id;
      total_mutations++;
      steps[step_count * 5] = 2; steps[step_count * 5 + 1] = target_id;
      steps[step_count * 5 + 2] = parent_id; steps[step_count * 5 + 3] = 0;
      step_count++;
    } else if (op == 3) { // update_attr on target
      if (target_id >= MAX_NODES) continue;
      if (nodes[target_id * 3] == -2) continue;
      nodes[target_id * 3 + 1] += 1;
      attr_updates++;
      steps[step_count * 5] = 3; steps[step_count * 5 + 1] = target_id;
      steps[step_count * 5 + 2] = 0; steps[step_count * 5 + 3] = attr_code;
      step_count++;
    } else if (op == 4) { // replace_node: target>0, exists
      if (target_id == 0 || target_id >= MAX_NODES) continue;
      if (nodes[target_id * 3] == -2) continue;
      nodes[target_id * 3 + 2] = 1;
      total_mutations++;
      steps[step_count * 5] = 4; steps[step_count * 5 + 1] = target_id;
      steps[step_count * 5 + 2] = 0; steps[step_count * 5 + 3] = 0;
      step_count++;
    }
  }
  results[0] = total_mutations;
  results[1] = attr_updates;
  results[2] = node_count;
  return (int)step_count;
}
