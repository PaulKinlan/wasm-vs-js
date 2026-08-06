// path_tracer.rs — no_std cdylib mirror of the frozen graphics-cpu-path-tracer
// engine (path-tracer.c), bit-identical framebuffer bytes + 9 counters.
#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    loop {}
}


// Correctly-rounded f64 sqrt (matches V8's Math.sqrt / C __builtin_sqrtf on the
// frozen fixture). Rust's core lacks f32/f64::sqrt on this wasm toolchain
// ("missing core crate" — documented 2026-08-06), so Newton + nearest fixup.
#[inline(always)]
fn sqrt_f64(x: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    let b = x.to_bits();
    let e = (b >> 52) & 0x7ff;
    if e == 0x7ff {
        return x;
    }
    if e == 0 {
        // subnormal: scale up by 2^52, sqrt, scale down by 2^26
        return sqrt_f64(x * 4503599627370496.0) * 1.4901161193847656e-8;
    }
    // initial guess: exponent-halving approximation (~3 bits accurate)
    let mut y = f64::from_bits((b >> 1) + 0x1ff8_0000_0000_0000);
    for _ in 0..8 {
        y = 0.5 * (y + x / y);
    }
    // nearest fixup: find the largest y with y*y <= x, then pick the closer neighbour
    let mut yi = y.to_bits();
    while f64::from_bits(yi) * f64::from_bits(yi) > x {
        yi -= 1;
    }
    let lo = f64::from_bits(yi);
    let hi = f64::from_bits(yi + 1);
    if hi * hi - x <= x - lo * lo {
        hi
    } else {
        lo
    }
}

#[derive(Clone, Copy)]
struct Vec3 {
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Clone, Copy)]
struct Sphere {
    cx: f32,
    cy: f32,
    cz: f32,
    r: f32,
    cr: f32,
    cg: f32,
    cb: f32,
    emit: f32,
}

#[derive(Clone, Copy)]
struct Node {
    left: i32,
    right: i32,
    primitive: i32,
    minx: f32,
    miny: f32,
    minz: f32,
    maxx: f32,
    maxy: f32,
    maxz: f32,
}

const MAX_WIDTH: u32 = 512;
const MAX_HEIGHT: u32 = 512;
const MAX_SPP: u32 = 64;
const MAX_BOUNCES: u32 = 4;
const EPSILON: f32 = 0.001;
const SEED: u32 = 0x6d2b79f5;

static mut FRAMEBUFFER: [u8; (MAX_WIDTH * MAX_HEIGHT * 4) as usize] = [0u8; (MAX_WIDTH * MAX_HEIGHT * 4) as usize];
static mut COUNTERS: [u32; 9] = [0u32; 9];

static SPHERES: [Sphere; 7] = [
    Sphere { cx: 0.0, cy: -1001.0, cz: 0.0, r: 1000.0, cr: 0.72, cg: 0.72, cb: 0.72, emit: 0.0 },
    Sphere { cx: -1001.0, cy: 0.0, cz: 0.0, r: 1000.0, cr: 0.72, cg: 0.12, cb: 0.12, emit: 0.0 },
    Sphere { cx: 1001.0, cy: 0.0, cz: 0.0, r: 1000.0, cr: 0.12, cg: 0.72, cb: 0.18, emit: 0.0 },
    Sphere { cx: 0.0, cy: 0.0, cz: -1001.0, r: 1000.0, cr: 0.72, cg: 0.72, cb: 0.72, emit: 0.0 },
    Sphere { cx: -0.6, cy: -0.45, cz: 0.3, r: 0.55, cr: 0.75, cg: 0.68, cb: 0.22, emit: 0.0 },
    Sphere { cx: 0.65, cy: -0.55, cz: -0.2, r: 0.45, cr: 0.2, cg: 0.38, cb: 0.82, emit: 0.0 },
    Sphere { cx: 0.0, cy: 2.3, cz: 0.0, r: 0.5, cr: 1.0, cg: 1.0, cb: 1.0, emit: 8.0 },
];

