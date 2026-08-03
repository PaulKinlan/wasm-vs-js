import {
  BODY_WORDS,
  generateRigidBodyFixture,
  HEADER_BYTES,
  JOINT_BYTES,
  RIGID_CONFIG,
  RIGID_FIXTURE_BYTES,
} from "./fixture.js";

const MAX_PAIRS = 8192;
const f = Math.fround;
const PI = f(3.1415927410125732), TAU = f(6.2831854820251465);
const add = (a, b) => f(f(a) + f(b));
const sub = (a, b) => f(f(a) - f(b));
const mul = (a, b) => f(f(a) * f(b));
const div = (a, b) => f(f(a) / f(b));
const abs = (a) => f(Math.abs(f(a)));
const sqrt = (a) => f(Math.sqrt(f(a)));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function wrapAngle(value) {
  let angle = f(value);
  while (angle > PI) angle = sub(angle, TAU);
  while (angle < -PI) angle = add(angle, TAU);
  return angle;
}
function sinApprox(value) {
  const x = wrapAngle(value), x2 = mul(x, x);
  return add(x, mul(mul(x, x2), add(f(-1 / 6), mul(x2, add(f(1 / 120), mul(x2, f(-1 / 5040)))))));
}
function cosApprox(value) {
  const x = wrapAngle(value), x2 = mul(x, x);
  return add(1, mul(x2, add(f(-1 / 2), mul(x2, add(f(1 / 24), mul(x2, f(-1 / 720)))))));
}
function quantize(value) {
  const scaled = mul(value, 1000);
  const rounded = scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
  return f(rounded / 1000);
}
function cross(ax, ay, bx, by) {
  return sub(mul(ax, by), mul(ay, bx));
}

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
function allocate(counter, Type, length) {
  counter.value += 1;
  counter.onAllocate?.(Type.name, length);
  return new Type(length);
}
function parseFixture(fixture, allocationCounter) {
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const bodies = view.getUint32(12, true), joints = view.getUint32(16, true);
  const x = allocate(allocationCounter, Float32Array, bodies);
  const y = allocate(allocationCounter, Float32Array, bodies);
  const angle = allocate(allocationCounter, Float32Array, bodies);
  const vx = allocate(allocationCounter, Float32Array, bodies);
  const vy = allocate(allocationCounter, Float32Array, bodies);
  const omega = allocate(allocationCounter, Float32Array, bodies);
  const invMass = allocate(allocationCounter, Float32Array, bodies);
  const invInertia = allocate(allocationCounter, Float32Array, bodies);
  const halfX = allocate(allocationCounter, Float32Array, bodies);
  const halfY = allocate(allocationCounter, Float32Array, bodies);
  const torque = allocate(allocationCounter, Float32Array, bodies);
  for (let id = 0; id < bodies; id += 1) {
    const offset = HEADER_BYTES + id * BODY_WORDS * 4;
    x[id] = view.getFloat32(offset, true);
    y[id] = view.getFloat32(offset + 4, true);
    angle[id] = view.getFloat32(offset + 8, true);
    vx[id] = view.getFloat32(offset + 12, true);
    vy[id] = view.getFloat32(offset + 16, true);
    omega[id] = view.getFloat32(offset + 20, true);
    invMass[id] = view.getFloat32(offset + 24, true);
    invInertia[id] = view.getFloat32(offset + 28, true);
    halfX[id] = view.getFloat32(offset + 32, true);
    halfY[id] = view.getFloat32(offset + 36, true);
    torque[id] = view.getFloat32(offset + 40, true);
  }
  const jointA = allocate(allocationCounter, Uint32Array, joints);
  const jointB = allocate(allocationCounter, Uint32Array, joints);
  const localAx = allocate(allocationCounter, Float32Array, joints);
  const localAy = allocate(allocationCounter, Float32Array, joints);
  const localBx = allocate(allocationCounter, Float32Array, joints);
  const localBy = allocate(allocationCounter, Float32Array, joints);
  const jointRest = allocate(allocationCounter, Float32Array, joints);
  const jointStiffness = allocate(allocationCounter, Float32Array, joints);
  const jointBase = HEADER_BYTES + bodies * BODY_WORDS * 4;
  for (let id = 0; id < joints; id += 1) {
    const offset = jointBase + id * JOINT_BYTES;
    jointA[id] = view.getUint32(offset, true);
    jointB[id] = view.getUint32(offset + 4, true);
    localAx[id] = view.getFloat32(offset + 8, true);
    localAy[id] = view.getFloat32(offset + 12, true);
    localBx[id] = view.getFloat32(offset + 16, true);
    localBy[id] = view.getFloat32(offset + 20, true);
    jointRest[id] = view.getFloat32(offset + 24, true);
    jointStiffness[id] = view.getFloat32(offset + 28, true);
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
    friction: view.getFloat32(52, true),
    linearDamping: view.getFloat32(60, true),
    angularDamping: view.getFloat32(64, true),
    torqueSteps: view.getUint32(68, true),
    x,
    y,
    angle,
    vx,
    vy,
    omega,
    invMass,
    invInertia,
    halfX,
    halfY,
    torque,
    jointA,
    jointB,
    localAx,
    localAy,
    localBx,
    localBy,
    jointRest,
    jointStiffness,
  };
}

