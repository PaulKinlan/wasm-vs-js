import { GAME_CONFIG, GAME_IDS, generateFixture } from "./fixtures.js";

export const GAME_VARIANTS = Object.freeze(["js-controlled", "wasm-linear-controlled"]);
const PRIME = 0x01000193;
const RESULT_WORDS = 2048;

function mix(hash, value) {
  return Math.imul((hash ^ (value >>> 0)) >>> 0, PRIME) >>> 0;
}
function hex(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}
export function hashBytes(bytes, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let i = 0; i < bytes.length; i += 1) hash = mix(hash, bytes[i]);
  return hash;
}
function validate(id, fixture) {
  if (!GAME_IDS.includes(id)) throw new Error("workload ID denied");
  if (!(fixture instanceof Uint8Array)) throw new Error("fixture must be Uint8Array");
  const expected = generateFixture(id);
  if (fixture.length !== expected.length) throw new Error("fixture byte length mismatch");
  for (let i = 0; i < fixture.length; i += 1) {
    if (fixture[i] !== expected[i]) throw new Error(`fixture mismatch at byte ${i}`);
  }
}
function finalize(id, variantId, target, fixture, core) {
  const fixtureDigest = hashBytes(fixture);
  const digest = mix(fixtureDigest, core.semanticDigest);
  return {
    workloadId: id,
    variantId,
    executionTarget: target,
    fixtureDigest: hex(fixtureDigest),
    semanticDigest: hex(core.semanticDigest),
    digest: hex(digest),
    oracle: core.oracle,
    counters: core.counters,
    replay: core.replay,
    visual: core.visual,
  };
}

function arcade(fixture) {
  const config = GAME_CONFIG[GAME_IDS[0]];
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  let state = 0x54a1c9e7, draw = 0x9e3779b9, audio = 0x243f6a88;
  let x = 640, y = 600, score = 0, lives = config.lives;
  let entityUpdates = 0, collisionTests = 0, drawCommands = 0, audioEvents = 0;
  const checkpoints = [], replay = [];
  for (let frame = 0; frame < config.frames; frame += 1) {
    const input = view.getUint32(24 + frame * 4, true);
    x = (x + ((input & 1) ? -7 : 0) + ((input & 2) ? 7 : 0) + 1280) % 1280;
    y = Math.max(0, Math.min(719, y + ((input & 4) ? -5 : 0) + ((input & 8) ? 5 : 0)));
    const active = 32 + ((input >>> 8) & 31);
    draw = mix(mix(mix(draw, 0), frame), 0x050002d0); // clear/background command
    drawCommands += 1;
    for (let entity = 0; entity < active; entity += 1) {
      state = mix(state, (frame * 131 + entity * 17 + input) >>> 0);
      entityUpdates += 1;
      state = mix(state, (x + y + entity) >>> 0);
      collisionTests += 1;
      draw = mix(mix(mix(mix(draw, 2), frame), entity), state);
      drawCommands += 1;
      if ((state & 2047) === 0) {
        score += 10;
        audio = mix(mix(mix(audio, 1), frame), entity);
        audioEvents += 1;
      }
    }
    draw = mix(mix(mix(mix(draw, 1), frame), x), y); // player
    draw = mix(mix(mix(draw, 3), score), lives); // HUD
    drawCommands += 2;
    if ((input & 0xff00) === 0xff00 && lives > 0) {
      lives -= 1;
      audio = mix(mix(mix(audio, 2), frame), lives);
      audioEvents += 1;
    }
    state = mix(state, x ^ (y << 11) ^ score ^ lives);
    if ((frame + 1) % 600 === 0) {
      const item = {
        frame: frame + 1,
        stateDigest: hex(state),
        drawDigest: hex(draw),
        audioDigest: hex(audio),
        x,
        y,
        score,
        lives,
        activeEntities: active,
      };
      checkpoints.push(item);
      replay.push({
        frame: frame + 1,
        x,
        y,
        score,
        lives,
        entities: active,
        traceDigest: hex(draw),
      });
    }
  }
  const semanticDigest = mix(mix(state, draw), audio);
  return {
    semanticDigest,
    oracle: {
      finalStateDigest: hex(state),
      drawCommandStreamDigest: hex(draw),
      audioEventStreamDigest: hex(audio),
      checkpoints,
    },
    counters: {
      frames: 3600,
      entityUpdates,
      collisionTests,
      drawCommands,
      audioEvents,
      inputBytes: fixture.length,
      outputBytes: checkpoints.length * 8 * 4 + 3 * 4,
      boundaryCrossings: 2,
    },
    replay,
    visual: replay.at(-1),
  };
}

