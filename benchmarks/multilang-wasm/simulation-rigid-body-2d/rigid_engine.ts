// rigid_engine.ts — AssemblyScript multilang kernel for
// simulation.rigid-body-2d.v1.
//
// Mirrors rigid_engine.c statement for statement: the same SAT narrow phase,
// the same sweep-and-prune ordering with its exact tie-break, the same
// sequential-impulse velocity and position solvers, the same joint solver, the
// same per-substep quantisation to 1/1000, and the same thirteen counters in
// the same order.
//
// The trigonometry is the C kernel's polynomial approximation after range
// reduction, not the platform's Math.sin/cos — calling the platform's would
// make this a different function from every other engine, which is the defect
// the audio-fft AssemblyScript kernel shipped with.
//
// State lives at fixed linear-memory offsets rather than in AssemblyScript
// arrays: a top-level array is heap-allocated, and the caller writes the
// fixture through fixture_ptr(), so the heap and the fixture would collide.

const BODIES: u32 = 500;
const JOINTS: u32 = 19;
const HEADER_BYTES: u32 = 96;
const BODY_WORDS: u32 = 11;
const JOINT_BYTES: u32 = 32;
const FIXTURE_BYTES: u32 = HEADER_BYTES + BODIES * BODY_WORDS * 4 + JOINTS * JOINT_BYTES;
const MAX_PAIRS: u32 = 8192;
const MAX_CHECKPOINTS: u32 = 6;
const STATE_VALUES: u32 = BODIES * 6;
const PI: f32 = 3.1415927410125732;
const TAU: f32 = 6.2831854820251465;

// ── Fixed memory layout ───────────────────────────────────────────────────
// The fixture the caller fills, then one f32 slab per body property, then the
// joint slabs, then the sweep-and-prune scratch, then the result block.
const FIXTURE_OFF: usize = 0;
const B: usize = <usize> BODIES * 4;
const X_OFF: usize = FIXTURE_OFF + <usize> FIXTURE_BYTES + 64;
const Y_OFF: usize = X_OFF + B;
const ANGLE_OFF: usize = Y_OFF + B;
const VX_OFF: usize = ANGLE_OFF + B;
const VY_OFF: usize = VX_OFF + B;
const OMEGA_OFF: usize = VY_OFF + B;
const INV_MASS_OFF: usize = OMEGA_OFF + B;
const INV_INERTIA_OFF: usize = INV_MASS_OFF + B;
const HALF_X_OFF: usize = INV_INERTIA_OFF + B;
const HALF_Y_OFF: usize = HALF_X_OFF + B;
const TORQUE_OFF: usize = HALF_Y_OFF + B;
const COSINE_OFF: usize = TORQUE_OFF + B;
const SINE_OFF: usize = COSINE_OFF + B;
const EXTENT_X_OFF: usize = SINE_OFF + B;
const EXTENT_Y_OFF: usize = EXTENT_X_OFF + B;
const ORDER_OFF: usize = EXTENT_Y_OFF + B;
const J: usize = <usize> JOINTS * 4;
const JOINT_A_OFF: usize = ORDER_OFF + B;
const JOINT_B_OFF: usize = JOINT_A_OFF + J;
const LOCAL_AX_OFF: usize = JOINT_B_OFF + J;
const LOCAL_AY_OFF: usize = LOCAL_AX_OFF + J;
const LOCAL_BX_OFF: usize = LOCAL_AY_OFF + J;
const LOCAL_BY_OFF: usize = LOCAL_BX_OFF + J;
const JOINT_REST_OFF: usize = LOCAL_BY_OFF + J;
const JOINT_STIFF_OFF: usize = JOINT_REST_OFF + J;
const PAIR_A_OFF: usize = JOINT_STIFF_OFF + J;
const PAIR_B_OFF: usize = PAIR_A_OFF + <usize> MAX_PAIRS * 4;
// Result block: 13 counters, 3 reserved words, then the checkpoint states.
const RESULT_OFF: usize = PAIR_B_OFF + <usize> MAX_PAIRS * 4;
const RESULT_CHECKPOINTS_OFF: usize = RESULT_OFF + 64;

function fget(base: usize, i: u32): f32 {
  return load<f32>(base + (<usize> i) * 4);
}

function fset(base: usize, i: u32, v: f32): void {
  store<f32>(base + (<usize> i) * 4, v);
}

