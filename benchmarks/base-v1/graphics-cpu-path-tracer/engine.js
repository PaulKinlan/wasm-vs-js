const F = Math.fround;
const SEED = 0x6d2b79f5;
const MAX_BOUNCES = 4;
const EPSILON = F(0.001);

// Project-owned Cornell-box-like product scene. Large spheres are the four planes.
export const SCENE = Object.freeze([
  [-0.0, -1001.0, 0.0, 1000.0, 0.72, 0.72, 0.72, 0.0],
  [-1001.0, 0.0, 0.0, 1000.0, 0.72, 0.12, 0.12, 0.0],
  [1001.0, 0.0, 0.0, 1000.0, 0.12, 0.72, 0.18, 0.0],
  [0.0, 0.0, -1001.0, 1000.0, 0.72, 0.72, 0.72, 0.0],
  [-0.6, -0.45, 0.3, 0.55, 0.75, 0.68, 0.22, 0.0],
  [0.65, -0.55, -0.2, 0.45, 0.2, 0.38, 0.82, 0.0],
  [0.0, 2.3, 0.0, 0.5, 1.0, 1.0, 1.0, 8.0],
]);

const TREE = Object.freeze([
  [1, 2, -1],
  [3, 4, -1],
  [5, 6, -1],
  [7, 8, -1],
  [9, 10, -1],
  [-1, -1, 4],
  [-1, -1, -1],
  [-1, -1, 0],
  [-1, -1, 3],
  [-1, -1, 1],
  [-1, -1, 2],
  [-1, -1, 5],
  [-1, -1, 6],
]);
// Node 6 is internal and fixed here to leaves 11 and 12.
const CHILDREN = TREE.map((node, index) => index === 6 ? [11, 12, -1] : node);

function boundsForPrimitive(index, strict) {
  const f = strict ? F : (x) => x;
  const s = SCENE[index];
  return [
    f(s[0] - s[3]),
    f(s[1] - s[3]),
    f(s[2] - s[3]),
    f(s[0] + s[3]),
    f(s[1] + s[3]),
    f(s[2] + s[3]),
  ];
}
function makeBounds(strict) {
  const result = new Array(CHILDREN.length);
  for (let i = 0; i < CHILDREN.length; i++) {
    if (CHILDREN[i][2] >= 0) result[i] = boundsForPrimitive(CHILDREN[i][2], strict);
  }
  for (let i = CHILDREN.length - 1; i >= 0; i--) {
    if (result[i]) continue;
    const a = result[CHILDREN[i][0]], b = result[CHILDREN[i][1]];
    result[i] = [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.min(a[2], b[2]),
      Math.max(a[3], b[3]),
      Math.max(a[4], b[4]),
      Math.max(a[5], b[5]),
    ];
  }
  return result;
}
const BOUNDS_F32 = makeBounds(true), BOUNDS_F64 = makeBounds(false);

