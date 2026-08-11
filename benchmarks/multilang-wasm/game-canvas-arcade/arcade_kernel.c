// arcade_kernel.c — multilang compute core for game.canvas-arcade.v1.
//
// ABI (mirrors the gc_document_kernel multilang template): the adapter writes
// the frozen 14,424-byte arcade fixture (game-v2-controlled-family/
// game-canvas-arcade-v1.bin — 6×u32 header + 3,600 u32 input events, generated
// by benchmarks/v2/game-family/fixtures.js with seed 0x6d2b79f5) into linear
// memory at FIXTURE_OFFSET, passes the byte length, and this kernel replays
// the 3,600-frame arcade engine (bit-for-bit identical to run_arcade() in
// benchmarks/v2/game-family/game-family.c and arcade() in engine.js). We
// accept the fixture bytes via memory rather than regenerating them, because
// the fixture is a 14 KiB seed-derived xorshift stream and the game-family
// authoritative C already reads it the same way — reusing that oracle keeps
// this kernel byte-identical with runGameJavaScript() and runGameWasm().
//
// Results (fixed offset RES_OFFSET, u32 little-endian):
//   [0] semanticDigest           (0x585a29e5)
//   [1] finalStateDigest         (0x87695460)
//   [2] drawCommandStreamDigest  (0xf3a03070)
//   [3] audioEventStreamDigest   (0x8b4cb497)
//   [4] entityUpdates            (169501)
//   [5] collisionTests           (169501)
//   [6] drawCommands             (180301)
//   [7] audioEvents              (91)
// Exports: i32 arcade_trace(u32 fixture_len) -> 0 on success, non-zero on
// fixture-length mismatch (bad input).

#define FIXTURE_OFFSET 65536
#define RES_OFFSET 131072

typedef unsigned int u32;
typedef int i32;
typedef unsigned char u8;

static u8 fixture_at(u32 off) { return *((u8 *)(FIXTURE_OFFSET) + off); }
static u32 read16(u32 at) {
  return (u32)fixture_at(at) | ((u32)fixture_at(at + 1) << 8);
}
static u32 read32(u32 at) { return read16(at) | (read16(at + 2) << 16); }
static u32 mix(u32 h, u32 v) { return (h ^ v) * 16777619u; }

__attribute__((export_name("arcade_trace")))
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
      state = mix(state, (u32)(x + y) + entity);
      collision_tests++;
      draw = mix(mix(mix(mix(draw, 2u), frame), entity), state);
      draw_commands++;
      if ((state & 2047u) == 0u) {
        score += 10u;
        audio = mix(mix(mix(audio, 1u), frame), entity);
        audio_events++;
      }
    }
    draw = mix(mix(mix(mix(draw, 1u), frame), (u32)x), (u32)y);
    draw = mix(mix(mix(draw, 3u), score), lives);
    draw_commands += 2u;
    if ((control & 0xff00u) == 0xff00u && lives > 0u) {
      lives--;
      audio = mix(mix(mix(audio, 2u), frame), lives);
      audio_events++;
    }
    state = mix(state, (u32)x ^ ((u32)y << 11) ^ score ^ lives);
  }

  const u32 semantic = mix(mix(state, draw), audio);
  u32 *results = (u32 *)RES_OFFSET;
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
