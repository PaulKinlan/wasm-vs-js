#include <stdint.h>
#include <stddef.h>

#define ROWS 100000u
#define ACTIONS 300u
#define HEADER_BYTES 64u
#define ROW_BYTES 16u
#define ACTION_BYTES 16u
#define FIXTURE_BYTES (HEADER_BYTES + ROWS * ROW_BYTES + ACTIONS * ACTION_BYTES)
#define MAGIC 0x31445247u
#define RESULT_MAGIC 0x31525347u
#define EMPTY 0xffffffffu
#define MAX_MOUNTED 28u
#define COMMAND_WIDTH 6u
#define RESULT_HEADER_WORDS 20u
#define CHECKPOINTS 6u
#define CHECKPOINT_WORDS 8u
#define COMMAND_OFFSET (RESULT_HEADER_WORDS + CHECKPOINTS * CHECKPOINT_WORDS)
#define OUTPUT_WORDS 200000u

static uint8_t input_buffer[FIXTURE_BYTES];
static uint32_t output_buffer[OUTPUT_WORDS];
static int32_t scores[ROWS];
static uint32_t groups[ROWS];
static uint32_t order_rows[ROWS];
static uint32_t scratch_rows[ROWS];
static uint32_t filtered_rows[ROWS];

static uint32_t rows_scanned;
static uint32_t comparisons;
static uint32_t events;
static uint32_t command_count;
static uint32_t physical_creates;
static uint32_t physical_reuses;
static uint32_t physical_updates;
static uint32_t physical_placements;
static uint32_t physical_hides;
static uint32_t focus_operations;
static uint32_t layout_reads;
static uint32_t filtered_length;
static uint32_t final_start;
static uint32_t final_end;
static uint32_t focused;
static uint32_t selected;
static uint32_t filter_group;
static uint32_t scroll_offset;
static uint32_t next_action;
static uint32_t checkpoint;

static uint32_t slot_rows[MAX_MOUNTED];
static int32_t slot_scores[MAX_MOUNTED];
static uint32_t slot_indexes[MAX_MOUNTED];
static uint32_t slot_selected[MAX_MOUNTED];
static uint32_t slot_positions[MAX_MOUNTED];
static uint32_t slot_count;