function uget(base: usize, i: u32): u32 {
  return load<u32>(base + (<usize> i) * 4);
}

function uset(base: usize, i: u32, v: u32): void {
  store<u32>(base + (<usize> i) * 4, v);
}

function counterBump(i: u32): void {
  store<u32>(RESULT_OFF + (<usize> i) * 4, load<u32>(RESULT_OFF + (<usize> i) * 4) + 1);
}

function u32At(o: u32): u32 {
  return <u32> load<u8>(FIXTURE_OFF + <usize> o) |
    (<u32> load<u8>(FIXTURE_OFF + <usize> (o + 1)) << 8) |
    (<u32> load<u8>(FIXTURE_OFF + <usize> (o + 2)) << 16) |
    (<u32> load<u8>(FIXTURE_OFF + <usize> (o + 3)) << 24);
}
function f32At(o: u32): f32 {
  return reinterpret<f32>(u32At(o));
}

function absf(a: f32): f32 {
  return a < 0 ? -a : a;
}

function cross(ax: f32, ay: f32, bx: f32, by: f32): f32 {
  return ax * by - ay * bx;
}

function clampf(v: f32, lo: f32, hi: f32): f32 {
  return v < lo ? lo : (v > hi ? hi : v);
}

function wrap(a0: f32): f32 {
  let a: f32 = a0;
  while (a > PI) a -= TAU;
  while (a < -PI) a += TAU;
  return a;
}

function sinApprox(x0: f32): f32 {
  const x: f32 = wrap(x0);
  const x2: f32 = x * x;
  return x +
    (x * x2) *
      (<f32> (-1.0 / 6.0) + x2 * (<f32> (1.0 / 120.0) + x2 * <f32> (-1.0 / 5040.0)));
}

function cosApprox(x0: f32): f32 {
  const x: f32 = wrap(x0);
  const x2: f32 = x * x;
  return <f32> 1.0 +
    x2 * (<f32> (-1.0 / 2.0) + x2 * (<f32> (1.0 / 24.0) + x2 * <f32> (-1.0 / 720.0)));
}

function quantize(a: f32): f32 {
  const s: f32 = a * 1000.0;
  const r: i32 = <i32> (s < 0 ? s - <f32> 0.5 : s + <f32> 0.5);
  return <f32> r / <f32> 1000.0;
}

export function fixture_ptr(): u32 {
  return <u32> FIXTURE_OFF;
}

export function result_ptr(): u32 {
  return <u32> RESULT_OFF;
}

function updateBasis(): void {
  for (let i: u32 = 0; i < BODIES; i++) {
    const c: f32 = cosApprox(fget(ANGLE_OFF, i));
    const s: f32 = sinApprox(fget(ANGLE_OFF, i));
    fset(COSINE_OFF, i, c);
    fset(SINE_OFF, i, s);
    fset(EXTENT_X_OFF, i, absf(c) * fget(HALF_X_OFF, i) + absf(s) * fget(HALF_Y_OFF, i));
    fset(EXTENT_Y_OFF, i, absf(s) * fget(HALF_X_OFF, i) + absf(c) * fget(HALF_Y_OFF, i));
  }
}

// Manifold fields, held in globals rather than a struct so nothing allocates.
let mNx: f32 = 0, mNy: f32 = 0, mPen: f32 = 0, mCx: f32 = 0, mCy: f32 = 0;

