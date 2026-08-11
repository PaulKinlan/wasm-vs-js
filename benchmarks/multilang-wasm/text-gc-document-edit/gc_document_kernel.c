// gc_document_kernel.c — multilang compute core for text.gc-document-edit.v1.
//
// ABI (mirrors the multilang-wasm kernels): the adapter writes the frozen
// fixture bytes into linear memory at offset 0 (byte length passed in), and
// the kernel parses parseFixture + executeFixture (256 initial labelled nodes
// on a 3-ary DAG plus 10,000 edits — inserts/deletes/reparents mirroring
// benchmarks/v1/text-gc-document-edit/workload.js), writes counters + a
// deterministic FNV-1a digest of the DFS canonical traversal (u32 id +
// label bytes + u32 child count per node) to a fixed memory offset, and
// returns the final node count.
//
// Results (fixed offset 327680):
//   [0] inserts             (=3334)   [1] deletes         (=3333)
//   [2] reparents           (=3333)   [3] final-nodes     (=257)
//   [4] child-insertions    (=6922)   [5] child-removals  (=6666)
//   [6] parent-writes       (=10255)  [7] canonical FNV-1a (u32)
// Exports: i32 gc_document_edit_trace(u32 fixture_len) -> final_nodes

#define MAX_SLOTS 4096                 // ids in the frozen fixture max at 3589
// clang/wasm-ld defaults place the stack at 0..64KiB and the .bss/data
// section immediately after (data_end ≈ 172 KiB for our slot arrays). Put
// the fixture bytes and results well above data_end so the adapter's write
// cannot clobber our slot storage. Compile with --initial-memory=655360.
#define FIXTURE_OFFSET 196608          // 192 KiB, past LLD's default data_end
#define RES_OFFSET 524288              // 512 KiB — past 256 KiB max fixture

typedef unsigned int u32;
typedef int i32;
typedef unsigned short u16;
typedef unsigned char u8;

// Slot storage (indexed by fixture id, which is <= 3589)
static i32 parent_of[MAX_SLOTS];       // -2 = absent, -1 = root, else parent id
static i32 first_child_of[MAX_SLOTS];  // -1 = none
static i32 prev_sibling_of[MAX_SLOTS]; // -1 = first child
static i32 next_sibling_of[MAX_SLOTS]; // -1 = last child
static u32 child_count_of[MAX_SLOTS];
static u32 label_off_of[MAX_SLOTS];    // hex label byte offset in fixture
static u16 label_hex_len_of[MAX_SLOTS];

// FNV-1a 32-bit
static u32 fnv;
static void fnv_reset(void) { fnv = 0x811c9dc5U; }
static void fnv_mix_byte(u8 b) { fnv ^= (u32)b; fnv *= 0x01000193U; }
static void fnv_mix_u32(u32 v) {
  fnv_mix_byte((u8)(v & 0xff));
  fnv_mix_byte((u8)((v >> 8) & 0xff));
  fnv_mix_byte((u8)((v >> 16) & 0xff));
  fnv_mix_byte((u8)((v >> 24) & 0xff));
}

static u8 fixture_at(u32 off) { return *((u8 *)(FIXTURE_OFFSET) + off); }
static int is_digit(u8 c) { return c >= '0' && c <= '9'; }
static int is_hex(u8 c) {
  return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}
static u8 hex_val(u8 c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return c - 'A' + 10;
}

// Read decimal integer at *off; may be negative (with leading '-').
// Advances *off past the number. Returns the value.
static i32 read_int(u32 *off, u32 end) {
  int neg = 0;
  if (*off < end && fixture_at(*off) == '-') { neg = 1; (*off)++; }
  i32 v = 0;
  while (*off < end && is_digit(fixture_at(*off))) {
    v = v * 10 + (i32)(fixture_at(*off) - '0');
    (*off)++;
  }
  return neg ? -v : v;
}
// Advance *off past a single delimiter (\t or \n).
static void skip_delim(u32 *off) { (*off)++; }
// Read the hex-label span at *off up to \t or \n; return start_off & hex_len.
static void read_hex_span(u32 *off, u32 end, u32 *start_off, u16 *hex_len) {
  *start_off = *off;
  u32 start = *off;
  while (*off < end && fixture_at(*off) != '\t' && fixture_at(*off) != '\n') {
    (*off)++;
  }
  *hex_len = (u16)(*off - start);
}
// Skip to the next newline (or end).
static void skip_line(u32 *off, u32 end) {
  while (*off < end && fixture_at(*off) != '\n') (*off)++;
  if (*off < end) (*off)++;
}
// Skip past a header line by finding a \t, reading the count, then skipping to newline.
static i32 read_header_count(u32 *off, u32 end) {
  while (*off < end && fixture_at(*off) != '\t') (*off)++;
  if (*off < end) (*off)++;
  i32 count = read_int(off, end);
  skip_line(off, end);
  return count;
}

