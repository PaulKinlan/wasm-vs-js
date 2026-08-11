// gc_document_kernel.cpp — multilang compute core for text.gc-document-edit.v1.
//
// Same ABI as gc_document_kernel.c: the adapter writes the frozen fixture
// bytes to FIXTURE_OFFSET (192 KiB) and passes the byte length; the kernel
// parses parseFixture + executeFixture (256 initial labelled nodes, 10,000
// inserts/deletes/reparents) and writes counters + FNV-1a digest of the DFS
// canonical traversal to RES_OFFSET (512 KiB). Returns final-nodes.

constexpr int MAX_SLOTS = 4096;
constexpr int FIXTURE_OFFSET = 196608;
constexpr int RES_OFFSET = 524288;

using u32 = unsigned int;
using i32 = int;
using u16 = unsigned short;
using u8 = unsigned char;

static i32 parent_of[MAX_SLOTS];
static i32 first_child_of[MAX_SLOTS];
static i32 prev_sibling_of[MAX_SLOTS];
static i32 next_sibling_of[MAX_SLOTS];
static u32 child_count_of[MAX_SLOTS];
static u32 label_off_of[MAX_SLOTS];
static u16 label_hex_len_of[MAX_SLOTS];

static u32 fnv;
static void fnv_reset() { fnv = 0x811c9dc5U; }
static void fnv_mix_byte(u8 b) { fnv ^= static_cast<u32>(b); fnv *= 0x01000193U; }
static void fnv_mix_u32(u32 v) {
  fnv_mix_byte(static_cast<u8>(v & 0xff));
  fnv_mix_byte(static_cast<u8>((v >> 8) & 0xff));
  fnv_mix_byte(static_cast<u8>((v >> 16) & 0xff));
  fnv_mix_byte(static_cast<u8>((v >> 24) & 0xff));
}

static u8 fixture_at(u32 off) {
  return *(reinterpret_cast<u8 *>(FIXTURE_OFFSET) + off);
}
static int is_digit(u8 c) { return c >= '0' && c <= '9'; }
static u8 hex_val(u8 c) {
  if (c >= '0' && c <= '9') return static_cast<u8>(c - '0');
  if (c >= 'a' && c <= 'f') return static_cast<u8>(c - 'a' + 10);
  return static_cast<u8>(c - 'A' + 10);
}

static i32 read_int(u32 *off, u32 end) {
  int neg = 0;
  if (*off < end && fixture_at(*off) == '-') { neg = 1; (*off)++; }
  i32 v = 0;
  while (*off < end && is_digit(fixture_at(*off))) {
    v = v * 10 + static_cast<i32>(fixture_at(*off) - '0');
    (*off)++;
  }
  return neg ? -v : v;
}
static void skip_delim(u32 *off) { (*off)++; }
static void read_hex_span(u32 *off, u32 end, u32 *start_off, u16 *hex_len) {
  *start_off = *off;
  u32 start = *off;
  while (*off < end && fixture_at(*off) != '\t' && fixture_at(*off) != '\n') (*off)++;
  *hex_len = static_cast<u16>(*off - start);
}
static void skip_line(u32 *off, u32 end) {
  while (*off < end && fixture_at(*off) != '\n') (*off)++;
  if (*off < end) (*off)++;
}
static i32 read_header_count(u32 *off, u32 end) {
  while (*off < end && fixture_at(*off) != '\t') (*off)++;
  if (*off < end) (*off)++;
  i32 count = read_int(off, end);
  skip_line(off, end);
  return count;
}

static void link_after(i32 parent, i32 anchor, i32 node) {
  if (anchor == -1) {
    const i32 old_head = first_child_of[parent];
    next_sibling_of[node] = old_head;
    prev_sibling_of[node] = -1;
    if (old_head != -1) prev_sibling_of[old_head] = node;
    first_child_of[parent] = node;
  } else {
    const i32 old_next = next_sibling_of[anchor];
    next_sibling_of[node] = old_next;
    prev_sibling_of[node] = anchor;
    if (old_next != -1) prev_sibling_of[old_next] = node;
    next_sibling_of[anchor] = node;
  }
  child_count_of[parent]++;
}
static void insert_at_position(i32 parent, i32 position, i32 node) {
  if (position == 0) { link_after(parent, -1, node); return; }
  i32 cur = first_child_of[parent];
  for (i32 k = 0; k < position - 1 && cur != -1; k++) cur = next_sibling_of[cur];
  link_after(parent, cur, node);
}
static void splice_out(i32 node) {
  const i32 par = parent_of[node];
  const i32 p = prev_sibling_of[node];
  const i32 n = next_sibling_of[node];
  if (p == -1) first_child_of[par] = n;
  else next_sibling_of[p] = n;
  if (n != -1) prev_sibling_of[n] = p;
  prev_sibling_of[node] = -1;
  next_sibling_of[node] = -1;
  child_count_of[par]--;
}

