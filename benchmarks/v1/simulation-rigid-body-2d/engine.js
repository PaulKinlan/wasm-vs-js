import { generateRigidBodyFixture, RIGID_CONFIG, RIGID_FIXTURE_BYTES } from "./fixture.js";

const HEADER_BYTES = 64;
const BODY_WORDS = 7;
const MAX_PAIRS = 8192;
const f = Math.fround;
const add = (a, b) => f(f(a) + f(b));
const sub = (a, b) => f(f(a) - f(b));
const mul = (a, b) => f(f(a) * f(b));
const div = (a, b) => f(f(a) / f(b));
const abs = (a) => f(Math.abs(f(a)));
const sqrt = (a) => f(Math.sqrt(f(a)));
const quantizeStep = (value) => {
  const scaled = f(f(value) * 1000);
  const rounded = scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
  return f(rounded / 1000);
};

function assertFixture(fixture) {
  if (!(fixture instanceof Uint8Array) || fixture.length !== RIGID_FIXTURE_BYTES) {
    throw new Error("rigid-body fixture byte length mismatch");
  }
  const expected = generateRigidBodyFixture();
  for (let index = 0; index < fixture.length; index += 1) {
    if (fixture[index] !== expected[index]) {
      throw new Error(`rigid-body fixture mismatch at ${index}`);
    }
  }
}

function parseFixture(fixture) {
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const bodies = view.getUint32(12, true);
  const joints = view.getUint32(16, true);
  const x = new Float32Array(bodies), y = new Float32Array(bodies);
  const vx = new Float32Array(bodies), vy = new Float32Array(bodies);
  const invMass = new Float32Array(bodies), halfX = new Float32Array(bodies);
  const halfY = new Float32Array(bodies);
  for (let id = 0; id < bodies; id += 1) {
    const offset = HEADER_BYTES + id * BODY_WORDS * 4;
    x[id] = view.getFloat32(offset, true);
    y[id] = view.getFloat32(offset + 4, true);
    vx[id] = view.getFloat32(offset + 8, true);
    vy[id] = view.getFloat32(offset + 12, true);
    invMass[id] = view.getFloat32(offset + 16, true);
    halfX[id] = view.getFloat32(offset + 20, true);
    halfY[id] = view.getFloat32(offset + 24, true);
  }
  const jointA = new Uint32Array(joints), jointB = new Uint32Array(joints);
  const jointRest = new Float32Array(joints), jointStiffness = new Float32Array(joints);
  const jointBase = HEADER_BYTES + bodies * BODY_WORDS * 4;
  for (let id = 0; id < joints; id += 1) {
    const offset = jointBase + id * 16;
    jointA[id] = view.getUint32(offset, true);
    jointB[id] = view.getUint32(offset + 4, true);
    jointRest[id] = view.getFloat32(offset + 8, true);
    jointStiffness[id] = view.getFloat32(offset + 12, true);
  }
  return {
    bodies,
    joints,
    timesteps: view.getUint32(20, true),
    velocityIterations: view.getUint32(24, true),
    positionIterations: view.getUint32(28, true),
    checkpointEvery: view.getUint32(32, true),
    dt: view.getFloat32(40, true),
    gravityY: view.getFloat32(44, true),
    restitution: view.getFloat32(48, true),
    linearDamping: view.getFloat32(60, true),
    x,
    y,
    vx,
    vy,
    invMass,
    halfX,
    halfY,
    jointA,
    jointB,
    jointRest,
    jointStiffness,
  };
}

function stateInto(state, target, offset) {
  let at = offset;
  for (let id = 0; id < state.bodies; id += 1) {
    target[at++] = state.x[id];
    target[at++] = state.y[id];
    target[at++] = state.vx[id];
    target[at++] = state.vy[id];
  }
}