function xorshift(state) {
  let x = state >>> 0;
  x ^= (x << 13) >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  return x >>> 0;
}
function seedFor(pixel, sample) {
  return (SEED ^ Math.imul(pixel, 0x9e3779b9) ^ Math.imul(sample, 0x85ebca6b)) >>> 0;
}
function unitFromU32(value, strict) {
  const v = (value >>> 8) / 16777216;
  return strict ? F(v) : v;
}
function add(a, b, f) {
  return [f(a[0] + b[0]), f(a[1] + b[1]), f(a[2] + b[2])];
}
function sub(a, b, f) {
  return [f(a[0] - b[0]), f(a[1] - b[1]), f(a[2] - b[2])];
}
function mul(a, s, f) {
  return [f(a[0] * s), f(a[1] * s), f(a[2] * s)];
}
function dot(a, b, f) {
  return f(f(a[0] * b[0]) + f(f(a[1] * b[1]) + f(a[2] * b[2])));
}
function normalize(a, f) {
  const len = f(Math.sqrt(dot(a, a, f)));
  return len === 0 ? [0, 1, 0] : [f(a[0] / len), f(a[1] / len), f(a[2] / len)];
}
function hitAabb(o, d, b, tMax, f) {
  let lo = EPSILON, hi = tMax;
  for (let axis = 0; axis < 3; axis++) {
    const inv = f(1 / d[axis]);
    let t0 = f((b[axis] - o[axis]) * inv), t1 = f((b[axis + 3] - o[axis]) * inv);
    if (inv < 0) {
      const q = t0;
      t0 = t1;
      t1 = q;
    }
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    if (hi < lo) return false;
  }
  return true;
}
function intersect(o, d, bounds, f, counters) {
  const stack = [0];
  let best = 1e30, bestIndex = -1;
  while (stack.length) {
    const node = stack.pop();
    counters.nodeTests++;
    if (!hitAabb(o, d, bounds[node], best, f)) continue;
    const [left, right, primitive] = CHILDREN[node];
    if (primitive >= 0) {
      counters.intersections++;
      const s = SCENE[primitive];
      const oc = sub(o, s, f);
      const half = dot(oc, d, f);
      const c = f(dot(oc, oc, f) - f(s[3] * s[3]));
      const disc = f(f(half * half) - c);
      if (disc < 0) continue;
      const root = f(Math.sqrt(disc));
      let t = f(-half - root);
      if (t <= EPSILON) t = f(-half + root);
      if (t > EPSILON && (t < best || (t === best && primitive < bestIndex))) {
        best = t;
        bestIndex = primitive;
      }
    } else {
      stack.push(right);
      stack.push(left);
    }
  }
  if (bestIndex < 0) return null;
  const point = add(o, mul(d, best, f), f);
  const s = SCENE[bestIndex];
  const normal = normalize(sub(point, s, f), f);
  return { t: best, index: bestIndex, point, normal };
}
function tone(value) {
  const mapped = value / (1 + value);
  const gamma = Math.sqrt(Math.max(0, Math.min(1, mapped)));
  return Math.max(0, Math.min(255, Math.floor(gamma * 255 + 0.5)));
}