static void dfs_mix(i32 slot) {
  fnv_mix_u32(static_cast<u32>(slot));
  const u32 hex_len = static_cast<u32>(label_hex_len_of[slot]);
  const u32 byte_len = hex_len / 2;
  fnv_mix_u32(byte_len);
  const u32 off = label_off_of[slot];
  for (u32 i = 0; i < byte_len; i++) {
    const u8 hi = fixture_at(off + i * 2);
    const u8 lo = fixture_at(off + i * 2 + 1);
    fnv_mix_byte(static_cast<u8>((hex_val(hi) << 4) | hex_val(lo)));
  }
  fnv_mix_u32(child_count_of[slot]);
  for (i32 c = first_child_of[slot]; c != -1; c = next_sibling_of[c]) dfs_mix(c);
}

extern "C" __attribute__((export_name("gc_document_edit_trace")))
int gc_document_edit_trace(u32 fixture_len) {
  u32 *results = reinterpret_cast<u32 *>(RES_OFFSET);
  for (i32 i = 0; i < MAX_SLOTS; i++) {
    parent_of[i] = -2;
    first_child_of[i] = -1;
    prev_sibling_of[i] = -1;
    next_sibling_of[i] = -1;
    child_count_of[i] = 0;
    label_off_of[i] = 0;
    label_hex_len_of[i] = 0;
  }

  u32 off = 0;
  const u32 end = fixture_len;
  skip_line(&off, end);
  const i32 initial_count = read_header_count(&off, end);
  (void)read_header_count(&off, end);

  u32 child_insertions = 0, child_removals = 0, parent_writes = 0;
  u32 node_count = 0;

  for (i32 i = 0; i < initial_count; i++) {
    off += 2;
    const i32 id = read_int(&off, end); skip_delim(&off);
    const i32 parentId = read_int(&off, end); skip_delim(&off);
    const i32 position = read_int(&off, end); skip_delim(&off);
    u32 label_off = 0;
    u16 label_hex_len = 0;
    read_hex_span(&off, end, &label_off, &label_hex_len);
    skip_line(&off, end);
    label_off_of[id] = label_off;
    label_hex_len_of[id] = label_hex_len;
    if (parentId == -1) {
      parent_of[id] = -1;
    } else {
      parent_of[id] = parentId;
      insert_at_position(parentId, position, id);
      child_insertions++;
      parent_writes++;
    }
    node_count++;
  }

  u32 inserts = 0, deletes = 0, reparents = 0;
  while (off < end) {
    const u8 tag = fixture_at(off);
    if (tag == '\n') { off++; continue; }
    off++;
    skip_delim(&off);
    if (tag == 'I') {
      const i32 id = read_int(&off, end); skip_delim(&off);
      const i32 parentId = read_int(&off, end); skip_delim(&off);
      const i32 position = read_int(&off, end); skip_delim(&off);
      u32 label_off = 0;
      u16 label_hex_len = 0;
      read_hex_span(&off, end, &label_off, &label_hex_len);
      skip_line(&off, end);
      label_off_of[id] = label_off;
      label_hex_len_of[id] = label_hex_len;
      parent_of[id] = parentId;
      insert_at_position(parentId, position, id);
      inserts++;
      child_insertions++;
      parent_writes++;
      node_count++;
    } else if (tag == 'D') {
      const i32 id = read_int(&off, end);
      skip_line(&off, end);
      splice_out(id);
      parent_of[id] = -2;
      deletes++;
      child_removals++;
      parent_writes++;
      node_count--;
    } else if (tag == 'R') {
      const i32 id = read_int(&off, end); skip_delim(&off);
      const i32 parentId = read_int(&off, end); skip_delim(&off);
      const i32 position = read_int(&off, end);
      skip_line(&off, end);
      splice_out(id);
      parent_of[id] = parentId;
      insert_at_position(parentId, position, id);
      reparents++;
      child_insertions++;
      child_removals++;
      parent_writes++;
    } else {
      skip_line(&off, end);
    }
  }

  fnv_reset();
  dfs_mix(0);
  results[0] = inserts;
  results[1] = deletes;
  results[2] = reparents;
  results[3] = node_count;
  results[4] = child_insertions;
  results[5] = child_removals;
  results[6] = parent_writes;
  results[7] = fnv;
  return static_cast<int>(node_count);
}
