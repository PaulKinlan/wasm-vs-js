// arcade_kernel.cpp — multilang compute core for game.canvas-arcade.v1.
//
// Same ABI as arcade_kernel.c: the adapter writes the frozen 14,424-byte
// arcade fixture at FIXTURE_OFFSET and passes the byte length; this kernel
// replays the 3,600-frame arcade engine (bit-identical to run_arcade() in
// benchmarks/v2/game-family/game-family.c and arcade() in engine.js) and
// writes counters + digests to RES_OFFSET.

constexpr int FIXTURE_OFFSET = 65536;
constexpr int RES_OFFSET = 131072;

using u32 = unsigned int;
using i32 = int;
using u8 = unsigned char;

static u8 fixture_at(u32 off) {
  return *(reinterpret_cast<u8 *>(FIXTURE_OFFSET) + off);
}
static u32 read16(u32 at) {
  return static_cast<u32>(fixture_at(at)) | (static_cast<u32>(fixture_at(at + 1)) << 8);
}
static u32 read32(u32 at) { return read16(at) | (read16(at + 2) << 16); }
static u32 mix(u32 h, u32 v) { return (h ^ v) * 16777619u; }

extern "C" __attribute__((export_name("arcade_trace")))
int arcade_trace(u32 fixture_len) {
  if (fixture_len != 14424u) return 1;
  if (read32(0) != 3600u) return 2;

  u32 state = 0x54a1c9e7u, draw = 0x9e3779b9u, audio = 0x243f6a88u;
  i32 x = 640, y = 600;
  u32 score = 0, lives = 3;
  u32 entity_updates = 0, collision_tests = 0, draw_commands = 0, audio_events = 0;

  for (u32 frame = 0; frame < 3600u; frame++) {
    const u32 control = read32(24u + frame * 4u);
    x = (x + ((control & 1u) ? -7 : 0) + ((control & 2u) ? 7 : 0) + 1280) % 1280;
    y += ((control & 4u) ? -5 : 0) + ((control & 8u) ? 5 : 0);
    if (y < 0) y = 0;
    if (y > 719) y = 719;
    const u32 active = 32u + ((control >> 8) & 31u);
    draw = mix(mix(mix(draw, 0u), frame), 0x050002d0u);
    draw_commands++;
    for (u32 entity = 0; entity < active; entity++) {
      state = mix(state, frame * 131u + entity * 17u + control);
      entity_updates++;
      state = mix(state, static_cast<u32>(x + y) + entity);
      collision_tests++;
      draw = mix(mix(mix(mix(draw, 2u), frame), entity), state);
      draw_commands++;
      if ((state & 2047u) == 0u) {
        score += 10u;
        audio = mix(mix(mix(audio, 1u), frame), entity);
        audio_events++;
      }
    }
    draw = mix(mix(mix(mix(draw, 1u), frame), static_cast<u32>(x)), static_cast<u32>(y));
    draw = mix(mix(mix(draw, 3u), score), lives);
    draw_commands += 2u;
    if ((control & 0xff00u) == 0xff00u && lives > 0u) {
      lives--;
      audio = mix(mix(mix(audio, 2u), frame), lives);
      audio_events++;
    }
    state = mix(
      state,
      static_cast<u32>(x) ^ (static_cast<u32>(y) << 11) ^ score ^ lives);
  }

  const u32 semantic = mix(mix(state, draw), audio);
  u32 *results = reinterpret_cast<u32 *>(RES_OFFSET);
  results[0] = semantic;
  results[1] = state;
  results[2] = draw;
  results[3] = audio;
  results[4] = entity_updates;
  results[5] = collision_tests;
  results[6] = draw_commands;
  results[7] = audio_events;
  return 0;
}
