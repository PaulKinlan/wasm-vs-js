import {
  ECS_CELL_SHIFT,
  ECS_CHECKPOINT_INTERVAL,
  ECS_ENTITY_BYTES,
  ECS_GRID_CELLS,
  ECS_GRID_WIDTH,
  ECS_HEADER_BYTES,
  ECS_VARIANTS,
  ECS_WORKLOAD_ID,
  generateEcsFixture,
  validateGeneratedFixture,
} from "./fixture.js";

const PRIME = 0x01000193;
const RESULT_STATE_OFFSET = 128;
const CHECKPOINT_OFFSET = 64;
const CHECKPOINT_WORDS = 3;

function mix(hash, value) {
  return Math.imul((hash ^ (value >>> 0)) >>> 0, PRIME) >>> 0;
}
function hex(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}
export function hashBytes(bytes, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let index = 0; index < bytes.length; index += 1) hash = mix(hash, bytes[index]);
  return hash;
}
function clampVelocity(value) {
  return value < -16 ? -16 : value > 16 ? 16 : value;
}
function delta(bits) {
  return bits === 3 ? 0 : bits - 1;
}
function canonicalState(xs, ys, vxs, vys, animations, radii, includeWords) {
  const words = includeWords ? new Uint32Array(xs.length * 6) : null;
  let digest = 0x7f4a7c15;
  for (let entity = 0; entity < xs.length; entity += 1) {
    const offset = entity * 6;
    const values = [
      xs[entity],
      ys[entity],
      vxs[entity] & 0xff,
      vys[entity] & 0xff,
      animations[entity],
      radii[entity],
    ];
    digest = mix(digest, entity);
    for (let item = 0; item < 6; item += 1) {
      digest = mix(digest, values[item]);
      if (words) words[offset + item] = values[item];
    }
  }
  return { words, digest };
}
function commonResult(fixture, entities, frames, state, checkpoints, counters) {
  let checkpointDigest = 0x5f356495;
  for (const checkpoint of checkpoints) {
    checkpointDigest = mix(checkpointDigest, checkpoint.frame);
    checkpointDigest = mix(checkpointDigest, Number.parseInt(checkpoint.stateDigest, 16));
    checkpointDigest = mix(checkpointDigest, checkpoint.pairTests);
  }
  const fixtureDigest = hashBytes(fixture);
  let semanticDigest = mix(fixtureDigest, state.digest);
  semanticDigest = mix(semanticDigest, checkpointDigest);
  semanticDigest = mix(semanticDigest, counters.pairTests);
  semanticDigest = mix(semanticDigest, counters.collisions);
  return {
    workloadId: ECS_WORKLOAD_ID,
    fixtureDigest: hex(fixtureDigest),
    semanticDigest: hex(semanticDigest),
    oracle: {
      kind: "canonical-semantic",
      equivalenceClass: "tolerance-equivalent",
      algorithmFamily: "ecs-fixed-system-order",
      integerTolerance: 0,
      finalStateDigest: hex(state.digest),
      checkpointDigest: hex(checkpointDigest),
      checkpoints,
      finalState: state.words,
    },
    counters: {
      frames,
      entities,
      ...counters,
      inputBytes: fixture.byteLength,
      outputBytes: state.words.byteLength + checkpoints.length * 12 + 8,
    },
  };
}