static NODES: [Node; 13] = [
    Node { left: 1, right: 2, primitive: -1, minx: -2001.0, miny: -2001.0, minz: -2001.0, maxx: 2001.0, maxy: 1000.0, maxz: 1000.0 },
    Node { left: 3, right: 4, primitive: -1, minx: -2001.0, miny: -2001.0, minz: -2001.0, maxx: 2001.0, maxy: 1000.0, maxz: 1000.0 },
    Node { left: 5, right: 6, primitive: -1, minx: -1.1500001f32, miny: -1.0, minz: -0.65f32, maxx: 1.0999999f32, maxy: 2.8f32, maxz: 0.85f32 },
    Node { left: 7, right: 8, primitive: -1, minx: -1000.0, miny: -2001.0, minz: -2001.0, maxx: 1000.0, maxy: 1000.0, maxz: 1000.0 },
    Node { left: 9, right: 10, primitive: -1, minx: -2001.0, miny: -1000.0, minz: -1000.0, maxx: 2001.0, maxy: 1000.0, maxz: 1000.0 },
    Node { left: -1, right: -1, primitive: 4, minx: -1.1500001f32, miny: -1.0, minz: -0.25, maxx: -0.050000012f32, maxy: 0.100000024f32, maxz: 0.85f32 },
    Node { left: 11, right: 12, primitive: -1, minx: -0.5, miny: -1.0, minz: -0.65f32, maxx: 1.0999999f32, maxy: 2.8f32, maxz: 0.5 },
    Node { left: -1, right: -1, primitive: 0, minx: -1000.0, miny: -2001.0, minz: -1000.0, maxx: 1000.0, maxy: -1.0, maxz: 1000.0 },
    Node { left: -1, right: -1, primitive: 3, minx: -1000.0, miny: -1000.0, minz: -2001.0, maxx: 1000.0, maxy: 1000.0, maxz: -1.0 },
    Node { left: -1, right: -1, primitive: 1, minx: -2001.0, miny: -1000.0, minz: -1000.0, maxx: -1.0, maxy: 1000.0, maxz: 1000.0 },
    Node { left: -1, right: -1, primitive: 2, minx: 1.0, miny: -1000.0, minz: -1000.0, maxx: 2001.0, maxy: 1000.0, maxz: 1000.0 },
    Node { left: -1, right: -1, primitive: 5, minx: 0.19999999f32, miny: -1.0, minz: -0.65f32, maxx: 1.0999999f32, maxy: -0.100000024f32, maxz: 0.24999999f32 },
    Node { left: -1, right: -1, primitive: 6, minx: -0.5, miny: 1.8f32, minz: -0.5, maxx: 0.5, maxy: 2.8f32, maxz: 0.5 },
];