function sat(a: u32, b: u32): bool {
  const dx: f32 = fget(X_OFF, b) - fget(X_OFF, a);
  const dy: f32 = fget(Y_OFF, b) - fget(Y_OFF, a);
  let minimum: f32 = 3.402823e38;
  let nx: f32 = 0, ny: f32 = 0;
  const ca: f32 = fget(COSINE_OFF, a), sa: f32 = fget(SINE_OFF, a);
  const cb: f32 = fget(COSINE_OFF, b), sb: f32 = fget(SINE_OFF, b);
  const hxa: f32 = fget(HALF_X_OFF, a), hya: f32 = fget(HALF_Y_OFF, a);
  const hxb: f32 = fget(HALF_X_OFF, b), hyb: f32 = fget(HALF_Y_OFF, b);
  for (let k: u32 = 0; k < 4; k++) {
    let ax: f32, ay: f32;
    if (k == 0) {
      ax = ca;
      ay = sa;
    } else if (k == 1) {
      ax = -sa;
      ay = ca;
    } else if (k == 2) {
      ax = cb;
      ay = sb;
    } else {
      ax = -sb;
      ay = cb;
    }
    const d: f32 = dx * ax + dy * ay;
    const au: f32 = absf(ax * ca + ay * sa), av: f32 = absf(ax * -sa + ay * ca);
    const bu: f32 = absf(ax * cb + ay * sb), bv: f32 = absf(ax * -sb + ay * cb);
    const radius: f32 = hxa * au + hya * av + hxb * bu + hyb * bv;
    const overlap: f32 = radius - absf(d);
    if (overlap <= 0) return false;
    if (overlap < minimum) {
      minimum = overlap;
      const sign: f32 = d < 0 ? <f32> -1.0 : <f32> 1.0;
      nx = ax * sign;
      ny = ay * sign;
    }
  }
  const sau: f32 = (nx * ca + ny * sa) < 0 ? <f32> -1.0 : <f32> 1.0;
  const sav: f32 = (nx * -sa + ny * ca) < 0 ? <f32> -1.0 : <f32> 1.0;
  const sbu: f32 = ((-nx) * cb + (-ny) * sb) < 0 ? <f32> -1.0 : <f32> 1.0;
  const sbv: f32 = ((-nx) * -sb + (-ny) * cb) < 0 ? <f32> -1.0 : <f32> 1.0;
  const sax: f32 = fget(X_OFF, a) + sau * hxa * ca + sav * hya * -sa;
  const say: f32 = fget(Y_OFF, a) + sau * hxa * sa + sav * hya * ca;
  const sbx: f32 = fget(X_OFF, b) + sbu * hxb * cb + sbv * hyb * -sb;
  const sby: f32 = fget(Y_OFF, b) + sbu * hxb * sb + sbv * hyb * cb;
  mNx = nx;
  mNy = ny;
  mPen = minimum;
  mCx = (sax + sbx) * <f32> 0.5;
  mCy = (say + sby) * <f32> 0.5;
  return true;
}

function groundManifold(i: u32): bool {
  const s: f32 = fget(SINE_OFF, i), c: f32 = fget(COSINE_OFF, i);
  const su: f32 = s > 0 ? <f32> -1.0 : <f32> 1.0;
  const sv: f32 = c > 0 ? <f32> -1.0 : <f32> 1.0;
  const hx: f32 = fget(HALF_X_OFF, i), hy: f32 = fget(HALF_Y_OFF, i);
  const rx: f32 = su * hx * c + sv * hy * -s;
  const ry: f32 = su * hx * s + sv * hy * c;
  const lowest: f32 = fget(Y_OFF, i) + ry;
  if (lowest >= 0) return false;
  mNx = 0;
  mNy = -1;
  mPen = -lowest;
  mCx = fget(X_OFF, i) + rx;
  mCy = 0;
  return true;
}

function buildPairs(): u32 {
  updateBasis();
  for (let k: u32 = 1; k < BODIES; k++) {
    const id: u32 = uget(ORDER_OFF, k);
    let at: u32 = k;
    const key: f32 = fget(X_OFF, id) - fget(EXTENT_X_OFF, id);
    while (at > 0) {
      const p: u32 = uget(ORDER_OFF, at - 1);
      const pk: f32 = fget(X_OFF, p) - fget(EXTENT_X_OFF, p);
      if (pk < key || (pk == key && p < id)) break;
      uset(ORDER_OFF, at, p);
      at--;
    }
    uset(ORDER_OFF, at, id);
  }
  let count: u32 = 0;
  for (let l: u32 = 0; l < BODIES; l++) {
    const a: u32 = uget(ORDER_OFF, l);
    const mx: f32 = fget(X_OFF, a) + fget(EXTENT_X_OFF, a);
    for (let r: u32 = l + 1; r < BODIES; r++) {
      const b: u32 = uget(ORDER_OFF, r);
      if (fget(X_OFF, b) - fget(EXTENT_X_OFF, b) > mx) break;
      counterBump(1);
      if (
        absf(fget(Y_OFF, b) - fget(Y_OFF, a)) <=
          fget(EXTENT_Y_OFF, a) + fget(EXTENT_Y_OFF, b)
      ) {
        if (count >= MAX_PAIRS) return 0xffffffff;
        uset(PAIR_A_OFF, count, a);
        uset(PAIR_B_OFF, count, b);
        count++;
      }
    }
  }
  return count;
}

