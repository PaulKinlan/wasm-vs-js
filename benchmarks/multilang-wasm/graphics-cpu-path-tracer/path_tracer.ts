// path_tracer.ts — AssemblyScript multilang kernel for graphics.cpu-path-tracer.v1.
//
// Mirrors path_tracer.c operation for operation. Every value is f32 and every
// expression keeps the C parenthesisation, because the four engines are
// compared on a bit-identical framebuffer: dot() adds as a.x*b.x + (a.y*b.y +
// a.z*b.z), not left to right, and tone() rounds through the same six steps.
//
// Nothing is heap-allocated. AssemblyScript arrays and object literals live on
// a heap the caller knows nothing about, and a Vec3 returned by value would
// allocate per bounce — millions of times — which is both a different program
// and a different measurement. Vectors are carried in locals and globals
// (Wasm globals, not memory), the BVH stack is a fixed span of linear memory,
// and the scene tables are written once by initScene().
//
// Layout is the contract: the caller reads the framebuffer and counters
// through framebuffer_ptr() and counters_ptr().

const MAX_WIDTH: u32 = 512;
const MAX_HEIGHT: u32 = 512;
const MAX_SPP: u32 = 64;
const MAX_BOUNCES: u32 = 4;
const EPSILON: f32 = 0.001;
const SEED: u32 = 0x6d2b79f5;

const COUNTERS_OFF: usize = 16;
const SPHERES_OFF: usize = 64; // 7 spheres x 8 f32
const NODES_OFF: usize = 320; // 13 nodes x (3 i32 + 6 f32)
const STACK_OFF: usize = 1024; // 32 i32
const FRAMEBUFFER_OFF: usize = 4096;

const SPHERE_WORDS: usize = 8;
const NODE_WORDS: usize = 9;

export function framebuffer_ptr(): u32 {
  return <u32> FRAMEBUFFER_OFF;
}

export function counters_ptr(): u32 {
  return <u32> COUNTERS_OFF;
}

// @ts-ignore: decorator

function counter(i: u32): u32 {
  return load<u32>(COUNTERS_OFF + (<usize> i) * 4);
}

// @ts-ignore: decorator

function bump(i: u32, by: u32 = 1): void {
  store<u32>(COUNTERS_OFF + (<usize> i) * 4, counter(i) + by);
}

// @ts-ignore: decorator

function sphereAt(index: i32, word: u32): f32 {
  return load<f32>(SPHERES_OFF + (<usize> index) * SPHERE_WORDS * 4 + (<usize> word) * 4);
}

// @ts-ignore: decorator

function nodeF32(index: i32, word: u32): f32 {
  return load<f32>(NODES_OFF + (<usize> index) * NODE_WORDS * 4 + (<usize> word) * 4);
}

// @ts-ignore: decorator

function nodeI32(index: i32, word: u32): i32 {
  return load<i32>(NODES_OFF + (<usize> index) * NODE_WORDS * 4 + (<usize> word) * 4);
}

function putSphere(
  i: i32,
  cx: f32,
  cy: f32,
  cz: f32,
  r: f32,
  cr: f32,
  cg: f32,
  cb: f32,
  emit: f32,
): void {
  const base: usize = SPHERES_OFF + (<usize> i) * SPHERE_WORDS * 4;
  store<f32>(base, cx);
  store<f32>(base + 4, cy);
  store<f32>(base + 8, cz);
  store<f32>(base + 12, r);
  store<f32>(base + 16, cr);
  store<f32>(base + 20, cg);
  store<f32>(base + 24, cb);
  store<f32>(base + 28, emit);
}

function putNode(
  i: i32,
  left: i32,
  right: i32,
  primitive: i32,
  minx: f32,
  miny: f32,
  minz: f32,
  maxx: f32,
  maxy: f32,
  maxz: f32,
): void {
  const base: usize = NODES_OFF + (<usize> i) * NODE_WORDS * 4;
  store<i32>(base, left);
  store<i32>(base + 4, right);
  store<i32>(base + 8, primitive);
  store<f32>(base + 12, minx);
  store<f32>(base + 16, miny);
  store<f32>(base + 20, minz);
  store<f32>(base + 24, maxx);
  store<f32>(base + 28, maxy);
  store<f32>(base + 32, maxz);
}

// The C source writes the tight AABB bounds as hex float literals, which
// AssemblyScript does not parse. They are reproduced here from their exact
// IEEE-754 single bit patterns so no decimal rounding can move a boundary.
// @ts-ignore: decorator

function bits(pattern: u32): f32 {
  return reinterpret<f32>(pattern);
}

