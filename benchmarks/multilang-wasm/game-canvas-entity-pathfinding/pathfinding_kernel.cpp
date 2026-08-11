// pathfinding_kernel.cpp — multilang compute core for
// game.canvas-entity-pathfinding.v1.
//
// Same ABI as pathfinding_kernel.c: the adapter writes the frozen
// 106,552-byte pathfinding fixture at FIXTURE_OFFSET and passes the byte
// length; this kernel runs the 128 A* requests + 1,800-frame ECS loop
// bit-identical to run_pathfinding() in benchmarks/v2/game-family/
// game-family.c and pathfinding() in engine.js, then writes counters +
// digests to RES_OFFSET.

// FIXTURE and RES offsets sit past every language's .bss window:
// C/C++ .bss ends around 1.9 MiB, Rust's __data_end lands near 2.9 MiB, and
// AS's fixed-offset arrays occupy < 1.9 MiB. 3 MiB is safely past all three.
constexpr unsigned int FIXTURE_OFFSET = 3145728u;  // 3 MiB
constexpr unsigned int RES_OFFSET = 3276800u;      // 3 MiB + 128 KiB
constexpr unsigned int HEAP_CAPACITY = 131072u;

using u32 = unsigned int;
using i32 = int;
using u16 = unsigned short;
using i8 = signed char;
using u8 = unsigned char;

static i32 astar_g[65536];
static i32 astar_parent[65536];
static u16 astar_seen[65536];
static u16 astar_closed[65536];
static u32 heap_node[HEAP_CAPACITY];
static u32 heap_f[HEAP_CAPACITY];
static u32 heap_length;
static u16 entity_x[4096];
static u16 entity_y[4096];
static i8 entity_vx[4096];
static i8 entity_vy[4096];

static u8 fixture_at(u32 off) { return *(reinterpret_cast<u8 *>(FIXTURE_OFFSET) + off); }
static u32 read16(u32 at) {
  return static_cast<u32>(fixture_at(at)) | (static_cast<u32>(fixture_at(at + 1)) << 8);
}
static u32 read32(u32 at) { return read16(at) | (read16(at + 2) << 16); }
static u32 mix(u32 h, u32 v) { return (h ^ v) * 16777619u; }
static u32 absolute(i32 v) {
  return v < 0 ? static_cast<u32>(-v) : static_cast<u32>(v);
}

static int heap_less(u32 af, u32 an, u32 bf, u32 bn) {
  return af != bf ? af < bf : an < bn;
}
static int heap_push(u32 node, u32 f, u32 *operations) {
  if (heap_length >= HEAP_CAPACITY) return 0;
  (*operations)++;
  u32 index = heap_length++;
  while (index > 0) {
    u32 up = (index - 1) >> 1;
    if (!heap_less(f, node, heap_f[up], heap_node[up])) break;
    heap_f[index] = heap_f[up];
    heap_node[index] = heap_node[up];
    index = up;
  }
  heap_f[index] = f;
  heap_node[index] = node;
  return 1;
}
static u32 heap_pop(u32 *f, u32 *operations) {
  (*operations)++;
  u32 first_node = heap_node[0];
  *f = heap_f[0];
  u32 last_index = --heap_length;
  if (heap_length) {
    u32 last_node = heap_node[last_index], last_f = heap_f[last_index], index = 0;
    for (;;) {
      u32 left = index * 2u + 1u;
      if (left >= heap_length) break;
      u32 right = left + 1u, child = left;
      if (
        right < heap_length &&
        heap_less(heap_f[right], heap_node[right], heap_f[left], heap_node[left])
      ) child = right;
      if (!heap_less(heap_f[child], heap_node[child], last_f, last_node)) break;
      heap_f[index] = heap_f[child];
      heap_node[index] = heap_node[child];
      index = child;
    }
    heap_f[index] = last_f;
    heap_node[index] = last_node;
  }
  return first_node;
}

