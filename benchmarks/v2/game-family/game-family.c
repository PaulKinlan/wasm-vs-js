#include <stdint.h>

#define INPUT_CAPACITY 120000u
#define RESULT_WORDS 2048u
#define HEAP_CAPACITY 131072u
static uint8_t input_bytes[INPUT_CAPACITY];
static uint32_t result_words[RESULT_WORDS];
static int32_t astar_g[65536], astar_parent[65536];
static uint16_t astar_seen[65536], astar_closed[65536];
static uint32_t heap_node[HEAP_CAPACITY], heap_f[HEAP_CAPACITY], heap_length;
static uint16_t entity_x[4096], entity_y[4096];
static int8_t entity_vx[4096], entity_vy[4096];
static uint8_t unit_hp[128], unit_team[128];
static uint16_t unit_position[128], bfs_queue[4096], bfs_seen[4096];
static int16_t occupancy[4096], bfs_parent[4096];

__attribute__((export_name("input_ptr"))) uint32_t input_ptr(void) { return (uint32_t)(uintptr_t)input_bytes; }
__attribute__((export_name("result_ptr"))) uint32_t result_ptr(void) { return (uint32_t)(uintptr_t)result_words; }
static uint32_t read16(uint32_t at) { return (uint32_t)input_bytes[at] | ((uint32_t)input_bytes[at + 1] << 8); }
static uint32_t read32(uint32_t at) { return read16(at) | (read16(at + 2) << 16); }
static uint32_t mix(uint32_t hash, uint32_t value) { return (hash ^ value) * 16777619u; }
static uint32_t absolute(int32_t value) { return value < 0 ? (uint32_t)(-value) : (uint32_t)value; }
static void clear_result(void) { for (uint32_t i = 0; i < RESULT_WORDS; i++) result_words[i] = 0; }

static int heap_less(uint32_t af, uint32_t an, uint32_t bf, uint32_t bn) { return af != bf ? af < bf : an < bn; }
static int heap_push(uint32_t node, uint32_t f, uint32_t *operations) {
  if (heap_length >= HEAP_CAPACITY) return 0;
  (*operations)++;
  uint32_t index = heap_length++;
  while (index > 0) {
    uint32_t up = (index - 1) >> 1;
    if (!heap_less(f, node, heap_f[up], heap_node[up])) break;
    heap_f[index] = heap_f[up]; heap_node[index] = heap_node[up]; index = up;
  }
  heap_f[index] = f; heap_node[index] = node; return 1;
}
static uint32_t heap_pop(uint32_t *f, uint32_t *operations) {
  (*operations)++;
  uint32_t first_node = heap_node[0]; *f = heap_f[0];
  uint32_t last_index = --heap_length;
  if (heap_length) {
    uint32_t last_node = heap_node[last_index], last_f = heap_f[last_index], index = 0;
    for (;;) {
      uint32_t left = index * 2 + 1;
      if (left >= heap_length) break;
      uint32_t right = left + 1, child = left;
      if (right < heap_length && heap_less(heap_f[right], heap_node[right], heap_f[left], heap_node[left])) child = right;
      if (!heap_less(heap_f[child], heap_node[child], last_f, last_node)) break;
      heap_f[index] = heap_f[child]; heap_node[index] = heap_node[child]; index = child;
    }
    heap_f[index] = last_f; heap_node[index] = last_node;
  }
  return first_node;
}