function quantizedDigest(values) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < values.length; index += 1) {
    const quantized = Math.round(values[index] * 10000) | 0;
    hash = Math.imul((hash ^ (quantized >>> 0)) >>> 0, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function computeMetrics(state) {
  let kinetic = 0, potential = 0, maxSpeed = 0, groundPenetration = 0;
  for (let id = 0; id < state.bodies; id += 1) {
    const mass = 1 / state.invMass[id];
    const speed2 = state.vx[id] * state.vx[id] + state.vy[id] * state.vy[id];
    kinetic += 0.5 * mass * speed2;
    potential += mass * -state.gravityY * Math.max(0, state.y[id]);
    maxSpeed = Math.max(maxSpeed, Math.sqrt(speed2));
    groundPenetration = Math.max(groundPenetration, state.halfY[id] - state.y[id]);
  }
  let jointLengthError = 0;
  for (let joint = 0; joint < state.joints; joint += 1) {
    const a = state.jointA[joint], b = state.jointB[joint];
    jointLengthError = Math.max(
      jointLengthError,
      Math.abs(
        Math.hypot(state.x[b] - state.x[a], state.y[b] - state.y[a]) - state.jointRest[joint],
      ),
    );
  }
  let contactPenetration = 0;
  for (let a = 0; a < state.bodies; a += 1) {
    for (let b = a + 1; b < state.bodies; b += 1) {
      const px = state.halfX[a] + state.halfX[b] - Math.abs(state.x[b] - state.x[a]);
      const py = state.halfY[a] + state.halfY[b] - Math.abs(state.y[b] - state.y[a]);
      if (px > 0 && py > 0) contactPenetration = Math.max(contactPenetration, Math.min(px, py));
    }
  }
  return {
    kinetic,
    potential,
    totalEnergy: kinetic + potential,
    maxSpeed,
    groundPenetration,
    jointLengthError,
    contactPenetration,
  };
}

export function runRigidBodyJavaScript(fixture, override = {}) {
  if (override.allowTestFixture) {
    if (!(fixture instanceof Uint8Array) || fixture.length !== RIGID_FIXTURE_BYTES) {
      throw new Error("test fixture byte length mismatch");
    }
  } else assertFixture(fixture);
  const state = parseFixture(fixture);
  const timesteps = override.timesteps ?? state.timesteps;
  const checkpointEvery = override.checkpointEvery ?? state.checkpointEvery;
  const checkpointCount = Math.ceil(timesteps / checkpointEvery);
  const stateValues = state.bodies * 4;
  const checkpoints = new Float32Array(checkpointCount * stateValues);
  const order = new Uint32Array(state.bodies);
  const pairA = new Uint32Array(MAX_PAIRS), pairB = new Uint32Array(MAX_PAIRS);
  for (let id = 0; id < state.bodies; id += 1) order[id] = id;
  const counters = {
    timesteps: 0,
    broadphasePairs: 0,
    narrowphaseTests: 0,
    contacts: 0,
    contactConstraints: 0,
    jointConstraints: 0,
    velocityIterations: 0,
    positionIterations: 0,
    stateValues: checkpointCount * stateValues,
    allocations: 17,
    boundaryCrossings: 0,
  };
  let checkpoint = 0;
  for (let step = 0; step < timesteps; step += 1) {
    for (let id = 0; id < state.bodies; id += 1) {
      state.vy[id] = add(state.vy[id], mul(state.gravityY, state.dt));
      state.vx[id] = mul(state.vx[id], state.linearDamping);
      state.vy[id] = mul(state.vy[id], state.linearDamping);
      state.x[id] = add(state.x[id], mul(state.vx[id], state.dt));
      state.y[id] = add(state.y[id], mul(state.vy[id], state.dt));
      state.x[id] = quantizeStep(state.x[id]);
      state.y[id] = quantizeStep(state.y[id]);
      state.vx[id] = quantizeStep(state.vx[id]);
      state.vy[id] = quantizeStep(state.vy[id]);
    }
    for (let index = 1; index < state.bodies; index += 1) {
      const id = order[index];
      const key = sub(state.x[id], state.halfX[id]);
      let at = index;
      while (at > 0) {
        const prior = order[at - 1];
        const priorKey = sub(state.x[prior], state.halfX[prior]);
        if (priorKey < key || (priorKey === key && prior < id)) break;
        order[at] = prior;
        at -= 1;
      }
      order[at] = id;
    }
    let pairCount = 0;
    for (let left = 0; left < state.bodies; left += 1) {
      const a = order[left];
      const maxX = add(state.x[a], state.halfX[a]);
      for (let right = left + 1; right < state.bodies; right += 1) {
        const b = order[right];
        if (sub(state.x[b], state.halfX[b]) > maxX) break;
        counters.broadphasePairs += 1;
        counters.narrowphaseTests += 1;
        const px = sub(add(state.halfX[a], state.halfX[b]), abs(sub(state.x[b], state.x[a])));
        const py = sub(add(state.halfY[a], state.halfY[b]), abs(sub(state.y[b], state.y[a])));
        if (px > 0 && py > 0) {
          if (pairCount >= MAX_PAIRS) throw new Error("rigid-body contact capacity exceeded");
          pairA[pairCount] = a;
          pairB[pairCount] = b;
          pairCount += 1;
        }
      }
    }
    let groundCount = 0;
    for (let id = 0; id < state.bodies; id += 1) {
      if (state.y[id] <= add(state.halfY[id], 0.002)) groundCount += 1;
    }
    counters.contacts += pairCount + groundCount;
    for (let iteration = 0; iteration < state.velocityIterations; iteration += 1) {
      counters.velocityIterations += 1;
      for (let id = 0; id < state.bodies; id += 1) {
        if (state.y[id] <= add(state.halfY[id], 0.002) && state.vy[id] < 0) state.vy[id] = 0;
      }
      for (let pair = 0; pair < pairCount; pair += 1) {
        const a = pairA[pair], b = pairB[pair];
        const dx = sub(state.x[b], state.x[a]), dy = sub(state.y[b], state.y[a]);
        const px = sub(add(state.halfX[a], state.halfX[b]), abs(dx));
        const py = sub(add(state.halfY[a], state.halfY[b]), abs(dy));
        if (px <= 0 || py <= 0) continue;
        const inverse = add(state.invMass[a], state.invMass[b]);
        if (px < py) {
          const sign = dx < 0 ? -1 : 1;
          const relative = mul(sub(state.vx[b], state.vx[a]), sign);
          if (relative < 0) {
            const impulse = div(-relative, inverse);
            state.vx[a] = sub(state.vx[a], mul(mul(impulse, sign), state.invMass[a]));
            state.vx[b] = add(state.vx[b], mul(mul(impulse, sign), state.invMass[b]));
          }
        } else {
          const sign = dy < 0 ? -1 : 1;
          const relative = mul(sub(state.vy[b], state.vy[a]), sign);
          if (relative < 0) {
            const impulse = div(-relative, inverse);
            state.vy[a] = sub(state.vy[a], mul(mul(impulse, sign), state.invMass[a]));
            state.vy[b] = add(state.vy[b], mul(mul(impulse, sign), state.invMass[b]));
          }
        }
        counters.contactConstraints += 1;
      }
      for (let joint = 0; joint < state.joints; joint += 1) {
        const a = state.jointA[joint], b = state.jointB[joint];
        const dx = sub(state.x[b], state.x[a]), dy = sub(state.y[b], state.y[a]);
        const length = sqrt(add(mul(dx, dx), mul(dy, dy)));
        if (length > 0.000001) {
          const nx = div(dx, length), ny = div(dy, length);
          const relative = add(
            mul(sub(state.vx[b], state.vx[a]), nx),
            mul(sub(state.vy[b], state.vy[a]), ny),
          );
          const impulse = div(-relative, add(state.invMass[a], state.invMass[b]));
          state.vx[a] = sub(state.vx[a], mul(mul(impulse, nx), state.invMass[a]));
          state.vy[a] = sub(state.vy[a], mul(mul(impulse, ny), state.invMass[a]));
          state.vx[b] = add(state.vx[b], mul(mul(impulse, nx), state.invMass[b]));
          state.vy[b] = add(state.vy[b], mul(mul(impulse, ny), state.invMass[b]));
        }
        counters.jointConstraints += 1;
      }
    }
    for (let iteration = 0; iteration < state.positionIterations; iteration += 1) {
      counters.positionIterations += 1;
      for (let id = 0; id < state.bodies; id += 1) {
        if (state.y[id] < state.halfY[id]) state.y[id] = state.halfY[id];
      }
      for (let index = 1; index < state.bodies; index += 1) {
        const id = order[index];
        const key = sub(state.x[id], state.halfX[id]);
        let at = index;
        while (at > 0) {
          const prior = order[at - 1];
          const priorKey = sub(state.x[prior], state.halfX[prior]);
          if (priorKey < key || (priorKey === key && prior < id)) break;
          order[at] = prior;
          at -= 1;
        }
        order[at] = id;
      }
      pairCount = 0;
      for (let left = 0; left < state.bodies; left += 1) {
        const a = order[left];
        const maxX = add(state.x[a], state.halfX[a]);
        for (let right = left + 1; right < state.bodies; right += 1) {
          const b = order[right];
          if (sub(state.x[b], state.halfX[b]) > maxX) break;
          counters.broadphasePairs += 1;
          counters.narrowphaseTests += 1;
          const px = sub(add(state.halfX[a], state.halfX[b]), abs(sub(state.x[b], state.x[a])));
          const py = sub(add(state.halfY[a], state.halfY[b]), abs(sub(state.y[b], state.y[a])));
          if (px > 0 && py > 0) {
            if (pairCount >= MAX_PAIRS) throw new Error("rigid-body contact capacity exceeded");
            pairA[pairCount] = a;
            pairB[pairCount] = b;
            pairCount += 1;
          }
        }
      }
      counters.contacts += pairCount;
      for (let pair = 0; pair < pairCount; pair += 1) {
        const a = pairA[pair], b = pairB[pair];
        const dx = sub(state.x[b], state.x[a]), dy = sub(state.y[b], state.y[a]);
        const px = sub(add(state.halfX[a], state.halfX[b]), abs(dx));
        const py = sub(add(state.halfY[a], state.halfY[b]), abs(dy));
        if (px <= 0 || py <= 0) continue;
        const inverse = add(state.invMass[a], state.invMass[b]);
        if (px < py) {
          const sign = dx < 0 ? -1 : 1;
          const correction = px;
          state.x[a] = sub(state.x[a], mul(mul(div(correction, inverse), sign), state.invMass[a]));
          state.x[b] = add(state.x[b], mul(mul(div(correction, inverse), sign), state.invMass[b]));
        } else {
          const sign = dy < 0 ? -1 : 1;
          const correction = py;
          if (sign > 0) {
            state.y[b] = add(state.y[b], correction);
            if (state.vy[b] < state.vy[a]) state.vy[b] = state.vy[a];
          } else {
            state.y[a] = add(state.y[a], correction);
            if (state.vy[a] < state.vy[b]) state.vy[a] = state.vy[b];
          }
        }
        counters.contactConstraints += 1;
      }
      for (let joint = 0; joint < state.joints; joint += 1) {
        const a = state.jointA[joint], b = state.jointB[joint];
        const dx = sub(state.x[b], state.x[a]), dy = sub(state.y[b], state.y[a]);
        const length = sqrt(add(mul(dx, dx), mul(dy, dy)));
        if (length > 0.000001) {
          const error = sub(length, state.jointRest[joint]);
          const scale = mul(
            div(mul(error, state.jointStiffness[joint]), add(state.invMass[a], state.invMass[b])),
            div(1, length),
          );
          const cx = mul(dx, scale), cy = mul(dy, scale);
          state.x[a] = add(state.x[a], mul(cx, state.invMass[a]));
          state.y[a] = add(state.y[a], mul(cy, state.invMass[a]));
          state.x[b] = sub(state.x[b], mul(cx, state.invMass[b]));
          state.y[b] = sub(state.y[b], mul(cy, state.invMass[b]));
        }
        counters.jointConstraints += 1;
      }
      for (let id = 0; id < state.bodies; id += 1) {
        if (state.y[id] < state.halfY[id]) state.y[id] = state.halfY[id];
        if (state.y[id] <= state.halfY[id] && state.vy[id] < 0) state.vy[id] = 0;
        state.x[id] = quantizeStep(state.x[id]);
        state.y[id] = quantizeStep(state.y[id]);
        state.vx[id] = quantizeStep(state.vx[id]);
        state.vy[id] = quantizeStep(state.vy[id]);
      }
    }
    for (let id = 0; id < state.bodies; id += 1) {
      state.x[id] = quantizeStep(state.x[id]);
      state.y[id] = quantizeStep(state.y[id]);
      state.vx[id] = quantizeStep(state.vx[id]);
      state.vy[id] = quantizeStep(state.vy[id]);
    }
    counters.timesteps += 1;
    if ((step + 1) % checkpointEvery === 0 || step + 1 === timesteps) {
      stateInto(state, checkpoints, checkpoint * stateValues);
      checkpoint += 1;
    }
  }
  const finalState = checkpoints.slice((checkpoint - 1) * stateValues, checkpoint * stateValues);
  for (const value of checkpoints) {
    if (!Number.isFinite(value)) throw new Error("non-finite rigid-body state");
  }
  return {
    workloadId: RIGID_CONFIG.id,
    variantId: "js-controlled",
    executionTarget: "javascript",
    checkpoints,
    finalState,
    checkpointDigest: quantizedDigest(checkpoints),
    metrics: computeMetrics(state),
    counters,
  };
}

export async function instantiateRigidBodyWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports;
  for (const name of ["memory", "fixture_ptr", "result_ptr", "run"]) {
    if (!(name in exports)) throw new Error(`rigid-body Wasm export missing: ${name}`);
  }
  return exports;
}

export function runRigidBodyWasm(fixture, exports, override = {}) {
  if (override.allowTestFixture) {
    if (!(fixture instanceof Uint8Array) || fixture.length !== RIGID_FIXTURE_BYTES) {
      throw new Error("test fixture byte length mismatch");
    }
  } else assertFixture(fixture);
  const timesteps = override.timesteps ?? RIGID_CONFIG.timesteps;
  const checkpointEvery = override.checkpointEvery ?? RIGID_CONFIG.checkpointEvery;
  const fixturePtr = exports.fixture_ptr();
  new Uint8Array(exports.memory.buffer, fixturePtr, fixture.length).set(fixture);
  const checkpointCount = Math.ceil(timesteps / checkpointEvery);
  const stateValues = RIGID_CONFIG.bodies * 4;
  const status = exports.run(timesteps, checkpointEvery);
  if (status !== 0) throw new Error(`rigid-body Wasm failed: ${status}`);
  const resultPtr = exports.result_ptr();
  const view = new DataView(exports.memory.buffer, resultPtr);
  const counters = {
    timesteps: view.getUint32(0, true),
    broadphasePairs: view.getUint32(4, true),
    narrowphaseTests: view.getUint32(8, true),
    contacts: view.getUint32(12, true),
    contactConstraints: view.getUint32(16, true),
    jointConstraints: view.getUint32(20, true),
    velocityIterations: view.getUint32(24, true),
    positionIterations: view.getUint32(28, true),
    stateValues: view.getUint32(32, true),
    allocations: 0,
    boundaryCrossings: 2,
  };
  const checkpoints = new Float32Array(checkpointCount * stateValues);
  checkpoints.set(new Float32Array(exports.memory.buffer, resultPtr + 64, checkpoints.length));
  const finalState = checkpoints.slice((checkpointCount - 1) * stateValues);
  for (const value of checkpoints) {
    if (!Number.isFinite(value)) throw new Error("non-finite rigid-body Wasm state");
  }
  const state = parseFixture(fixture);
  for (let id = 0; id < state.bodies; id += 1) {
    state.x[id] = finalState[id * 4];
    state.y[id] = finalState[id * 4 + 1];
    state.vx[id] = finalState[id * 4 + 2];
    state.vy[id] = finalState[id * 4 + 3];
  }
  return {
    workloadId: RIGID_CONFIG.id,
    variantId: "wasm-linear-controlled",
    executionTarget: "wasm-linear",
    checkpoints,
    finalState,
    checkpointDigest: quantizedDigest(checkpoints),
    metrics: computeMetrics(state),
    counters,
  };
}

export function compareRigidBodyResults(
  js,
  wasm,
  absoluteTolerance = 0.0005,
  relativeTolerance = 0.00005,
) {
  if (js.checkpoints.length !== wasm.checkpoints.length) {
    throw new Error("checkpoint length mismatch");
  }
  let maximumAbsoluteError = 0, maximumRelativeError = 0, violations = 0;
  for (let index = 0; index < js.checkpoints.length; index += 1) {
    const a = js.checkpoints[index], b = wasm.checkpoints[index];
    const absolute = Math.abs(a - b);
    const relative = absolute / Math.max(1, Math.abs(a), Math.abs(b));
    maximumAbsoluteError = Math.max(maximumAbsoluteError, absolute);
    maximumRelativeError = Math.max(maximumRelativeError, relative);
    if (absolute > absoluteTolerance && relative > relativeTolerance) violations += 1;
  }
  return { passed: violations === 0, violations, maximumAbsoluteError, maximumRelativeError };
}
