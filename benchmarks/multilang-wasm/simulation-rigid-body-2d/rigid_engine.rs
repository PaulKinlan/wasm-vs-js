#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

extern "C" {
    fn sqrtf(x: f32) -> f32;
}

// simulation-rigid-body-2d multilang kernel — exact mirror of
// benchmarks/v1/simulation-rigid-body-2d/rigid-body-2d.c (and the engine.js
// oracle): 500-body 2D physics with SAT collision, joints, torque, quantized
// state, and checkpoints. rustc does not contract or reassociate f32 by
// default, so with the same operation order every rounding is bit-identical
// to the C kernel and the JS oracle.

const BODIES: u32 = 500;
const JOINTS: u32 = 19;
const HEADER_BYTES: u32 = 96;
const BODY_WORDS: u32 = 11;
const JOINT_BYTES: u32 = 32;
const FIXTURE_BYTES: usize = (HEADER_BYTES + BODIES * BODY_WORDS * 4 + JOINTS * JOINT_BYTES) as usize;
const MAX_PAIRS: u32 = 8192;
const MAX_CHECKPOINTS: u32 = 6;
const STATE_VALUES: u32 = BODIES * 6;
const PI: f32 = 3.1415927410125732;
const TAU: f32 = 6.2831854820251465;

static mut FIXTURE: [u8; FIXTURE_BYTES] = [0; FIXTURE_BYTES];
static mut X: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut Y: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut ANGLE: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut VX: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut VY: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut OMEGA: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut INV_MASS: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut INV_INERTIA: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut HALF_X: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut HALF_Y: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut TORQUE: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut COSINE: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut SINE: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut EXTENT_X: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut EXTENT_Y: [f32; BODIES as usize] = [0.0; BODIES as usize];
static mut JOINT_A: [u32; JOINTS as usize] = [0; JOINTS as usize];
static mut JOINT_B: [u32; JOINTS as usize] = [0; JOINTS as usize];
static mut LOCAL_AX: [f32; JOINTS as usize] = [0.0; JOINTS as usize];
static mut LOCAL_AY: [f32; JOINTS as usize] = [0.0; JOINTS as usize];
static mut LOCAL_BX: [f32; JOINTS as usize] = [0.0; JOINTS as usize];
static mut LOCAL_BY: [f32; JOINTS as usize] = [0.0; JOINTS as usize];
static mut JOINT_REST: [f32; JOINTS as usize] = [0.0; JOINTS as usize];
static mut JOINT_STIFFNESS: [f32; JOINTS as usize] = [0.0; JOINTS as usize];
static mut ORDER: [u32; BODIES as usize] = [0; BODIES as usize];
static mut PAIR_A: [u32; MAX_PAIRS as usize] = [0; MAX_PAIRS as usize];
static mut PAIR_B: [u32; MAX_PAIRS as usize] = [0; MAX_PAIRS as usize];

#[repr(C)]
struct Result {
    c: [u32; 13],
    reserved: [u32; 3],
    checkpoints: [f32; (MAX_CHECKPOINTS * STATE_VALUES) as usize],
}
static mut RESULT: Result = Result {
    c: [0; 13],
    reserved: [0; 3],
    checkpoints: [0.0; (MAX_CHECKPOINTS * STATE_VALUES) as usize],
};

#[inline(always)]
unsafe fn u32_at(o: usize) -> u32 {
    FIXTURE[o] as u32
        | ((FIXTURE[o + 1] as u32) << 8)
        | ((FIXTURE[o + 2] as u32) << 16)
        | ((FIXTURE[o + 3] as u32) << 24)
}
#[inline(always)]
unsafe fn f32_at(o: usize) -> f32 {
    f32::from_bits(u32_at(o))
}

#[no_mangle]
pub extern "C" fn fixture_ptr() -> u32 {
    unsafe { core::ptr::addr_of!(FIXTURE) as *const u8 as u32 }
}
#[no_mangle]
pub extern "C" fn result_ptr() -> u32 {
    unsafe { core::ptr::addr_of!(RESULT) as *const u32 as u32 }
}