static int run_arcade(uint32_t length) {
  if (length != 14424u || read32(0) != 3600u) return 2;
  uint32_t state = 0x54a1c9e7u, draw = 0x9e3779b9u, audio = 0x243f6a88u;
  int32_t x = 640, y = 600; uint32_t score = 0, lives = 3;
  uint32_t entity_updates = 0, collision_tests = 0, draw_commands = 0, audio_events = 0;
  for (uint32_t frame = 0; frame < 3600; frame++) {
    uint32_t control = read32(24 + frame * 4);
    x = (x + ((control & 1) ? -7 : 0) + ((control & 2) ? 7 : 0) + 1280) % 1280;
    y += ((control & 4) ? -5 : 0) + ((control & 8) ? 5 : 0); if (y < 0) y = 0; if (y > 719) y = 719;
    uint32_t active = 32 + ((control >> 8) & 31);
    draw = mix(mix(mix(draw, 0), frame), 0x050002d0u); draw_commands++;
    for (uint32_t entity = 0; entity < active; entity++) {
      state = mix(state, frame * 131 + entity * 17 + control); entity_updates++;
      state = mix(state, (uint32_t)(x + y) + entity); collision_tests++;
      draw = mix(mix(mix(mix(draw, 2), frame), entity), state); draw_commands++;
      if ((state & 2047) == 0) { score += 10; audio = mix(mix(mix(audio, 1), frame), entity); audio_events++; }
    }
    draw = mix(mix(mix(mix(draw, 1), frame), (uint32_t)x), (uint32_t)y);
    draw = mix(mix(mix(draw, 3), score), lives); draw_commands += 2;
    if ((control & 0xff00u) == 0xff00u && lives > 0) { lives--; audio = mix(mix(mix(audio, 2), frame), lives); audio_events++; }
    state = mix(state, (uint32_t)x ^ ((uint32_t)y << 11) ^ score ^ lives);
    if ((frame + 1) % 600 == 0) {
      uint32_t checkpoint = frame / 600, at = 64 + checkpoint * 8;
      result_words[at] = frame + 1; result_words[at + 1] = state; result_words[at + 2] = draw; result_words[at + 3] = audio;
      result_words[at + 4] = (uint32_t)x; result_words[at + 5] = (uint32_t)y; result_words[at + 6] = score; result_words[at + 7] = lives;
      result_words[160 + checkpoint] = active;
    }
  }
  result_words[0] = mix(mix(state, draw), audio); result_words[1] = state; result_words[2] = draw; result_words[3] = audio;
  result_words[32] = 3600; result_words[33] = entity_updates; result_words[34] = collision_tests; result_words[35] = draw_commands;
  result_words[36] = audio_events; result_words[38] = 6 * 8 * 4 + 3 * 4; return 0;
}

