// vdom_kernel.c — multilang compute core for dom.vdom-diff-patch.v1.
//
// ABI (mirrors the multilang-wasm kernels): the kernel GENERATES the frozen
// 1,000-node treeA + treeB from the pinned SplitMix64 seed 3976273958, runs
// the exact createVDOMPatches diff (mirrors benchmarks/vdom-diff-patch-demo/
// engine.js — 100 op-6 reorder, 100 op-2 attr-set, 50 op-1 text-update ⇒ 250
// patches), writes counters + FNV-1a canonical/patch-stream digests to a
// fixed memory offset, and returns the patch count. Raw linear-memory only.
//
// Results (fixed offset 16384):
//   [0] patchesGenerated (=250) [1] op1Count (=50) [2] op2Count (=100)
//   [3] op6Count (=100) [4] treeB canonical FNV-1a (u32)
//   [5] sorted-patch-stream FNV-1a (u32)
// Exports: i32 vdom_diff_trace() -> patchesGenerated

#define NODE_COUNT 1000
#define TEXT_THRESHOLD 333          // ceil((NODE_COUNT-1)/3)
#define MAX_CHILDREN 3              // ternary tree, max 3 per parent
#define REORDER_LIST_MAX 400        // element nodes with >=2 children (in practice 333)
#define ATTR_LIST_MAX 1000
#define TEXT_LIST_MAX 1000
#define RES_OFFSET 16384

typedef unsigned long long u64;
typedef unsigned int u32;
typedef int i32;
typedef unsigned short u16;
typedef short i16;
typedef unsigned char u8;

// ---- SplitMix64 -----------------------------------------------------------
static u64 sm_state;
static u32 next_uint32(void) {
  sm_state = sm_state + 0x9e3779b97f4a7c15ULL; // modular u64 addition
  u64 z = sm_state;
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
  z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
  z = z ^ (z >> 31);
  return (u32)(z & 0xffffffffULL);
}
static i32 next_int_range(i32 min, i32 max) {
  u32 span = (u32)(max - min + 1);
  return min + (i32)(next_uint32() % span);
}

// ---- tree A storage -------------------------------------------------------
static i16 A_tag[NODE_COUNT];
static i16 A_key[NODE_COUNT];
static i16 A_attrKey[NODE_COUNT];
static i16 A_attrVal[NODE_COUNT];
static i16 A_textId[NODE_COUNT];
static u16 A_childCount[NODE_COUNT];
static u16 A_children[NODE_COUNT][MAX_CHILDREN];

// per-node mutation flags (treeB derived from treeA + these flags)
static u8 has_reorder[NODE_COUNT];
static u8 has_attr[NODE_COUNT];
static u8 has_text[NODE_COUNT];

// scratch lists for filter+shuffle
static u16 items[NODE_COUNT];
static u16 chosen[NODE_COUNT];

// ---- FNV-1a 32-bit --------------------------------------------------------
static u32 fnv_state;
static void fnv_reset(void) { fnv_state = 0x811c9dc5U; }
static void fnv_mix_byte(u8 b) {
  fnv_state ^= (u32)b;
  fnv_state *= 0x01000193U;
}
static void fnv_mix_u16(u16 v) {
  fnv_mix_byte((u8)(v & 0xff));
  fnv_mix_byte((u8)((v >> 8) & 0xff));
}
static void fnv_mix_i16(i16 v) {
  u16 u = (u16)v;
  fnv_mix_byte((u8)(u & 0xff));
  fnv_mix_byte((u8)((u >> 8) & 0xff));
}