function contactVelocity(a: u32, b: i32, restitution: f32, friction: f32): void {
  const rax: f32 = mCx - fget(X_OFF, a), ray: f32 = mCy - fget(Y_OFF, a);
  const vax: f32 = fget(VX_OFF, a) - fget(OMEGA_OFF, a) * ray;
  const vay: f32 = fget(VY_OFF, a) + fget(OMEGA_OFF, a) * rax;
  let inverse: f32 = fget(INV_MASS_OFF, a);
  let rbx: f32 = 0, rby: f32 = 0, vbx: f32 = 0, vby: f32 = 0;
  if (b >= 0) {
    const bu: u32 = <u32> b;
    rbx = mCx - fget(X_OFF, bu);
    rby = mCy - fget(Y_OFF, bu);
    vbx = fget(VX_OFF, bu) - fget(OMEGA_OFF, bu) * rby;
    vby = fget(VY_OFF, bu) + fget(OMEGA_OFF, bu) * rbx;
    inverse += fget(INV_MASS_OFF, bu);
  }
  const rna: f32 = cross(rax, ray, mNx, mNy);
  let denom: f32 = inverse + rna * rna * fget(INV_INERTIA_OFF, a);
  let rnb: f32 = 0;
  if (b >= 0) {
    rnb = cross(rbx, rby, mNx, mNy);
    denom += rnb * rnb * fget(INV_INERTIA_OFF, <u32> b);
  }
  const relx: f32 = vbx - vax, rely: f32 = vby - vay;
  const nv: f32 = relx * mNx + rely * mNy;
  if (nv >= 0 || denom <= 0) return;
  const impulse: f32 = -(<f32> 1.0 + restitution) * nv / denom;
  const ix: f32 = impulse * mNx, iy: f32 = impulse * mNy;
  fset(VX_OFF, a, fget(VX_OFF, a) - ix * fget(INV_MASS_OFF, a));
  fset(VY_OFF, a, fget(VY_OFF, a) - iy * fget(INV_MASS_OFF, a));
  fset(OMEGA_OFF, a, fget(OMEGA_OFF, a) - rna * impulse * fget(INV_INERTIA_OFF, a));
  if (b >= 0) {
    const bu: u32 = <u32> b;
    fset(VX_OFF, bu, fget(VX_OFF, bu) + ix * fget(INV_MASS_OFF, bu));
    fset(VY_OFF, bu, fget(VY_OFF, bu) + iy * fget(INV_MASS_OFF, bu));
    fset(OMEGA_OFF, bu, fget(OMEGA_OFF, bu) + rnb * impulse * fget(INV_INERTIA_OFF, bu));
  }
  counterBump(5);
  if (rna != 0) counterBump(7);
  if (b >= 0 && rnb != 0) counterBump(7);

  const tx: f32 = -mNy, ty: f32 = mNx;
  const rta: f32 = cross(rax, ray, tx, ty);
  let tden: f32 = inverse + rta * rta * fget(INV_INERTIA_OFF, a);
  let rtb: f32 = 0;
  if (b >= 0) {
    rtb = cross(rbx, rby, tx, ty);
    tden += rtb * rtb * fget(INV_INERTIA_OFF, <u32> b);
  }
  const ti: f32 = clampf(
    -(relx * tx + rely * ty) / tden,
    -friction * impulse,
    friction * impulse,
  );
  const fx: f32 = ti * tx, fy: f32 = ti * ty;
  fset(VX_OFF, a, fget(VX_OFF, a) - fx * fget(INV_MASS_OFF, a));
  fset(VY_OFF, a, fget(VY_OFF, a) - fy * fget(INV_MASS_OFF, a));
  fset(OMEGA_OFF, a, fget(OMEGA_OFF, a) - rta * ti * fget(INV_INERTIA_OFF, a));
  if (b >= 0) {
    const bu: u32 = <u32> b;
    fset(VX_OFF, bu, fget(VX_OFF, bu) + fx * fget(INV_MASS_OFF, bu));
    fset(VY_OFF, bu, fget(VY_OFF, bu) + fy * fget(INV_MASS_OFF, bu));
    fset(OMEGA_OFF, bu, fget(OMEGA_OFF, bu) + rtb * ti * fget(INV_INERTIA_OFF, bu));
  }
  counterBump(6);
}