static int run_pathfinding(uint32_t length) {
  if (length != 106552u || read32(0) != 256u || read32(8) != 4096u) return 2;
  const uint32_t map_offset = 24, entity_offset = map_offset + 65536, path_offset = entity_offset + 4096 * 8, control_offset = path_offset + 128 * 8;
  uint16_t stamp = 0; uint32_t state = 0xa1427b39u, path_digest = 0x13198a2eu, tie_digest = 0x03707344u;
  uint32_t expanded = 0, frontier_operations = 0, system_updates = 0, draw_commands = 0, audio_events = 0;
  for (uint32_t request = 0; request < 128; request++) {
    stamp++; heap_length = 0;
    uint32_t start = read16(path_offset + request * 8) + read16(path_offset + request * 8 + 2) * 256;
    uint32_t goal = read16(path_offset + request * 8 + 4) + read16(path_offset + request * 8 + 6) * 256;
    uint32_t gx = goal & 255, gy = goal >> 8;
    astar_seen[start] = stamp; astar_g[start] = 0; astar_parent[start] = -1;
    if (!heap_push(start, absolute((int32_t)(start & 255) - (int32_t)gx) + absolute((int32_t)(start >> 8) - (int32_t)gy), &frontier_operations)) return 3;
    uint32_t request_tie = 0x85a308d3u;
    while (heap_length) {
      uint32_t f, node = heap_pop(&f, &frontier_operations);
      if (astar_closed[node] == stamp) continue;
      request_tie = mix(mix(request_tie, f), node); astar_closed[node] = stamp; expanded++;
      state = mix(state, node ^ (request << 16) ^ (uint32_t)astar_g[node]);
      if (node == goal) break;
      uint32_t x = node & 255, y = node >> 8;
      int32_t candidates[4] = { y > 0 ? (int32_t)node - 256 : -1, x > 0 ? (int32_t)node - 1 : -1, x < 255 ? (int32_t)node + 1 : -1, y < 255 ? (int32_t)node + 256 : -1 };
      for (uint32_t i = 0; i < 4; i++) {
        int32_t signed_next = candidates[i]; if (signed_next < 0) continue; uint32_t next = (uint32_t)signed_next;
        if (input_bytes[map_offset + next] != 0 || astar_closed[next] == stamp) continue;
        int32_t cost = astar_g[node] + 1;
        if (astar_seen[next] != stamp || cost < astar_g[next]) {
          astar_seen[next] = stamp; astar_g[next] = cost; astar_parent[next] = (int32_t)node;
          uint32_t estimate = (uint32_t)cost + absolute((int32_t)(next & 255) - (int32_t)gx) + absolute((int32_t)(next >> 8) - (int32_t)gy);
          if (!heap_push(next, estimate, &frontier_operations)) return 3;
        }
      }
    }
    uint32_t request_path = 0xa4093822u, path_length = 0;
    if (astar_closed[goal] == stamp) {
      int32_t node = (int32_t)goal;
      while (node >= 0) { request_path = mix(request_path, (uint32_t)node); node = astar_parent[(uint32_t)node]; path_length++; }
    } else request_path = mix(request_path, 0xffffffffu);
    path_digest = mix(mix(path_digest, request), request_path); tie_digest = mix(mix(tie_digest, request), request_tie);
    uint32_t at = 256 + request * 3; result_words[at] = path_length; result_words[at + 1] = request_path; result_words[at + 2] = request_tie;
  }
  for (uint32_t entity = 0; entity < 4096; entity++) {
    uint32_t at = entity_offset + entity * 8;
    entity_x[entity] = (uint16_t)read16(at); entity_y[entity] = (uint16_t)read16(at + 2);
    entity_vx[entity] = (int8_t)((int32_t)read16(at + 4) - 3); entity_vy[entity] = (int8_t)((int32_t)read16(at + 6) - 3);
  }
  uint32_t ecs = 0x299f31d0u, animation = 0x082efa98u, draw = 0xec4e6c89u, audio = 0x452821e6u;
  for (uint32_t frame = 0; frame < 1800; frame++) {
    uint32_t control = read32(control_offset + frame * 4);
    for (uint32_t entity = 0; entity < 4096; entity++) {
      entity_x[entity] = (uint16_t)(((int32_t)entity_x[entity] + entity_vx[entity] + (control & 1) + 256) & 255);
      entity_y[entity] = (uint16_t)(((int32_t)entity_y[entity] + entity_vy[entity] + ((control >> 1) & 1) + 256) & 255);
      uint32_t packed = entity_x[entity] ^ ((uint32_t)entity_y[entity] << 8) ^ entity ^ control;
      ecs = mix(ecs, packed); state = mix(state, packed); system_updates++;
      animation = mix(animation, entity ^ (frame << 12) ^ ((control >> 16) & 15));
      draw = mix(mix(mix(draw, entity), entity_x[entity]), entity_y[entity]); draw_commands++;
    }
    if ((control & 1023) == 0) { audio = mix(mix(audio, frame), control); audio_events++; }
    if ((frame + 1) % 300 == 0) {
      uint32_t checkpoint = frame / 300, at = 64 + checkpoint * 7;
      result_words[at] = frame + 1; result_words[at + 1] = ecs; result_words[at + 2] = animation; result_words[at + 3] = draw; result_words[at + 4] = audio;
      result_words[at + 5] = entity_x[0]; result_words[at + 6] = entity_y[0]; result_words[160 + checkpoint * 2] = state & 15; result_words[161 + checkpoint * 2] = (state >> 8) % 10;
    }
  }
  uint32_t semantic = state; semantic = mix(semantic, path_digest); semantic = mix(semantic, tie_digest); semantic = mix(semantic, ecs); semantic = mix(semantic, animation); semantic = mix(semantic, draw); semantic = mix(semantic, audio);
  result_words[0] = semantic; result_words[1] = path_digest; result_words[2] = tie_digest; result_words[3] = ecs; result_words[4] = animation; result_words[5] = draw; result_words[6] = audio;
  result_words[32] = 1800; result_words[33] = 4096; result_words[34] = system_updates; result_words[35] = expanded; result_words[36] = frontier_operations; result_words[37] = draw_commands; result_words[38] = audio_events; return 0;
}

