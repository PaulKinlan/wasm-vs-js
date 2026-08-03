import { GAME_CONFIG, GAME_IDS, generateFixture } from "./fixtures.js";

export const GAME_VARIANTS = Object.freeze(["js-controlled", "wasm-linear-controlled"]);
const FNV_PRIME = 0x01000193;

function mix(hash, value) {
  return Math.imul((hash ^ value) >>> 0, FNV_PRIME) >>> 0;
}

export function hashBytes(bytes, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let i = 0; i < bytes.length; i += 1) hash = mix(hash, bytes[i]);
  return hash >>> 0;
}

function validate(id, fixture) {
  if (!GAME_IDS.includes(id)) throw new Error("workload ID denied");
  if (!(fixture instanceof Uint8Array)) throw new Error("fixture must be Uint8Array");
  const expected = generateFixture(id);
  if (fixture.byteLength !== expected.byteLength) throw new Error("fixture byte length mismatch");
  for (let i = 0; i < fixture.length; i += 1) {
    if (fixture[i] !== expected[i]) throw new Error(`fixture mismatch at byte ${i}`);
  }
}

function checkpoint(checkpoints, frame, hash) {
  checkpoints.push({ frame, digest: hash.toString(16).padStart(8, "0") });
}

function simulateArcade(fixture) {
  const config = GAME_CONFIG[GAME_IDS[0]];
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  let state = 0x54a1c9e7;
  let x = 640, y = 600, score = 0, lives = config.lives;
  let entityUpdates = 0, collisionTests = 0, drawCommands = 0, audioEvents = 0;
  const checkpoints = [];
  for (let frame = 0; frame < config.frames; frame += 1) {
    const input = view.getUint32(24 + frame * 4, true);
    x = (x + ((input & 1) ? -7 : 0) + ((input & 2) ? 7 : 0) + 1280) % 1280;
    y = Math.max(0, Math.min(719, y + ((input & 4) ? -5 : 0) + ((input & 8) ? 5 : 0)));
    const active = 32 + ((input >>> 8) & 31);
    for (let entity = 0; entity < active; entity += 1) {
      state = mix(state, (frame * 131 + entity * 17 + input) >>> 0);
      entityUpdates += 1;
      state = mix(state, (x + y + entity) >>> 0);
      collisionTests += 1;
      if ((state & 2047) === 0) {
        score += 10;
        audioEvents += 1;
      }
    }
    drawCommands += active + 2;
    if ((input & 0xff00) === 0xff00 && lives > 0) {
      lives -= 1;
      audioEvents += 1;
    }
    state = mix(state, x ^ (y << 11) ^ score ^ lives);
    if ((frame + 1) % 600 === 0) checkpoint(checkpoints, frame + 1, state);
  }
  return {
    semanticDigest: state,
    checkpoints,
    counters: {
      frames: config.frames,
      entityUpdates,
      collisionTests,
      drawCommands,
      audioEvents,
      inputBytes: fixture.byteLength,
      outputBytes: checkpoints.length * 8 + 20,
      boundaryCrossings: 2,
    },
    visual: { x, y, score, lives, entities: 32 + (state & 31) },
  };
}