// Doubly linked list helpers.
static void link_after(i32 parent, i32 anchor, i32 node) {
  // insert `node` immediately after `anchor` inside parent's children.
  if (anchor == -1) {
    // anchor == -1 means insert at head
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
  // walk to find the (position-1)th child. Anchor = -1 when position == 0.
  if (position == 0) {
    link_after(parent, -1, node);
    return;
  }
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

// Decode a hex-encoded label and feed each decoded byte to FNV.
static u32 mix_label(u32 off, u16 hex_len) {
  const u32 byte_len = (u32)(hex_len / 2);
  fnv_mix_u32(byte_len);
  for (u32 i = 0; i < byte_len; i++) {
    const u8 hi = fixture_at(off + i * 2);
    const u8 lo = fixture_at(off + i * 2 + 1);
    fnv_mix_byte((u8)((hex_val(hi) << 4) | hex_val(lo)));
  }
  return byte_len;
}

static void dfs_mix(i32 slot) {
  fnv_mix_u32((u32)slot);
  mix_label(label_off_of[slot], label_hex_len_of[slot]);
  fnv_mix_u32(child_count_of[slot]);
  for (i32 c = first_child_of[slot]; c != -1; c = next_sibling_of[c]) {
    dfs_mix(c);
  }
}

__attribute__((export_name("gc_document_edit_trace")))
int gc_document_edit_trace(u32 fixture_len) {
  u32 *results = (u32 *)RES_OFFSET;
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
  // Skip format-header line.
  skip_line(&off, end);
  // "initial\t<N>\n"
  const i32 initial_count = read_header_count(&off, end);
  // "operations\t<M>\n"
  (void)read_header_count(&off, end);

  u32 child_insertions = 0;
  u32 child_removals = 0;
  u32 parent_writes = 0;
  u32 node_count = 0;

  // Read initial rows: "N\t<id>\t<parentId>\t<position>\t<hexLabel>\n"
  for (i32 i = 0; i < initial_count; i++) {
    // 'N' then '\t'
    off += 2;
    const i32 id = read_int(&off, end);
    skip_delim(&off);
    const i32 parentId = read_int(&off, end);
    skip_delim(&off);
    const i32 position = read_int(&off, end);
    skip_delim(&off);
    u32 label_off = 0;
    u16 label_hex_len = 0;
    read_hex_span(&off, end, &label_off, &label_hex_len);
    skip_line(&off, end);

    label_off_of[id] = label_off;
    label_hex_len_of[id] = label_hex_len;
    if (parentId == -1) {
      // root
      parent_of[id] = -1;
      first_child_of[id] = -1;
      child_count_of[id] = 0;
    } else {
      parent_of[id] = parentId;
      first_child_of[id] = -1;
      child_count_of[id] = 0;
      insert_at_position(parentId, position, id);
      child_insertions++;
      parent_writes++;
    }
    node_count++;
  }

  u32 inserts = 0, deletes = 0, reparents = 0;

  // Ops loop
  while (off < end) {
    const u8 tag = fixture_at(off);
    if (tag == '\n') { off++; continue; }
    off++;               // skip tag
    skip_delim(&off);    // skip \t
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
      first_child_of[id] = -1;
      child_count_of[id] = 0;
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
      // unknown tag — skip line defensively
      skip_line(&off, end);
    }
  }

  // Traversal-based canonical FNV-1a digest.
  fnv_reset();
  dfs_mix(0);
  const u32 canonical_fnv = fnv;

  results[0] = inserts;
  results[1] = deletes;
  results[2] = reparents;
  results[3] = node_count;
  results[4] = child_insertions;
  results[5] = child_removals;
  results[6] = parent_writes;
  results[7] = canonical_fnv;
  return (int)node_count;
}
