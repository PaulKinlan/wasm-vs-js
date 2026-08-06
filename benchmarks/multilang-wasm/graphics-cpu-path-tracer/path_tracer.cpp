// path_tracer.cpp — C++ mirror of the frozen graphics-cpu-path-tracer engine
// (benchmarks/base-v1/graphics-cpu-path-tracer/path-tracer.c), bit-identical
// output (framebuffer bytes + 9 counters) to the C kernel and the JS oracle.
#include <stdint.h>

#define MAX_WIDTH 512u
#define MAX_HEIGHT 512u
#define MAX_SPP 64u
#define MAX_BOUNCES 4u
#define EPSILON 0.001f
#define SEED 0x6d2b79f5u

struct Vec3 { float x, y, z; };
struct Sphere { float cx, cy, cz, r, cr, cg, cb, emit; };
struct Node { int left, right, primitive; float minx, miny, minz, maxx, maxy, maxz; };

static uint8_t framebuffer[MAX_WIDTH * MAX_HEIGHT * 4];
static uint32_t counters[9];
static const Sphere spheres[7] = {
  {0.0f, -1001.0f, 0.0f, 1000.0f, 0.72f, 0.72f, 0.72f, 0.0f},
  {-1001.0f, 0.0f, 0.0f, 1000.0f, 0.72f, 0.12f, 0.12f, 0.0f},
  {1001.0f, 0.0f, 0.0f, 1000.0f, 0.12f, 0.72f, 0.18f, 0.0f},
  {0.0f, 0.0f, -1001.0f, 1000.0f, 0.72f, 0.72f, 0.72f, 0.0f},
  {-0.6f, -0.45f, 0.3f, 0.55f, 0.75f, 0.68f, 0.22f, 0.0f},
  {0.65f, -0.55f, -0.2f, 0.45f, 0.2f, 0.38f, 0.82f, 0.0f},
  {0.0f, 2.3f, 0.0f, 0.5f, 1.0f, 1.0f, 1.0f, 8.0f},
};
static const Node nodes[13] = {
  {1, 2, -1, -2001, -2001, -2001, 2001, 1000, 1000},
  {3, 4, -1, -2001, -2001, -2001, 2001, 1000, 1000},
  {5, 6, -1, -0x1.266668p+0f, -1, -0x1.4cccccp-1f, 0x1.199998p+0f, 0x1.666666p+1f, 0x1.b33334p-1f},
  {7, 8, -1, -1000, -2001, -2001, 1000, 1000, 1000},
  {9, 10, -1, -2001, -1000, -1000, 2001, 1000, 1000},
  {-1, -1, 4, -0x1.266668p+0f, -1, -0.25f, -0x1.9999ap-5f, 0x1.9999ap-4f, 0x1.b33334p-1f},
  {11, 12, -1, -0.5f, -1, -0x1.4cccccp-1f, 0x1.199998p+0f, 0x1.666666p+1f, 0.5f},
  {-1, -1, 0, -1000, -2001, -1000, 1000, -1, 1000},
  {-1, -1, 3, -1000, -1000, -2001, 1000, 1000, -1},
  {-1, -1, 1, -2001, -1000, -1000, -1, 1000, 1000},
  {-1, -1, 2, 1, -1000, -1000, 2001, 1000, 1000},
  {-1, -1, 5, 0x1.999998p-3f, -1, -0x1.4cccccp-1f, 0x1.199998p+0f, -0x1.9999ap-4f, 0x1.fffffep-3f},
  {-1, -1, 6, -0.5f, 0x1.ccccccp+0f, -0.5f, 0.5f, 0x1.666666p+1f, 0.5f},
};

static float minf(float a, float b) { return a < b ? a : b; }
static float maxf(float a, float b) { return a > b ? a : b; }
static Vec3 vadd(Vec3 a, Vec3 b) { return {a.x + b.x, a.y + b.y, a.z + b.z}; }
static Vec3 vsub(Vec3 a, Vec3 b) { return {a.x - b.x, a.y - b.y, a.z - b.z}; }
static Vec3 vmul(Vec3 a, float s) { return {a.x * s, a.y * s, a.z * s}; }
static float dot(Vec3 a, Vec3 b) { return a.x * b.x + (a.y * b.y + a.z * b.z); }
static Vec3 norm(Vec3 a) {
  float d = dot(a, a);
  if (d == 0.0f) return {0, 1, 0};
  float l = __builtin_sqrtf(d);
  return {a.x / l, a.y / l, a.z / l};
}
static uint32_t rng(uint32_t x) { x ^= x << 13; x ^= x >> 17; x ^= x << 5; return x; }
static float unit(uint32_t x) { return (float)(x >> 8) * (1.0f / 16777216.0f); }
static uint32_t seed_for(uint32_t pixel, uint32_t sample) {
  return SEED ^ (pixel * 0x9e3779b9u) ^ (sample * 0x85ebca6bu);
}