function initScene(): void {
  putSphere(0, 0.0, -1001.0, 0.0, 1000.0, 0.72, 0.72, 0.72, 0.0);
  putSphere(1, -1001.0, 0.0, 0.0, 1000.0, 0.72, 0.12, 0.12, 0.0);
  putSphere(2, 1001.0, 0.0, 0.0, 1000.0, 0.12, 0.72, 0.18, 0.0);
  putSphere(3, 0.0, 0.0, -1001.0, 1000.0, 0.72, 0.72, 0.72, 0.0);
  putSphere(4, -0.6, -0.45, 0.3, 0.55, 0.75, 0.68, 0.22, 0.0);
  putSphere(5, 0.65, -0.55, -0.2, 0.45, 0.2, 0.38, 0.82, 0.0);
  putSphere(6, 0.0, 2.3, 0.0, 0.5, 1.0, 1.0, 1.0, 8.0);

  const n1150 = bits(0xbf933334); // -0x1.266668p+0
  const n0650 = bits(0xbf266666); // -0x1.4cccccp-1
  const p1100 = bits(0x3f8ccccc); // 0x1.199998p+0
  const p2800 = bits(0x40333333); // 0x1.666666p+1
  const p0850 = bits(0x3f59999a); // 0x1.b33334p-1
  const n0050 = bits(0xbd4cccd0); // -0x1.9999ap-5
  const p0100 = bits(0x3dccccd0); // 0x1.9999ap-4
  const p0200 = bits(0x3e4ccccc); // 0x1.999998p-3
  const n0100 = bits(0xbdccccd0); // -0x1.9999ap-4
  const p0250 = bits(0x3e7fffff); // 0x1.fffffep-3
  const p1800 = bits(0x3fe66666); // 0x1.ccccccp+0

  putNode(0, 1, 2, -1, -2001, -2001, -2001, 2001, 1000, 1000);
  putNode(1, 3, 4, -1, -2001, -2001, -2001, 2001, 1000, 1000);
  putNode(2, 5, 6, -1, n1150, -1, n0650, p1100, p2800, p0850);
  putNode(3, 7, 8, -1, -1000, -2001, -2001, 1000, 1000, 1000);
  putNode(4, 9, 10, -1, -2001, -1000, -1000, 2001, 1000, 1000);
  putNode(5, -1, -1, 4, n1150, -1, -0.25, n0050, p0100, p0850);
  putNode(6, 11, 12, -1, -0.5, -1, n0650, p1100, p2800, 0.5);
  putNode(7, -1, -1, 0, -1000, -2001, -1000, 1000, -1, 1000);
  putNode(8, -1, -1, 3, -1000, -1000, -2001, 1000, 1000, -1);
  putNode(9, -1, -1, 1, -2001, -1000, -1000, -1, 1000, 1000);
  putNode(10, -1, -1, 2, 1, -1000, -1000, 2001, 1000, 1000);
  putNode(11, -1, -1, 5, p0200, -1, n0650, p1100, n0100, p0250);
  putNode(12, -1, -1, 6, -0.5, p1800, -0.5, 0.5, p2800, 0.5);
}

// @ts-ignore: decorator

function minf(a: f32, b: f32): f32 {
  return a < b ? a : b;
}

// @ts-ignore: decorator

function maxf(a: f32, b: f32): f32 {
  return a > b ? a : b;
}

/** C's dot(): a.x*b.x + (a.y*b.y + a.z*b.z). The grouping is load-bearing. */
// @ts-ignore: decorator

function dot(ax: f32, ay: f32, az: f32, bx: f32, by: f32, bz: f32): f32 {
  return ax * bx + (ay * by + az * bz);
}

// Normalised vector out-parameters. Wasm globals, so no allocation.
let nrmX: f32 = 0, nrmY: f32 = 0, nrmZ: f32 = 0;

function norm(ax: f32, ay: f32, az: f32): void {
  const d: f32 = dot(ax, ay, az, ax, ay, az);
  if (d == 0.0) {
    nrmX = 0;
    nrmY = 1;
    nrmZ = 0;
    return;
  }
  const l: f32 = Mathf.sqrt(d);
  nrmX = ax / l;
  nrmY = ay / l;
  nrmZ = az / l;
}

// @ts-ignore: decorator

function rng(x: u32): u32 {
  let v: u32 = x;
  v ^= v << 13;
  v ^= v >> 17;
  v ^= v << 5;
  return v;
}

// @ts-ignore: decorator

function unit(x: u32): f32 {
  return <f32> (x >> 8) * (<f32> 1.0 / <f32> 16777216.0);
}

