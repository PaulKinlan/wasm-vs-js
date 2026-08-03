// Independent f64 oracle: brute-force primitives rather than the controlled BVH traversal.
import { SCENE } from "./engine.js";
const SEED = 0x6d2b79f5, EPS = 0.001;
function rng(x) {
  x >>>= 0;
  x ^= (x << 13) >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  return x >>> 0;
}
function unit(x) {
  return (x >>> 8) / 16777216;
}
function seed(pixel, sample) {
  return (SEED ^ Math.imul(pixel, 0x9e3779b9) ^ Math.imul(sample, 0x85ebca6b)) >>> 0;
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a) {
  const l = Math.sqrt(dot(a, a));
  return l === 0 ? [0, 1, 0] : a.map((v) => v / l);
}
function hit(origin, direction) {
  let best = Infinity, index = -1;
  for (let i = 0; i < SCENE.length; i++) {
    const s = SCENE[i],
      oc = [origin[0] - s[0], origin[1] - s[1], origin[2] - s[2]],
      h = dot(oc, direction),
      c = dot(oc, oc) - s[3] * s[3],
      disc = h * h - c;
    if (disc < 0) continue;
    const root = Math.sqrt(disc);
    let t = -h - root;
    if (t <= EPS) t = -h + root;
    if (t > EPS && (t < best || (t === best && i < index))) {
      best = t;
      index = i;
    }
  }
  if (index < 0) return null;
  const point = [
      origin[0] + direction[0] * best,
      origin[1] + direction[1] * best,
      origin[2] + direction[2] * best,
    ],
    s = SCENE[index],
    normal = norm([point[0] - s[0], point[1] - s[1], point[2] - s[2]]);
  return { index, point, normal };
}
function tone(v) {
  v = v / (1 + v);
  return Math.max(0, Math.min(255, Math.floor(Math.sqrt(Math.max(0, Math.min(1, v))) * 255 + 0.5)));
}
export function renderReference(width, height, spp) {
  const framebuffer = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const sum = [0, 0, 0];
      for (let sample = 0; sample < spp; sample++) {
        let state = seed(pixel, sample);
        state = rng(state);
        const jx = unit(state);
        state = rng(state);
        const jy = unit(state);
        const sx = ((x + jx) / width * 2 - 1) * 1.7, sy = (1 - (y + jy) / height * 2) * 1.7;
        let origin = [0, 0, 4.5], direction = norm([sx, sy, -4.5]);
        const throughput = [1, 1, 1], radiance = [0, 0, 0];
        for (let bounce = 0; bounce < 4; bounce++) {
          const h = hit(origin, direction);
          if (!h) break;
          const s = SCENE[h.index];
          if (s[7] > 0) {
            for (let k = 0; k < 3; k++) radiance[k] += throughput[k] * s[7];
            break;
          }
          for (let k = 0; k < 3; k++) throughput[k] *= s[4 + k];
          if (bounce >= 2) {
            const p = Math.max(0.1, Math.min(0.95, Math.max(...throughput)));
            state = rng(state);
            if (unit(state) > p) break;
            for (let k = 0; k < 3; k++) throughput[k] /= p;
          }
          state = rng(state);
          const rx = unit(state) * 2 - 1;
          state = rng(state);
          const ry = unit(state) * 2 - 1;
          state = rng(state);
          const rz = unit(state) * 2 - 1;
          let hemi = norm([rx, ry, rz]);
          if (dot(hemi, h.normal) < 0) hemi = hemi.map((v) => -v);
          origin = [
            h.point[0] + h.normal[0] * EPS,
            h.point[1] + h.normal[1] * EPS,
            h.point[2] + h.normal[2] * EPS,
          ];
          direction = hemi;
        }
        for (let k = 0; k < 3; k++) sum[k] += radiance[k];
      }
      const off = pixel * 4;
      framebuffer[off] = tone(sum[0] / spp);
      framebuffer[off + 1] = tone(sum[1] / spp);
      framebuffer[off + 2] = tone(sum[2] / spp);
      framebuffer[off + 3] = 255;
    }
  }
  return framebuffer;
}