static int hit_box(Vec3 o, Vec3 d, const Node* n, float tmax) {
  float lo = EPSILON, hi = tmax;
  float oo[3] = {o.x, o.y, o.z}, dd[3] = {d.x, d.y, d.z};
  float mn[3] = {n->minx, n->miny, n->minz}, mx[3] = {n->maxx, n->maxy, n->maxz};
  for (int a = 0; a < 3; a++) {
    float inv = 1.0f / dd[a];
    float near_delta = mn[a] - oo[a], far_delta = mx[a] - oo[a];
    float t0 = near_delta * inv, t1 = far_delta * inv;
    if (inv < 0) { float q = t0; t0 = t1; t1 = q; }
    lo = maxf(lo, t0); hi = minf(hi, t1);
    if (hi < lo) return 0;
  }
  return 1;
}
static int intersect(Vec3 o, Vec3 d, float* out_t, Vec3* out_p, Vec3* out_n) {
  int stack[32], sp = 0, best_index = -1;
  float best = 1.0e30f;
  stack[sp++] = 0;
  while (sp) {
    int ni = stack[--sp];
    counters[2]++;
    const Node* n = &nodes[ni];
    if (!hit_box(o, d, n, best)) continue;
    if (n->primitive >= 0) {
      counters[3]++;
      const Sphere* s = &spheres[n->primitive];
      Vec3 oc = {o.x - s->cx, o.y - s->cy, o.z - s->cz};
      float half = dot(oc, d);
      float radius_squared = s->r * s->r;
      float origin_squared = dot(oc, oc);
      float c = origin_squared - radius_squared;
      float half_squared = half * half;
      float disc = half_squared - c;
      if (disc < 0) continue;
      float root = __builtin_sqrtf(disc), t = -half - root;
      if (t <= EPSILON) t = -half + root;
      if (t > EPSILON && (t < best || (t == best && n->primitive < best_index))) {
        best = t;
        best_index = n->primitive;
      }
    } else {
      stack[sp++] = n->right;
      stack[sp++] = n->left;
    }
  }
  if (best_index < 0) return -1;
  *out_t = best;
  *out_p = vadd(o, vmul(d, best));
  const Sphere* s = &spheres[best_index];
  *out_n = norm((Vec3){out_p->x - s->cx, out_p->y - s->cy, out_p->z - s->cz});
  return best_index;
}
static uint8_t tone(float value) {
  float denominator = 1.0f + value;
  float mapped = value / denominator;
  float clamped = maxf(0.0f, minf(1.0f, mapped));
  float gamma = __builtin_sqrtf(clamped);
  float scaled = gamma * 255.0f;
  float rounded = scaled + 0.5f;
  int q = (int)rounded;
  if (q < 0) q = 0;
  if (q > 255) q = 255;
  return (uint8_t)q;
}

extern "C" {
__attribute__((visibility("default"))) uint32_t framebuffer_ptr(void) {
  return (uint32_t)(uintptr_t)framebuffer;
}
__attribute__((visibility("default"))) uint32_t counters_ptr(void) {
  return (uint32_t)(uintptr_t)counters;
}
__attribute__((visibility("default"))) int render(uint32_t width, uint32_t height, uint32_t spp) {
  if (width < 1 || height < 1 || spp < 1 || width > MAX_WIDTH || height > MAX_HEIGHT || spp > MAX_SPP) return 1;
  for (int i = 0; i < 9; i++) counters[i] = 0;
  counters[4] = width * height * spp;
  counters[6] = 0;
  counters[8] = 1;
  for (uint32_t y = 0; y < height; y++)
    for (uint32_t x = 0; x < width; x++) {
      uint32_t pixel = y * width + x;
      float ar = 0, ag = 0, ab = 0;
      for (uint32_t sample = 0; sample < spp; sample++) {
        uint32_t state = seed_for(pixel, sample);
        state = rng(state);
        float jx = unit(state);
        state = rng(state);
        float jy = unit(state);
        counters[5] += 2;
        float pixel_x = ((float)x + jx) / (float)width;
        float pixel_y = ((float)y + jy) / (float)height;
        float sx_scale = pixel_x * 2.0f;
        float sy_scale = pixel_y * 2.0f;
        float sx_centered = sx_scale - 1.0f;
        float sy_centered = 1.0f - sy_scale;
        float sx = sx_centered * 1.7f;
        float sy = sy_centered * 1.7f;
        Vec3 origin = {0, 0, 4.5f};
        Vec3 direction = norm((Vec3){sx, sy, -4.5f});
        Vec3 throughput = {1, 1, 1};
        Vec3 radiance = {0, 0, 0};
        counters[0]++;
        for (uint32_t bounce = 0; bounce < MAX_BOUNCES; bounce++) {
          float t;
          Vec3 p, n;
          int index = intersect(origin, direction, &t, &p, &n);
          if (index < 0) break;
          counters[1]++;
          const Sphere* s = &spheres[index];
          if (s->emit > 0) {
            radiance.x += throughput.x * s->emit;
            radiance.y += throughput.y * s->emit;
            radiance.z += throughput.z * s->emit;
            break;
          }
          throughput.x *= s->cr;
          throughput.y *= s->cg;
          throughput.z *= s->cb;
          if (bounce >= 2) {
            float prob = maxf(0.1f, minf(0.95f, maxf(throughput.x, maxf(throughput.y, throughput.z))));
            state = rng(state);
            counters[5]++;
            if (unit(state) > prob) break;
            throughput.x /= prob;
            throughput.y /= prob;
            throughput.z /= prob;
          }
          state = rng(state);
          float rx = unit(state) * 2.0f - 1.0f;
          state = rng(state);
          float ry = unit(state) * 2.0f - 1.0f;
          state = rng(state);
          float rz = unit(state) * 2.0f - 1.0f;
          counters[5] += 3;
          Vec3 hemi = norm((Vec3){rx, ry, rz});
          if (dot(hemi, n) < 0) hemi = vmul(hemi, -1);
          origin = vadd(p, vmul(n, EPSILON));
          direction = hemi;
          counters[0]++;
        }
        ar += radiance.x;
        ag += radiance.y;
        ab += radiance.z;
      }
      uint32_t off = pixel * 4;
      framebuffer[off] = tone(ar / (float)spp);
      framebuffer[off + 1] = tone(ag / (float)spp);
      framebuffer[off + 2] = tone(ab / (float)spp);
      framebuffer[off + 3] = 255;
      counters[7] += 4;
    }
  return 0;
}
}