function makeHeap(frontierCounter) {
  const heap = [];
  const less = (a, b) => a.f !== b.f ? a.f < b.f : a.node < b.node;
  return {
    clear() {
      heap.length = 0;
    },
    get length() {
      return heap.length;
    },
    push(item) {
      frontierCounter.value += 1;
      heap.push(item);
      let index = heap.length - 1;
      while (index > 0) {
        const up = (index - 1) >>> 1;
        if (!less(item, heap[up])) break;
        heap[index] = heap[up];
        index = up;
      }
      heap[index] = item;
    },
    pop() {
      frontierCounter.value += 1;
      const first = heap[0], last = heap.pop();
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
    },
  };
}

function pathfinding(fixture) {
  const config = GAME_CONFIG[GAME_IDS[1]];
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const mapOffset = 24, entityOffset = mapOffset + 65536;
  const pathOffset = entityOffset + config.entities * 8,
    controlOffset = pathOffset + config.paths * 8;
  const g = new Int32Array(65536), parent = new Int32Array(65536);
  const seen = new Uint16Array(65536), closed = new Uint16Array(65536);
  const frontierCounter = { value: 0 }, heap = makeHeap(frontierCounter);
  let stamp = 0, state = 0xa1427b39, pathDigest = 0x13198a2e, tieDigest = 0x03707344;
  let expanded = 0, systemUpdates = 0, drawCommands = 0, audioEvents = 0;
  const pathOracles = [], checkpoints = [], replay = [];
  for (let request = 0; request < config.paths; request += 1) {
    stamp += 1;
    heap.clear();
    const start = view.getUint16(pathOffset + request * 8, true) +
      view.getUint16(pathOffset + request * 8 + 2, true) * 256;
    const goal = view.getUint16(pathOffset + request * 8 + 4, true) +
      view.getUint16(pathOffset + request * 8 + 6, true) * 256;
    const gx = goal & 255, gy = goal >>> 8;
    seen[start] = stamp;
    g[start] = 0;
    parent[start] = -1;
    heap.push({ node: start, f: Math.abs((start & 255) - gx) + Math.abs((start >>> 8) - gy) });
    let requestTie = 0x85a308d3;
    while (heap.length) {
      const current = heap.pop(), node = current.node;
      if (closed[node] === stamp) continue;
      requestTie = mix(mix(requestTie, current.f), node);
      closed[node] = stamp;
      expanded += 1;
      state = mix(state, node ^ (request << 16) ^ g[node]);
      if (node === goal) break;
      const x = node & 255, y = node >>> 8;
      const candidates = [
        y > 0 ? node - 256 : -1,
        x > 0 ? node - 1 : -1,
        x < 255 ? node + 1 : -1,
        y < 255 ? node + 256 : -1,
      ];
      for (const next of candidates) {
        if (next < 0 || fixture[mapOffset + next] !== 0 || closed[next] === stamp) continue;
        const cost = g[node] + 1;
        if (seen[next] !== stamp || cost < g[next]) {
          seen[next] = stamp;
          g[next] = cost;
          parent[next] = node;
          heap.push({
            node: next,
            f: cost + Math.abs((next & 255) - gx) + Math.abs((next >>> 8) - gy),
          });
        }
      }
    }
    let requestPath = 0xa4093822, length = 0;
    if (closed[goal] === stamp) {
      let node = goal;
      while (node >= 0) {
        requestPath = mix(requestPath, node);
        node = parent[node];
        length += 1;
      }
    } else {
      requestPath = mix(requestPath, 0xffffffff);
    }
    pathDigest = mix(mix(pathDigest, request), requestPath);
    tieDigest = mix(mix(tieDigest, request), requestTie);
    pathOracles.push({
      request,
      length,
      pathDigest: hex(requestPath),
      tieBreakDigest: hex(requestTie),
    });
  }
  const xs = new Uint16Array(config.entities), ys = new Uint16Array(config.entities);
  const vxs = new Int8Array(config.entities), vys = new Int8Array(config.entities);
  for (let entity = 0; entity < config.entities; entity += 1) {
    const offset = entityOffset + entity * 8;
    xs[entity] = view.getUint16(offset, true);
    ys[entity] = view.getUint16(offset + 2, true);
    vxs[entity] = view.getUint16(offset + 4, true) - 3;
    vys[entity] = view.getUint16(offset + 6, true) - 3;
  }
  let ecs = 0x299f31d0, animation = 0x082efa98, draw = 0xec4e6c89, audio = 0x452821e6;
  for (let frame = 0; frame < config.frames; frame += 1) {
    const control = view.getUint32(controlOffset + frame * 4, true);
    for (let entity = 0; entity < config.entities; entity += 1) {
      xs[entity] = (xs[entity] + vxs[entity] + (control & 1) + 256) & 255;
      ys[entity] = (ys[entity] + vys[entity] + ((control >>> 1) & 1) + 256) & 255;
      const packed = xs[entity] ^ (ys[entity] << 8) ^ entity ^ control;
      ecs = mix(ecs, packed);
      state = mix(state, packed);
      systemUpdates += 1;
      animation = mix(animation, entity ^ (frame << 12) ^ ((control >>> 16) & 15));
      draw = mix(mix(mix(draw, entity), xs[entity]), ys[entity]);
      drawCommands += 1;
    }
    if ((control & 1023) === 0) {
      audio = mix(mix(audio, frame), control);
      audioEvents += 1;
    }
    if ((frame + 1) % 300 === 0) {
      const item = {
        frame: frame + 1,
        ecsDigest: hex(ecs),
        animationDigest: hex(animation),
        drawDigest: hex(draw),
        audioDigest: hex(audio),
        sampleX: xs[0],
        sampleY: ys[0],
      };
      checkpoints.push(item);
      replay.push({
        frame: frame + 1,
        entities: 80,
        goalX: state & 15,
        goalY: (state >>> 8) % 10,
        sampleX: xs[0],
        sampleY: ys[0],
        traceDigest: hex(draw),
      });
    }
  }
  const semanticDigest = [pathDigest, tieDigest, ecs, animation, draw, audio].reduce(mix, state);
  return {
    semanticDigest,
    oracle: {
      pathNodeSequenceDigest: hex(pathDigest),
      tieBreakDigest: hex(tieDigest),
      pathOracles,
      ecsCheckpointDigest: hex(ecs),
      animationCommandStreamDigest: hex(animation),
      drawCommandStreamDigest: hex(draw),
      audioEventStreamDigest: hex(audio),
      checkpoints,
    },
    counters: {
      frames: 1800,
      entities: 4096,
      systemUpdates,
      pathNodesExpanded: expanded,
      frontierOperations: frontierCounter.value,
      drawCommands,
      audioEvents,
      boundaryCrossings: 2,
    },
    replay,
    visual: replay.at(-1),
  };
}