#[inline(always)]
fn absf(a: f32) -> f32 {
    if a < 0.0 { -a } else { a }
}
#[inline(always)]
fn wrap(mut a: f32) -> f32 {
    while a > PI {
        a -= TAU;
    }
    while a < -PI {
        a += TAU;
    }
    a
}
#[inline(always)]
fn sin_approx(x: f32) -> f32 {
    let x = wrap(x);
    let x2 = x * x;
    x + (x * x2) * ((-1.0 / 6.0) + x2 * ((1.0 / 120.0) + x2 * (-1.0 / 5040.0)))
}
#[inline(always)]
fn cos_approx(x: f32) -> f32 {
    let x = wrap(x);
    let x2 = x * x;
    1.0 + x2 * ((-1.0 / 2.0) + x2 * ((1.0 / 24.0) + x2 * (-1.0 / 720.0)))
}
#[inline(always)]
fn quantize(a: f32) -> f32 {
    let s = a * 1000.0;
    let r: i32 = if s < 0.0 { (s - 0.5) as i32 } else { (s + 0.5) as i32 };
    (r as f32) / 1000.0
}
#[inline(always)]
fn cross(ax: f32, ay: f32, bx: f32, by: f32) -> f32 {
    ax * by - ay * bx
}
#[inline(always)]
fn clampf(v: f32, lo: f32, hi: f32) -> f32 {
    if v < lo { lo } else if v > hi { hi } else { v }
}

#[repr(C)]
struct Manifold {
    nx: f32,
    ny: f32,
    penetration: f32,
    cx: f32,
    cy: f32,
}
#[repr(C)]
struct JointGeometry {
    a: u32,
    b: u32,
    rax: f32,
    ray: f32,
    rbx: f32,
    rby: f32,
    length: f32,
    nx: f32,
    ny: f32,
}

unsafe fn update_basis() {
    for i in 0..BODIES as usize {
        let c = cos_approx(ANGLE[i]);
        let s = sin_approx(ANGLE[i]);
        COSINE[i] = c;
        SINE[i] = s;
        EXTENT_X[i] = absf(c) * HALF_X[i] + absf(s) * HALF_Y[i];
        EXTENT_Y[i] = absf(s) * HALF_X[i] + absf(c) * HALF_Y[i];
    }
}

unsafe fn sat(a: usize, b: usize, m: &mut Manifold) -> i32 {
    let dx = X[b] - X[a];
    let dy = Y[b] - Y[a];
    let mut minimum: f32 = 3.402823e38;
    let mut nx: f32 = 0.0;
    let mut ny: f32 = 0.0;
    let axes: [f32; 8] = [
        COSINE[a], SINE[a], -SINE[a], COSINE[a],
        COSINE[b], SINE[b], -SINE[b], COSINE[b],
    ];
    for k in 0..4 {
        let ax = axes[k * 2];
        let ay = axes[k * 2 + 1];
        let d = dx * ax + dy * ay;
        let au = absf(ax * COSINE[a] + ay * SINE[a]);
        let av = absf(ax * -SINE[a] + ay * COSINE[a]);
        let bu = absf(ax * COSINE[b] + ay * SINE[b]);
        let bv = absf(ax * -SINE[b] + ay * COSINE[b]);
        let radius = HALF_X[a] * au + HALF_Y[a] * av + HALF_X[b] * bu + HALF_Y[b] * bv;
        let overlap = radius - absf(d);
        if overlap <= 0.0 {
            return 0;
        }
        if overlap < minimum {
            minimum = overlap;
            let sign: f32 = if d < 0.0 { -1.0 } else { 1.0 };
            nx = ax * sign;
            ny = ay * sign;
        }
    }
    let sau: f32 = if (nx * COSINE[a] + ny * SINE[a]) < 0.0 { -1.0 } else { 1.0 };
    let sav: f32 = if (nx * -SINE[a] + ny * COSINE[a]) < 0.0 { -1.0 } else { 1.0 };
    let sbu: f32 = if ((-nx) * COSINE[b] + (-ny) * SINE[b]) < 0.0 { -1.0 } else { 1.0 };
    let sbv: f32 = if ((-nx) * -SINE[b] + (-ny) * COSINE[b]) < 0.0 { -1.0 } else { 1.0 };
    let sax = X[a] + sau * HALF_X[a] * COSINE[a] + sav * HALF_Y[a] * -SINE[a];
    let say = Y[a] + sau * HALF_X[a] * SINE[a] + sav * HALF_Y[a] * COSINE[a];
    let sbx = X[b] + sbu * HALF_X[b] * COSINE[b] + sbv * HALF_Y[b] * -SINE[b];
    let sby = Y[b] + sbu * HALF_X[b] * SINE[b] + sbv * HALF_Y[b] * COSINE[b];
    m.nx = nx;
    m.ny = ny;
    m.penetration = minimum;
    m.cx = (sax + sbx) * 0.5;
    m.cy = (say + sby) * 0.5;
    1
}