static uint16_t tactics_stamp;
static uint32_t tactics_state, tactics_expanded, tactics_los;
static int tactics_path(uint32_t start, uint32_t goal, uint32_t map_offset) {
  tactics_stamp++; uint32_t head = 0, tail = 1; bfs_queue[0] = (uint16_t)start; bfs_seen[start] = tactics_stamp; bfs_parent[start] = -1;
  while (head < tail) {
    uint32_t node = bfs_queue[head++]; tactics_expanded++; if (node == goal) break;
    uint32_t x = node & 63, y = node >> 6;
    int32_t candidates[4] = { y > 0 ? (int32_t)node - 64 : -1, x > 0 ? (int32_t)node - 1 : -1, x < 63 ? (int32_t)node + 1 : -1, y < 63 ? (int32_t)node + 64 : -1 };
    for (uint32_t i = 0; i < 4; i++) {
      int32_t sn = candidates[i]; if (sn < 0) continue; uint32_t next = (uint32_t)sn;
      if (bfs_seen[next] == tactics_stamp || input_bytes[map_offset + next] == 3 || (occupancy[next] >= 0 && next != goal)) continue;
      bfs_seen[next] = tactics_stamp; bfs_parent[next] = (int16_t)node; bfs_queue[tail++] = (uint16_t)next;
    }
  }
  if (bfs_seen[goal] != tactics_stamp) return 0;
  int32_t node = (int32_t)goal; while (node >= 0) { tactics_state = mix(tactics_state, (uint32_t)node); node = bfs_parent[(uint32_t)node]; } return 1;
}
static int tactics_los_visible(uint32_t start, uint32_t goal, uint32_t map_offset) {
  int32_t x0 = start & 63, y0 = start >> 6, x1 = goal & 63, y1 = goal >> 6;
  int32_t dx = (int32_t)absolute(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -(int32_t)absolute(y1 - y0), sy = y0 < y1 ? 1 : -1, error = dx + dy;
  for (;;) {
    tactics_los++; uint32_t node = (uint32_t)(x0 + y0 * 64);
    if (node != start && node != goal && input_bytes[map_offset + node] == 3) return 0;
    if (x0 == x1 && y0 == y1) return 1;
    int32_t twice = 2 * error; if (twice >= dy) { error += dy; x0 += sx; } if (twice <= dx) { error += dx; y0 += sy; }
  }
}
static int run_tactics(uint32_t length) {
  if (length != 7064u || read32(0) != 64u || read32(8) != 128u) return 2;
  const uint32_t map_offset = 24, unit_offset = map_offset + 4096, action_offset = unit_offset + 1024;
  for (uint32_t cell = 0; cell < 4096; cell++) occupancy[cell] = -1;
  for (uint32_t unit = 0; unit < 128; unit++) {
    uint32_t at = unit_offset + unit * 8; unit_position[unit] = (uint16_t)(read16(at) + read16(at + 2) * 64);
    unit_hp[unit] = input_bytes[at + 4]; unit_team[unit] = input_bytes[at + 5] & 1;
    if (occupancy[unit_position[unit]] < 0) occupancy[unit_position[unit]] = (int16_t)unit;
  }
  tactics_stamp = 0; tactics_state = 0x5d7219afu; tactics_expanded = 0; tactics_los = 0;
  uint32_t turns = 0, updates = 0, mutations = 0, selected = unit_position[0], focused = selected, initiative = 0;
  for (uint32_t action = 0; action < 240; action++) {
    uint32_t at = action_offset + action * 8, type = input_bytes[at], unit = input_bytes[at + 1], from = read16(at + 2), target = read16(at + 4), turn_id = read16(at + 6);
    if (action % 4 == 0) { turns++; initiative = (turn_id * 7) & 127; mutations++; }
    if (type == 0) { selected = unit_position[unit]; focused = selected; updates++; mutations += 2; }
    if (type == 1 && tactics_path(unit_position[unit], target, map_offset) && (occupancy[target] < 0 || occupancy[target] == (int16_t)unit)) {
      if (occupancy[unit_position[unit]] == (int16_t)unit) occupancy[unit_position[unit]] = -1;
      unit_position[unit] = (uint16_t)target; occupancy[target] = (int16_t)unit; selected = target; focused = target; updates++; mutations += 3;
    }
    if ((type == 2 || type == 4) && tactics_los_visible(from, target, map_offset)) {
      int32_t target_unit = occupancy[target];
      if (target_unit >= 0) { uint32_t damage = type == 4 ? 3 : 1; unit_hp[target_unit] = unit_hp[target_unit] > damage ? (uint8_t)(unit_hp[target_unit] - damage) : 0; updates++; mutations++; }
    }
    if (type == 3) { initiative = (initiative + 1) & 127; mutations++; }
    tactics_state = mix(tactics_state, type ^ unit ^ unit_hp[unit] ^ unit_position[unit] ^ selected ^ turn_id);
    if ((action + 1) % 4 == 0) {
      uint32_t unit_digest = 0x9216d5d9u, occupancy_digest = 0x8979fb1bu, initiative_digest = mix(0xd1310ba6u, initiative), objective_digest = 0x98dfb5acu;
      uint32_t dom_digest = 0x2ffd72dbu, focus_digest = mix(0xd01adfb7u, focused), accessibility_digest = 0xb8e1afedu, objectives0 = 0, objectives1 = 0;
      for (uint32_t i = 0; i < 128; i++) {
        unit_digest = mix(mix(mix(unit_digest, i), unit_position[i]), unit_hp[i] ^ ((uint32_t)unit_team[i] << 8));
        initiative_digest = mix(initiative_digest, (i + initiative) & 127);
        if (input_bytes[map_offset + unit_position[i]] == 2 && unit_hp[i] > 0) { if (unit_team[i]) objectives1++; else objectives0++; }
      }
      objective_digest = mix(mix(objective_digest, objectives0), objectives1);
      for (uint32_t cell = 0; cell < 4096; cell++) {
        int32_t occupant = occupancy[cell]; uint32_t is_selected = cell == selected, is_focused = cell == focused;
        occupancy_digest = mix(occupancy_digest, occupant < 0 ? 0xffffffffu : (uint32_t)occupant);
        dom_digest = mix(mix(mix(dom_digest, cell), input_bytes[map_offset + cell]), (uint32_t)(occupant + 1) ^ (is_selected << 16) ^ (is_focused << 17));
        uint32_t unit_state = occupant < 0 ? 0 : unit_hp[occupant] ^ ((uint32_t)unit_team[occupant] << 8);
        accessibility_digest = mix(mix(accessibility_digest, 0x67726964u), is_selected ^ (is_focused << 1) ^ (unit_state << 2));
      }
      uint32_t checkpoint = action / 4, out = 600 + checkpoint * 13;
      result_words[out] = turn_id + 1; result_words[out + 1] = unit_digest; result_words[out + 2] = occupancy_digest; result_words[out + 3] = initiative_digest;
      result_words[out + 4] = objective_digest; result_words[out + 5] = dom_digest; result_words[out + 6] = focus_digest; result_words[out + 7] = accessibility_digest;
      result_words[out + 8] = selected; result_words[out + 9] = focused; result_words[out + 10] = initiative; result_words[out + 11] = objectives0; result_words[out + 12] = objectives1;
      tactics_state = mix(tactics_state, unit_digest); tactics_state = mix(tactics_state, occupancy_digest); tactics_state = mix(tactics_state, initiative_digest);
      tactics_state = mix(tactics_state, objective_digest); tactics_state = mix(tactics_state, dom_digest); tactics_state = mix(tactics_state, focus_digest); tactics_state = mix(tactics_state, accessibility_digest);
      mutations += 2;
    }
  }
  result_words[0] = tactics_state; result_words[32] = 240; result_words[33] = turns; result_words[34] = tactics_expanded; result_words[35] = tactics_los; result_words[36] = updates; result_words[37] = mutations; return 0;
}

__attribute__((export_name("run"))) int32_t run(uint32_t workload, uint32_t length) {
  clear_result(); if (length > INPUT_CAPACITY) return 1;
  if (workload == 0) return run_arcade(length); if (workload == 1) return run_pathfinding(length); if (workload == 2) return run_tactics(length); return 4;
}
