typedef unsigned char u8;
typedef unsigned int u32;
typedef int i32;
#define MAXF 4096
#define MAXV 4096
#define HEADER_WORDS 20
static u8 input_data[120000], output_data[200000];
static i32 verts[MAXV * 3], faces[MAXF * 3], selected[MAXF * 3], simpverts[MAXV * 3],
    remap[MAXV];
static i32 vcount, fcount, removed, flipped, vertex_weld_comparisons, unique_edges,
    simplification_weld_comparisons, clean_edge_comparisons, simplified_edge_comparisons;
static u32 read_u32(const u8 *p) {
  return (u32)p[0] | ((u32)p[1] << 8) | ((u32)p[2] << 16) | ((u32)p[3] << 24);
}
static float read_f32(const u8 *p) {
  union {
    u32 u;
    float f;
  } x;
  x.u = read_u32(p);
  return x.f;
}
static i32 quant(float x) {
  if (x != x || x > 100000.0f || x < -100000.0f) return 0x7fffffff;
  float product = x * 10000.0f;
  float adjusted = product + (product < 0.0f ? -0.5f : 0.5f);
  return (i32)adjusted;
}
static void write_i32(u8 *p, i32 x) {
  u32 v = (u32)x;
  p[0] = v;
  p[1] = v >> 8;
  p[2] = v >> 16;
  p[3] = v >> 24;
}
static i32 vertex(i32 x, i32 y, i32 z) {
  for (i32 i = 0; i < vcount; i++) {
    vertex_weld_comparisons++;
    if (verts[i * 3] == x && verts[i * 3 + 1] == y && verts[i * 3 + 2] == z) return i;
  }
  if (vcount >= MAXV) return -1;
  verts[vcount * 3] = x;
  verts[vcount * 3 + 1] = y;
  verts[vcount * 3 + 2] = z;
  return vcount++;
}
static int same_edge(i32 a, i32 b, i32 c, i32 d) {
  return (a == c && b == d) || (a == d && b == c);
}
__attribute__((export_name("input_ptr"))) i32 input_ptr() { return (i32)input_data; }
__attribute__((export_name("output_ptr"))) i32 output_ptr() { return (i32)output_data; }
__attribute__((export_name("run"))) i32 run(i32 len) {
  u8 *in = input_data;
  u8 *out = output_data;
  if (len < 84) return -1;
  i32 n = (i32)read_u32(in + 80);
  if (n < 1 || n > MAXF || len != 84 + n * 50) return -2;
  vcount = fcount = removed = flipped = vertex_weld_comparisons = unique_edges = 0;
  simplification_weld_comparisons = clean_edge_comparisons = simplified_edge_comparisons = 0;
  for (i32 f = 0; f < n; f++) {
    u8 *p = in + 84 + f * 50 + 12;
    i32 id[3];
    for (i32 j = 0; j < 3; j++) {
      i32 x = quant(read_f32(p + j * 12));
      i32 y = quant(read_f32(p + j * 12 + 4));
      i32 z = quant(read_f32(p + j * 12 + 8));
      if (x == 0x7fffffff || y == 0x7fffffff || z == 0x7fffffff) return -3;
      id[j] = vertex(x, y, z);
      if (id[j] < 0) return -4;
    }
    if (id[0] == id[1] || id[1] == id[2] || id[0] == id[2]) {
      removed++;
      continue;
    }
    i32 ax = verts[id[0] * 3], ay = verts[id[0] * 3 + 1], bx = verts[id[1] * 3],
        by = verts[id[1] * 3 + 1], cx = verts[id[2] * 3], cy = verts[id[2] * 3 + 1];
    long long nz = (long long)(bx - ax) * (cy - ay) - (long long)(by - ay) * (cx - ax);
    if (nz == 0) {
      removed++;
      continue;
    }
    if (nz < 0) {
      i32 t = id[1];
      id[1] = id[2];
      id[2] = t;
      flipped++;
    }
    faces[fcount * 3] = id[0];
    faces[fcount * 3 + 1] = id[1];
    faces[fcount * 3 + 2] = id[2];
    fcount++;
  }
  if (fcount & 1) return -5;
  for (i32 i = 0; i < fcount; i++) {
    for (i32 e = 0; e < 3; e++) {
      i32 a = faces[i * 3 + e], b = faces[i * 3 + (e + 1) % 3], incidence = 0;
      for (i32 j = 0; j < fcount; j++) {
        for (i32 q = 0; q < 3; q++) {
          clean_edge_comparisons++;
          if (same_edge(a, b, faces[j * 3 + q], faces[j * 3 + (q + 1) % 3])) incidence++;
        }
      }
      if (incidence > 2) return -6;
    }
  }
  i32 sv = 0;
  for (i32 i = 0; i < vcount; i++) {
    i32 x = verts[i * 3], unit = x / 10000;
    if (unit < 0) unit = -unit;
    if (unit & 1) x -= 10000;
    i32 found = -1;
    for (i32 j = 0; j < sv; j++) {
      simplification_weld_comparisons++;
      if (simpverts[j * 3] == x && simpverts[j * 3 + 1] == verts[i * 3 + 1] &&
          simpverts[j * 3 + 2] == verts[i * 3 + 2]) {
        found = j;
        break;
      }
    }
    if (found < 0) {
      found = sv;
      simpverts[sv * 3] = x;
      simpverts[sv * 3 + 1] = verts[i * 3 + 1];
      simpverts[sv * 3 + 2] = verts[i * 3 + 2];
      sv++;
    }
    remap[i] = found;
  }
  i32 target = fcount / 2, sc = 0;
  for (i32 i = 0; i < fcount; i++) {
    i32 a = remap[faces[i * 3]], b = remap[faces[i * 3 + 1]], c = remap[faces[i * 3 + 2]];
    if (a != b && b != c && a != c) {
      selected[sc * 3] = a;
      selected[sc * 3 + 1] = b;
      selected[sc * 3 + 2] = c;
      sc++;
    }
  }
  if (sc != target) return -7;
  unique_edges = 0;
  for (i32 i = 0; i < sc; i++) {
    for (i32 e = 0; e < 3; e++) {
      i32 a = selected[i * 3 + e], b = selected[i * 3 + (e + 1) % 3], seen = 0,
          incidence = 0;
      for (i32 j = 0; j < sc; j++) {
        for (i32 q = 0; q < 3; q++) {
          simplified_edge_comparisons++;
          if (same_edge(a, b, selected[j * 3 + q], selected[j * 3 + (q + 1) % 3])) {
            incidence++;
            if (j < i || (j == i && q < e)) seen = 1;
          }
        }
      }
      if (incidence > 2) return -8;
      if (!seen) unique_edges++;
    }
  }
  long long volume6 = 0;
  for (i32 i = 0; i < sc; i++) {
    i32 a = selected[i * 3], b = selected[i * 3 + 1], c = selected[i * 3 + 2];
    long long ax = simpverts[a * 3], ay = simpverts[a * 3 + 1], az = simpverts[a * 3 + 2],
              bx = simpverts[b * 3], by = simpverts[b * 3 + 1], bz = simpverts[b * 3 + 2],
              cx = simpverts[c * 3], cy = simpverts[c * 3 + 1], cz = simpverts[c * 3 + 2];
    volume6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) +
               az * (bx * cy - by * cx);
  }
  if (volume6 != 0) return -9;
  i32 header[HEADER_WORDS] = {
      0x4d455348, 2, n, vcount, fcount, target, removed, flipped, n * 3, unique_edges,
      sc, sv, (i32)volume6, sc, vertex_weld_comparisons, simplification_weld_comparisons,
      clean_edge_comparisons, simplified_edge_comparisons, 0, HEADER_WORDS};
  for (i32 i = 0; i < HEADER_WORDS; i++) write_i32(out + i * 4, header[i]);
  i32 off = HEADER_WORDS * 4;
  for (i32 i = 0; i < sv * 3; i++, off += 4) write_i32(out + off, simpverts[i]);
  for (i32 i = 0; i < sc * 3; i++, off += 4) write_i32(out + off, selected[i]);
  return off;
}