function render(width, height, spp, strict) {
  if (
    !Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(spp) || width < 1 ||
    height < 1 || spp < 1 || width > 512 || height > 512 || spp > 64
  ) throw new Error("render bounds");
  const f = strict ? F : (x) => x,
    bounds = strict ? BOUNDS_F32 : BOUNDS_F64,
    framebuffer = new Uint8Array(width * height * 4);
  const counters = {
    rays: 0,
    bounces: 0,
    nodeTests: 0,
    intersections: 0,
    samples: width * height * spp,
    rngDraws: 0,
    allocations: 1,
    boundaryCrossings: strict ? 0 : 0,
  };
  const checkpoints = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      let ar = 0, ag = 0, ab = 0;
      for (let sample = 0; sample < spp; sample++) {
        let state = seedFor(pixel, sample);
        state = xorshift(state);
        const jx = unitFromU32(state, strict);
        state = xorshift(state);
        const jy = unitFromU32(state, strict);
        counters.rngDraws += 2;
        const sx = f(f((f((x + jx) / width) * 2) - 1) * 1.7);
        const sy = f(f(1 - f(f((y + jy) / height) * 2)) * 1.7);
        let origin = [f(0), f(0), f(4.5)],
          direction = normalize([sx, sy, f(-4.5)], f),
          throughput = [f(1), f(1), f(1)],
          radiance = [f(0), f(0), f(0)];
        counters.rays++;
        for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
          const hit = intersect(origin, direction, bounds, f, counters);
          if (!hit) break;
          counters.bounces++;
          const s = SCENE[hit.index];
          if (s[7] > 0) {
            radiance = [
              f(radiance[0] + f(throughput[0] * s[7])),
              f(radiance[1] + f(throughput[1] * s[7])),
              f(radiance[2] + f(throughput[2] * s[7])),
            ];
            break;
          }
          throughput = [f(throughput[0] * s[4]), f(throughput[1] * s[5]), f(throughput[2] * s[6])];
          if (bounce >= 2) {
            const p = Math.max(0.1, Math.min(0.95, Math.max(...throughput)));
            state = xorshift(state);
            counters.rngDraws++;
            if (unitFromU32(state, strict) > p) break;
            throughput = [f(throughput[0] / p), f(throughput[1] / p), f(throughput[2] / p)];
          }
          state = xorshift(state);
          let rx = f(unitFromU32(state, strict) * 2 - 1);
          state = xorshift(state);
          let ry = f(unitFromU32(state, strict) * 2 - 1);
          state = xorshift(state);
          let rz = f(unitFromU32(state, strict) * 2 - 1);
          counters.rngDraws += 3;
          let hemisphere = normalize([rx, ry, rz], f);
          if (dot(hemisphere, hit.normal, f) < 0) hemisphere = mul(hemisphere, -1, f);
          origin = add(hit.point, mul(hit.normal, EPSILON, f), f);
          direction = hemisphere;
          counters.rays++;
        }
        ar = f(ar + radiance[0]);
        ag = f(ag + radiance[1]);
        ab = f(ab + radiance[2]);
        if (
          (pixel === 0 || pixel === ((width * height / 2) | 0) || pixel === width * height - 1) &&
          sample === 0
        ) {
          checkpoints.push({
            pixel,
            sample,
            state,
            radiance: [...radiance],
            throughput: [...throughput],
          });
        }
      }
      const off = pixel * 4;
      framebuffer[off] = tone(f(ar / spp));
      framebuffer[off + 1] = tone(f(ag / spp));
      framebuffer[off + 2] = tone(f(ab / spp));
      framebuffer[off + 3] = 255;
    }
  }
  return { framebuffer, counters, checkpoints };
}
export function renderJavaScript(width, height, spp) {
  return render(width, height, spp, true);
}
export function renderHighPrecision(width, height, spp) {
  return render(width, height, spp, false);
}
export function compareToReference(actual, reference) {
  if (actual.length !== reference.length) throw new Error("framebuffer length mismatch");
  let max = 0, sum = 0, count = 0;
  for (let i = 0; i < actual.length; i++) {
    if ((i & 3) === 3) continue;
    const d = Math.abs(actual[i] - reference[i]);
    max = Math.max(max, d);
    sum += d;
    count++;
  }
  return {
    maxChannelDelta: max,
    meanChannelDelta: sum / count,
    passed: max <= 4 && sum / count <= 0.35,
  };
}
export function readWasmResult(instance, width, height, spp) {
  const render = instance.exports.render;
  if (typeof render !== "function") throw new Error("missing render export");
  const status = render(width, height, spp);
  if (status !== 0) throw new Error(`Wasm render failed ${status}`);
  const memory = instance.exports.memory;
  if (!(memory instanceof WebAssembly.Memory)) throw new Error("missing memory");
  const framebufferPtr = instance.exports.framebuffer_ptr,
    countersPtr = instance.exports.counters_ptr;
  if (typeof framebufferPtr !== "function" || typeof countersPtr !== "function") {
    throw new Error("missing pointer exports");
  }
  const fbPtr = Number(framebufferPtr()), counterPtr = Number(countersPtr());
  const framebuffer = new Uint8Array(memory.buffer, fbPtr, width * height * 4).slice();
  const raw = new Uint32Array(memory.buffer, counterPtr, 8);
  return {
    framebuffer,
    counters: {
      rays: raw[0],
      bounces: raw[1],
      nodeTests: raw[2],
      intersections: raw[3],
      samples: raw[4],
      rngDraws: raw[5],
      allocations: raw[6],
      boundaryCrossings: raw[7],
    },
    checkpoints: [],
  };
}
