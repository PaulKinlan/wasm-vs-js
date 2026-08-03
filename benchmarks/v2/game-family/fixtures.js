export const GAME_IDS = Object.freeze([
  "game.canvas-arcade.v1",
  "game.canvas-entity-pathfinding.v1",
  "game.dom-tactics-grid.v1",
]);

export const GAME_CONFIG = Object.freeze({
  "game.canvas-arcade.v1": Object.freeze({
    seed: 0x6d2b79f5,
    frames: 3600,
    stepHz: 60,
    width: 1280,
    height: 720,
    lives: 3,
  }),
  "game.canvas-entity-pathfinding.v1": Object.freeze({
    seed: 0x8f4c21a7,
    columns: 256,
    rows: 256,
    entities: 4096,
    paths: 128,
    frames: 1800,
  }),
  "game.dom-tactics-grid.v1": Object.freeze({
    seed: 0x7c3a19e5,
    columns: 64,
    rows: 64,
    units: 128,
    actions: 240,
    turns: 60,
  }),
});

function next(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

function writer(size) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  return {
    bytes,
    u8(value) {
      view.setUint8(offset, value);
      offset += 1;
    },
    u16(value) {
      view.setUint16(offset, value, true);
      offset += 2;
    },
    u32(value) {
      view.setUint32(offset, value >>> 0, true);
      offset += 4;
    },
    done() {
      if (offset !== size) throw new Error(`fixture length mismatch: ${offset} != ${size}`);
      return bytes;
    },
  };
}

export function generateFixture(id) {
  if (!GAME_IDS.includes(id)) throw new Error("workload ID denied");
  const config = GAME_CONFIG[id];
  let state = config.seed;
  if (id === "game.canvas-arcade.v1") {
    const out = writer(6 * 4 + config.frames * 4);
    for (
      const value of [config.frames, config.stepHz, config.width, config.height, 1, config.lives]
    ) out.u32(value);
    for (let frame = 0; frame < config.frames; frame += 1) {
      state = next(state);
      const buttons = state & 15;
      const event = ((state >>> 8) & 255) << 8;
      out.u32(buttons | event);
    }
    return out.done();
  }
  if (id === "game.canvas-entity-pathfinding.v1") {
    const size = 6 * 4 + config.columns * config.rows + config.entities * 8 + config.paths * 8 +
      config.frames * 4;
    const out = writer(size);
    for (
      const value of [config.columns, config.rows, config.entities, config.paths, config.frames, 4]
    ) out.u32(value);
    for (let i = 0; i < config.columns * config.rows; i += 1) {
      state = next(state);
      out.u8((state & 15) === 0 ? 1 : 0);
    }
    for (let i = 0; i < config.entities; i += 1) {
      state = next(state);
      out.u16(state & 255);
      out.u16((state >>> 8) & 255);
      out.u16((state >>> 16) & 7);
      out.u16((state >>> 24) & 7);
    }
    for (let i = 0; i < config.paths; i += 1) {
      state = next(state);
      out.u16(state & 255);
      out.u16((state >>> 8) & 255);
      state = next(state);
      out.u16(state & 255);
      out.u16((state >>> 8) & 255);
    }
    for (let frame = 0; frame < config.frames; frame += 1) {
      state = next(state);
      out.u32(state);
    }
    return out.done();
  }
  const size = 6 * 4 + config.columns * config.rows + config.units * 8 + config.actions * 8;
  const out = writer(size);
  for (
    const value of [config.columns, config.rows, config.units, config.actions, config.turns, 4]
  ) out.u32(value);
  for (let i = 0; i < config.columns * config.rows; i += 1) {
    state = next(state);
    out.u8((state >>> 29) & 3);
  }
  for (let i = 0; i < config.units; i += 1) {
    state = next(state);
    out.u16(state & 63);
    out.u16((state >>> 8) & 63);
    out.u8(20 + ((state >>> 16) & 31));
    out.u8(i & 1);
    out.u16(i);
  }
  for (let i = 0; i < config.actions; i += 1) {
    state = next(state);
    out.u8(i % 5);
    out.u8(state & 127);
    out.u16((state >>> 8) & 4095);
    out.u16((state >>> 20) & 4095);
    out.u16(i >>> 2);
  }
  return out.done();
}
