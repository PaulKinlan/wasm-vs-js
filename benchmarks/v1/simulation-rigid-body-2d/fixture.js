export const RIGID_CONFIG = Object.freeze({
  id: "simulation.rigid-body-2d.v1",
  seed: 0x5242474e,
  bodies: 500,
  columns: 20,
  rows: 25,
  joints: 19,
  timesteps: 1800,
  checkpointEvery: 300,
  checkpoints: 6,
  dt: Math.fround(1 / 60),
  gravityY: Math.fround(-9.8),
  velocityIterations: 6,
  positionIterations: 64,
  warmStart: false,
  spacingX: Math.fround(0.9),
  spacingY: Math.fround(0.9),
  restitution: Math.fround(0),
  friction: Math.fround(0.35),
  jointStiffness: Math.fround(0.8),
  linearDamping: Math.fround(0.05),
  angularDamping: Math.fround(0.05),
  torqueSteps: 120,
});

export const HEADER_BYTES = 96;
export const BODY_WORDS = 11;
export const JOINT_BYTES = 32;

function xorshift32(state) {
  let value = state >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function generateRigidBodyFixture() {
  const c = RIGID_CONFIG;
  const bytes = new Uint8Array(
    HEADER_BYTES + c.bodies * BODY_WORDS * 4 + c.joints * JOINT_BYTES,
  );
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RB2D-V2\0"), 0);
  view.setUint32(8, 2, true);
  view.setUint32(12, c.bodies, true);
  view.setUint32(16, c.joints, true);
  view.setUint32(20, c.timesteps, true);
  view.setUint32(24, c.velocityIterations, true);
  view.setUint32(28, c.positionIterations, true);
  view.setUint32(32, c.checkpointEvery, true);
  view.setUint32(36, c.seed, true);
  view.setFloat32(40, c.dt, true);
  view.setFloat32(44, c.gravityY, true);
  view.setFloat32(48, c.restitution, true);
  view.setFloat32(52, c.friction, true);
  view.setUint32(56, c.warmStart ? 1 : 0, true);
  view.setFloat32(60, c.linearDamping, true);
  view.setFloat32(64, c.angularDamping, true);
  view.setUint32(68, c.torqueSteps, true);
  view.setFloat32(72, c.jointStiffness, true);
  let state = c.seed;
  const halfX = new Float32Array(c.bodies), halfY = new Float32Array(c.bodies);
  for (let id = 0; id < c.bodies; id += 1) {
    state = xorshift32(state);
    const jitterX = Math.fround((((state >>> 8) & 0xffff) / 0xffff - 0.5) * 0.002);
    state = xorshift32(state);
    const jitterY = Math.fround((((state >>> 8) & 0xffff) / 0xffff) * 0.001);
    const column = id % c.columns;
    const row = Math.floor(id / c.columns);
    const offset = HEADER_BYTES + id * BODY_WORDS * 4;
    const hx = Math.fround(0.42 + (id % 3) * 0.015);
    const hy = Math.fround(0.42 + (id % 5) * 0.008);
    halfX[id] = hx;
    halfY[id] = hy;
    const x = Math.fround(Math.fround(Math.fround(column - 9.5) * c.spacingX) + jitterX);
    const y = Math.fround(Math.fround(hy + Math.fround(row * c.spacingY)) + jitterY);
    state = xorshift32(state);
    const angle = Math.fround((((state >>> 9) & 0x7fff) / 0x7fff - 0.5) * 0.06);
    state = xorshift32(state);
    const vx = Math.fround((((state >>> 9) & 0x7fff) / 0x7fff - 0.5) * 0.004);
    state = xorshift32(state);
    const omega = Math.fround((((state >>> 9) & 0x7fff) / 0x7fff - 0.5) * 0.012);
    const mass = Math.fround(1 + (id % 4) * 0.25);
    const inertia = Math.fround(Math.fround(mass / 3) * Math.fround(hx * hx + hy * hy));
    state = xorshift32(state);
    const torque = Math.fround((((state >>> 10) & 0x3fff) / 0x3fff - 0.5) * 0.001);
    view.setFloat32(offset, x, true);
    view.setFloat32(offset + 4, y, true);
    view.setFloat32(offset + 8, angle, true);
    view.setFloat32(offset + 12, vx, true);
    view.setFloat32(offset + 16, 0, true);
    view.setFloat32(offset + 20, omega, true);
    view.setFloat32(offset + 24, Math.fround(1 / mass), true);
    view.setFloat32(offset + 28, Math.fround(1 / inertia), true);
    view.setFloat32(offset + 32, hx, true);
    view.setFloat32(offset + 36, hy, true);
    view.setFloat32(offset + 40, torque, true);
  }
  const top = c.bodies - c.columns;
  const jointOffset = HEADER_BYTES + c.bodies * BODY_WORDS * 4;
  for (let joint = 0; joint < c.joints; joint += 1) {
    const a = top + joint, b = top + joint + 1;
    const offset = jointOffset + joint * JOINT_BYTES;
    view.setUint32(offset, a, true);
    view.setUint32(offset + 4, b, true);
    view.setFloat32(offset + 8, halfX[a], true);
    view.setFloat32(offset + 12, 0, true);
    view.setFloat32(offset + 16, -halfX[b], true);
    view.setFloat32(offset + 20, 0, true);
    view.setFloat32(
      offset + 24,
      Math.fround(c.spacingX - halfX[a] - halfX[b]),
      true,
    );
    view.setFloat32(offset + 28, c.jointStiffness, true);
  }
  return bytes;
}

export const RIGID_FIXTURE_BYTES = HEADER_BYTES + RIGID_CONFIG.bodies * BODY_WORDS * 4 +
  RIGID_CONFIG.joints * JOINT_BYTES;