unsafe fn ground_manifold(i: usize, m: &mut Manifold) -> i32 {
    let su: f32 = if SINE[i] > 0.0 { -1.0 } else { 1.0 };
    let sv: f32 = if COSINE[i] > 0.0 { -1.0 } else { 1.0 };
    let rx = su * HALF_X[i] * COSINE[i] + sv * HALF_Y[i] * -SINE[i];
    let ry = su * HALF_X[i] * SINE[i] + sv * HALF_Y[i] * COSINE[i];
    let lowest = Y[i] + ry;
    if lowest >= 0.0 {
        return 0;
    }
    m.nx = 0.0;
    m.ny = -1.0;
    m.penetration = -lowest;
    m.cx = X[i] + rx;
    m.cy = 0.0;
    1
}

unsafe fn build_pairs() -> u32 {
    update_basis();
    for k in 1..BODIES as usize {
        let id = ORDER[k];
        let mut at = k;
        let key = X[id as usize] - EXTENT_X[id as usize];
        while at > 0 {
            let p = ORDER[at - 1];
            let pk = X[p as usize] - EXTENT_X[p as usize];
            if pk < key || (pk == key && p < id) {
                break;
            }
            ORDER[at] = p;
            at -= 1;
        }
        ORDER[at] = id;
    }
    let mut count: u32 = 0;
    for l in 0..BODIES as usize {
        let a = ORDER[l];
        let mx = X[a as usize] + EXTENT_X[a as usize];
        for r in (l + 1)..BODIES as usize {
            let b = ORDER[r];
            if X[b as usize] - EXTENT_X[b as usize] > mx {
                break;
            }
            RESULT.c[1] += 1;
            if absf(Y[b as usize] - Y[a as usize]) <= EXTENT_Y[a as usize] + EXTENT_Y[b as usize] {
                if count >= MAX_PAIRS {
                    return 0xffffffff;
                }
                PAIR_A[count as usize] = a;
                PAIR_B[count as usize] = b;
                count += 1;
            }
        }
    }
    count
}