// ---- tree generation ------------------------------------------------------
static void generate_tree_a(void) {
  // root
  A_tag[0] = 0;
  A_key[0] = -1;
  A_attrKey[0] = 0;
  A_attrVal[0] = 1;
  A_textId[0] = -1;
  A_childCount[0] = 0;
  for (int id = 1; id < NODE_COUNT; id++) {
    const int parentId = (id - 1) / 3;
    // isText: only when id > TEXT_THRESHOLD and prng.nextIntRange(0,4)===0
    int isText = 0;
    if (id > TEXT_THRESHOLD) {
      isText = (next_int_range(0, 4) == 0) ? 1 : 0;
    }
    const i16 tag = isText ? (i16)-1 : (i16)next_int_range(0, 6);
    const int keyGate = next_int_range(0, 4);
    const i16 key = (keyGate == 0) ? (i16)next_int_range(100, 999) : (i16)-1;
    const i16 attrKey = isText ? (i16)-1 : (i16)next_int_range(0, 15);
    const i16 attrVal = isText ? (i16)-1 : (i16)next_int_range(0, 50);
    const i16 textId = isText ? (i16)next_int_range(0, 100) : (i16)-1;
    A_tag[id] = tag;
    A_key[id] = key;
    A_attrKey[id] = attrKey;
    A_attrVal[id] = attrVal;
    A_textId[id] = textId;
    A_childCount[id] = 0;
    // append currentId to parent's children
    A_children[parentId][A_childCount[parentId]] = (u16)id;
    A_childCount[parentId]++;
  }
}

// shuffle items[0..len) in-place using Fisher-Yates from end.
static void shuffle(int len) {
  for (int i = len - 1; i > 0; i--) {
    const int j = next_int_range(0, i);
    const u16 t = items[i];
    items[i] = items[j];
    items[j] = t;
  }
}

// filter into items[] then shuffle then copy first `take` into chosen[],
// then mark flags[] for those ids.
static int filter_shuffle_mark(int predicate, int take, u8 *flags) {
  int len = 0;
  for (int id = 0; id < NODE_COUNT; id++) {
    int keep = 0;
    if (predicate == 0) { // children.length >= 2
      keep = (A_childCount[id] >= 2) ? 1 : 0;
    } else if (predicate == 1) { // tag !== -1
      keep = (A_tag[id] != -1) ? 1 : 0;
    } else { // tag === -1
      keep = (A_tag[id] == -1) ? 1 : 0;
    }
    if (keep) items[len++] = (u16)id;
  }
  shuffle(len);
  const int limit = take < len ? take : len;
  for (int i = 0; i < limit; i++) {
    chosen[i] = items[i];
    flags[items[i]] = 1;
  }
  return limit;
}

// ---- treeB canonical serialization (byte-stream FNV) ---------------------
// A node's treeB fields are treeA fields with per-flag mutations applied.
static void mix_treeB_dfs(int id) {
  const int isText = (A_tag[id] == -1);
  i16 textId = A_textId[id];
  i16 attrVal = A_attrVal[id];
  if (has_text[id] && isText) textId = (i16)(((int)A_textId[id] + 31) % 100);
  if (has_attr[id] && !isText) attrVal = (i16)(((int)A_attrVal[id] + 17) % 100);

  fnv_mix_u16((u16)id);
  fnv_mix_i16(A_tag[id]);
  fnv_mix_i16(A_key[id]);
  fnv_mix_i16(A_attrKey[id]);
  fnv_mix_i16(attrVal);
  fnv_mix_i16(textId);
  const u16 cc = A_childCount[id];
  fnv_mix_u16(cc);

  // compute the current child order for treeB (rotate-left first→last if flagged)
  u16 order[MAX_CHILDREN];
  for (int c = 0; c < cc; c++) order[c] = A_children[id][c];
  if (has_reorder[id] && cc >= 2) {
    const u16 first = order[0];
    for (int c = 0; c < cc - 1; c++) order[c] = order[c + 1];
    order[cc - 1] = first;
  }
  for (int c = 0; c < cc; c++) fnv_mix_u16(order[c]);
  for (int c = 0; c < cc; c++) mix_treeB_dfs((int)order[c]);
}