function updateBasis(state, cosine, sine, extentX, extentY) {
  for (let id = 0; id < state.bodies; id += 1) {
    const c = cosApprox(state.angle[id]), s = sinApprox(state.angle[id]);
    cosine[id] = c;
    sine[id] = s;
    extentX[id] = add(mul(abs(c), state.halfX[id]), mul(abs(s), state.halfY[id]));
    extentY[id] = add(mul(abs(s), state.halfX[id]), mul(abs(c), state.halfY[id]));
  }
}
function sat(state, cosine, sine, a, b, out) {
  const dx = sub(state.x[b], state.x[a]), dy = sub(state.y[b], state.y[a]);
  let minimum = Infinity, nx = 0, ny = 0;
  const testAxis = (axisX, axisY) => {
    const distance = add(mul(dx, axisX), mul(dy, axisY));
    const au = abs(add(mul(axisX, cosine[a]), mul(axisY, sine[a])));
    const av = abs(add(mul(axisX, -sine[a]), mul(axisY, cosine[a])));
    const bu = abs(add(mul(axisX, cosine[b]), mul(axisY, sine[b])));
    const bv = abs(add(mul(axisX, -sine[b]), mul(axisY, cosine[b])));
    const radius = add(
      add(mul(state.halfX[a], au), mul(state.halfY[a], av)),
      add(mul(state.halfX[b], bu), mul(state.halfY[b], bv)),
    );
    const overlap = sub(radius, abs(distance));
    if (overlap <= 0) return false;
    if (overlap < minimum) {
      minimum = overlap;
      const sign = distance < 0 ? -1 : 1;
      nx = mul(axisX, sign);
      ny = mul(axisY, sign);
    }
    return true;
  };
  if (
    !testAxis(cosine[a], sine[a]) || !testAxis(-sine[a], cosine[a]) ||
    !testAxis(cosine[b], sine[b]) || !testAxis(-sine[b], cosine[b])
  ) return false;
  const signAu = add(mul(nx, cosine[a]), mul(ny, sine[a])) < 0 ? -1 : 1;
  const signAv = add(mul(nx, -sine[a]), mul(ny, cosine[a])) < 0 ? -1 : 1;
  const signBu = add(mul(-nx, cosine[b]), mul(-ny, sine[b])) < 0 ? -1 : 1;
  const signBv = add(mul(-nx, -sine[b]), mul(-ny, cosine[b])) < 0 ? -1 : 1;
  const sax = add(
    state.x[a],
    add(mul(mul(signAu, state.halfX[a]), cosine[a]), mul(mul(signAv, state.halfY[a]), -sine[a])),
  );
  const say = add(
    state.y[a],
    add(mul(mul(signAu, state.halfX[a]), sine[a]), mul(mul(signAv, state.halfY[a]), cosine[a])),
  );
  const sbx = add(
    state.x[b],
    add(mul(mul(signBu, state.halfX[b]), cosine[b]), mul(mul(signBv, state.halfY[b]), -sine[b])),
  );
  const sby = add(
    state.y[b],
    add(mul(mul(signBu, state.halfX[b]), sine[b]), mul(mul(signBv, state.halfY[b]), cosine[b])),
  );
  out.nx = nx;
  out.ny = ny;
  out.penetration = minimum;
  out.cx = mul(add(sax, sbx), 0.5);
  out.cy = mul(add(say, sby), 0.5);
  return true;
}
function groundManifold(state, cosine, sine, id, out) {
  const signU = sine[id] > 0 ? -1 : 1;
  const signV = cosine[id] > 0 ? -1 : 1;
  const rx = add(
    mul(mul(signU, state.halfX[id]), cosine[id]),
    mul(mul(signV, state.halfY[id]), -sine[id]),
  );
  const ry = add(
    mul(mul(signU, state.halfX[id]), sine[id]),
    mul(mul(signV, state.halfY[id]), cosine[id]),
  );
  const lowest = add(state.y[id], ry);
  if (lowest >= 0) return false;
  out.nx = 0;
  out.ny = -1;
  out.penetration = -lowest;
  out.cx = add(state.x[id], rx);
  out.cy = 0;
  return true;
}
function buildPairs(state, order, pairA, pairB, cosine, sine, extentX, extentY, counters) {
  updateBasis(state, cosine, sine, extentX, extentY);
  for (let index = 1; index < state.bodies; index += 1) {
    const id = order[index], key = sub(state.x[id], extentX[id]);
    let at = index;
    while (at > 0) {
      const prior = order[at - 1], priorKey = sub(state.x[prior], extentX[prior]);
      if (priorKey < key || (priorKey === key && prior < id)) break;
      order[at] = prior;
      at -= 1;
    }
    order[at] = id;
  }
  let count = 0;
  for (let left = 0; left < state.bodies; left += 1) {
    const a = order[left], maxX = add(state.x[a], extentX[a]);
    for (let right = left + 1; right < state.bodies; right += 1) {
      const b = order[right];
      if (sub(state.x[b], extentX[b]) > maxX) break;
      counters.broadphasePairs += 1;
      if (abs(sub(state.y[b], state.y[a])) <= add(extentY[a], extentY[b])) {
        if (count >= MAX_PAIRS) throw new Error("rotated manifold capacity exceeded");
        pairA[count] = a;
        pairB[count] = b;
        count += 1;
      }
    }
  }
  return count;
}
function applyContactVelocity(state, manifold, a, b, counters) {
  const rxA = sub(manifold.cx, state.x[a]), ryA = sub(manifold.cy, state.y[a]);
  const vxA = sub(state.vx[a], mul(state.omega[a], ryA));
  const vyA = add(state.vy[a], mul(state.omega[a], rxA));
  let inverse = state.invMass[a], rxB = 0, ryB = 0, vxB = 0, vyB = 0;
  if (b >= 0) {
    rxB = sub(manifold.cx, state.x[b]);
    ryB = sub(manifold.cy, state.y[b]);
    vxB = sub(state.vx[b], mul(state.omega[b], ryB));
    vyB = add(state.vy[b], mul(state.omega[b], rxB));
    inverse = add(inverse, state.invMass[b]);
  }
  const rnA = cross(rxA, ryA, manifold.nx, manifold.ny);
  let denominator = add(inverse, mul(mul(rnA, rnA), state.invInertia[a]));
  let rnB = 0;
  if (b >= 0) {
    rnB = cross(rxB, ryB, manifold.nx, manifold.ny);
    denominator = add(denominator, mul(mul(rnB, rnB), state.invInertia[b]));
  }
  const relativeX = sub(vxB, vxA), relativeY = sub(vyB, vyA);
  const normalVelocity = add(mul(relativeX, manifold.nx), mul(relativeY, manifold.ny));
  if (normalVelocity >= 0 || denominator <= 0) return;
  const impulse = div(mul(-(1 + state.restitution), normalVelocity), denominator);
  const ix = mul(impulse, manifold.nx), iy = mul(impulse, manifold.ny);
  state.vx[a] = sub(state.vx[a], mul(ix, state.invMass[a]));
  state.vy[a] = sub(state.vy[a], mul(iy, state.invMass[a]));
  state.omega[a] = sub(state.omega[a], mul(mul(rnA, impulse), state.invInertia[a]));
  if (b >= 0) {
    state.vx[b] = add(state.vx[b], mul(ix, state.invMass[b]));
    state.vy[b] = add(state.vy[b], mul(iy, state.invMass[b]));
    state.omega[b] = add(state.omega[b], mul(mul(rnB, impulse), state.invInertia[b]));
  }
  counters.normalImpulses += 1;
  if (rnA !== 0) counters.angularContactImpulses += 1;
  if (b >= 0 && rnB !== 0) counters.angularContactImpulses += 1;
  const tx = -manifold.ny, ty = manifold.nx;
  const rtA = cross(rxA, ryA, tx, ty);
  let tangentDenominator = add(inverse, mul(mul(rtA, rtA), state.invInertia[a]));
  let rtB = 0;
  if (b >= 0) {
    rtB = cross(rxB, ryB, tx, ty);
    tangentDenominator = add(tangentDenominator, mul(mul(rtB, rtB), state.invInertia[b]));
  }
  const tangentVelocity = add(mul(relativeX, tx), mul(relativeY, ty));
  const tangentImpulse = clamp(
    div(-tangentVelocity, tangentDenominator),
    -mul(state.friction, impulse),
    mul(state.friction, impulse),
  );
  const fx = mul(tangentImpulse, tx), fy = mul(tangentImpulse, ty);
  state.vx[a] = sub(state.vx[a], mul(fx, state.invMass[a]));
  state.vy[a] = sub(state.vy[a], mul(fy, state.invMass[a]));
  state.omega[a] = sub(state.omega[a], mul(mul(rtA, tangentImpulse), state.invInertia[a]));
  if (b >= 0) {
    state.vx[b] = add(state.vx[b], mul(fx, state.invMass[b]));
    state.vy[b] = add(state.vy[b], mul(fy, state.invMass[b]));
    state.omega[b] = add(state.omega[b], mul(mul(rtB, tangentImpulse), state.invInertia[b]));
  }
  counters.frictionImpulses += 1;
}
function applyContactPosition(state, manifold, a, b) {
  const depth = Math.max(0, manifold.penetration - 0.001);
  if (depth <= 0) return false;
  const denominator = b >= 0 ? add(state.invMass[a], state.invMass[b]) : state.invMass[a];
  if (denominator <= 0) return false;
  const impulse = div(b < 0 ? depth : Math.min(depth, 0.05), denominator);
  const ix = mul(impulse, manifold.nx), iy = mul(impulse, manifold.ny);
  state.x[a] = sub(state.x[a], mul(ix, state.invMass[a]));
  state.y[a] = sub(state.y[a], mul(iy, state.invMass[a]));
  if (b >= 0) {
    state.x[b] = add(state.x[b], mul(ix, state.invMass[b]));
    state.y[b] = add(state.y[b], mul(iy, state.invMass[b]));
  }
  return true;
}
function jointGeometry(state, cosine, sine, joint, out) {
  const a = state.jointA[joint], b = state.jointB[joint];
  const rax = add(mul(state.localAx[joint], cosine[a]), mul(state.localAy[joint], -sine[a]));
  const ray = add(mul(state.localAx[joint], sine[a]), mul(state.localAy[joint], cosine[a]));
  const rbx = add(mul(state.localBx[joint], cosine[b]), mul(state.localBy[joint], -sine[b]));
  const rby = add(mul(state.localBx[joint], sine[b]), mul(state.localBy[joint], cosine[b]));
  const dx = sub(add(state.x[b], rbx), add(state.x[a], rax));
  const dy = sub(add(state.y[b], rby), add(state.y[a], ray));
  const length = sqrt(add(mul(dx, dx), mul(dy, dy)));
  out.a = a;
  out.b = b;
  out.rax = rax;
  out.ray = ray;
  out.rbx = rbx;
  out.rby = rby;
  out.length = length;
  out.nx = length > 0.000001 ? div(dx, length) : 1;
  out.ny = length > 0.000001 ? div(dy, length) : 0;
}
function applyJointVelocity(state, joint, geometry, counters) {
  jointGeometry(state, geometry.cosine, geometry.sine, joint, geometry);
  const { a, b, rax, ray, rbx, rby, nx, ny } = geometry;
  const vaX = sub(state.vx[a], mul(state.omega[a], ray));
  const vaY = add(state.vy[a], mul(state.omega[a], rax));
  const vbX = sub(state.vx[b], mul(state.omega[b], rby));
  const vbY = add(state.vy[b], mul(state.omega[b], rbx));
  const rnA = cross(rax, ray, nx, ny), rnB = cross(rbx, rby, nx, ny);
  const denominator = add(
    add(state.invMass[a], state.invMass[b]),
    add(mul(mul(rnA, rnA), state.invInertia[a]), mul(mul(rnB, rnB), state.invInertia[b])),
  );
  if (denominator <= 0) return;
  const relative = add(mul(sub(vbX, vaX), nx), mul(sub(vbY, vaY), ny));
  const impulse = div(-relative, denominator), ix = mul(impulse, nx), iy = mul(impulse, ny);
  state.vx[a] = sub(state.vx[a], mul(ix, state.invMass[a]));
  state.vy[a] = sub(state.vy[a], mul(iy, state.invMass[a]));
  state.omega[a] = sub(state.omega[a], mul(mul(rnA, impulse), state.invInertia[a]));
  state.vx[b] = add(state.vx[b], mul(ix, state.invMass[b]));
  state.vy[b] = add(state.vy[b], mul(iy, state.invMass[b]));
  state.omega[b] = add(state.omega[b], mul(mul(rnB, impulse), state.invInertia[b]));
  counters.jointImpulses += 1;
}
function applyJointPosition(state, joint, geometry, counters) {
  jointGeometry(state, geometry.cosine, geometry.sine, joint, geometry);
  const { a, b, nx, ny, length } = geometry;
  const denominator = add(state.invMass[a], state.invMass[b]);
  if (denominator <= 0) return;
  const impulse = div(
    mul(clamp(sub(length, state.jointRest[joint]), -0.05, 0.05), state.jointStiffness[joint]),
    denominator,
  );
  const ix = mul(impulse, nx), iy = mul(impulse, ny);
  state.x[a] = add(state.x[a], mul(ix, state.invMass[a]));
  state.y[a] = add(state.y[a], mul(iy, state.invMass[a]));
  state.x[b] = sub(state.x[b], mul(ix, state.invMass[b]));
  state.y[b] = sub(state.y[b], mul(iy, state.invMass[b]));
  counters.jointImpulses += 1;
}
function quantizeState(state) {
  for (let id = 0; id < state.bodies; id += 1) {
    state.x[id] = quantize(state.x[id]);
    state.y[id] = quantize(state.y[id]);
    state.angle[id] = quantize(wrapAngle(state.angle[id]));
    state.vx[id] = quantize(state.vx[id]);
    state.vy[id] = quantize(state.vy[id]);
    state.omega[id] = quantize(state.omega[id]);
  }
}
function stateInto(state, target, offset) {
  let at = offset;
  for (let id = 0; id < state.bodies; id += 1) {
    target[at++] = state.x[id];
    target[at++] = state.y[id];
    target[at++] = state.angle[id];
    target[at++] = state.vx[id];
    target[at++] = state.vy[id];
    target[at++] = state.omega[id];
  }
}
function digest(values) {
  let hash = 0x811c9dc5;
  for (const value of values) {
    hash = Math.imul((hash ^ (Math.round(value * 1000) >>> 0)) >>> 0, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
function computeMetrics(state) {
  const c = new Float32Array(state.bodies),
    s = new Float32Array(state.bodies),
    ex = new Float32Array(state.bodies),
    ey = new Float32Array(state.bodies);
  updateBasis(state, c, s, ex, ey);
  let kinetic = 0, potential = 0, maxSpeed = 0, maxAngularSpeed = 0, groundPenetration = 0;
  for (let id = 0; id < state.bodies; id += 1) {
    const mass = 1 / state.invMass[id], inertia = 1 / state.invInertia[id];
    const speed2 = state.vx[id] ** 2 + state.vy[id] ** 2;
    kinetic += 0.5 * mass * speed2 + 0.5 * inertia * state.omega[id] ** 2;
    potential += mass * -state.gravityY * Math.max(0, state.y[id]);
    maxSpeed = Math.max(maxSpeed, Math.sqrt(speed2));
    maxAngularSpeed = Math.max(maxAngularSpeed, Math.abs(state.omega[id]));
    groundPenetration = Math.max(groundPenetration, ey[id] - state.y[id]);
  }
  const geometry = { cosine: c, sine: s };
  let jointAnchorError = 0;
  for (let joint = 0; joint < state.joints; joint += 1) {
    jointGeometry(state, c, s, joint, geometry);
    jointAnchorError = Math.max(
      jointAnchorError,
      Math.abs(geometry.length - state.jointRest[joint]),
    );
  }
  const manifold = {};
  let contactPenetration = 0;
  for (let a = 0; a < state.bodies; a += 1) {
    for (let b = a + 1; b < state.bodies; b += 1) {
      if (sat(state, c, s, a, b, manifold)) {
        contactPenetration = Math.max(contactPenetration, manifold.penetration);
      }
    }
  }
  return {
    kinetic,
    potential,
    totalEnergy: kinetic + potential,
    maxSpeed,
    maxAngularSpeed,
    groundPenetration,
    jointAnchorError,
    contactPenetration,
  };
}

export function runRigidBodyJavaScript(fixture, override = {}) {
  if (override.allowTestFixture) {
    if (!(fixture instanceof Uint8Array) || fixture.length !== RIGID_FIXTURE_BYTES) {
      throw new Error("test fixture byte length mismatch");
    }
  } else assertFixture(fixture);
  const allocationCounter = { value: 0, onAllocate: override.onAllocate },
    state = parseFixture(fixture, allocationCounter);
  const timesteps = override.timesteps ?? state.timesteps,
    checkpointEvery = override.checkpointEvery ?? state.checkpointEvery;
  const checkpointCount = Math.ceil(timesteps / checkpointEvery), stateValues = state.bodies * 6;
  const checkpoints = allocate(allocationCounter, Float32Array, checkpointCount * stateValues);
  const order = allocate(allocationCounter, Uint32Array, state.bodies);
  const pairA = allocate(allocationCounter, Uint32Array, MAX_PAIRS),
    pairB = allocate(allocationCounter, Uint32Array, MAX_PAIRS);
  const cosine = allocate(allocationCounter, Float32Array, state.bodies),
    sine = allocate(allocationCounter, Float32Array, state.bodies);
  const extentX = allocate(allocationCounter, Float32Array, state.bodies),
    extentY = allocate(allocationCounter, Float32Array, state.bodies);
  for (let id = 0; id < state.bodies; id += 1) order[id] = id;
  const counters = {
    timesteps: 0,
    broadphasePairs: 0,
    rotatedManifoldTests: 0,
    manifolds: 0,
    contactPoints: 0,
    normalImpulses: 0,
    frictionImpulses: 0,
    angularContactImpulses: 0,
    jointImpulses: 0,
    torqueApplications: 0,
    velocityIterations: 0,
    positionIterations: 0,
    stateValues: checkpointCount * stateValues,
    typedArrayAllocations: 0,
    exportedCallBoundaries: 0,
  };
  const manifold = {}, geometry = { cosine, sine };
  let checkpoint = 0;
  for (let step = 0; step < timesteps; step += 1) {
    for (let id = 0; id < state.bodies; id += 1) {
      state.vy[id] = add(state.vy[id], mul(state.gravityY, state.dt));
      if (step < state.torqueSteps && state.torque[id] !== 0) {
        state.omega[id] = add(
          state.omega[id],
          mul(mul(state.torque[id], state.invInertia[id]), state.dt),
        );
        counters.torqueApplications += 1;
      }
      state.vx[id] = mul(state.vx[id], state.linearDamping);
      state.vy[id] = mul(state.vy[id], state.linearDamping);
      state.omega[id] = mul(state.omega[id], state.angularDamping);
      state.x[id] = add(state.x[id], mul(state.vx[id], state.dt));
      state.y[id] = add(state.y[id], mul(state.vy[id], state.dt));
      state.angle[id] = wrapAngle(add(state.angle[id], mul(state.omega[id], state.dt)));
    }
    quantizeState(state);
    let pairCount = buildPairs(
      state,
      order,
      pairA,
      pairB,
      cosine,
      sine,
      extentX,
      extentY,
      counters,
    );
    for (let iteration = 0; iteration < state.velocityIterations; iteration += 1) {
      counters.velocityIterations += 1;
      updateBasis(state, cosine, sine, extentX, extentY);
      for (let id = 0; id < state.bodies; id += 1) {
        if (groundManifold(state, cosine, sine, id, manifold)) {
          counters.manifolds += 1;
          counters.contactPoints += 1;
          applyContactVelocity(state, manifold, id, -1, counters);
        }
      }
      for (let pair = 0; pair < pairCount; pair += 1) {
        counters.rotatedManifoldTests += 1;
        if (sat(state, cosine, sine, pairA[pair], pairB[pair], manifold)) {
          counters.manifolds += 1;
          counters.contactPoints += 1;
          applyContactVelocity(state, manifold, pairA[pair], pairB[pair], counters);
        }
      }
      for (let joint = 0; joint < state.joints; joint += 1) {
        applyJointVelocity(state, joint, geometry, counters);
      }
      quantizeState(state);
    }
    for (let iteration = 0; iteration < state.positionIterations; iteration += 1) {
      counters.positionIterations += 1;
      pairCount = buildPairs(state, order, pairA, pairB, cosine, sine, extentX, extentY, counters);
      for (let id = 0; id < state.bodies; id += 1) {
        if (groundManifold(state, cosine, sine, id, manifold)) {
          counters.manifolds += 1;
          counters.contactPoints += 1;
          applyContactPosition(state, manifold, id, -1);
        }
      }
      for (let pair = 0; pair < pairCount; pair += 1) {
        counters.rotatedManifoldTests += 1;
        if (sat(state, cosine, sine, pairA[pair], pairB[pair], manifold)) {
          counters.manifolds += 1;
          counters.contactPoints += 1;
          applyContactPosition(state, manifold, pairA[pair], pairB[pair]);
        }
      }
      updateBasis(state, cosine, sine, extentX, extentY);
      for (let joint = 0; joint < state.joints; joint += 1) {
        applyJointPosition(state, joint, geometry, counters);
      }
      updateBasis(state, cosine, sine, extentX, extentY);
      for (let id = 0; id < state.bodies; id += 1) {
        if (groundManifold(state, cosine, sine, id, manifold)) {
          counters.manifolds += 1;
          counters.contactPoints += 1;
          applyContactPosition(state, manifold, id, -1);
        }
      }
      quantizeState(state);
    }
    counters.timesteps += 1;
    if ((step + 1) % checkpointEvery === 0 || step + 1 === timesteps) {
      stateInto(state, checkpoints, checkpoint++ * stateValues);
    }
  }
  const finalState = allocate(allocationCounter, Float32Array, stateValues);
  finalState.set(checkpoints.subarray((checkpoint - 1) * stateValues, checkpoint * stateValues));
  counters.typedArrayAllocations = allocationCounter.value;
  for (const value of checkpoints) {
    if (!Number.isFinite(value)) throw new Error("non-finite rigid-body state");
  }
  return {
    workloadId: RIGID_CONFIG.id,
    variantId: "js-controlled",
    executionTarget: "javascript",
    checkpoints,
    finalState,
    checkpointDigest: digest(checkpoints),
    metrics: computeMetrics(state),
    counters,
  };
}

export async function instantiateRigidBodyWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  for (const name of ["memory", "fixture_ptr", "result_ptr", "run"]) {
    if (!(name in instance.exports)) throw new Error(`rigid-body Wasm export missing: ${name}`);
  }
  return instance.exports;
}
export function runRigidBodyWasm(fixture, exports, override = {}) {
  if (override.allowTestFixture) {
    if (!(fixture instanceof Uint8Array) || fixture.length !== RIGID_FIXTURE_BYTES) {
      throw new Error("test fixture byte length mismatch");
    }
  } else assertFixture(fixture);
  let allocations = 0, boundaries = 0;
  const allocated = (kind, length) => {
    allocations += 1;
    override.onAllocate?.(kind, length);
  };
  const timesteps = override.timesteps ?? RIGID_CONFIG.timesteps,
    checkpointEvery = override.checkpointEvery ?? RIGID_CONFIG.checkpointEvery;
  const fixturePtr = exports.fixture_ptr();
  boundaries += 1;
  override.onBoundary?.("fixture_ptr");
  const fixtureView = new Uint8Array(exports.memory.buffer, fixturePtr, fixture.length);
  allocated("Uint8Array", fixture.length);
  fixtureView.set(fixture);
  if (exports.run(timesteps, checkpointEvery) !== 0) throw new Error("rigid-body Wasm failed");
  boundaries += 1;
  override.onBoundary?.("run");
  const resultPtr = exports.result_ptr();
  boundaries += 1;
  override.onBoundary?.("result_ptr");
  const view = new DataView(exports.memory.buffer, resultPtr);
  allocated("DataView", 64);
  const names = [
    "timesteps",
    "broadphasePairs",
    "rotatedManifoldTests",
    "manifolds",
    "contactPoints",
    "normalImpulses",
    "frictionImpulses",
    "angularContactImpulses",
    "jointImpulses",
    "torqueApplications",
    "velocityIterations",
    "positionIterations",
    "stateValues",
  ];
  /** @type {Record<string, number>} */
  const counters = {};
  names.forEach((name, index) => counters[name] = view.getUint32(index * 4, true));
  const checkpointCount = Math.ceil(timesteps / checkpointEvery),
    stateValues = RIGID_CONFIG.bodies * 6;
  const source = new Float32Array(
    exports.memory.buffer,
    resultPtr + 64,
    checkpointCount * stateValues,
  );
  allocated("Float32Array-view", source.length);
  const checkpoints = new Float32Array(source);
  allocated("Float32Array", checkpoints.length);
  const finalState = checkpoints.slice((checkpointCount - 1) * stateValues);
  allocated("Float32Array", finalState.length);
  counters.typedArrayAllocations = allocations;
  counters.exportedCallBoundaries = boundaries;
  const validationCounter = { value: 0 }, state = parseFixture(fixture, validationCounter);
  for (let id = 0; id < state.bodies; id += 1) {
    const at = id * 6;
    state.x[id] = finalState[at];
    state.y[id] = finalState[at + 1];
    state.angle[id] = finalState[at + 2];
    state.vx[id] = finalState[at + 3];
    state.vy[id] = finalState[at + 4];
    state.omega[id] = finalState[at + 5];
  }
  for (const value of checkpoints) {
    if (!Number.isFinite(value)) throw new Error("non-finite rigid-body Wasm state");
  }
  return {
    workloadId: RIGID_CONFIG.id,
    variantId: "wasm-linear-controlled",
    executionTarget: "wasm-linear",
    checkpoints,
    finalState,
    checkpointDigest: digest(checkpoints),
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
    const a = js.checkpoints[index], b = wasm.checkpoints[index], absolute = Math.abs(a - b);
    const relative = absolute / Math.max(1, Math.abs(a), Math.abs(b));
    maximumAbsoluteError = Math.max(maximumAbsoluteError, absolute);
    maximumRelativeError = Math.max(maximumRelativeError, relative);
    if (absolute > absoluteTolerance && relative > relativeTolerance) violations += 1;
  }
  return { passed: violations === 0, violations, maximumAbsoluteError, maximumRelativeError };
}