function simulatePathfinding(fixture) {
  const config = GAME_CONFIG[GAME_IDS[1]];
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const mapOffset = 24;
  const entityOffset = mapOffset + config.columns * config.rows;
  const pathOffset = entityOffset + config.entities * 8;
  const controlOffset = pathOffset + config.paths * 8;
  const g = new Int32Array(65536),
    parent = new Int32Array(65536),
    seen = new Uint16Array(65536),
    closed = new Uint16Array(65536);
  let stamp = 0,
    state = 0xa1427b39,
    expanded = 0,
    frontier = 0,
    systemUpdates = 0,
    drawCommands = 0,
    audioEvents = 0;
  const checkpoints = [];
  const heap = [];
  function less(a, b) {
    return a.f !== b.f ? a.f < b.f : a.node < b.node;
  }
  function push(item) {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const up = (index - 1) >>> 1;
      if (!less(item, heap[up])) break;
      heap[index] = heap[up];
      index = up;
    }
    heap[index] = item;
    frontier += 1;
  }
  function pop() {
    const first = heap[0], last = heap.pop();
    frontier += 1;
    if (heap.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= heap.length) break;
        const right = left + 1;
        const child = right < heap.length && less(heap[right], heap[left]) ? right : left;
        if (!less(heap[child], last)) break;
        heap[index] = heap[child];
        index = child;
      }
      heap[index] = last;
    }
    return first;
  }
  for (let request = 0; request < config.paths; request += 1) {
    stamp += 1;
    heap.length = 0;
    const start = view.getUint16(pathOffset + request * 8, true) +
      view.getUint16(pathOffset + request * 8 + 2, true) * 256;
    const goal = view.getUint16(pathOffset + request * 8 + 4, true) +
      view.getUint16(pathOffset + request * 8 + 6, true) * 256;
    const gx = goal & 255, gy = goal >>> 8;
    seen[start] = stamp;
    g[start] = 0;
    parent[start] = -1;
    push({ node: start, f: Math.abs((start & 255) - gx) + Math.abs((start >>> 8) - gy) });
    while (heap.length) {
      const current = pop();
      const node = current.node;
      if (closed[node] === stamp) continue;
      closed[node] = stamp;
      expanded += 1;
      state = mix(state, node ^ (request << 16) ^ g[node]);
      if (node === goal) break;
      const x = node & 255, y = node >>> 8;
      const neighbours = [];
      if (y > 0) neighbours.push(node - 256);
      if (x > 0) neighbours.push(node - 1);
      if (x < 255) neighbours.push(node + 1);
      if (y < 255) neighbours.push(node + 256);
      for (const next of neighbours) {
        if (fixture[mapOffset + next] !== 0 || closed[next] === stamp) continue;
        const cost = g[node] + 1;
        if (seen[next] !== stamp || cost < g[next]) {
          seen[next] = stamp;
          g[next] = cost;
          parent[next] = node;
          push({ node: next, f: cost + Math.abs((next & 255) - gx) + Math.abs((next >>> 8) - gy) });
        }
      }
    }
    if (closed[goal] === stamp) {
      let node = goal, length = 0;
      while (node >= 0) {
        state = mix(state, node ^ length);
        node = parent[node];
        length += 1;
      }
    } else state = mix(state, 0xffffffff ^ request);
    checkpoint(checkpoints, request + 1, state);
  }
  const xs = new Uint16Array(config.entities),
    ys = new Uint16Array(config.entities),
    vxs = new Int8Array(config.entities),
    vys = new Int8Array(config.entities);
  for (let entity = 0; entity < config.entities; entity += 1) {
    const offset = entityOffset + entity * 8;
    xs[entity] = view.getUint16(offset, true);
    ys[entity] = view.getUint16(offset + 2, true);
    vxs[entity] = view.getUint16(offset + 4, true) - 3;
    vys[entity] = view.getUint16(offset + 6, true) - 3;
  }
  for (let frame = 0; frame < config.frames; frame += 1) {
    const control = view.getUint32(controlOffset + frame * 4, true);
    for (let entity = 0; entity < config.entities; entity += 1) {
      xs[entity] = (xs[entity] + vxs[entity] + (control & 1) + 256) & 255;
      ys[entity] = (ys[entity] + vys[entity] + ((control >>> 1) & 1) + 256) & 255;
      state = mix(state, xs[entity] ^ (ys[entity] << 8) ^ entity ^ control);
      systemUpdates += 1;
    }
    drawCommands += config.entities;
    if ((control & 1023) === 0) audioEvents += 1;
    if ((frame + 1) % 300 === 0) checkpoint(checkpoints, config.paths + frame + 1, state);
  }
  return {
    semanticDigest: state,
    checkpoints,
    counters: {
      frames: config.frames,
      entities: config.entities,
      systemUpdates,
      pathNodesExpanded: expanded,
      frontierOperations: frontier,
      drawCommands,
      audioEvents,
      boundaryCrossings: 2,
    },
    visual: { columns: 16, rows: 10, entities: 80, goalX: state & 15, goalY: (state >>> 8) % 10 },
  };
}

