// vdom_kernel.cpp — multilang compute core for dom.vdom-diff-patch.v1.
//
// Same ABI as vdom_kernel.c: generates the frozen 1,000-node treeA + treeB
// from SplitMix64 seed 3976273958, runs the exact createVDOMPatches diff
// (100 op-6 reorder, 100 op-2 attr-set, 50 op-1 text-update ⇒ 250 patches),
// writes counters + FNV-1a canonical/patch-stream digests to fixed offset
// 16384, returns patchesGenerated.

constexpr int NODE_COUNT = 1000;
constexpr int TEXT_THRESHOLD = 333; // ceil((NODE_COUNT-1)/3)
constexpr int MAX_CHILDREN = 3;
constexpr int RES_OFFSET = 16384;

using u64 = unsigned long long;
using u32 = unsigned int;
using i32 = int;
using u16 = unsigned short;
using i16 = short;
using u8 = unsigned char;

static u64 sm_state;
static u32 next_uint32() {
  sm_state = sm_state + 0x9e3779b97f4a7c15ULL;
  u64 z = sm_state;
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
  z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
  z = z ^ (z >> 31);
  return static_cast<u32>(z & 0xffffffffULL);
}
static i32 next_int_range(i32 min, i32 max) {
  u32 span = static_cast<u32>(max - min + 1);
  return min + static_cast<i32>(next_uint32() % span);
}

static i16 A_tag[NODE_COUNT];
static i16 A_key[NODE_COUNT];
static i16 A_attrKey[NODE_COUNT];
static i16 A_attrVal[NODE_COUNT];
static i16 A_textId[NODE_COUNT];
static u16 A_childCount[NODE_COUNT];
static u16 A_children[NODE_COUNT][MAX_CHILDREN];
static u8 has_reorder[NODE_COUNT];
static u8 has_attr[NODE_COUNT];
static u8 has_text[NODE_COUNT];
static u16 items[NODE_COUNT];

static u32 fnv_state;
static void fnv_reset() { fnv_state = 0x811c9dc5U; }
static void fnv_mix_byte(u8 b) {
  fnv_state ^= static_cast<u32>(b);
  fnv_state *= 0x01000193U;
}
static void fnv_mix_u16(u16 v) {
  fnv_mix_byte(static_cast<u8>(v & 0xff));
  fnv_mix_byte(static_cast<u8>((v >> 8) & 0xff));
}
static void fnv_mix_i16(i16 v) {
  u16 u = static_cast<u16>(v);
  fnv_mix_byte(static_cast<u8>(u & 0xff));
  fnv_mix_byte(static_cast<u8>((u >> 8) & 0xff));
}

static void generate_tree_a() {
  A_tag[0] = 0;
  A_key[0] = -1;
  A_attrKey[0] = 0;
  A_attrVal[0] = 1;
  A_textId[0] = -1;
  A_childCount[0] = 0;
  for (int id = 1; id < NODE_COUNT; id++) {
    const int parentId = (id - 1) / 3;
    int isText = 0;
    if (id > TEXT_THRESHOLD) isText = (next_int_range(0, 4) == 0) ? 1 : 0;
    const i16 tag = isText ? static_cast<i16>(-1) : static_cast<i16>(next_int_range(0, 6));
    const int keyGate = next_int_range(0, 4);
    const i16 key = (keyGate == 0)
      ? static_cast<i16>(next_int_range(100, 999))
      : static_cast<i16>(-1);
    const i16 attrKey = isText ? static_cast<i16>(-1) : static_cast<i16>(next_int_range(0, 15));
    const i16 attrVal = isText ? static_cast<i16>(-1) : static_cast<i16>(next_int_range(0, 50));
    const i16 textId = isText ? static_cast<i16>(next_int_range(0, 100)) : static_cast<i16>(-1);
    A_tag[id] = tag;
    A_key[id] = key;
    A_attrKey[id] = attrKey;
    A_attrVal[id] = attrVal;
    A_textId[id] = textId;
    A_childCount[id] = 0;
    A_children[parentId][A_childCount[parentId]] = static_cast<u16>(id);
    A_childCount[parentId]++;
  }
}

static void shuffle(int len) {
  for (int i = len - 1; i > 0; i--) {
    const int j = next_int_range(0, i);
    const u16 t = items[i];
    items[i] = items[j];
    items[j] = t;
  }
}

