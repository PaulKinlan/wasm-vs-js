#include <stdint.h>
#include <stddef.h>

// game-ecs-frame-update multilang kernel — C++ translation unit with the
// identical computation as the C kernel (and benchmarks/v1 engine.js): control
// velocity deltas, movement with wall bounce, 128x128 spatial-grid collision,
// animation speed-class update, FNV-1a canonical state + checkpoint digests,
// full counter set. Fixed-memory linear Wasm; JS-visible surface is
// input_ptr / result_ptr / run (extern "C").

namespace {

constexpr uint32_t MAX_ENTITIES = 10000u;
constexpr uint32_t MAX_FRAMES = 1000u;
constexpr uint32_t INPUT_CAPACITY = 82000u;
constexpr uint32_t GRID_WIDTH = 128u;
constexpr uint32_t GRID_CELLS = 16384u;
constexpr uint32_t CELL_SHIFT = 9u;
constexpr uint32_t CHECKPOINT_INTERVAL = 100u;
constexpr uint32_t RESULT_STATE_OFFSET = 128u;
constexpr uint32_t RESULT_WORDS = RESULT_STATE_OFFSET + MAX_ENTITIES * 6u;
constexpr uint32_t ECS_MAGIC = 0x31435345u;
constexpr uint32_t PRIME = 16777619u;

alignas(4) uint8_t input_bytes[INPUT_CAPACITY];
alignas(4) uint32_t result_words[RESULT_WORDS];
uint16_t xs[MAX_ENTITIES], ys[MAX_ENTITIES];
int8_t vxs[MAX_ENTITIES], vys[MAX_ENTITIES];
uint8_t animations[MAX_ENTITIES], radii[MAX_ENTITIES];
int32_t heads[GRID_CELLS], next_entity[MAX_ENTITIES];
uint32_t pair_tests = 0, collisions = 0, state_mutations = 0;

uint32_t read32(uint32_t at) {
  return static_cast<uint32_t>(input_bytes[at]) |
    (static_cast<uint32_t>(input_bytes[at + 1]) << 8) |
    (static_cast<uint32_t>(input_bytes[at + 2]) << 16) |
    (static_cast<uint32_t>(input_bytes[at + 3]) << 24);
}
uint32_t mix(uint32_t hash, uint32_t value) { return (hash ^ value) * PRIME; }
uint32_t absolute8(int8_t value) { return value < 0 ? static_cast<uint32_t>(-value) : static_cast<uint32_t>(value); }
int8_t clamp_velocity(int32_t value) {
  if (value < -16) return -16;
  if (value > 16) return 16;
  return static_cast<int8_t>(value);
}
int32_t control_delta(uint32_t bits) { return bits == 3u ? 0 : static_cast<int32_t>(bits) - 1; }

uint32_t canonical_state(uint32_t entities, int write_state) {
  uint32_t digest = 0x7f4a7c15u;
  for (uint32_t entity = 0; entity < entities; entity++) {
    uint32_t values[6] = {
      xs[entity], ys[entity], static_cast<uint8_t>(vxs[entity]), static_cast<uint8_t>(vys[entity]),
      animations[entity], radii[entity]
    };
    digest = mix(digest, entity);
    for (uint32_t item = 0; item < 6; item++) {
      digest = mix(digest, values[item]);
      if (write_state) result_words[RESULT_STATE_OFFSET + entity * 6u + item] = values[item];
    }
  }
  return digest;
}

void process_pair(uint32_t left, uint32_t right) {
  pair_tests++;
  int32_t reach = static_cast<int32_t>(radii[left]) + static_cast<int32_t>(radii[right]);
  int32_t dx = static_cast<int32_t>(xs[left]) - static_cast<int32_t>(xs[right]);
  int32_t dy = static_cast<int32_t>(ys[left]) - static_cast<int32_t>(ys[right]);
  if (dx < -reach || dx > reach || dy < -reach || dy > reach) return;
  int8_t left_vx = vxs[left], left_vy = vys[left];
  vxs[left] = vxs[right];
  vys[left] = vys[right];
  vxs[right] = left_vx;
  vys[right] = left_vy;
  collisions++;
  state_mutations += 4u;
}
void process_cross_cells(uint32_t left_cell, uint32_t right_cell) {
  for (int32_t left = heads[left_cell]; left >= 0; left = next_entity[static_cast<uint32_t>(left)]) {
    for (int32_t right = heads[right_cell]; right >= 0; right = next_entity[static_cast<uint32_t>(right)]) {
      process_pair(static_cast<uint32_t>(left), static_cast<uint32_t>(right));
    }
  }
}

}  // namespace