static uint32_t load_u32(const uint8_t *p) {
  return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

static void emit(uint32_t op, uint32_t a, uint32_t b, uint32_t c, uint32_t d, uint32_t e) {
  uint32_t at = COMMAND_OFFSET + command_count * COMMAND_WIDTH;
  if (at + COMMAND_WIDTH > OUTPUT_WORDS) return;
  output_buffer[at] = op;
  output_buffer[at + 1] = a;
  output_buffer[at + 2] = b;
  output_buffer[at + 3] = c;
  output_buffer[at + 4] = d;
  output_buffer[at + 5] = e;
  command_count++;
}

static int compare_rows(uint32_t a, uint32_t b, uint32_t direction) {
  if (scores[a] != scores[b]) {
    return direction ? (scores[b] - scores[a]) : (scores[a] - scores[b]);
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

static void rebuild_filter(uint32_t filter_group) {
  filtered_length = 0;
  for (uint32_t i = 0; i < ROWS; i++) {
    uint32_t row = order_rows[i];
    rows_scanned++;
    if (filter_group == EMPTY || groups[row] == filter_group) filtered_rows[filtered_length++] = row;
  }
}

static void stable_sort(uint32_t direction, uint32_t filter_group) {
  uint32_t *source = order_rows;
  uint32_t *target = scratch_rows;
  for (uint32_t width = 1; width < ROWS; width *= 2) {
    for (uint32_t left = 0; left < ROWS; left += width * 2) {
      uint32_t middle = left + width < ROWS ? left + width : ROWS;
      uint32_t right = left + width * 2 < ROWS ? left + width * 2 : ROWS;
      uint32_t i = left;
      uint32_t j = middle;
      uint32_t out = left;
      while (i < middle && j < right) {
        comparisons++;
        if (compare_rows(source[i], source[j], direction) <= 0) target[out++] = source[i++];
        else target[out++] = source[j++];
      }
      while (i < middle) target[out++] = source[i++];
      while (j < right) target[out++] = source[j++];
    }
    uint32_t *swap = source;
    source = target;
    target = swap;
  }
  if (source != order_rows) {
    for (uint32_t i = 0; i < ROWS; i++) order_rows[i] = source[i];
  }
  rebuild_filter(filter_group);
}

static int visible_index(uint32_t row, const uint32_t *visible, uint32_t length) {
  for (uint32_t i = 0; i < length; i++) if (visible[i] == row) return (int)i;
  return -1;
}

static void save_checkpoint(uint32_t checkpoint, uint32_t action, uint32_t start, uint32_t end, uint32_t visible_length) {
  uint32_t at = RESULT_HEADER_WORDS + checkpoint * CHECKPOINT_WORDS;
  output_buffer[at] = action;
  output_buffer[at + 1] = start;
  output_buffer[at + 2] = end;
  output_buffer[at + 3] = visible_length;
  output_buffer[at + 4] = focused;
  output_buffer[at + 5] = selected;
  output_buffer[at + 6] = command_count;
  output_buffer[at + 7] = filtered_length;
}

static void reconcile(uint32_t action_index, uint32_t checkpoint_index) {
  uint32_t base = filtered_length < (output_buffer[19] / 24u) ? filtered_length : (output_buffer[19] / 24u);
  uint32_t start = base > 4u ? base - 4u : 0u;
  uint32_t end = base + 24u < filtered_length ? base + 24u : filtered_length;
  uint32_t visible[MAX_MOUNTED];
  uint32_t visible_length = end - start;
  uint32_t used[MAX_MOUNTED];
  for (uint32_t i = 0; i < MAX_MOUNTED; i++) used[i] = 0;
  for (uint32_t i = 0; i < visible_length; i++) visible[i] = filtered_rows[start + i];

  for (uint32_t position = 0; position < visible_length; position++) {
    uint32_t row = visible[position];
    int slot = -1;
    for (uint32_t candidate = 0; candidate < slot_count; candidate++) {
      if (slot_rows[candidate] == row) { slot = (int)candidate; break; }
    }
    uint32_t is_selected = row == selected ? 1u : 0u;
    if (slot < 0) {
      for (uint32_t candidate = 0; candidate < slot_count; candidate++) {
        if (visible_index(slot_rows[candidate], visible, visible_length) < 0 && !used[candidate]) {
          slot = (int)candidate;
          break;
        }
      }
      if (slot < 0) {
        if (slot_count >= MAX_MOUNTED) return;
        slot = (int)slot_count++;
        emit(1, (uint32_t)slot, row, start + position, (uint32_t)scores[row], is_selected);
        physical_creates++;
      } else {
        emit(2, (uint32_t)slot, row, start + position, (uint32_t)scores[row], is_selected);
        physical_reuses++;
      }
      slot_rows[slot] = row;
      slot_scores[slot] = scores[row];
      slot_indexes[slot] = start + position;
      slot_selected[slot] = is_selected;
    } else if (slot_scores[slot] != scores[row] || slot_indexes[slot] != start + position || slot_selected[slot] != is_selected) {
      emit(3, (uint32_t)slot, row, start + position, (uint32_t)scores[row], is_selected);
      physical_updates++;
      slot_scores[slot] = scores[row];
      slot_indexes[slot] = start + position;
      slot_selected[slot] = is_selected;
    }
    used[slot] = 1;
    if (slot_positions[slot] != position) {
      emit(4, (uint32_t)slot, position, row, start + position, 0);
      physical_placements++;
      slot_positions[slot] = position;
    }
  }
  for (uint32_t slot = 0; slot < slot_count; slot++) {
    if (!used[slot] && slot_rows[slot] != EMPTY) {
      emit(5, slot, slot_rows[slot], 0, 0, 0);
      physical_hides++;
      slot_rows[slot] = EMPTY;
      slot_positions[slot] = EMPTY;
    }
  }
  for (uint32_t slot = 0; slot < slot_count; slot++) {
    if (slot_rows[slot] == focused) {
      emit(6, slot, focused, 0, 0, 0);
      focus_operations++;
      break;
    }
  }
  emit(7, action_index, visible_length, start, end, filtered_length);
  layout_reads++;
  final_start = start;
  final_end = end;
  if (checkpoint_index < CHECKPOINTS) save_checkpoint(checkpoint_index, action_index + 1, start, end, visible_length);
}

uint8_t *input_ptr(void) { return input_buffer; }
uint32_t *result_ptr(void) { return output_buffer; }

int prepare(uint32_t length) {
  if (length != FIXTURE_BYTES) return 1;
  if (load_u32(input_buffer) != MAGIC || load_u32(input_buffer + 4) != 1u || load_u32(input_buffer + 8) != ROWS || load_u32(input_buffer + 12) != ACTIONS) return 2;
  rows_scanned = comparisons = events = command_count = 0;
  physical_creates = physical_reuses = physical_updates = physical_placements = physical_hides = 0;
  focus_operations = layout_reads = 0;
  filtered_length = ROWS;
  focused = selected = EMPTY;
  filter_group = EMPTY;
  scroll_offset = 0;
  next_action = 0;
  checkpoint = 0;
  slot_count = 0;
  for (uint32_t i = 0; i < MAX_MOUNTED; i++) {
    slot_rows[i] = EMPTY;
    slot_indexes[i] = EMPTY;
    slot_positions[i] = EMPTY;
    slot_selected[i] = 0;
    slot_scores[i] = 0;
  }
  uint32_t row_offset = HEADER_BYTES;
  for (uint32_t i = 0; i < ROWS; i++) {
    uint32_t id = load_u32(input_buffer + row_offset);
    if (id != i) return 3;
    scores[id] = (int32_t)load_u32(input_buffer + row_offset + 4);
    groups[id] = load_u32(input_buffer + row_offset + 8);
    order_rows[i] = id;
    filtered_rows[i] = id;
    row_offset += ROW_BYTES;
  }
  output_buffer[2] = 0;
  output_buffer[19] = 0;
  return 0;
}

int run_event(uint32_t action) {
  if (action != next_action || action >= ACTIONS) return 8;
  uint32_t action_offset = HEADER_BYTES + ROWS * ROW_BYTES;
  const uint8_t *at = input_buffer + action_offset + action * ACTION_BYTES;
  if (load_u32(at) != action * 100u) return 4;
  uint32_t type = load_u32(at + 4);
  uint32_t a = load_u32(at + 8);
  uint32_t b = load_u32(at + 12);
  if (type == 0) {
    uint32_t max_offset = filtered_length > 20u ? (filtered_length - 20u) * 24u : 0u;
    scroll_offset = a < max_offset ? a : max_offset;
  } else if (type == 1) {
    filter_group = a;
    rebuild_filter(filter_group);
    scroll_offset = 0;
  } else if (type == 2) {
    stable_sort(a & 1u, filter_group);
  } else if (type == 3) {
    if (a >= ROWS) return 5;
    scores[a] = (int32_t)b;
    selected = a;
  } else if (type == 4) {
    if (a == EMPTY) {
      uint32_t base = scroll_offset / 24u + 5u;
      if (base >= filtered_length) base = filtered_length - 1u;
      focused = filtered_rows[base];
    } else {
      if (a >= ROWS) return 6;
      focused = a;
    }
    selected = focused;
  } else return 7;
  events++;
  output_buffer[19] = scroll_offset;
  uint32_t checkpoint_index = EMPTY;
  if ((action + 1u) % 50u == 0u) checkpoint_index = checkpoint++;
  reconcile(action, checkpoint_index);
  output_buffer[2] = command_count;
  next_action++;
  return 0;
}

int finish(void) {
  if (next_action != ACTIONS) return 9;
  output_buffer[0] = RESULT_MAGIC;
  output_buffer[1] = 1;
  output_buffer[2] = command_count;
  output_buffer[3] = final_start;
  output_buffer[4] = final_end;
  output_buffer[5] = filtered_length;
  output_buffer[6] = rows_scanned;
  output_buffer[7] = comparisons;
  output_buffer[8] = events;
  output_buffer[9] = command_count;
  output_buffer[10] = physical_creates;
  output_buffer[11] = physical_reuses;
  output_buffer[12] = physical_updates;
  output_buffer[13] = physical_placements;
  output_buffer[14] = physical_hides;
  output_buffer[15] = focus_operations;
  output_buffer[16] = layout_reads;
  output_buffer[17] = 0;
  output_buffer[18] = 304;
  output_buffer[19] = filtered_length;
  return 0;
}
