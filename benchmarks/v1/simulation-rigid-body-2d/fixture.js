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
  velocityIterations: 4,
  positionIterations: 64,
  warmStart: false,
  linearDamping: Math.fround(0.5),
  halfExtent: Math.fround(0.5),
  spacingX: Math.fround(1.02),
  spacingY: Math.fround(1.01),
  restitution: Math.fround(0),
  jointStiffness: Math.fround(0.8),
});

const HEADER_BYTES = 64;
const BODY_WORDS = 7;
const JOINT_BYTES = 16;

function xorshift32(state) {
  let value = state >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function generateRigidBodyFixture() {
  const c = RIGID_CONFIG;
  const bytes = new Uint8Array(HEADER_BYTES + c.bodies * BODY_WORDS * 4 + c.joints * JOINT_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RB2D-V1\0"), 0);
  view.setUint32(8, 1, true);
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
  view.setFloat32(52, c.jointStiffness, true);
  view.setUint32(56, c.warmStart ? 1 : 0, true);
  view.setFloat32(60, c.linearDamping, true);
  let state = c.seed;
  for (let id = 0; id < c.bodies; id += 1) {
    state = xorshift32(state);
    const jitterX = Math.fround((((state >>> 8) & 0xffff) / 0xffff - 0.5) * 0.002);
    state = xorshift32(state);
    const jitterY = Math.fround((((state >>> 8) & 0xffff) / 0xffff) * 0.001);
    const column = id % c.columns;
    const row = Math.floor(id / c.columns);
    const offset = HEADER_BYTES + id * BODY_WORDS * 4;
    const x = Math.fround(Math.fround(Math.fround(column - 9.5) * c.spacingX) + jitterX);
    const y = Math.fround(
      Math.fround(c.halfExtent + Math.fround(row * c.spacingY)) + jitterY,
    );
    state = xorshift32(state);
    const vx = Math.fround((((state >>> 9) & 0x7fff) / 0x7fff - 0.5) * 0.004);
    view.setFloat32(offset, x, true);
    view.setFloat32(offset + 4, y, true);
    view.setFloat32(offset + 8, vx, true);
    view.setFloat32(offset + 12, 0, true);
    view.setFloat32(offset + 16, Math.fround(1 / (1 + (id % 4) * 0.25)), true);
    view.setFloat32(offset + 20, c.halfExtent, true);
    view.setFloat32(offset + 24, c.halfExtent, true);
  }
  const top = c.bodies - c.columns;
  const jointOffset = HEADER_BYTES + c.bodies * BODY_WORDS * 4;
  for (let joint = 0; joint < c.joints; joint += 1) {
    const offset = jointOffset + joint * JOINT_BYTES;
    view.setUint32(offset, top + joint, true);
    view.setUint32(offset + 4, top + joint + 1, true);
    view.setFloat32(offset + 8, c.spacingX, true);
    view.setFloat32(offset + 12, c.jointStiffness, true);
  }
  return bytes;
}

export const RIGID_FIXTURE_BYTES = HEADER_BYTES + RIGID_CONFIG.bodies * BODY_WORDS * 4 +
  RIGID_CONFIG.joints * JOINT_BYTES;