static int filter_shuffle_mark(int predicate, int take, u8 *flags) {
  int len = 0;
  for (int id = 0; id < NODE_COUNT; id++) {
    int keep = 0;
    if (predicate == 0) keep = (A_childCount[id] >= 2) ? 1 : 0;
    else if (predicate == 1) keep = (A_tag[id] != -1) ? 1 : 0;
    else keep = (A_tag[id] == -1) ? 1 : 0;
    if (keep) items[len++] = static_cast<u16>(id);
  }
  shuffle(len);
  const int limit = take < len ? take : len;
  for (int i = 0; i < limit; i++) flags[items[i]] = 1;
  return limit;
}

static void mix_treeB_dfs(int id) {
  const int isText = (A_tag[id] == -1);
  i16 textId = A_textId[id];
  i16 attrVal = A_attrVal[id];
  if (has_text[id] && isText) textId = static_cast<i16>((static_cast<int>(A_textId[id]) + 31) % 100);
  if (has_attr[id] && !isText) attrVal = static_cast<i16>((static_cast<int>(A_attrVal[id]) + 17) % 100);

  fnv_mix_u16(static_cast<u16>(id));
  fnv_mix_i16(A_tag[id]);
  fnv_mix_i16(A_key[id]);
  fnv_mix_i16(A_attrKey[id]);
  fnv_mix_i16(attrVal);
  fnv_mix_i16(textId);
  const u16 cc = A_childCount[id];
  fnv_mix_u16(cc);

  u16 order[MAX_CHILDREN];
  for (int c = 0; c < cc; c++) order[c] = A_children[id][c];
  if (has_reorder[id] && cc >= 2) {
    const u16 first = order[0];
    for (int c = 0; c < cc - 1; c++) order[c] = order[c + 1];
    order[cc - 1] = first;
  }
  for (int c = 0; c < cc; c++) fnv_mix_u16(order[c]);
  for (int c = 0; c < cc; c++) mix_treeB_dfs(static_cast<int>(order[c]));
}

static void mix_patch_stream() {
  for (int id = 0; id < NODE_COUNT; id++) {
    if (has_text[id] && A_tag[id] == -1) {
      const i16 newTextId = static_cast<i16>((static_cast<int>(A_textId[id]) + 31) % 100);
      fnv_mix_byte(1);
      fnv_mix_u16(static_cast<u16>(id));
      fnv_mix_i16(newTextId);
      fnv_mix_i16(-1);
      fnv_mix_i16(-1);
      fnv_mix_i16(-1);
    }
  }
  for (int id = 0; id < NODE_COUNT; id++) {
    if (has_attr[id] && A_tag[id] != -1) {
      const i16 newAttrVal = static_cast<i16>((static_cast<int>(A_attrVal[id]) + 17) % 100);
      fnv_mix_byte(2);
      fnv_mix_u16(static_cast<u16>(id));
      fnv_mix_i16(-1);
      fnv_mix_i16(A_attrKey[id]);
      fnv_mix_i16(newAttrVal);
      fnv_mix_i16(-1);
    }
  }
  for (int id = 0; id < NODE_COUNT; id++) {
    if (has_reorder[id] && A_childCount[id] >= 2) {
      const u16 cc = A_childCount[id];
      u16 order[MAX_CHILDREN];
      for (int c = 0; c < cc; c++) order[c] = A_children[id][c];
      const u16 first = order[0];
      for (int c = 0; c < cc - 1; c++) order[c] = order[c + 1];
      order[cc - 1] = first;
      fnv_mix_byte(6);
      fnv_mix_u16(static_cast<u16>(id));
      fnv_mix_i16(static_cast<i16>(cc));
      fnv_mix_i16(-1);
      fnv_mix_i16(-1);
      fnv_mix_i16(static_cast<i16>(cc));
      fnv_mix_u16(cc);
      for (int c = 0; c < cc; c++) fnv_mix_u16(order[c]);
    }
  }
}

extern "C" __attribute__((export_name("vdom_diff_trace")))
int vdom_diff_trace() {
  u32 *results = reinterpret_cast<u32 *>(RES_OFFSET);
  for (int i = 0; i < NODE_COUNT; i++) {
    has_reorder[i] = 0;
    has_attr[i] = 0;
    has_text[i] = 0;
  }
  sm_state = 3976273958ULL;
  generate_tree_a();
  filter_shuffle_mark(0, 100, has_reorder);
  filter_shuffle_mark(1, 100, has_attr);
  filter_shuffle_mark(2, 50, has_text);

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
  return static_cast<int>(patches);
}
