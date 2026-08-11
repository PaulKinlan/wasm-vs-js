// grid_trace_kernel.cpp — multilang compute core for dom.virtualized-grid.v1.
//
// Same ABI as grid_trace_kernel.c: the adapter writes the frozen
// 1,604,864-byte virtualized-grid fixture at FIXTURE_OFFSET and passes the
// byte length; this kernel replays the 300-event trace bit-identical to
// createJavaScriptGridExecution() in benchmarks/base/dom-virtualized-grid/
// engine.js and grid.c, and writes the FNV-1a commandDigest + counters +
// final checkpoint to RES_OFFSET.

// FIXTURE and RES offsets sit past every language's .bss window:
// C/C++ .bss ends near 2.0 MiB, Rust's __data_end lands near 4.0 MiB (rustc
// auto-sizes initial memory), and AS's fixed offsets occupy < 2.0 MiB.
// 3 MiB fixture / 5 MiB result is safely past all three.
constexpr unsigned int FIXTURE_OFFSET = 3145728u;   // 3 MiB
constexpr unsigned int RES_OFFSET = 5242880u;       // 5 MiB

constexpr unsigned int ROWS = 100000u;
constexpr unsigned int ACTIONS = 300u;
constexpr unsigned int HEADER_BYTES = 64u;
constexpr unsigned int ROW_BYTES = 16u;
constexpr unsigned int ACTION_BYTES = 16u;
constexpr unsigned int FIXTURE_BYTES = HEADER_BYTES + ROWS * ROW_BYTES + ACTIONS * ACTION_BYTES;
constexpr unsigned int MAGIC = 0x31445247u;
constexpr unsigned int EMPTY = 0xffffffffu;
constexpr unsigned int MAX_MOUNTED = 28u;

using u32 = unsigned int;
using i32 = int;
using u8 = unsigned char;

static i32 scores[ROWS];
static u32 groups[ROWS];
static u32 order_rows[ROWS];
static u32 scratch_rows[ROWS];
static u32 filtered_rows[ROWS];

static u32 slot_rows[MAX_MOUNTED];
static i32 slot_scores[MAX_MOUNTED];
static u32 slot_indexes[MAX_MOUNTED];
static u32 slot_selected[MAX_MOUNTED];
static u32 slot_positions[MAX_MOUNTED];
static u32 slot_count;

static u8 fixture_at(u32 off) {
  return *(reinterpret_cast<u8 *>(FIXTURE_OFFSET) + off);
}
static u32 read32(u32 at) {
  return static_cast<u32>(fixture_at(at)) |
    (static_cast<u32>(fixture_at(at + 1)) << 8) |
    (static_cast<u32>(fixture_at(at + 2)) << 16) |
    (static_cast<u32>(fixture_at(at + 3)) << 24);
}

static u32 command_digest;
static void hash_u32(u32 value) {
  for (u32 i = 0; i < 4u; i++) {
    command_digest ^= value & 0xffu;
    command_digest *= 0x01000193u;
    value >>= 8;
  }
}

static u32 command_count;
static u32 rows_scanned;
static u32 comparisons;
static u32 events;
static u32 physical_creates;
static u32 physical_reuses;
static u32 physical_updates;
static u32 physical_placements;
static u32 physical_hides;
static u32 focus_operations;
static u32 layout_reads;
static u32 filtered_length;
static u32 final_start;
static u32 final_end;
static u32 final_visible_length;
static u32 focused;
static u32 selected;
static u32 filter_group;
static u32 scroll_offset;

static void emit(u32 op, u32 a, u32 b, u32 c, u32 d, u32 e) {
  hash_u32(op);
  hash_u32(a);
  hash_u32(b);
  hash_u32(c);
  hash_u32(d);
  hash_u32(e);
  command_count++;
}