unsafe fn contact_velocity(m: &Manifold, a: usize, b: i32, restitution: f32, friction: f32) {
    let rax = m.cx - X[a];
    let ray = m.cy - Y[a];
    let vax = VX[a] - OMEGA[a] * ray;
    let vay = VY[a] + OMEGA[a] * rax;
    let mut inverse = INV_MASS[a];
    let (mut rbx, mut rby, mut vbx, mut vby) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
    if b >= 0 {
        let bi = b as usize;
        rbx = m.cx - X[bi];
        rby = m.cy - Y[bi];
        vbx = VX[bi] - OMEGA[bi] * rby;
        vby = VY[bi] + OMEGA[bi] * rbx;
        inverse += INV_MASS[bi];
    }
    let rna = cross(rax, ray, m.nx, m.ny);
    let mut denom = inverse + rna * rna * INV_INERTIA[a];
    let mut rnb = 0.0;
    if b >= 0 {
        let bi = b as usize;
        rnb = cross(rbx, rby, m.nx, m.ny);
        denom += rnb * rnb * INV_INERTIA[bi];
    }
    let relx = vbx - vax;
    let rely = vby - vay;
    let nv = relx * m.nx + rely * m.ny;
    if nv >= 0.0 || denom <= 0.0 {
        return;
    }
    let impulse = -(1.0 + restitution) * nv / denom;
    let ix = impulse * m.nx;
    let iy = impulse * m.ny;
    VX[a] -= ix * INV_MASS[a];
    VY[a] -= iy * INV_MASS[a];
    OMEGA[a] -= rna * impulse * INV_INERTIA[a];
    if b >= 0 {
        let bi = b as usize;
        VX[bi] += ix * INV_MASS[bi];
        VY[bi] += iy * INV_MASS[bi];
        OMEGA[bi] += rnb * impulse * INV_INERTIA[bi];
    }
    RESULT.c[5] += 1;
    if rna != 0.0 {
        RESULT.c[7] += 1;
    }
    if b >= 0 && rnb != 0.0 {
        RESULT.c[7] += 1;
    }
    let tx = -m.ny;
    let ty = m.nx;
    let rta = cross(rax, ray, tx, ty);
    let mut tden = inverse + rta * rta * INV_INERTIA[a];
    let mut rtb = 0.0;
    if b >= 0 {
        let bi = b as usize;
        rtb = cross(rbx, rby, tx, ty);
        tden += rtb * rtb * INV_INERTIA[bi];
    }
    let ti = clampf(-(relx * tx + rely * ty) / tden, -friction * impulse, friction * impulse);
    let fx = ti * tx;
    let fy = ti * ty;
    VX[a] -= fx * INV_MASS[a];
    VY[a] -= fy * INV_MASS[a];
    OMEGA[a] -= rta * ti * INV_INERTIA[a];
    if b >= 0 {
        let bi = b as usize;
        VX[bi] += fx * INV_MASS[bi];
        VY[bi] += fy * INV_MASS[bi];
        OMEGA[bi] += rtb * ti * INV_INERTIA[bi];
    }
    RESULT.c[6] += 1;
}

unsafe fn contact_position(m: &Manifold, a: usize, b: i32) -> i32 {
    let depth = m.penetration - 0.001;
    if depth <= 0.0 {
        return 0;
    }
    let mut den = INV_MASS[a];
    if b >= 0 {
        den += INV_MASS[b as usize];
    }
    if den <= 0.0 {
        return 0;
    }
    let imp = if b < 0 { depth } else if depth < 0.05 { depth } else { 0.05 } / den;
    let ix = imp * m.nx;
    let iy = imp * m.ny;
    X[a] -= ix * INV_MASS[a];
    Y[a] -= iy * INV_MASS[a];
    if b >= 0 {
        let bi = b as usize;
        X[bi] += ix * INV_MASS[bi];
        Y[bi] += iy * INV_MASS[bi];
    }
    1
}

unsafe fn joint_geometry(j: usize, g: &mut JointGeometry) {
    let a = JOINT_A[j] as usize;
    let b = JOINT_B[j] as usize;
    let rax = LOCAL_AX[j] * COSINE[a] + LOCAL_AY[j] * -SINE[a];
    let ray = LOCAL_AX[j] * SINE[a] + LOCAL_AY[j] * COSINE[a];
    let rbx = LOCAL_BX[j] * COSINE[b] + LOCAL_BY[j] * -SINE[b];
    let rby = LOCAL_BX[j] * SINE[b] + LOCAL_BY[j] * COSINE[b];
    let dx = (X[b] + rbx) - (X[a] + rax);
    let dy = (Y[b] + rby) - (Y[a] + ray);
    let len = unsafe { sqrtf(dx * dx + dy * dy) };
    g.a = a as u32;
    g.b = b as u32;
    g.rax = rax;
    g.ray = ray;
    g.rbx = rbx;
    g.rby = rby;
    g.length = len;
    g.nx = if len > 0.000001 { dx / len } else { 1.0 };
    g.ny = if len > 0.000001 { dy / len } else { 0.0 };
}