function contactPosition(a: u32, b: i32): bool {
  const depth: f32 = mPen - <f32> 0.001;
  if (depth <= 0) return false;
  const den: f32 = fget(INV_MASS_OFF, a) + (b >= 0 ? fget(INV_MASS_OFF, <u32> b) : <f32> 0);
  if (den <= 0) return false;
  const imp: f32 = (b < 0 ? depth : (depth < <f32> 0.05 ? depth : <f32> 0.05)) / den;
  const ix: f32 = imp * mNx, iy: f32 = imp * mNy;
  fset(X_OFF, a, fget(X_OFF, a) - ix * fget(INV_MASS_OFF, a));
  fset(Y_OFF, a, fget(Y_OFF, a) - iy * fget(INV_MASS_OFF, a));
  if (b >= 0) {
    const bu: u32 = <u32> b;
    fset(X_OFF, bu, fget(X_OFF, bu) + ix * fget(INV_MASS_OFF, bu));
    fset(Y_OFF, bu, fget(Y_OFF, bu) + iy * fget(INV_MASS_OFF, bu));
  }
  return true;
}

// Joint geometry, also held in globals rather than a struct.
let gA: u32 = 0, gB: u32 = 0;
let gRax: f32 = 0, gRay: f32 = 0, gRbx: f32 = 0, gRby: f32 = 0;
let gLength: f32 = 0, gNx: f32 = 0, gNy: f32 = 0;

function jointGeometry(j: u32): void {
  const a: u32 = uget(JOINT_A_OFF, j), b: u32 = uget(JOINT_B_OFF, j);
  const ca: f32 = fget(COSINE_OFF, a), sa: f32 = fget(SINE_OFF, a);
  const cb: f32 = fget(COSINE_OFF, b), sb: f32 = fget(SINE_OFF, b);
  const rax: f32 = fget(LOCAL_AX_OFF, j) * ca + fget(LOCAL_AY_OFF, j) * -sa;
  const ray: f32 = fget(LOCAL_AX_OFF, j) * sa + fget(LOCAL_AY_OFF, j) * ca;
  const rbx: f32 = fget(LOCAL_BX_OFF, j) * cb + fget(LOCAL_BY_OFF, j) * -sb;
  const rby: f32 = fget(LOCAL_BX_OFF, j) * sb + fget(LOCAL_BY_OFF, j) * cb;
  const dx: f32 = (fget(X_OFF, b) + rbx) - (fget(X_OFF, a) + rax);
  const dy: f32 = (fget(Y_OFF, b) + rby) - (fget(Y_OFF, a) + ray);
  const len: f32 = <f32> Math.sqrt(<f64> (dx * dx + dy * dy));
  gA = a;
  gB = b;
  gRax = rax;
  gRay = ray;
  gRbx = rbx;
  gRby = rby;
  gLength = len;
  gNx = len > <f32> 0.000001 ? dx / len : <f32> 1;
  gNy = len > <f32> 0.000001 ? dy / len : <f32> 0;
}

function jointVelocity(j: u32): void {
  jointGeometry(j);
  const a: u32 = gA, b: u32 = gB;
  const vax: f32 = fget(VX_OFF, a) - fget(OMEGA_OFF, a) * gRay;
  const vay: f32 = fget(VY_OFF, a) + fget(OMEGA_OFF, a) * gRax;
  const vbx: f32 = fget(VX_OFF, b) - fget(OMEGA_OFF, b) * gRby;
  const vby: f32 = fget(VY_OFF, b) + fget(OMEGA_OFF, b) * gRbx;
  const rna: f32 = cross(gRax, gRay, gNx, gNy);
  const rnb: f32 = cross(gRbx, gRby, gNx, gNy);
  const den: f32 = fget(INV_MASS_OFF, a) + fget(INV_MASS_OFF, b) +
    rna * rna * fget(INV_INERTIA_OFF, a) + rnb * rnb * fget(INV_INERTIA_OFF, b);
  if (den <= 0) return;
  const imp: f32 = -((vbx - vax) * gNx + (vby - vay) * gNy) / den;
  const ix: f32 = imp * gNx, iy: f32 = imp * gNy;
  fset(VX_OFF, a, fget(VX_OFF, a) - ix * fget(INV_MASS_OFF, a));
  fset(VY_OFF, a, fget(VY_OFF, a) - iy * fget(INV_MASS_OFF, a));
  fset(OMEGA_OFF, a, fget(OMEGA_OFF, a) - rna * imp * fget(INV_INERTIA_OFF, a));
  fset(VX_OFF, b, fget(VX_OFF, b) + ix * fget(INV_MASS_OFF, b));
  fset(VY_OFF, b, fget(VY_OFF, b) + iy * fget(INV_MASS_OFF, b));
  fset(OMEGA_OFF, b, fget(OMEGA_OFF, b) + rnb * imp * fget(INV_INERTIA_OFF, b));
  counterBump(8);
}