static int compare_rows(u32 a, u32 b, u32 direction) {
  if (scores[a] != scores[b]) {
    i32 diff = direction ? scores[b] - scores[a] : scores[a] - scores[b];
    return diff;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

static void rebuild_filter(u32 fg) {
  filtered_length = 0;
  for (u32 i = 0; i < ROWS; i++) {
    u32 row = order_rows[i];
    rows_scanned++;
    if (fg == EMPTY || groups[row] == fg) filtered_rows[filtered_length++] = row;
  }
}

static void stable_sort(u32 direction, u32 fg) {
  u32 *source = order_rows;
  u32 *target = scratch_rows;
  for (u32 width = 1; width < ROWS; width *= 2) {
    for (u32 left = 0; left < ROWS; left += width * 2u) {
      u32 middle = left + width < ROWS ? left + width : ROWS;
      u32 right = left + width * 2u < ROWS ? left + width * 2u : ROWS;
      u32 i = left, j = middle, out = left;
      while (i < middle && j < right) {
        comparisons++;
        if (compare_rows(source[i], source[j], direction) <= 0) target[out++] = source[i++];
        else target[out++] = source[j++];
      }
      while (i < middle) target[out++] = source[i++];
      while (j < right) target[out++] = source[j++];
    }
    u32 *swap = source;
    source = target;
    target = swap;
  }
  if (source != order_rows) {
    for (u32 i = 0; i < ROWS; i++) order_rows[i] = source[i];
  }
  rebuild_filter(fg);
}

static int visible_index(u32 row, const u32 *visible, u32 length) {
  for (u32 i = 0; i < length; i++) {
    if (visible[i] == row) return static_cast<int>(i);
  }
  return -1;
}

static void reconcile(u32 action_index) {
  constexpr u32 visibleRows = 20u;
  constexpr u32 overscan = 4u;
  u32 quotient = scroll_offset / 24u;
  u32 base = filtered_length < quotient ? filtered_length : quotient;
  u32 start = base > overscan ? base - overscan : 0u;
  u32 upper = base + visibleRows + overscan;
  u32 end = upper < filtered_length ? upper : filtered_length;
  u32 visible_length = end - start;

  u32 visible[MAX_MOUNTED];
  u32 used[MAX_MOUNTED];
  for (u32 i = 0; i < MAX_MOUNTED; i++) used[i] = 0;
  for (u32 i = 0; i < visible_length; i++) visible[i] = filtered_rows[start + i];

  for (u32 position = 0; position < visible_length; position++) {
    u32 row = visible[position];
    int slot = -1;
    for (u32 candidate = 0; candidate < slot_count; candidate++) {
      if (slot_rows[candidate] == row) { slot = static_cast<int>(candidate); break; }
    }
    u32 is_selected = row == selected ? 1u : 0u;
    if (slot < 0) {
      for (u32 candidate = 0; candidate < slot_count; candidate++) {
        if (
          visible_index(slot_rows[candidate], visible, visible_length) < 0 &&
          !used[candidate]
        ) { slot = static_cast<int>(candidate); break; }
      }
      if (slot < 0) {
        if (slot_count >= MAX_MOUNTED) return;
        slot = static_cast<int>(slot_count++);
        emit(1u, static_cast<u32>(slot), row, start + position, static_cast<u32>(scores[row]), is_selected);
        physical_creates++;
      } else {
        emit(2u, static_cast<u32>(slot), row, start + position, static_cast<u32>(scores[row]), is_selected);
        physical_reuses++;
      }
      slot_rows[slot] = row;
      slot_scores[slot] = scores[row];
      slot_indexes[slot] = start + position;
      slot_selected[slot] = is_selected;
    } else if (
      slot_scores[slot] != scores[row] ||
      slot_indexes[slot] != start + position ||
      slot_selected[slot] != is_selected
    ) {
      emit(3u, static_cast<u32>(slot), row, start + position, static_cast<u32>(scores[row]), is_selected);
      physical_updates++;
      slot_scores[slot] = scores[row];
      slot_indexes[slot] = start + position;
      slot_selected[slot] = is_selected;
    }
    used[slot] = 1u;
    if (slot_positions[slot] != position) {
      emit(4u, static_cast<u32>(slot), position, row, start + position, 0u);
      physical_placements++;
      slot_positions[slot] = position;
    }
  }
  for (u32 slot = 0; slot < slot_count; slot++) {
    if (!used[slot] && slot_rows[slot] != EMPTY) {
      emit(5u, slot, slot_rows[slot], 0u, 0u, 0u);
      physical_hides++;
      slot_rows[slot] = EMPTY;
      slot_positions[slot] = EMPTY;
    }
  }
  for (u32 slot = 0; slot < slot_count; slot++) {
    if (slot_rows[slot] == focused) {
      emit(6u, slot, focused, 0u, 0u, 0u);
      focus_operations++;
      break;
    }
  }
  emit(7u, action_index, visible_length, start, end, filtered_length);
  layout_reads++;
  final_start = start;
  final_end = end;
  final_visible_length = visible_length;
}

extern "C" __attribute__((export_name("grid_trace")))
int grid_trace(u32 fixture_len) {
  if (fixture_len != FIXTURE_BYTES) return 1;
  if (
    read32(0) != MAGIC || read32(4) != 1u ||
    read32(8) != ROWS || read32(12) != ACTIONS
  ) return 2;

  command_digest = 0x811c9dc5u;
  command_count = 0;
  rows_scanned = 0;
  comparisons = 0;
  events = 0;
  physical_creates = 0;
  physical_reuses = 0;
  physical_updates = 0;
  physical_placements = 0;
  physical_hides = 0;
  focus_operations = 0;
  layout_reads = 0;
  filtered_length = ROWS;
  focused = EMPTY;
  selected = EMPTY;
  filter_group = EMPTY;
  scroll_offset = 0;
  slot_count = 0;
  for (u32 i = 0; i < MAX_MOUNTED; i++) {
    slot_rows[i] = EMPTY;
    slot_indexes[i] = EMPTY;
    slot_positions[i] = EMPTY;
    slot_selected[i] = 0;
    slot_scores[i] = 0;
  }

  u32 row_offset = HEADER_BYTES;
  for (u32 i = 0; i < ROWS; i++) {
    u32 id = read32(row_offset);
    if (id != i) return 3;
    scores[id] = static_cast<i32>(read32(row_offset + 4u));
    groups[id] = read32(row_offset + 8u);
    order_rows[i] = id;
    filtered_rows[i] = id;
    row_offset += ROW_BYTES;
  }

  u32 action_offset = HEADER_BYTES + ROWS * ROW_BYTES;
  for (u32 action = 0; action < ACTIONS; action++) {
    u32 at = action_offset + action * ACTION_BYTES;
    if (read32(at) != action * 100u) return 4;
    u32 type = read32(at + 4u);
    u32 a = read32(at + 8u);
    u32 b = read32(at + 12u);
    if (type == 0u) {
      u32 max_offset = filtered_length > 20u ? (filtered_length - 20u) * 24u : 0u;
      scroll_offset = a < max_offset ? a : max_offset;
    } else if (type == 1u) {
      filter_group = a;
      rebuild_filter(filter_group);
      scroll_offset = 0;
    } else if (type == 2u) {
      stable_sort(a & 1u, filter_group);
    } else if (type == 3u) {
      if (a >= ROWS) return 5;
      scores[a] = static_cast<i32>(b);
      selected = a;
    } else if (type == 4u) {
      if (a == EMPTY) {
        u32 quot = scroll_offset / 24u;
        u32 base_pos = quot + 5u;
        if (base_pos >= filtered_length) base_pos = filtered_length - 1u;
        focused = filtered_rows[base_pos];
      } else {
        if (a >= ROWS) return 6;
        focused = a;
      }
      selected = focused;
    } else return 7;
    events++;
    reconcile(action);
  }

  u32 *results = reinterpret_cast<u32 *>(RES_OFFSET);
  results[0] = command_digest;
  results[1] = rows_scanned;
  results[2] = comparisons;
  results[3] = events;
  results[4] = command_count;
  results[5] = physical_creates;
  results[6] = physical_reuses;
  results[7] = physical_updates;
  results[8] = physical_placements;
  results[9] = physical_hides;
  results[10] = focus_operations;
  results[11] = layout_reads;
  results[12] = final_start;
  results[13] = final_end;
  results[14] = final_visible_length;
  results[15] = focused;
  results[16] = selected;
  results[17] = filtered_length;
  return 0;
}