unsafe fn joint_velocity(j: usize, g: &mut JointGeometry) {
    joint_geometry(j, g);
    let a = g.a as usize;
    let b = g.b as usize;
    let vax = VX[a] - OMEGA[a] * g.ray;
    let vay = VY[a] + OMEGA[a] * g.rax;
    let vbx = VX[b] - OMEGA[b] * g.rby;
    let vby = VY[b] + OMEGA[b] * g.rbx;
    let rna = cross(g.rax, g.ray, g.nx, g.ny);
    let rnb = cross(g.rbx, g.rby, g.nx, g.ny);
    let den = INV_MASS[a] + INV_MASS[b] + rna * rna * INV_INERTIA[a] + rnb * rnb * INV_INERTIA[b];
    if den <= 0.0 {
        return;
    }
    let imp = -((vbx - vax) * g.nx + (vby - vay) * g.ny) / den;
    let ix = imp * g.nx;
    let iy = imp * g.ny;
    VX[a] -= ix * INV_MASS[a];
    VY[a] -= iy * INV_MASS[a];
    OMEGA[a] -= rna * imp * INV_INERTIA[a];
    VX[b] += ix * INV_MASS[b];
    VY[b] += iy * INV_MASS[b];
    OMEGA[b] += rnb * imp * INV_INERTIA[b];
    RESULT.c[8] += 1;
}

unsafe fn joint_position(j: usize, g: &mut JointGeometry) {
    joint_geometry(j, g);
    let a = g.a as usize;
    let b = g.b as usize;
    let den = INV_MASS[a] + INV_MASS[b];
    if den <= 0.0 {
        return;
    }
    let imp = clampf(g.length - JOINT_REST[j], -0.05, 0.05) * JOINT_STIFFNESS[j] / den;
    let ix = imp * g.nx;
    let iy = imp * g.ny;
    X[a] += ix * INV_MASS[a];
    Y[a] += iy * INV_MASS[a];
    X[b] -= ix * INV_MASS[b];
    Y[b] -= iy * INV_MASS[b];
    RESULT.c[8] += 1;
}

unsafe fn quantize_state() {
    for i in 0..BODIES as usize {
        X[i] = quantize(X[i]);
        Y[i] = quantize(Y[i]);
        ANGLE[i] = quantize(wrap(ANGLE[i]));
        VX[i] = quantize(VX[i]);
        VY[i] = quantize(VY[i]);
        OMEGA[i] = quantize(OMEGA[i]);
    }
}

unsafe fn snapshot(cp: u32) {
    let mut at = (cp * STATE_VALUES) as usize;
    for i in 0..BODIES as usize {
        RESULT.checkpoints[at] = X[i];
        at += 1;
        RESULT.checkpoints[at] = Y[i];
        at += 1;
        RESULT.checkpoints[at] = ANGLE[i];
        at += 1;
        RESULT.checkpoints[at] = VX[i];
        at += 1;
        RESULT.checkpoints[at] = VY[i];
        at += 1;
        RESULT.checkpoints[at] = OMEGA[i];
        at += 1;
    }
}