function jointPosition(j: u32): void {
  jointGeometry(j);
  const a: u32 = gA, b: u32 = gB;
  const den: f32 = fget(INV_MASS_OFF, a) + fget(INV_MASS_OFF, b);
  if (den <= 0) return;
  const imp: f32 = clampf(gLength - fget(JOINT_REST_OFF, j), <f32> -0.05, <f32> 0.05) *
    fget(JOINT_STIFF_OFF, j) / den;
  const ix: f32 = imp * gNx, iy: f32 = imp * gNy;
  fset(X_OFF, a, fget(X_OFF, a) + ix * fget(INV_MASS_OFF, a));
  fset(Y_OFF, a, fget(Y_OFF, a) + iy * fget(INV_MASS_OFF, a));
  fset(X_OFF, b, fget(X_OFF, b) - ix * fget(INV_MASS_OFF, b));
  fset(Y_OFF, b, fget(Y_OFF, b) - iy * fget(INV_MASS_OFF, b));
  counterBump(8);
}

function quantizeState(): void {
  for (let i: u32 = 0; i < BODIES; i++) {
    fset(X_OFF, i, quantize(fget(X_OFF, i)));
    fset(Y_OFF, i, quantize(fget(Y_OFF, i)));
    fset(ANGLE_OFF, i, quantize(wrap(fget(ANGLE_OFF, i))));
    fset(VX_OFF, i, quantize(fget(VX_OFF, i)));
    fset(VY_OFF, i, quantize(fget(VY_OFF, i)));
    fset(OMEGA_OFF, i, quantize(fget(OMEGA_OFF, i)));
  }
}

function snapshot(cp: u32): void {
  let at: u32 = cp * STATE_VALUES;
  for (let i: u32 = 0; i < BODIES; i++) {
    fset(RESULT_CHECKPOINTS_OFF, at++, fget(X_OFF, i));
    fset(RESULT_CHECKPOINTS_OFF, at++, fget(Y_OFF, i));
    fset(RESULT_CHECKPOINTS_OFF, at++, fget(ANGLE_OFF, i));
    fset(RESULT_CHECKPOINTS_OFF, at++, fget(VX_OFF, i));
    fset(RESULT_CHECKPOINTS_OFF, at++, fget(VY_OFF, i));
    fset(RESULT_CHECKPOINTS_OFF, at++, fget(OMEGA_OFF, i));
  }
}