function tactics(fixture) {
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const mapOffset = 24, unitOffset = mapOffset + 4096, actionOffset = unitOffset + 1024;
  const hp = new Uint8Array(128), team = new Uint8Array(128), positions = new Uint16Array(128);
  const occupancy = new Int16Array(4096);
  occupancy.fill(-1);
  for (let unit = 0; unit < 128; unit += 1) {
    const offset = unitOffset + unit * 8;
    positions[unit] = view.getUint16(offset, true) + view.getUint16(offset + 2, true) * 64;
    hp[unit] = fixture[offset + 4];
    team[unit] = fixture[offset + 5] & 1;
    if (occupancy[positions[unit]] < 0) occupancy[positions[unit]] = unit;
  }
  const queue = new Uint16Array(4096), parent = new Int16Array(4096), seen = new Uint16Array(4096);
  let stamp = 0,
    state = 0x5d7219af,
    turns = 0,
    expanded = 0,
    losTests = 0,
    updates = 0,
    mutations = 0;
  let selectedCell = positions[0], focusedCell = selectedCell, initiative = 0;
  const checkpoints = [], replay = [];
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
      const candidates = [
        y > 0 ? node - 64 : -1,
        x > 0 ? node - 1 : -1,
        x < 63 ? node + 1 : -1,
        y < 63 ? node + 64 : -1,
      ];
      for (const next of candidates) {
        if (
          next < 0 || seen[next] === stamp || fixture[mapOffset + next] === 3 ||
          (occupancy[next] >= 0 && next !== goal)
        ) continue;
        seen[next] = stamp;
        parent[next] = node;
        queue[tail++] = next;
      }
    }
    if (seen[goal] !== stamp) return false;
    let node = goal;
    while (node >= 0) {
      state = mix(state, node);
      node = parent[node];
    }
    return true;
  }
  function lineOfSight(start, goal) {
    let x0 = start & 63, y0 = start >>> 6;
    const x1 = goal & 63, y1 = goal >>> 6;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      losTests += 1;
      const node = x0 + y0 * 64;
      if (node !== start && node !== goal && fixture[mapOffset + node] === 3) return false;
      if (x0 === x1 && y0 === y1) return true;
      const twice = 2 * error;
      if (twice >= dy) {
        error += dy;
        x0 += sx;
      }
      if (twice <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  }
  for (let action = 0; action < 240; action += 1) {
    const offset = actionOffset + action * 8;
    const type = fixture[offset], unit = fixture[offset + 1];
    const from = view.getUint16(offset + 2, true),
      target = view.getUint16(offset + 4, true),
      turnId = view.getUint16(offset + 6, true);
    if (action % 4 === 0) {
      turns += 1;
      initiative = (turnId * 7) & 127;
      mutations += 1;
    }
    if (type === 0) {
      selectedCell = positions[unit];
      focusedCell = selectedCell;
      updates += 1;
      mutations += 2;
    }
    if (
      type === 1 && path(positions[unit], target) &&
      (occupancy[target] < 0 || occupancy[target] === unit)
    ) {
      if (occupancy[positions[unit]] === unit) occupancy[positions[unit]] = -1;
      positions[unit] = target;
      occupancy[target] = unit;
      selectedCell = target;
      focusedCell = target;
      updates += 1;
      mutations += 3;
    }
    if ((type === 2 || type === 4) && lineOfSight(from, target)) {
      const targetUnit = occupancy[target];
      if (targetUnit >= 0) {
        hp[targetUnit] = Math.max(0, hp[targetUnit] - (type === 4 ? 3 : 1));
        updates += 1;
        mutations += 1;
      }
    }
    if (type === 3) {
      initiative = (initiative + 1) & 127;
      mutations += 1;
    }
    state = mix(state, type ^ unit ^ hp[unit] ^ positions[unit] ^ selectedCell ^ turnId);
    if ((action + 1) % 4 === 0) {
      let unitDigest = 0x9216d5d9, occupancyDigest = 0x8979fb1b;
      let initiativeDigest = mix(0xd1310ba6, initiative), objectiveDigest = 0x98dfb5ac;
      let domDigest = 0x2ffd72db, accessibilityDigest = 0xb8e1afed;
      const focusDigest = mix(0xd01adfb7, focusedCell);
      const objectives = [0, 0];
      for (let i = 0; i < 128; i += 1) {
        unitDigest = mix(mix(mix(unitDigest, i), positions[i]), hp[i] ^ (team[i] << 8));
        initiativeDigest = mix(initiativeDigest, (i + initiative) & 127);
        if (fixture[mapOffset + positions[i]] === 2 && hp[i] > 0) objectives[team[i]] += 1;
      }
      objectiveDigest = mix(mix(objectiveDigest, objectives[0]), objectives[1]);
      for (let cell = 0; cell < 4096; cell += 1) {
        const occupant = occupancy[cell],
          selected = cell === selectedCell ? 1 : 0,
          focused = cell === focusedCell ? 1 : 0;
        occupancyDigest = mix(occupancyDigest, occupant < 0 ? 0xffffffff : occupant);
        domDigest = mix(
          mix(mix(domDigest, cell), fixture[mapOffset + cell]),
          (occupant + 1) ^ (selected << 16) ^ (focused << 17),
        );
        const unitState = occupant < 0 ? 0 : hp[occupant] ^ (team[occupant] << 8);
        accessibilityDigest = mix(
          mix(accessibilityDigest, 0x67726964),
          selected ^ (focused << 1) ^ (unitState << 2),
        );
      }
      const item = {
        turn: turnId + 1,
        unitDigest: hex(unitDigest),
        occupancyDigest: hex(occupancyDigest),
        initiativeDigest: hex(initiativeDigest),
        objectiveDigest: hex(objectiveDigest),
        domDigest: hex(domDigest),
        focusDigest: hex(focusDigest),
        accessibilityDigest: hex(accessibilityDigest),
        selectedCell,
        focusedCell,
        initiative,
        objectives,
      };
      checkpoints.push(item);
      replay.push({
        turn: turnId + 1,
        selected: selectedCell % 96,
        focused: focusedCell % 96,
        initiative,
        objectives,
        traceDigest: hex(domDigest),
      });
      state = [
        unitDigest,
        occupancyDigest,
        initiativeDigest,
        objectiveDigest,
        domDigest,
        focusDigest,
        accessibilityDigest,
      ].reduce(mix, state);
      mutations += 2;
    }
  }
  const final = checkpoints.at(-1);
  return {
    semanticDigest: state,
    oracle: {
      finalUnitDigest: final.unitDigest,
      finalOccupancyDigest: final.occupancyDigest,
      finalInitiativeDigest: final.initiativeDigest,
      finalObjectiveDigest: final.objectiveDigest,
      canonicalDomDigest: final.domDigest,
      focusStateDigest: final.focusDigest,
      accessibilityStateDigest: final.accessibilityDigest,
      turnCheckpoints: checkpoints,
    },
    counters: {
      actions: 240,
      turns,
      pathNodesExpanded: expanded,
      lineOfSightTests: losTests,
      stateUpdates: updates,
      domMutations: mutations,
      transferredBytes: fixture.length,
      boundaryCrossings: 2,
    },
    replay,
    visual: { ...replay.at(-1), columns: 12, rows: 8, units: 24 },
  };
}