#[no_mangle]
pub extern "C" fn run(timesteps: u32, checkpoint_every: u32) -> i32 {
    unsafe {
        if u32_at(8) != 2
            || u32_at(12) != BODIES
            || u32_at(16) > JOINTS
            || timesteps == 0
            || timesteps > 1800
            || checkpoint_every == 0
            || (timesteps + checkpoint_every - 1) / checkpoint_every > MAX_CHECKPOINTS
        {
            return 1;
        }
        let joint_count = u32_at(16);
        let vel_iters = u32_at(24);
        let pos_iters = u32_at(28);
        let torque_steps = u32_at(68);
        let dt = f32_at(40);
        let gravity = f32_at(44);
        let restitution = f32_at(48);
        let friction = f32_at(52);
        let linear_damping = f32_at(60);
        let angular_damping = f32_at(64);
        for v in RESULT.c.iter_mut() {
            *v = 0;
        }
        for v in RESULT.reserved.iter_mut() {
            *v = 0;
        }
        for i in 0..BODIES as usize {
            let o = (HEADER_BYTES + (i as u32) * BODY_WORDS * 4) as usize;
            X[i] = f32_at(o);
            Y[i] = f32_at(o + 4);
            ANGLE[i] = f32_at(o + 8);
            VX[i] = f32_at(o + 12);
            VY[i] = f32_at(o + 16);
            OMEGA[i] = f32_at(o + 20);
            INV_MASS[i] = f32_at(o + 24);
            INV_INERTIA[i] = f32_at(o + 28);
            HALF_X[i] = f32_at(o + 32);
            HALF_Y[i] = f32_at(o + 36);
            TORQUE[i] = f32_at(o + 40);
            ORDER[i] = i as u32;
        }
        let jb = (HEADER_BYTES + BODIES * BODY_WORDS * 4) as usize;
        for j in 0..joint_count as usize {
            let o = jb + j * JOINT_BYTES as usize;
            JOINT_A[j] = u32_at(o);
            JOINT_B[j] = u32_at(o + 4);
            LOCAL_AX[j] = f32_at(o + 8);
            LOCAL_AY[j] = f32_at(o + 12);
            LOCAL_BX[j] = f32_at(o + 16);
            LOCAL_BY[j] = f32_at(o + 20);
            JOINT_REST[j] = f32_at(o + 24);
            JOINT_STIFFNESS[j] = f32_at(o + 28);
        }
        let mut m = Manifold { nx: 0.0, ny: 0.0, penetration: 0.0, cx: 0.0, cy: 0.0 };
        let mut g = JointGeometry {
            a: 0,
            b: 0,
            rax: 0.0,
            ray: 0.0,
            rbx: 0.0,
            rby: 0.0,
            length: 0.0,
            nx: 0.0,
            ny: 0.0,
        };
        let mut cp: u32 = 0;
        for step in 0..timesteps {
            for i in 0..BODIES as usize {
                VY[i] += gravity * dt;
                if step < torque_steps && TORQUE[i] != 0.0 {
                    OMEGA[i] += TORQUE[i] * INV_INERTIA[i] * dt;
                    RESULT.c[9] += 1;
                }
                VX[i] *= linear_damping;
                VY[i] *= linear_damping;
                OMEGA[i] *= angular_damping;
                X[i] += VX[i] * dt;
                Y[i] += VY[i] * dt;
                ANGLE[i] = wrap(ANGLE[i] + OMEGA[i] * dt);
            }
            quantize_state();
            let mut pairs = build_pairs();
            if pairs == 0xffffffff {
                return 2;
            }
            for _it in 0..vel_iters {
                RESULT.c[10] += 1;
                update_basis();
                for i in 0..BODIES as usize {
                    if ground_manifold(i, &mut m) != 0 {
                        RESULT.c[3] += 1;
                        RESULT.c[4] += 1;
                        contact_velocity(&m, i, -1, restitution, friction);
                    }
                }
                for p in 0..pairs as usize {
                    RESULT.c[2] += 1;
                    if sat(PAIR_A[p] as usize, PAIR_B[p] as usize, &mut m) != 0 {
                        RESULT.c[3] += 1;
                        RESULT.c[4] += 1;
                        contact_velocity(&m, PAIR_A[p] as usize, PAIR_B[p] as i32, restitution, friction);
                    }
                }
                for j in 0..joint_count as usize {
                    joint_velocity(j, &mut g);
                }
                quantize_state();
            }
            for _it in 0..pos_iters {
                RESULT.c[11] += 1;
                pairs = build_pairs();
                if pairs == 0xffffffff {
                    return 2;
                }
                for i in 0..BODIES as usize {
                    if ground_manifold(i, &mut m) != 0 {
                        RESULT.c[3] += 1;
                        RESULT.c[4] += 1;
                        contact_position(&m, i, -1);
                    }
                }
                for p in 0..pairs as usize {
                    RESULT.c[2] += 1;
                    if sat(PAIR_A[p] as usize, PAIR_B[p] as usize, &mut m) != 0 {
                        RESULT.c[3] += 1;
                        RESULT.c[4] += 1;
                        contact_position(&m, PAIR_A[p] as usize, PAIR_B[p] as i32);
                    }
                }
                update_basis();
                for j in 0..joint_count as usize {
                    joint_position(j, &mut g);
                }
                update_basis();
                for i in 0..BODIES as usize {
                    if ground_manifold(i, &mut m) != 0 {
                        RESULT.c[3] += 1;
                        RESULT.c[4] += 1;
                        contact_position(&m, i, -1);
                    }
                }
                quantize_state();
            }
            RESULT.c[0] += 1;
            if (step + 1) % checkpoint_every == 0 || step + 1 == timesteps {
                snapshot(cp);
                cp += 1;
            }
        }
        RESULT.c[12] = cp * STATE_VALUES;
    }
    0
}