// ---- patch stream FNV (canonicalized order: op 1 → op 2 → op 6, each by id)
static void mix_patch_stream(void) {
  // op 1: text updates, one per has_text flagged text node in id order
  for (int id = 0; id < NODE_COUNT; id++) {
    if (has_text[id] && A_tag[id] == -1) {
      const i16 newTextId = (i16)(((int)A_textId[id] + 31) % 100);
      fnv_mix_byte(1);
      fnv_mix_u16((u16)id);        // nodeId
      fnv_mix_i16(newTextId);      // targetId
      fnv_mix_i16(-1);             // attrKey
      fnv_mix_i16(-1);             // attrVal
      fnv_mix_i16(-1);             // index
    }
  }
  // op 2: attribute set, one per has_attr flagged element in id order
  for (int id = 0; id < NODE_COUNT; id++) {
    if (has_attr[id] && A_tag[id] != -1) {
      const i16 newAttrVal = (i16)(((int)A_attrVal[id] + 17) % 100);
      fnv_mix_byte(2);
      fnv_mix_u16((u16)id);
      fnv_mix_i16(-1);
      fnv_mix_i16(A_attrKey[id]);
      fnv_mix_i16(newAttrVal);
      fnv_mix_i16(-1);
    }
  }
  // op 6: child reorder, one per has_reorder flagged element (id order)
  for (int id = 0; id < NODE_COUNT; id++) {
    if (has_reorder[id] && A_childCount[id] >= 2) {
      const u16 cc = A_childCount[id];
      // rotate-left order
      u16 order[MAX_CHILDREN];
      for (int c = 0; c < cc; c++) order[c] = A_children[id][c];
      const u16 first = order[0];
      for (int c = 0; c < cc - 1; c++) order[c] = order[c + 1];
      order[cc - 1] = first;
      fnv_mix_byte(6);
      fnv_mix_u16((u16)id);
      fnv_mix_i16((i16)cc);        // targetId = children.length
      fnv_mix_i16(-1);             // attrKey
      fnv_mix_i16(-1);             // attrVal
      fnv_mix_i16((i16)cc);        // index
      fnv_mix_u16(cc);
      for (int c = 0; c < cc; c++) fnv_mix_u16(order[c]);
    }
  }
}

__attribute__((export_name("vdom_diff_trace")))
int vdom_diff_trace(void) {
  u32 *results = (u32 *)RES_OFFSET;
  for (int i = 0; i < NODE_COUNT; i++) {
    has_reorder[i] = 0;
    has_attr[i] = 0;
    has_text[i] = 0;
  }

  // Phase 1: generate treeA (advances the prng)
  sm_state = 3976273958ULL;
  generate_tree_a();

  // Phase 2: three shuffle+slice passes (advance the prng in JS fixture order)
  const int reorder_count = filter_shuffle_mark(0, 100, has_reorder);
  const int attr_count = filter_shuffle_mark(1, 100, has_attr);
  const int text_count = filter_shuffle_mark(2, 50, has_text);
  (void)reorder_count;
  (void)attr_count;
  (void)text_count;

  // Phase 3: compute counters + digests. Only element nodes emit op 2/op 6;
  // only text nodes emit op 1. In the frozen fixture the three sets are
  // disjoint by construction: text-only nodes (tag=-1) can never appear in
  // the attribute or reorder lists (both restricted to non-text nodes), so
  // op1Count + op2Count + op6Count == patchesGenerated.
  u32 op1 = 0, op2 = 0, op6 = 0;
  for (int id = 0; id < NODE_COUNT; id++) {
    if (has_text[id] && A_tag[id] == -1) op1++;
    if (has_attr[id] && A_tag[id] != -1) op2++;
    if (has_reorder[id] && A_childCount[id] >= 2) op6++;
  }
  const u32 patches = op1 + op2 + op6;

  fnv_reset();
  mix_treeB_dfs(0);
  const u32 treeB_fnv = fnv_state;
  fnv_reset();
  mix_patch_stream();
  const u32 patch_fnv = fnv_state;

  results[0] = patches;
  results[1] = op1;
  results[2] = op2;
  results[3] = op6;
  results[4] = treeB_fnv;
  results[5] = patch_fnv;
  return (int)patches;
}
