export const ECS_WORKLOAD_ID = "game.ecs-frame-update.v1";
export const ECS_VARIANTS = Object.freeze(["js-controlled", "wasm-linear-controlled"]);
export const ECS_SEED = 0x6ec5f17d;
export const ECS_FULL_ENTITIES = 10_000;
export const ECS_FULL_FRAMES = 1_000;
export const ECS_GRID_WIDTH = 128;
export const ECS_GRID_CELLS = ECS_GRID_WIDTH * ECS_GRID_WIDTH;
export const ECS_CELL_SHIFT = 9;
export const ECS_CHECKPOINT_INTERVAL = 100;
export const ECS_MAGIC = 0x31435345;
export const ECS_HEADER_BYTES = 16;
export const ECS_ENTITY_BYTES = 8;

function xorshift32(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function fixtureByteLength(entities, frames) {
  return ECS_HEADER_BYTES + entities * ECS_ENTITY_BYTES + frames;
}

export function generateEcsFixture(options = {}) {
  const entities = options.entities ?? ECS_FULL_ENTITIES;
  const frames = options.frames ?? ECS_FULL_FRAMES;
  const seed = options.seed ?? ECS_SEED;
  if (!Number.isInteger(entities) || entities < 2 || entities > ECS_FULL_ENTITIES) {
    throw new Error("entities must be an integer from 2 through 10000");
  }
  if (!Number.isInteger(frames) || frames < 1 || frames > ECS_FULL_FRAMES) {
    throw new Error("frames must be an integer from 1 through 1000");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error("seed must be an unsigned 32-bit integer");
  }
  const bytes = new Uint8Array(fixtureByteLength(entities, frames));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, ECS_MAGIC, true);
  view.setUint32(4, entities, true);
  view.setUint32(8, frames, true);
  view.setUint32(12, seed >>> 0, true);
  let state = seed >>> 0;
  let offset = ECS_HEADER_BYTES;
  for (let entity = 0; entity < entities; entity += 1) {
    state = xorshift32(state);
    view.setUint16(offset, state & 0xffff, true);
    state = xorshift32(state);
    view.setUint16(offset + 2, state & 0xffff, true);
    state = xorshift32(state);
    const vx = (state % 15) - 7 || 1;
    state = xorshift32(state);
    const vy = (state % 15) - 7 || -1;
    view.setInt8(offset + 4, vx);
    view.setInt8(offset + 5, vy);
    state = xorshift32(state);
    view.setUint8(offset + 6, state & 0xff);
    view.setUint8(offset + 7, 4 + ((state >>> 8) & 3));
    offset += ECS_ENTITY_BYTES;
  }
  for (let frame = 0; frame < frames; frame += 1) {
    state = xorshift32(state);
    bytes[offset + frame] = state & 0xff;
  }
  return bytes;
}

export function parseFixtureHeader(fixture) {
  if (!(fixture instanceof Uint8Array)) throw new Error("fixture must be Uint8Array");
  if (fixture.byteLength < ECS_HEADER_BYTES) throw new Error("fixture header is truncated");
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const magic = view.getUint32(0, true);
  const entities = view.getUint32(4, true);
  const frames = view.getUint32(8, true);
  const seed = view.getUint32(12, true);
  if (magic !== ECS_MAGIC) throw new Error("fixture magic mismatch");
  if (entities < 2 || entities > ECS_FULL_ENTITIES) throw new Error("fixture entity count denied");
  if (frames < 1 || frames > ECS_FULL_FRAMES) throw new Error("fixture frame count denied");
  if (fixture.byteLength !== fixtureByteLength(entities, frames)) {
    throw new Error("fixture byte length mismatch");
  }
  return { entities, frames, seed };
}

export function validateGeneratedFixture(fixture) {
  const header = parseFixtureHeader(fixture);
  const expected = generateEcsFixture(header);
  for (let index = 0; index < fixture.byteLength; index += 1) {
    if (fixture[index] !== expected[index]) throw new Error(`fixture mismatch at byte ${index}`);
  }
  return header;
}