extern "C" __attribute__((export_name("pathfinding_trace")))
int pathfinding_trace(u32 fixture_len) {
  if (fixture_len != 106552u) return 1;
  if (read32(0) != 256u || read32(8) != 4096u) return 2;

  for (u32 node = 0; node < 65536u; node++) {
    astar_seen[node] = 0;
    astar_closed[node] = 0;
  }

  const u32 map_offset = 24u;
  const u32 entity_offset = map_offset + 65536u;
  const u32 path_offset = entity_offset + 4096u * 8u;
  const u32 control_offset = path_offset + 128u * 8u;

  u16 stamp = 0;
  u32 state = 0xa1427b39u, path_digest = 0x13198a2eu, tie_digest = 0x03707344u;
  u32 expanded = 0, frontier_operations = 0, system_updates = 0;
  u32 draw_commands = 0, audio_events = 0;

  for (u32 request = 0; request < 128u; request++) {
    stamp++;
    heap_length = 0;
    const u32 start = read16(path_offset + request * 8u) +
      read16(path_offset + request * 8u + 2u) * 256u;
    const u32 goal = read16(path_offset + request * 8u + 4u) +
      read16(path_offset + request * 8u + 6u) * 256u;
    const u32 gx = goal & 255u, gy = goal >> 8;
    astar_seen[start] = stamp;
    astar_g[start] = 0;
    astar_parent[start] = -1;
    if (
      !heap_push(
        start,
        absolute(static_cast<i32>(start & 255u) - static_cast<i32>(gx)) +
          absolute(static_cast<i32>(start >> 8) - static_cast<i32>(gy)),
        &frontier_operations
      )
    ) return 3;
    u32 request_tie = 0x85a308d3u;
    while (heap_length) {
      u32 f;
      u32 node = heap_pop(&f, &frontier_operations);
      if (astar_closed[node] == stamp) continue;
      request_tie = mix(mix(request_tie, f), node);
      astar_closed[node] = stamp;
      expanded++;
      state = mix(state, node ^ (request << 16) ^ static_cast<u32>(astar_g[node]));
      if (node == goal) break;
      const u32 x = node & 255u, y = node >> 8;
      i32 candidates[4] = {
        y > 0u ? static_cast<i32>(node) - 256 : -1,
        x > 0u ? static_cast<i32>(node) - 1 : -1,
        x < 255u ? static_cast<i32>(node) + 1 : -1,
        y < 255u ? static_cast<i32>(node) + 256 : -1,
      };
      for (u32 i = 0; i < 4u; i++) {
        i32 signed_next = candidates[i];
        if (signed_next < 0) continue;
        const u32 next = static_cast<u32>(signed_next);
        if (fixture_at(map_offset + next) != 0 || astar_closed[next] == stamp) continue;
        const i32 cost = astar_g[node] + 1;
        if (astar_seen[next] != stamp || cost < astar_g[next]) {
          astar_seen[next] = stamp;
          astar_g[next] = cost;
          astar_parent[next] = static_cast<i32>(node);
          const u32 estimate = static_cast<u32>(cost) +
            absolute(static_cast<i32>(next & 255u) - static_cast<i32>(gx)) +
            absolute(static_cast<i32>(next >> 8) - static_cast<i32>(gy));
          if (!heap_push(next, estimate, &frontier_operations)) return 3;
        }
      }
    }
    u32 request_path = 0xa4093822u;
    if (astar_closed[goal] == stamp) {
      i32 node = static_cast<i32>(goal);
      while (node >= 0) {
        request_path = mix(request_path, static_cast<u32>(node));
        node = astar_parent[static_cast<u32>(node)];
      }
    } else {
      request_path = mix(request_path, 0xffffffffu);
    }
    path_digest = mix(mix(path_digest, request), request_path);
    tie_digest = mix(mix(tie_digest, request), request_tie);
  }

  for (u32 entity = 0; entity < 4096u; entity++) {
    const u32 at = entity_offset + entity * 8u;
    entity_x[entity] = static_cast<u16>(read16(at));
    entity_y[entity] = static_cast<u16>(read16(at + 2u));
    entity_vx[entity] = static_cast<i8>(static_cast<i32>(read16(at + 4u)) - 3);
    entity_vy[entity] = static_cast<i8>(static_cast<i32>(read16(at + 6u)) - 3);
  }

  u32 ecs = 0x299f31d0u;
  u32 animation = 0x082efa98u;
  u32 draw = 0xec4e6c89u;
  u32 audio = 0x452821e6u;

  for (u32 frame = 0; frame < 1800u; frame++) {
    const u32 control = read32(control_offset + frame * 4u);
    for (u32 entity = 0; entity < 4096u; entity++) {
      entity_x[entity] = static_cast<u16>(
        (static_cast<i32>(entity_x[entity]) + entity_vx[entity] +
          static_cast<i32>(control & 1u) + 256) & 255);
      entity_y[entity] = static_cast<u16>(
        (static_cast<i32>(entity_y[entity]) + entity_vy[entity] +
          static_cast<i32>((control >> 1) & 1u) + 256) & 255);
      const u32 packed = entity_x[entity] ^ (static_cast<u32>(entity_y[entity]) << 8) ^
        entity ^ control;
      ecs = mix(ecs, packed);
      state = mix(state, packed);
      system_updates++;
      animation = mix(animation, entity ^ (frame << 12) ^ ((control >> 16) & 15u));
      draw = mix(mix(mix(draw, entity), entity_x[entity]), entity_y[entity]);
      draw_commands++;
    }
    if ((control & 1023u) == 0u) {
      audio = mix(mix(audio, frame), control);
      audio_events++;
    }
  }

  u32 semantic = state;
  semantic = mix(semantic, path_digest);
  semantic = mix(semantic, tie_digest);
  semantic = mix(semantic, ecs);
  semantic = mix(semantic, animation);
  semantic = mix(semantic, draw);
  semantic = mix(semantic, audio);

  u32 *results = reinterpret_cast<u32 *>(RES_OFFSET);
  results[0] = semantic;
  results[1] = path_digest;
  results[2] = tie_digest;
  results[3] = ecs;
  results[4] = animation;
  results[5] = draw;
  results[6] = audio;
  results[7] = system_updates;
  results[8] = expanded;
  results[9] = frontier_operations;
  results[10] = draw_commands;
  results[11] = audio_events;
  return 0;
}