export function runEcsJavaScript(fixture = generateEcsFixture()) {
  const { entities, frames } = validateGeneratedFixture(fixture);
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const xs = new Uint16Array(entities);
  const ys = new Uint16Array(entities);
  const vxs = new Int8Array(entities);
  const vys = new Int8Array(entities);
  const animations = new Uint8Array(entities);
  const radii = new Uint8Array(entities);
  const head = new Int32Array(ECS_GRID_CELLS);
  const next = new Int32Array(entities);
  let offset = ECS_HEADER_BYTES;
  for (let entity = 0; entity < entities; entity += 1) {
    xs[entity] = view.getUint16(offset, true);
    ys[entity] = view.getUint16(offset + 2, true);
    vxs[entity] = view.getInt8(offset + 4);
    vys[entity] = view.getInt8(offset + 5);
    animations[entity] = view.getUint8(offset + 6);
    radii[entity] = view.getUint8(offset + 7);
    offset += ECS_ENTITY_BYTES;
  }
  const traceOffset = ECS_HEADER_BYTES + entities * ECS_ENTITY_BYTES;
  let movementUpdates = 0;
  let controlMutations = 0;
  let pairTests = 0;
  let collisions = 0;
  let animationUpdates = 0;
  let stateMutations = 0;
  const checkpoints = [];
  const processPair = (left, right) => {
    pairTests += 1;
    const reach = radii[left] + radii[right];
    const dx = xs[left] - xs[right];
    const dy = ys[left] - ys[right];
    if (dx < -reach || dx > reach || dy < -reach || dy > reach) return;
    const leftVx = vxs[left], leftVy = vys[left];
    vxs[left] = vxs[right];
    vys[left] = vys[right];
    vxs[right] = leftVx;
    vys[right] = leftVy;
    collisions += 1;
    stateMutations += 4;
  };
  const processCrossCells = (leftCell, rightCell) => {
    for (let left = head[leftCell]; left >= 0; left = next[left]) {
      for (let right = head[rightCell]; right >= 0; right = next[right]) {
        processPair(left, right);
      }
    }
  };
  for (let frame = 0; frame < frames; frame += 1) {
    const control = fixture[traceOffset + frame];
    const selectedRemainder = frame % 257;
    const controlX = delta(control & 3);
    const controlY = delta((control >>> 2) & 3);
    for (let entity = 0; entity < entities; entity += 1) {
      if (entity % 257 === selectedRemainder) {
        vxs[entity] = clampVelocity(vxs[entity] + controlX);
        vys[entity] = clampVelocity(vys[entity] + controlY);
        controlMutations += 2;
        stateMutations += 2;
      }
      let x = xs[entity] + vxs[entity];
      let y = ys[entity] + vys[entity];
      if (x < 0) {
        x = -x;
        vxs[entity] = -vxs[entity];
        stateMutations += 1;
      } else if (x > 0xffff) {
        x = 0x1fffe - x;
        vxs[entity] = -vxs[entity];
        stateMutations += 1;
      }
      if (y < 0) {
        y = -y;
        vys[entity] = -vys[entity];
        stateMutations += 1;
      } else if (y > 0xffff) {
        y = 0x1fffe - y;
        vys[entity] = -vys[entity];
        stateMutations += 1;
      }
      xs[entity] = x;
      ys[entity] = y;
      movementUpdates += 1;
      stateMutations += 2;
    }
    head.fill(-1);
    for (let entity = 0; entity < entities; entity += 1) {
      const cell = (ys[entity] >>> ECS_CELL_SHIFT) * ECS_GRID_WIDTH +
        (xs[entity] >>> ECS_CELL_SHIFT);
      next[entity] = head[cell];
      head[cell] = entity;
    }
    for (let cellY = 0; cellY < ECS_GRID_WIDTH; cellY += 1) {
      for (let cellX = 0; cellX < ECS_GRID_WIDTH; cellX += 1) {
        const cell = cellY * ECS_GRID_WIDTH + cellX;
        for (let left = head[cell]; left >= 0; left = next[left]) {
          for (let right = next[left]; right >= 0; right = next[right]) {
            processPair(left, right);
          }
        }
        if (cellX + 1 < ECS_GRID_WIDTH) processCrossCells(cell, cell + 1);
        if (cellY + 1 < ECS_GRID_WIDTH && cellX > 0) {
          processCrossCells(cell, cell + ECS_GRID_WIDTH - 1);
        }
        if (cellY + 1 < ECS_GRID_WIDTH) processCrossCells(cell, cell + ECS_GRID_WIDTH);
        if (cellY + 1 < ECS_GRID_WIDTH && cellX + 1 < ECS_GRID_WIDTH) {
          processCrossCells(cell, cell + ECS_GRID_WIDTH + 1);
        }
      }
    }
    const controlAnimation = (control >>> 4) & 1;
    for (let entity = 0; entity < entities; entity += 1) {
      const speedClass = (Math.abs(vxs[entity]) + Math.abs(vys[entity])) & 3;
      animations[entity] = (animations[entity] + 1 + speedClass + controlAnimation) & 0xff;
      animationUpdates += 1;
      stateMutations += 1;
    }
    if ((frame + 1) % ECS_CHECKPOINT_INTERVAL === 0 || frame + 1 === frames) {
      const state = canonicalState(xs, ys, vxs, vys, animations, radii, false);
      checkpoints.push({
        frame: frame + 1,
        stateDigest: hex(state.digest),
        pairTests,
        collisions,
      });
    }
  }
  const state = canonicalState(xs, ys, vxs, vys, animations, radii, true);
  const result = commonResult(fixture, entities, frames, state, checkpoints, {
    systemPasses: frames * 3,
    movementUpdates,
    broadphaseCellClears: frames * ECS_GRID_CELLS,
    broadphaseCellScans: frames * ECS_GRID_CELLS * 5,
    broadphaseInsertions: frames * entities,
    pairTests,
    collisions,
    animationUpdates,
    controlMutations,
    stateMutations,
    checkpointCount: checkpoints.length,
    ownedBufferAllocations: 9,
    boundaryCrossings: 0,
  });
  return { ...result, variantId: ECS_VARIANTS[0], executionTarget: "javascript" };
}