// @ts-ignore: decorator

function seedFor(pixel: u32, sample: u32): u32 {
  return SEED ^ (pixel * 0x9e3779b9) ^ (sample * 0x85ebca6b);
}

function hitBox(
  ox: f32,
  oy: f32,
  oz: f32,
  dx: f32,
  dy: f32,
  dz: f32,
  node: i32,
  tmax: f32,
): bool {
  let lo: f32 = EPSILON, hi: f32 = tmax;
  // The C loops over three components through stack arrays; unrolled here so
  // no array is allocated, in the same axis order.
  for (let a: u32 = 0; a < 3; a++) {
    const o: f32 = a == 0 ? ox : (a == 1 ? oy : oz);
    const d: f32 = a == 0 ? dx : (a == 1 ? dy : dz);
    const mn: f32 = nodeF32(node, 3 + a);
    const mx: f32 = nodeF32(node, 6 + a);
    const inv: f32 = <f32> 1.0 / d;
    const nearDelta: f32 = mn - o;
    const farDelta: f32 = mx - o;
    let t0: f32 = nearDelta * inv;
    let t1: f32 = farDelta * inv;
    if (inv < 0) {
      const q: f32 = t0;
      t0 = t1;
      t1 = q;
    }
    lo = maxf(lo, t0);
    hi = minf(hi, t1);
    if (hi < lo) return false;
  }
  return true;
}

// intersect() out-parameters. The C signature also returns the hit distance,
// which its render loop declares and never reads; it is not carried here.
let hitPx: f32 = 0, hitPy: f32 = 0, hitPz: f32 = 0;
let hitNx: f32 = 0, hitNy: f32 = 0, hitNz: f32 = 0;

function intersect(ox: f32, oy: f32, oz: f32, dx: f32, dy: f32, dz: f32): i32 {
  let sp: i32 = 0;
  let bestIndex: i32 = -1;
  let best: f32 = 1.0e30;
  store<i32>(STACK_OFF, 0);
  sp++;
  while (sp > 0) {
    const ni: i32 = load<i32>(STACK_OFF + (<usize> (--sp)) * 4);
    bump(2);
    if (!hitBox(ox, oy, oz, dx, dy, dz, ni, best)) continue;
    const primitive: i32 = nodeI32(ni, 2);
    if (primitive >= 0) {
      bump(3);
      const ocx: f32 = ox - sphereAt(primitive, 0);
      const ocy: f32 = oy - sphereAt(primitive, 1);
      const ocz: f32 = oz - sphereAt(primitive, 2);
      const half: f32 = dot(ocx, ocy, ocz, dx, dy, dz);
      const r: f32 = sphereAt(primitive, 3);
      const radiusSquared: f32 = r * r;
      const originSquared: f32 = dot(ocx, ocy, ocz, ocx, ocy, ocz);
      const c: f32 = originSquared - radiusSquared;
      const halfSquared: f32 = half * half;
      const disc: f32 = halfSquared - c;
      if (disc < 0) continue;
      const root: f32 = Mathf.sqrt(disc);
      let t: f32 = -half - root;
      if (t <= EPSILON) t = -half + root;
      if (t > EPSILON && (t < best || (t == best && primitive < bestIndex))) {
        best = t;
        bestIndex = primitive;
      }
    } else {
      store<i32>(STACK_OFF + (<usize> sp) * 4, nodeI32(ni, 1));
      sp++;
      store<i32>(STACK_OFF + (<usize> sp) * 4, nodeI32(ni, 0));
      sp++;
    }
  }
  if (bestIndex < 0) return -1;
  hitPx = ox + dx * best;
  hitPy = oy + dy * best;
  hitPz = oz + dz * best;
  norm(
    hitPx - sphereAt(bestIndex, 0),
    hitPy - sphereAt(bestIndex, 1),
    hitPz - sphereAt(bestIndex, 2),
  );
  hitNx = nrmX;
  hitNy = nrmY;
  hitNz = nrmZ;
  return bestIndex;
}

function tone(value: f32): u8 {
  const denominator: f32 = <f32> 1.0 + value;
  const mapped: f32 = value / denominator;
  const clamped: f32 = maxf(0.0, minf(1.0, mapped));
  const gamma: f32 = Mathf.sqrt(clamped);
  const scaled: f32 = gamma * <f32> 255.0;
  const rounded: f32 = scaled + <f32> 0.5;
  let q: i32 = <i32> rounded;
  if (q < 0) q = 0;
  if (q > 255) q = 255;
  return <u8> q;
}