export function run(timesteps: u32, checkpointEvery: u32): i32 {
  if (
    u32At(8) != 2 || u32At(12) != BODIES || u32At(16) > JOINTS || timesteps == 0 ||
    timesteps > 1800 || checkpointEvery == 0 ||
    (timesteps + checkpointEvery - 1) / checkpointEvery > MAX_CHECKPOINTS
  ) return 1;
  const jointCount: u32 = u32At(16);
  const velIters: u32 = u32At(24);
  const posIters: u32 = u32At(28);
  const torqueSteps: u32 = u32At(68);
  const dt: f32 = f32At(40);
  const gravity: f32 = f32At(44);
  const restitution: f32 = f32At(48);
  const friction: f32 = f32At(52);
  const linearDamping: f32 = f32At(60);
  const angularDamping: f32 = f32At(64);

  for (let i: u32 = 0; i < 16; i++) uset(RESULT_OFF, i, 0);
  for (let i: u32 = 0; i < BODIES; i++) {
    const o: u32 = HEADER_BYTES + i * BODY_WORDS * 4;
    fset(X_OFF, i, f32At(o));
    fset(Y_OFF, i, f32At(o + 4));
    fset(ANGLE_OFF, i, f32At(o + 8));
    fset(VX_OFF, i, f32At(o + 12));
    fset(VY_OFF, i, f32At(o + 16));
    fset(OMEGA_OFF, i, f32At(o + 20));
    fset(INV_MASS_OFF, i, f32At(o + 24));
    fset(INV_INERTIA_OFF, i, f32At(o + 28));
    fset(HALF_X_OFF, i, f32At(o + 32));
    fset(HALF_Y_OFF, i, f32At(o + 36));
    fset(TORQUE_OFF, i, f32At(o + 40));
    uset(ORDER_OFF, i, i);
  }
  const jb: u32 = HEADER_BYTES + BODIES * BODY_WORDS * 4;
  for (let j: u32 = 0; j < jointCount; j++) {
    const o: u32 = jb + j * JOINT_BYTES;
    uset(JOINT_A_OFF, j, u32At(o));
    uset(JOINT_B_OFF, j, u32At(o + 4));
    fset(LOCAL_AX_OFF, j, f32At(o + 8));
    fset(LOCAL_AY_OFF, j, f32At(o + 12));
    fset(LOCAL_BX_OFF, j, f32At(o + 16));
    fset(LOCAL_BY_OFF, j, f32At(o + 20));
    fset(JOINT_REST_OFF, j, f32At(o + 24));
    fset(JOINT_STIFF_OFF, j, f32At(o + 28));
  }

  let cp: u32 = 0;
  for (let step: u32 = 0; step < timesteps; step++) {
    for (let i: u32 = 0; i < BODIES; i++) {
      fset(VY_OFF, i, fget(VY_OFF, i) + gravity * dt);
      if (step < torqueSteps && fget(TORQUE_OFF, i) != 0) {
        fset(
          OMEGA_OFF,
          i,
          fget(OMEGA_OFF, i) + fget(TORQUE_OFF, i) * fget(INV_INERTIA_OFF, i) * dt,
        );
        counterBump(9);
      }
      fset(VX_OFF, i, fget(VX_OFF, i) * linearDamping);
      fset(VY_OFF, i, fget(VY_OFF, i) * linearDamping);
      fset(OMEGA_OFF, i, fget(OMEGA_OFF, i) * angularDamping);
      fset(X_OFF, i, fget(X_OFF, i) + fget(VX_OFF, i) * dt);
      fset(Y_OFF, i, fget(Y_OFF, i) + fget(VY_OFF, i) * dt);
      fset(ANGLE_OFF, i, wrap(fget(ANGLE_OFF, i) + fget(OMEGA_OFF, i) * dt));
    }
    quantizeState();

    let pairs: u32 = buildPairs();
    if (pairs == 0xffffffff) return 2;

    for (let it: u32 = 0; it < velIters; it++) {
      counterBump(10);
      updateBasis();
      for (let i: u32 = 0; i < BODIES; i++) {
        if (groundManifold(i)) {
          counterBump(3);
          counterBump(4);
          contactVelocity(i, -1, restitution, friction);
        }
      }
      for (let p: u32 = 0; p < pairs; p++) {
        counterBump(2);
        if (sat(uget(PAIR_A_OFF, p), uget(PAIR_B_OFF, p))) {
          counterBump(3);
          counterBump(4);
          contactVelocity(uget(PAIR_A_OFF, p), <i32> uget(PAIR_B_OFF, p), restitution, friction);
        }
      }
      for (let j: u32 = 0; j < jointCount; j++) jointVelocity(j);
      quantizeState();
    }

    for (let it: u32 = 0; it < posIters; it++) {
      counterBump(11);
      pairs = buildPairs();
      if (pairs == 0xffffffff) return 2;
      for (let i: u32 = 0; i < BODIES; i++) {
        if (groundManifold(i)) {
          counterBump(3);
          counterBump(4);
          contactPosition(i, -1);
        }
      }
      for (let p: u32 = 0; p < pairs; p++) {
        counterBump(2);
        if (sat(uget(PAIR_A_OFF, p), uget(PAIR_B_OFF, p))) {
          counterBump(3);
          counterBump(4);
          contactPosition(uget(PAIR_A_OFF, p), <i32> uget(PAIR_B_OFF, p));
        }
      }
      updateBasis();
      for (let j: u32 = 0; j < jointCount; j++) jointPosition(j);
      updateBasis();
      for (let i: u32 = 0; i < BODIES; i++) {
        if (groundManifold(i)) {
          counterBump(3);
          counterBump(4);
          contactPosition(i, -1);
        }
      }
      quantizeState();
    }

    counterBump(0);
    if ((step + 1) % checkpointEvery == 0 || step + 1 == timesteps) snapshot(cp++);
  }
  uset(RESULT_OFF, 12, cp * STATE_VALUES);
  return 0;
}