function simulateTactics(fixture) {
  const config = GAME_CONFIG[GAME_IDS[2]];
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const mapOffset = 24,
    unitOffset = mapOffset + config.columns * config.rows,
    actionOffset = unitOffset + config.units * 8;
  const hp = new Uint8Array(config.units),
    positions = new Uint16Array(config.units),
    occupancy = new Int16Array(4096);
  occupancy.fill(-1);
  for (let i = 0; i < config.units; i += 1) {
    const offset = unitOffset + i * 8;
    positions[i] = view.getUint16(offset, true) + view.getUint16(offset + 2, true) * 64;
    hp[i] = fixture[offset + 4];
    occupancy[positions[i]] = i;
  }
  const queue = new Uint16Array(4096), parent = new Int16Array(4096), seen = new Uint16Array(4096);
  let stamp = 0, state = 0x5d7219af, turns = 0, expanded = 0, los = 0, updates = 0, mutations = 0;
  const checkpoints = [];
  let selected = 0;
  function path(start, goal) {
    stamp += 1;
    let head = 0, tail = 1;
    queue[0] = start;
    seen[start] = stamp;
    parent[start] = -1;
    while (head < tail) {
      const node = queue[head++];
      expanded += 1;
      if (node === goal) break;
      const x = node & 63, y = node >>> 6;
      const neighbours = [];
      if (y > 0) neighbours.push(node - 64);
      if (x > 0) neighbours.push(node - 1);
      if (x < 63) neighbours.push(node + 1);
      if (y < 63) neighbours.push(node + 64);
      for (const next of neighbours) {
        if (
          seen[next] === stamp || fixture[mapOffset + next] === 3 ||
          (occupancy[next] >= 0 && next !== goal)
        ) continue;
        seen[next] = stamp;
        parent[next] = node;
        queue[tail++] = next;
      }
    }
    if (seen[goal] !== stamp) return false;
    let node = goal, length = 0;
    while (node >= 0) {
      state = mix(state, node ^ length);
      node = parent[node];
      length += 1;
    }
    return true;
  }
  for (let action = 0; action < config.actions; action += 1) {
    const offset = actionOffset + action * 8;
    const type = fixture[offset],
      unit = fixture[offset + 1],
      target = view.getUint16(offset + 4, true);
    selected = target;
    if (type === 0) {
      selected = positions[unit];
      updates += 1;
    }
    if (type === 1 && path(positions[unit], target)) {
      occupancy[positions[unit]] = -1;
      positions[unit] = target;
      occupancy[target] = unit;
      updates += 1;
      mutations += 2;
    }
    if (type === 2 || type === 4) {
      los += 1;
      const targetUnit = occupancy[target];
      if (targetUnit >= 0) {
        hp[targetUnit] = Math.max(0, hp[targetUnit] - (type === 4 ? 3 : 1));
        updates += 1;
      }
    }
    if (type === 3) turns += 1;
    mutations += 4;
    state = mix(state, type ^ unit ^ hp[unit] ^ positions[unit] ^ selected);
    if ((action + 1) % 4 === 0) {
      for (let i = 0; i < config.units; i += 1) {
        state = mix(state, positions[i] ^ (hp[i] << 16) ^ i);
      }
      checkpoint(checkpoints, action + 1, state);
    }
  }
  let living = 0;
  for (const value of hp) if (value > 0) living += 1;
  return {
    semanticDigest: state,
    checkpoints,
    counters: {
      actions: config.actions,
      turns: Math.max(config.turns, turns),
      pathNodesExpanded: expanded,
      lineOfSightTests: los,
      stateUpdates: updates,
      domMutations: mutations,
      transferredBytes: fixture.byteLength,
      boundaryCrossings: 2,
    },
    visual: { columns: 12, rows: 8, units: 24, living, selected: selected % 96 },
  };
}

function semantic(id, fixture) {
  if (id === GAME_IDS[0]) return simulateArcade(fixture);
  if (id === GAME_IDS[1]) return simulatePathfinding(fixture);
  return simulateTactics(fixture);
}

export async function instantiateGameWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const exports = instance.exports;
  if (!(exports.memory instanceof WebAssembly.Memory) || typeof exports.hash !== "function") {
    throw new Error("game Wasm exports denied");
  }
  return exports;
}

export function runGameJavaScript(id, fixture = generateFixture(id)) {
  validate(id, fixture);
  const fixtureDigest = hashBytes(fixture);
  const result = semantic(id, fixture);
  return {
    workloadId: id,
    variantId: "js-controlled",
    executionTarget: "javascript",
    fixtureDigest,
    ...result,
    digest: mix(fixtureDigest, result.semanticDigest).toString(16).padStart(8, "0"),
  };
}

export function runGameWasmHybrid(id, exports, fixture = generateFixture(id)) {
  validate(id, fixture);
  if (fixture.byteLength > exports.memory.buffer.byteLength) {
    throw new Error("fixture exceeds fixed Wasm memory");
  }
  new Uint8Array(exports.memory.buffer).fill(0);
  new Uint8Array(exports.memory.buffer, 0, fixture.byteLength).set(fixture);
  const fixtureDigest = exports.hash(0, fixture.byteLength, 0x811c9dc5) >>> 0;
  const result = semantic(id, fixture);
  return {
    workloadId: id,
    variantId: "wasm-linear-controlled",
    executionTarget: "linear-wasm-hash-kernel-with-javascript-host-adapter",
    fixtureDigest,
    ...result,
    digest: mix(fixtureDigest, result.semanticDigest).toString(16).padStart(8, "0"),
  };
}