function runCore(id, fixture) {
  if (id === GAME_IDS[0]) return arcade(fixture);
  if (id === GAME_IDS[1]) return pathfinding(fixture);
  return tactics(fixture);
}

export async function instantiateGameWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const exports = instance.exports;
  if (
    !(exports.memory instanceof WebAssembly.Memory) || typeof exports.run !== "function" ||
    typeof exports.input_ptr !== "function" || typeof exports.result_ptr !== "function"
  ) throw new Error("game Wasm exports denied");
  return exports;
}

export function runGameJavaScript(id, fixture = generateFixture(id)) {
  validate(id, fixture);
  return finalize(id, "js-controlled", "javascript", fixture, runCore(id, fixture));
}

// The Wasm parser is deliberately strict: every retained oracle field and counter
// comes from the independently compiled C implementation, never from runCore().
export function runGameWasm(id, exports, fixture = generateFixture(id)) {
  validate(id, fixture);
  const workload = GAME_IDS.indexOf(id);
  const inputPointer = Number(exports.input_ptr());
  new Uint8Array(exports.memory.buffer, inputPointer, fixture.length).set(fixture);
  const resultPointer = Number(exports.result_ptr());
  new Uint32Array(exports.memory.buffer, resultPointer, RESULT_WORDS).fill(0);
  const status = Number(exports.run(workload, fixture.length));
  if (status !== 0) throw new Error(`game Wasm run failed: ${status}`);
  const words = new Uint32Array(exports.memory.buffer, resultPointer, RESULT_WORDS);
  const core = decodeWasm(workload, words, fixture.length);
  return finalize(id, "wasm-linear-controlled", "wasm-linear", fixture, core);
}

