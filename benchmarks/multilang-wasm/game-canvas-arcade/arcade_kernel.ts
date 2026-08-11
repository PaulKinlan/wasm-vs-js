// arcade_kernel.ts — AssemblyScript multilang compute core for
// game.canvas-arcade.v1. Same ABI as arcade_kernel.c: the adapter writes the
// frozen 14,424-byte arcade fixture at FIXTURE_OFFSET (65 536), passes the
// byte length, and this kernel replays the 3,600-frame arcade engine
// (bit-identical to run_arcade() in benchmarks/v2/game-family/game-family.c
// and arcade() in engine.js), writing counters + digests to RES_OFFSET
// (131 072). Raw linear-memory access only (no heap allocation, no runtime
// imports) — mirrors gc_document_kernel.ts.

const FIXTURE_OFFSET: usize = 65536;
const RES_OFFSET: usize = 131072;

function fixtureAt(off: u32): u8 {
  return load<u8>(FIXTURE_OFFSET + (<usize> off));
}
function read16(at: u32): u32 {
  return (<u32> fixtureAt(at)) | ((<u32> fixtureAt(at + 1)) << 8);
}
function read32(at: u32): u32 {
  return read16(at) | (read16(at + 2) << 16);
}
function mix(h: u32, v: u32): u32 {
  return ((h ^ v) * 0x01000193) >>> 0;
}

export function arcade_trace(fixture_len: u32): i32 {
  if (fixture_len != 14424) return 1;
  if (read32(0) != 3600) return 2;

  let state: u32 = 0x54a1c9e7;
  let draw: u32 = 0x9e3779b9;
  let audio: u32 = 0x243f6a88;
  let x: i32 = 640;
  let y: i32 = 600;
  let score: u32 = 0;
  let lives: u32 = 3;
  let entityUpdates: u32 = 0;
  let collisionTests: u32 = 0;
  let drawCommands: u32 = 0;
  let audioEvents: u32 = 0;

  for (let frame: u32 = 0; frame < 3600; frame++) {
    const control = read32(24 + frame * 4);
    const dx: i32 = ((control & 1) ? -7 : 0) + ((control & 2) ? 7 : 0);
    x = (x + dx + 1280) % 1280;
    const dy: i32 = ((control & 4) ? -5 : 0) + ((control & 8) ? 5 : 0);
    y += dy;
    if (y < 0) y = 0;
    if (y > 719) y = 719;
    const active: u32 = 32 + ((control >>> 8) & 31);
    draw = mix(mix(mix(draw, 0), frame), 0x050002d0);
    drawCommands++;
    for (let entity: u32 = 0; entity < active; entity++) {
      state = mix(state, frame * 131 + entity * 17 + control);
      entityUpdates++;
      state = mix(state, (<u32> (x + y)) + entity);
      collisionTests++;
      draw = mix(mix(mix(mix(draw, 2), frame), entity), state);
      drawCommands++;
      if ((state & 2047) == 0) {
        score += 10;
        audio = mix(mix(mix(audio, 1), frame), entity);
        audioEvents++;
      }
    }
    draw = mix(mix(mix(mix(draw, 1), frame), <u32> x), <u32> y);
    draw = mix(mix(mix(draw, 3), score), lives);
    drawCommands += 2;
    if ((control & 0xff00) == 0xff00 && lives > 0) {
      lives--;
      audio = mix(mix(mix(audio, 2), frame), lives);
      audioEvents++;
    }
    state = mix(state, (<u32> x) ^ ((<u32> y) << 11) ^ score ^ lives);
  }

  const semantic = mix(mix(state, draw), audio);
  store<u32>(RES_OFFSET, semantic);
  store<u32>(RES_OFFSET + 4, state);
  store<u32>(RES_OFFSET + 8, draw);
  store<u32>(RES_OFFSET + 12, audio);
  store<u32>(RES_OFFSET + 16, entityUpdates);
  store<u32>(RES_OFFSET + 20, collisionTests);
  store<u32>(RES_OFFSET + 24, drawCommands);
  store<u32>(RES_OFFSET + 28, audioEvents);
  return 0;
}
