const F = Math.fround;
const SEED = 0x6d2b79f5;
const MAX_BOUNCES = 4;
const EPSILON = F(0.001);

export const PATH_CHECKPOINT_PIXELS = Object.freeze([0, 131328, 262143]);
export const SAMPLE_CHECKPOINT_COORDINATES = Object.freeze([
  Object.freeze([0, 0]),
  Object.freeze([256, 256]),
  Object.freeze([511, 511]),
  Object.freeze([128, 384]),
  Object.freeze([384, 128]),
]);

export function sampleCheckpointPixels(width, height) {
  if (width === 512 && height === 512) {
    return SAMPLE_CHECKPOINT_COORDINATES.map(([x, y]) => y * width + x);
  }
  return [
    0,
    Math.floor(height / 2) * width + Math.floor(width / 2),
    width * height - 1,
    Math.floor(height * 3 / 4) * width + Math.floor(width / 4),
    Math.floor(height / 4) * width + Math.floor(width * 3 / 4),
  ];
}

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
    f(f(s[0]) - f(s[3])),
    f(f(s[1]) - f(s[3])),
    f(f(s[2]) - f(s[3])),
    f(f(s[0]) + f(s[3])),
    f(f(s[1]) + f(s[3])),
    f(f(s[2]) + f(s[3])),
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
function countAllocation(counters, value) {
  counters.allocations++;
  return value;
}
function add(a, b, f, counters) {
  return countAllocation(counters, [
    f(f(a[0]) + f(b[0])),
    f(f(a[1]) + f(b[1])),
    f(f(a[2]) + f(b[2])),
  ]);
}
function sub(a, b, f, counters) {
  return countAllocation(counters, [
    f(f(a[0]) - f(b[0])),
    f(f(a[1]) - f(b[1])),
    f(f(a[2]) - f(b[2])),
  ]);
}
function mul(a, s, f, counters) {
  return countAllocation(counters, [
    f(f(a[0]) * f(s)),
    f(f(a[1]) * f(s)),
    f(f(a[2]) * f(s)),
  ]);
}
function dot(a, b, f) {
  const x = f(f(a[0]) * f(b[0]));
  const y = f(f(a[1]) * f(b[1]));
  const z = f(f(a[2]) * f(b[2]));
  return f(x + f(y + z));
}
function normalize(a, f, counters) {
  const len = f(Math.sqrt(dot(a, a, f)));
  return countAllocation(
    counters,
    len === 0 ? [0, 1, 0] : [f(a[0] / len), f(a[1] / len), f(a[2] / len)],
  );
}
function hitAabb(o, d, b, tMax, f) {
  let lo = EPSILON, hi = tMax;
  for (let axis = 0; axis < 3; axis++) {
    const inv = f(1 / d[axis]);
    let t0 = f(f(b[axis] - o[axis]) * inv),
      t1 = f(f(b[axis + 3] - o[axis]) * inv);
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
  const stack = countAllocation(counters, [0]);
  let best = f(1e30), bestIndex = -1;
  while (stack.length) {
    const node = stack.pop();
    counters.nodeTests++;
    if (!hitAabb(o, d, bounds[node], best, f)) continue;
    const [left, right, primitive] = CHILDREN[node];
    if (primitive >= 0) {
      counters.intersections++;
      const s = SCENE[primitive];
      const oc = sub(o, s, f, counters);
      const half = dot(oc, d, f);
      const c = f(dot(oc, oc, f) - f(f(s[3]) * f(s[3])));
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
  const point = add(o, mul(d, best, f, counters), f, counters);
  const s = SCENE[bestIndex];
  const normal = normalize(sub(point, s, f, counters), f, counters);
  return countAllocation(counters, { t: best, index: bestIndex, point, normal });
}
function toneF32(value) {
  const denominator = F(F(1) + value);
  const mapped = F(value / denominator);
  const clamped = Math.max(F(0), Math.min(F(1), mapped));
  const gamma = F(Math.sqrt(clamped));
  const scaled = F(gamma * F(255));
  const rounded = F(scaled + F(0.5));
  return Math.max(0, Math.min(255, Math.floor(rounded)));
}
function toneF64(value) {
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
    tone = strict ? toneF32 : toneF64,
    framebuffer = new Uint8Array(width * height * 4);
  const counters = {
    rays: 0,
    bounces: 0,
    nodeTests: 0,
    intersections: 0,
    samples: width * height * spp,
    rngDraws: 0,
    // Render-scope authored allocations count the framebuffer and every
    // algorithm vector, traversal stack, and hit record. Module fixtures and
    // validation/checkpoint evidence envelopes are outside this counter.
    allocations: 1,
    outputBytes: 0,
    boundaryCrossings: 0,
  };
  const checkpoints = [];
  const pathCheckpointPixels = width === 512 && height === 512
    ? PATH_CHECKPOINT_PIXELS
    : [0, Math.floor(width * height / 2), width * height - 1];
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
        const pixelX = f(f(x + jx) / f(width));
        const pixelY = f(f(y + jy) / f(height));
        const sx = f(f(f(pixelX * f(2)) - f(1)) * f(1.7));
        const sy = f(f(f(1) - f(pixelY * f(2))) * f(1.7));
        let origin = countAllocation(counters, [f(0), f(0), f(4.5)]),
          direction = normalize(
            countAllocation(counters, [sx, sy, f(-4.5)]),
            f,
            counters,
          ),
          throughput = countAllocation(counters, [f(1), f(1), f(1)]),
          radiance = countAllocation(counters, [f(0), f(0), f(0)]);
        counters.rays++;
        for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
          const hit = intersect(origin, direction, bounds, f, counters);
          if (!hit) break;
          counters.bounces++;
          const s = SCENE[hit.index];
          if (s[7] > 0) {
            radiance = countAllocation(counters, [
              f(radiance[0] + f(throughput[0] * f(s[7]))),
              f(radiance[1] + f(throughput[1] * f(s[7]))),
              f(radiance[2] + f(throughput[2] * f(s[7]))),
            ]);
            break;
          }
          throughput = countAllocation(counters, [
            f(throughput[0] * f(s[4])),
            f(throughput[1] * f(s[5])),
            f(throughput[2] * f(s[6])),
          ]);
          if (bounce >= 2) {
            const p = Math.max(f(0.1), Math.min(f(0.95), Math.max(...throughput)));
            state = xorshift(state);
            counters.rngDraws++;
            if (unitFromU32(state, strict) > p) break;
            throughput = countAllocation(counters, [
              f(throughput[0] / p),
              f(throughput[1] / p),
              f(throughput[2] / p),
            ]);
          }
          state = xorshift(state);
          const rx = f(f(unitFromU32(state, strict) * f(2)) - f(1));
          state = xorshift(state);
          const ry = f(f(unitFromU32(state, strict) * f(2)) - f(1));
          state = xorshift(state);
          const rz = f(f(unitFromU32(state, strict) * f(2)) - f(1));
          counters.rngDraws += 3;
          let hemisphere = normalize(
            countAllocation(counters, [rx, ry, rz]),
            f,
            counters,
          );
          if (dot(hemisphere, hit.normal, f) < 0) {
            hemisphere = mul(hemisphere, -1, f, counters);
          }
          origin = add(
            hit.point,
            mul(hit.normal, EPSILON, f, counters),
            f,
            counters,
          );
          direction = hemisphere;
          counters.rays++;
        }
        ar = f(ar + radiance[0]);
        ag = f(ag + radiance[1]);
        ab = f(ab + radiance[2]);
        if (
          pathCheckpointPixels.includes(pixel) && sample === 0
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
      counters.outputBytes += 4;
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
  let max = 0, sum = 0, count = 0, outlierChannels = 0;
  for (let i = 0; i < actual.length; i++) {
    if ((i & 3) === 3) continue;
    const d = Math.abs(actual[i] - reference[i]);
    max = Math.max(max, d);
    sum += d;
    if (d > 4) outlierChannels++;
    count++;
  }
  const meanChannelDelta = sum / count;
  const outlierChannelRatio = outlierChannels / count;
  return {
    maxChannelDelta: max,
    meanChannelDelta,
    outlierChannels,
    outlierChannelRatio,
    passed: max <= 96 && meanChannelDelta <= 0.01 && outlierChannelRatio <= 0.0002,
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
  const raw = new Uint32Array(memory.buffer, counterPtr, 9);
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
      outputBytes: raw[7],
      boundaryCrossings: raw[8],
    },
    checkpoints: [],
  };
}