extern "C" {

__attribute__((export_name("input_ptr"))) uint32_t input_ptr(void) {
  return static_cast<uint32_t>(reinterpret_cast<uintptr_t>(input_bytes));
}
__attribute__((export_name("result_ptr"))) uint32_t result_ptr(void) {
  return static_cast<uint32_t>(reinterpret_cast<uintptr_t>(result_words));
}

__attribute__((export_name("run"))) int32_t run(uint32_t length) {
  if (length < 16u || length > INPUT_CAPACITY || read32(0) != ECS_MAGIC) return 1;
  uint32_t entities = read32(4), frames = read32(8);
  if (entities < 2u || entities > MAX_ENTITIES || frames < 1u || frames > MAX_FRAMES) return 2;
  if (length != 16u + entities * 8u + frames) return 3;
  for (uint32_t index = 0; index < RESULT_WORDS; index++) result_words[index] = 0;
  uint32_t offset = 16u;
  for (uint32_t entity = 0; entity < entities; entity++) {
    xs[entity] = static_cast<uint16_t>(static_cast<uint32_t>(input_bytes[offset]) |
      (static_cast<uint32_t>(input_bytes[offset + 1]) << 8));
    ys[entity] = static_cast<uint16_t>(static_cast<uint32_t>(input_bytes[offset + 2]) |
      (static_cast<uint32_t>(input_bytes[offset + 3]) << 8));
    vxs[entity] = static_cast<int8_t>(input_bytes[offset + 4]);
    vys[entity] = static_cast<int8_t>(input_bytes[offset + 5]);
    animations[entity] = input_bytes[offset + 6];
    radii[entity] = input_bytes[offset + 7];
    offset += 8u;
  }
  uint32_t trace_offset = 16u + entities * 8u;
  uint32_t movement_updates = 0, control_mutations = 0, animation_updates = 0;
  uint32_t checkpoint_count = 0, checkpoint_digest = 0x5f356495u;
  pair_tests = 0;
  collisions = 0;
  state_mutations = 0;
  for (uint32_t frame = 0; frame < frames; frame++) {
    uint32_t control = input_bytes[trace_offset + frame];
    uint32_t selected_remainder = frame % 257u;
    int32_t control_x = control_delta(control & 3u);
    int32_t control_y = control_delta((control >> 2) & 3u);
    for (uint32_t entity = 0; entity < entities; entity++) {
      if (entity % 257u == selected_remainder) {
        vxs[entity] = clamp_velocity(static_cast<int32_t>(vxs[entity]) + control_x);
        vys[entity] = clamp_velocity(static_cast<int32_t>(vys[entity]) + control_y);
        control_mutations += 2u;
        state_mutations += 2u;
      }
      int32_t x = static_cast<int32_t>(xs[entity]) + static_cast<int32_t>(vxs[entity]);
      int32_t y = static_cast<int32_t>(ys[entity]) + static_cast<int32_t>(vys[entity]);
      if (x < 0) {
        x = -x;
        vxs[entity] = static_cast<int8_t>(-vxs[entity]);
        state_mutations++;
      } else if (x > 65535) {
        x = 131070 - x;
        vxs[entity] = static_cast<int8_t>(-vxs[entity]);
        state_mutations++;
      }
      if (y < 0) {
        y = -y;
        vys[entity] = static_cast<int8_t>(-vys[entity]);
        state_mutations++;
      } else if (y > 65535) {
        y = 131070 - y;
        vys[entity] = static_cast<int8_t>(-vys[entity]);
        state_mutations++;
      }
      xs[entity] = static_cast<uint16_t>(x);
      ys[entity] = static_cast<uint16_t>(y);
      movement_updates++;
      state_mutations += 2u;
    }
    for (uint32_t cell = 0; cell < GRID_CELLS; cell++) heads[cell] = -1;
    for (uint32_t entity = 0; entity < entities; entity++) {
      uint32_t cell = (static_cast<uint32_t>(ys[entity]) >> CELL_SHIFT) * GRID_WIDTH +
        (static_cast<uint32_t>(xs[entity]) >> CELL_SHIFT);
      next_entity[entity] = heads[cell];
      heads[cell] = static_cast<int32_t>(entity);
    }
    for (uint32_t cell_y = 0; cell_y < GRID_WIDTH; cell_y++) {
      for (uint32_t cell_x = 0; cell_x < GRID_WIDTH; cell_x++) {
        uint32_t cell = cell_y * GRID_WIDTH + cell_x;
        for (int32_t left = heads[cell]; left >= 0; left = next_entity[static_cast<uint32_t>(left)]) {
          for (int32_t right = next_entity[static_cast<uint32_t>(left)]; right >= 0; right = next_entity[static_cast<uint32_t>(right)]) {
            process_pair(static_cast<uint32_t>(left), static_cast<uint32_t>(right));
          }
        }
        if (cell_x + 1u < GRID_WIDTH) process_cross_cells(cell, cell + 1u);
        if (cell_y + 1u < GRID_WIDTH && cell_x > 0u) {
          process_cross_cells(cell, cell + GRID_WIDTH - 1u);
        }
        if (cell_y + 1u < GRID_WIDTH) process_cross_cells(cell, cell + GRID_WIDTH);
        if (cell_y + 1u < GRID_WIDTH && cell_x + 1u < GRID_WIDTH) {
          process_cross_cells(cell, cell + GRID_WIDTH + 1u);
        }
      }
    }
    uint32_t control_animation = (control >> 4) & 1u;
    for (uint32_t entity = 0; entity < entities; entity++) {
      uint32_t speed_class = (absolute8(vxs[entity]) + absolute8(vys[entity])) & 3u;
      animations[entity] = static_cast<uint8_t>(animations[entity] + 1u + speed_class + control_animation);
      animation_updates++;
      state_mutations++;
    }
    if ((frame + 1u) % CHECKPOINT_INTERVAL == 0u || frame + 1u == frames) {
      uint32_t state_digest = canonical_state(entities, 0);
      uint32_t at = 64u + checkpoint_count * 3u;
      result_words[at] = frame + 1u;
      result_words[at + 1u] = state_digest;
      result_words[at + 2u] = pair_tests;
      result_words[29u + checkpoint_count] = collisions;
      checkpoint_digest = mix(checkpoint_digest, frame + 1u);
      checkpoint_digest = mix(checkpoint_digest, state_digest);
      checkpoint_digest = mix(checkpoint_digest, pair_tests);
      checkpoint_count++;
    }
  }
  result_words[0] = canonical_state(entities, 1);
  result_words[1] = checkpoint_digest;
  result_words[16] = frames;
  result_words[17] = entities;
  result_words[18] = frames * 3u;
  result_words[19] = movement_updates;
  result_words[20] = frames * GRID_CELLS;
  result_words[21] = frames * GRID_CELLS * 5u;
  result_words[22] = frames * entities;
  result_words[23] = pair_tests;
  result_words[24] = collisions;
  result_words[25] = animation_updates;
  result_words[26] = checkpoint_count;
  result_words[27] = control_mutations;
  result_words[28] = state_mutations;
  return 0;
}

}  // extern "C"