function decodeWasm(workload, words, fixtureBytes) {
  const semanticDigest = words[0];
  if (workload === 0) {
    const checkpoints = [], replay = [];
    for (let i = 0; i < 6; i += 1) {
      const at = 64 + i * 8;
      const item = {
        frame: words[at],
        stateDigest: hex(words[at + 1]),
        drawDigest: hex(words[at + 2]),
        audioDigest: hex(words[at + 3]),
        x: words[at + 4],
        y: words[at + 5],
        score: words[at + 6],
        lives: words[at + 7],
        activeEntities: words[160 + i],
      };
      checkpoints.push(item);
      replay.push({
        frame: item.frame,
        x: item.x,
        y: item.y,
        score: item.score,
        lives: item.lives,
        entities: item.activeEntities,
        traceDigest: item.drawDigest,
      });
    }
    return {
      semanticDigest,
      oracle: {
        finalStateDigest: hex(words[1]),
        drawCommandStreamDigest: hex(words[2]),
        audioEventStreamDigest: hex(words[3]),
        checkpoints,
      },
      counters: {
        frames: words[32],
        entityUpdates: words[33],
        collisionTests: words[34],
        drawCommands: words[35],
        audioEvents: words[36],
        inputBytes: fixtureBytes,
        outputBytes: words[38],
        boundaryCrossings: 2,
      },
      replay,
      visual: replay.at(-1),
    };
  }
  if (workload === 1) {
    const pathOracles = [];
    for (let i = 0; i < 128; i += 1) {
      pathOracles.push({
        request: i,
        length: words[256 + i * 3],
        pathDigest: hex(words[257 + i * 3]),
        tieBreakDigest: hex(words[258 + i * 3]),
      });
    }
    const checkpoints = [], replay = [];
    for (let i = 0; i < 6; i += 1) {
      const at = 64 + i * 7;
      const item = {
        frame: words[at],
        ecsDigest: hex(words[at + 1]),
        animationDigest: hex(words[at + 2]),
        drawDigest: hex(words[at + 3]),
        audioDigest: hex(words[at + 4]),
        sampleX: words[at + 5],
        sampleY: words[at + 6],
      };
      checkpoints.push(item);
      replay.push({
        frame: item.frame,
        entities: 80,
        goalX: words[160 + i * 2],
        goalY: words[161 + i * 2],
        sampleX: item.sampleX,
        sampleY: item.sampleY,
        traceDigest: item.drawDigest,
      });
    }
    return {
      semanticDigest,
      oracle: {
        pathNodeSequenceDigest: hex(words[1]),
        tieBreakDigest: hex(words[2]),
        pathOracles,
        ecsCheckpointDigest: hex(words[3]),
        animationCommandStreamDigest: hex(words[4]),
        drawCommandStreamDigest: hex(words[5]),
        audioEventStreamDigest: hex(words[6]),
        checkpoints,
      },
      counters: {
        frames: words[32],
        entities: words[33],
        systemUpdates: words[34],
        pathNodesExpanded: words[35],
        frontierOperations: words[36],
        drawCommands: words[37],
        audioEvents: words[38],
        boundaryCrossings: 2,
      },
      replay,
      visual: replay.at(-1),
    };
  }
  const checkpoints = [], replay = [];
  for (let i = 0; i < 60; i += 1) {
    const at = 600 + i * 13;
    const item = {
      turn: words[at],
      unitDigest: hex(words[at + 1]),
      occupancyDigest: hex(words[at + 2]),
      initiativeDigest: hex(words[at + 3]),
      objectiveDigest: hex(words[at + 4]),
      domDigest: hex(words[at + 5]),
      focusDigest: hex(words[at + 6]),
      accessibilityDigest: hex(words[at + 7]),
      selectedCell: words[at + 8],
      focusedCell: words[at + 9],
      initiative: words[at + 10],
      objectives: [words[at + 11], words[at + 12]],
    };
    checkpoints.push(item);
    replay.push({
      turn: item.turn,
      selected: item.selectedCell % 96,
      focused: item.focusedCell % 96,
      initiative: item.initiative,
      objectives: item.objectives,
      traceDigest: item.domDigest,
    });
  }
  const final = checkpoints.at(-1);
  return {
    semanticDigest,
    oracle: {
      finalUnitDigest: final.unitDigest,
      finalOccupancyDigest: final.occupancyDigest,
      finalInitiativeDigest: final.initiativeDigest,
      finalObjectiveDigest: final.objectiveDigest,
      canonicalDomDigest: final.domDigest,
      focusStateDigest: final.focusDigest,
      accessibilityStateDigest: final.accessibilityDigest,
      turnCheckpoints: checkpoints,
    },
    counters: {
      actions: words[32],
      turns: words[33],
      pathNodesExpanded: words[34],
      lineOfSightTests: words[35],
      stateUpdates: words[36],
      domMutations: words[37],
      transferredBytes: fixtureBytes,
      boundaryCrossings: 2,
    },
    replay,
    visual: { ...replay.at(-1), columns: 12, rows: 8, units: 24 },
  };
}