#[inline(always)]
fn minf(a: f32, b: f32) -> f32 {
    if a < b { a } else { b }
}
#[inline(always)]
fn maxf(a: f32, b: f32) -> f32 {
    if a > b { a } else { b }
}
#[inline(always)]
fn vadd(a: Vec3, b: Vec3) -> Vec3 {
    Vec3 { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}
#[inline(always)]
fn vmul(a: Vec3, s: f32) -> Vec3 {
    Vec3 { x: a.x * s, y: a.y * s, z: a.z * s }
}
#[inline(always)]
fn dot(a: Vec3, b: Vec3) -> f32 {
    a.x * b.x + (a.y * b.y + a.z * b.z)
}
#[inline(always)]
fn norm(a: Vec3) -> Vec3 {
    let d = dot(a, a);
    if d == 0.0 { return Vec3 { x: 0.0, y: 1.0, z: 0.0 }; }
    let l = sqrt_f64(d as f64) as f32;
    Vec3 { x: a.x / l, y: a.y / l, z: a.z / l }
}
#[inline(always)]
fn rng(mut x: u32) -> u32 {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    x
}
#[inline(always)]
fn unit(x: u32) -> f32 {
    (x >> 8) as f32 * (1.0 / 16777216.0)
}
#[inline(always)]
fn seed_for(pixel: u32, sample: u32) -> u32 {
    SEED ^ (pixel * 0x9e3779b9u32) ^ (sample * 0x85ebca6bu32)
}

#[inline(always)]
fn hit_box(o: Vec3, d: Vec3, n: &Node, tmax: f32) -> bool {
    let mut lo = EPSILON;
    let mut hi = tmax;
    let oo = [o.x, o.y, o.z];
    let dd = [d.x, d.y, d.z];
    let mn = [n.minx, n.miny, n.minz];
    let mx = [n.maxx, n.maxy, n.maxz];
    for a in 0..3 {
        let inv = 1.0 / dd[a];
        let near_delta = mn[a] - oo[a];
        let far_delta = mx[a] - oo[a];
        let mut t0 = near_delta * inv;
        let mut t1 = far_delta * inv;
        if inv < 0.0 {
            let q = t0;
            t0 = t1;
            t1 = q;
        }
        lo = maxf(lo, t0);
        hi = minf(hi, t1);
        if hi < lo {
            return false;
        }
    }
    true
}

fn intersect(o: Vec3, d: Vec3, out: &mut (f32, Vec3, Vec3)) -> i32 {
    let mut stack = [0i32; 32];
    let mut sp: usize = 0;
    let mut best_index: i32 = -1;
    let mut best: f32 = 1.0e30;
    stack[sp] = 0;
    sp += 1;
    while sp > 0 {
        sp -= 1;
        let ni = stack[sp];
        unsafe {
            COUNTERS[2] += 1;
        }
        let n = &NODES[ni as usize];
        if !hit_box(o, d, n, best) {
            continue;
        }
        if n.primitive >= 0 {
            unsafe {
                COUNTERS[3] += 1;
            }
            let s = &SPHERES[n.primitive as usize];
            let oc = Vec3 { x: o.x - s.cx, y: o.y - s.cy, z: o.z - s.cz };
            let half = dot(oc, d);
            let radius_squared = s.r * s.r;
            let origin_squared = dot(oc, oc);
            let c = origin_squared - radius_squared;
            let half_squared = half * half;
            let disc = half_squared - c;
            if disc < 0.0 {
                continue;
            }
            let root = sqrt_f64(disc as f64) as f32;
            let mut t = -half - root;
            if t <= EPSILON {
                t = -half + root;
            }
            if t > EPSILON && (t < best || (t == best && n.primitive < best_index)) {
                best = t;
                best_index = n.primitive;
            }
        } else {
            stack[sp] = n.right;
            sp += 1;
            stack[sp] = n.left;
            sp += 1;
        }
    }
    if best_index < 0 {
        return -1;
    }
    out.0 = best;
    out.1 = vadd(o, vmul(d, best));
    let s = &SPHERES[best_index as usize];
    out.2 = norm(Vec3 { x: out.1.x - s.cx, y: out.1.y - s.cy, z: out.1.z - s.cz });
    best_index
}

#[inline(always)]
fn tone(value: f32) -> u8 {
    let denominator = 1.0 + value;
    let mapped = value / denominator;
    let clamped = maxf(0.0, minf(1.0, mapped));
    let gamma = sqrt_f64(clamped as f64) as f32;
    let scaled = gamma * 255.0;
    let rounded = scaled + 0.5;
    let mut q = rounded as i32;
    if q < 0 {
        q = 0;
    }
    if q > 255 {
        q = 255;
    }
    q as u8
}

#[no_mangle]
pub extern "C" fn framebuffer_ptr() -> u32 {
    unsafe { FRAMEBUFFER.as_ptr() as usize as u32 }
}

#[no_mangle]
pub extern "C" fn counters_ptr() -> u32 {
    unsafe { COUNTERS.as_ptr() as usize as u32 }
}

#[no_mangle]
pub extern "C" fn render(width: u32, height: u32, spp: u32) -> i32 {
    if width < 1 || height < 1 || spp < 1 || width > MAX_WIDTH || height > MAX_HEIGHT || spp > MAX_SPP {
        return 1;
    }
    unsafe {
        for i in 0..9 {
            COUNTERS[i] = 0;
        }
        COUNTERS[4] = width * height * spp;
        COUNTERS[6] = 0;
        COUNTERS[8] = 1;
        let fb = &mut FRAMEBUFFER;
        let ct = &mut COUNTERS;
        for y in 0..height {
            for x in 0..width {
                let pixel = y * width + x;
                let mut ar: f32 = 0.0;
                let mut ag: f32 = 0.0;
                let mut ab: f32 = 0.0;
                for sample in 0..spp {
                    let mut state = seed_for(pixel, sample);
                    state = rng(state);
                    let jx = unit(state);
                    state = rng(state);
                    let jy = unit(state);
                    ct[5] += 2;
                    let pixel_x = (x as f32 + jx) / width as f32;
                    let pixel_y = (y as f32 + jy) / height as f32;
                    let sx_scale = pixel_x * 2.0;
                    let sy_scale = pixel_y * 2.0;
                    let sx_centered = sx_scale - 1.0;
                    let sy_centered = 1.0 - sy_scale;
                    let sx = sx_centered * 1.7;
                    let sy = sy_centered * 1.7;
                    let origin = Vec3 { x: 0.0, y: 0.0, z: 4.5 };
                    let direction = norm(Vec3 { x: sx, y: sy, z: -4.5 });
                    let mut throughput = Vec3 { x: 1.0, y: 1.0, z: 1.0 };
                    let mut radiance = Vec3 { x: 0.0, y: 0.0, z: 0.0 };
                    ct[0] += 1;
                    let mut o = origin;
                    let mut dir = direction;
                    for _bounce in 0..MAX_BOUNCES {
                        let mut out = (0.0f32, Vec3 { x: 0.0, y: 0.0, z: 0.0 }, Vec3 { x: 0.0, y: 0.0, z: 0.0 });
                        let index = intersect(o, dir, &mut out);
                        if index < 0 {
                            break;
                        }
                        ct[1] += 1;
                        let s = &SPHERES[index as usize];
                        if s.emit > 0.0 {
                            radiance.x += throughput.x * s.emit;
                            radiance.y += throughput.y * s.emit;
                            radiance.z += throughput.z * s.emit;
                            break;
                        }
                        throughput.x *= s.cr;
                        throughput.y *= s.cg;
                        throughput.z *= s.cb;
                        if _bounce >= 2 {
                            let prob = maxf(0.1, minf(0.95, maxf(throughput.x, maxf(throughput.y, throughput.z))));
                            state = rng(state);
                            ct[5] += 1;
                            if unit(state) > prob {
                                break;
                            }
                            throughput.x /= prob;
                            throughput.y /= prob;
                            throughput.z /= prob;
                        }
                        state = rng(state);
                        let rx = unit(state) * 2.0 - 1.0;
                        state = rng(state);
                        let ry = unit(state) * 2.0 - 1.0;
                        state = rng(state);
                        let rz = unit(state) * 2.0 - 1.0;
                        ct[5] += 3;
                        let mut hemi = norm(Vec3 { x: rx, y: ry, z: rz });
                        if dot(hemi, out.2) < 0.0 {
                            hemi = vmul(hemi, -1.0);
                        }
                        o = vadd(out.1, vmul(out.2, EPSILON));
                        dir = hemi;
                        ct[0] += 1;
                    }
                    ar += radiance.x;
                    ag += radiance.y;
                    ab += radiance.z;
                }
                let off = (pixel * 4) as usize;
                fb[off] = tone(ar / spp as f32);
                fb[off + 1] = tone(ag / spp as f32);
                fb[off + 2] = tone(ab / spp as f32);
                fb[off + 3] = 255;
                ct[7] += 4;
            }
        }
    }
    0
}