export function render(width: u32, height: u32, spp: u32): i32 {
  if (
    width < 1 || height < 1 || spp < 1 ||
    width > MAX_WIDTH || height > MAX_HEIGHT || spp > MAX_SPP
  ) return 1;
  initScene();
  for (let i: u32 = 0; i < 9; i++) store<u32>(COUNTERS_OFF + (<usize> i) * 4, 0);
  store<u32>(COUNTERS_OFF + 4 * 4, width * height * spp);
  store<u32>(COUNTERS_OFF + 6 * 4, 0);
  store<u32>(COUNTERS_OFF + 8 * 4, 1);

  for (let y: u32 = 0; y < height; y++) {
    for (let x: u32 = 0; x < width; x++) {
      const pixel: u32 = y * width + x;
      let ar: f32 = 0, ag: f32 = 0, ab: f32 = 0;
      for (let sample: u32 = 0; sample < spp; sample++) {
        let state: u32 = seedFor(pixel, sample);
        state = rng(state);
        const jx: f32 = unit(state);
        state = rng(state);
        const jy: f32 = unit(state);
        bump(5, 2);
        const pixelX: f32 = (<f32> x + jx) / <f32> width;
        const pixelY: f32 = (<f32> y + jy) / <f32> height;
        const sxScale: f32 = pixelX * <f32> 2.0;
        const syScale: f32 = pixelY * <f32> 2.0;
        const sxCentered: f32 = sxScale - <f32> 1.0;
        const syCentered: f32 = <f32> 1.0 - syScale;
        const sx: f32 = sxCentered * <f32> 1.7;
        const sy: f32 = syCentered * <f32> 1.7;
        let originX: f32 = 0, originY: f32 = 0, originZ: f32 = 4.5;
        norm(sx, sy, -4.5);
        let dirX: f32 = nrmX, dirY: f32 = nrmY, dirZ: f32 = nrmZ;
        let throughputX: f32 = 1, throughputY: f32 = 1, throughputZ: f32 = 1;
        let radianceX: f32 = 0, radianceY: f32 = 0, radianceZ: f32 = 0;
        bump(0);
        for (let bounce: u32 = 0; bounce < MAX_BOUNCES; bounce++) {
          const index: i32 = intersect(originX, originY, originZ, dirX, dirY, dirZ);
          if (index < 0) break;
          bump(1);
          const emit: f32 = sphereAt(index, 7);
          if (emit > 0) {
            radianceX += throughputX * emit;
            radianceY += throughputY * emit;
            radianceZ += throughputZ * emit;
            break;
          }
          throughputX *= sphereAt(index, 4);
          throughputY *= sphereAt(index, 5);
          throughputZ *= sphereAt(index, 6);
          if (bounce >= 2) {
            const prob: f32 = maxf(
              0.1,
              minf(0.95, maxf(throughputX, maxf(throughputY, throughputZ))),
            );
            state = rng(state);
            bump(5);
            if (unit(state) > prob) break;
            throughputX /= prob;
            throughputY /= prob;
            throughputZ /= prob;
          }
          state = rng(state);
          const rx: f32 = unit(state) * <f32> 2.0 - <f32> 1.0;
          state = rng(state);
          const ry: f32 = unit(state) * <f32> 2.0 - <f32> 1.0;
          state = rng(state);
          const rz: f32 = unit(state) * <f32> 2.0 - <f32> 1.0;
          bump(5, 3);
          norm(rx, ry, rz);
          let hemiX: f32 = nrmX, hemiY: f32 = nrmY, hemiZ: f32 = nrmZ;
          const nx: f32 = hitNx, ny: f32 = hitNy, nz: f32 = hitNz;
          if (dot(hemiX, hemiY, hemiZ, nx, ny, nz) < 0) {
            hemiX = hemiX * <f32> -1;
            hemiY = hemiY * <f32> -1;
            hemiZ = hemiZ * <f32> -1;
          }
          originX = hitPx + nx * EPSILON;
          originY = hitPy + ny * EPSILON;
          originZ = hitPz + nz * EPSILON;
          dirX = hemiX;
          dirY = hemiY;
          dirZ = hemiZ;
          bump(0);
        }
        ar += radianceX;
        ag += radianceY;
        ab += radianceZ;
      }
      const off: usize = FRAMEBUFFER_OFF + (<usize> pixel) * 4;
      store<u8>(off, tone(ar / <f32> spp));
      store<u8>(off + 1, tone(ag / <f32> spp));
      store<u8>(off + 2, tone(ab / <f32> spp));
      store<u8>(off + 3, 255);
      bump(7, 4);
    }
  }
  return 0;
}