export async function instantiateEcsWasm(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error("Wasm artifact must be Uint8Array");
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports;
  for (const name of ["memory", "input_ptr", "result_ptr", "run"]) {
    if (!(name in exports)) throw new Error(`Wasm export missing: ${name}`);
  }
  const memory = exports.memory;
  if (!(memory instanceof WebAssembly.Memory) || memory.buffer.byteLength !== 1_048_576) {
    throw new Error("Wasm memory must be fixed at 1 MiB");
  }
  return exports;
}

export function runEcsWasm(runtime, fixture = generateEcsFixture()) {
  const { entities, frames } = validateGeneratedFixture(fixture);
  const memory = runtime.memory;
  if (!(memory instanceof WebAssembly.Memory) || memory.buffer.byteLength !== 1_048_576) {
    throw new Error("Wasm memory changed");
  }
  const inputPointer = runtime.input_ptr();
  new Uint8Array(memory.buffer, inputPointer, fixture.byteLength).set(fixture);
  const status = runtime.run(fixture.byteLength);
  if (status !== 0) throw new Error(`Wasm ECS run failed with status ${status}`);
  const outputPointer = runtime.result_ptr();
  const words = new Uint32Array(memory.buffer, outputPointer, RESULT_STATE_OFFSET + entities * 6);
  const checkpointCount = words[26];
  const checkpoints = [];
  for (let index = 0; index < checkpointCount; index += 1) {
    const offset = CHECKPOINT_OFFSET + index * CHECKPOINT_WORDS;
    checkpoints.push({
      frame: words[offset],
      stateDigest: hex(words[offset + 1]),
      pairTests: words[offset + 2],
      collisions: words[29 + index],
    });
  }
  const state = {
    digest: words[0],
    words: words.slice(RESULT_STATE_OFFSET, RESULT_STATE_OFFSET + entities * 6),
  };
  const result = commonResult(fixture, entities, frames, state, checkpoints, {
    systemPasses: words[18],
    movementUpdates: words[19],
    broadphaseCellClears: words[20],
    broadphaseCellScans: words[21],
    broadphaseInsertions: words[22],
    pairTests: words[23],
    collisions: words[24],
    animationUpdates: words[25],
    controlMutations: words[27],
    stateMutations: words[28],
    checkpointCount,
    ownedBufferAllocations: 0,
    boundaryCrossings: 2,
  });
  if (words[1] !== Number.parseInt(result.oracle.checkpointDigest, 16)) {
    throw new Error("Wasm checkpoint digest mismatch");
  }
  return { ...result, variantId: ECS_VARIANTS[1], executionTarget: "wasm-linear" };
}
