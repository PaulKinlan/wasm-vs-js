// Dart/WasmGC mirror of the frozen cad-mesh-repair engine — bit-identical to
// engine.js repairMeshJavaScript (strict-f32 quantization via fround, matching
// the C/Rust f32 arithmetic). ABI: meshRepair(input, outWords) -> word count.
//
// Dart has no f32 primitive, so every quantization multiply/add is rounded
// with Math.fround (f64 -> f32) exactly like the JS oracle's Math.fround chain
// and the C f32 arithmetic. Integer arithmetic is exact 64-bit, matching the
// C long long volume.

import 'dart:js_interop';
import 'dart:typed_data';

@JS('Math.fround')
external double fround(double x);

const int MAXF = 4096;
const int MAXV = 4096;
const int HEADER_WORDS = 20;

@JSExport()
class MeshRepairKernels {
  @JSExport('meshRepair')
  int meshRepair(JSUint8Array inputJs, JSInt32Array outJs) {
    final input = inputJs.toDart; // zero-copy Uint8List view on Wasm
    final outWords = outJs.toDart; // zero-copy Int32List view
    if (input.length < 84) return -1;
    final n = _readU32(input, 80);
    if (n < 1 || n > MAXF || input.length != 84 + n * 50) return -2;
    final verts = Int32List(MAXV * 3);
    final faces = Int32List(MAXF * 3);
    final selected = Int32List(MAXF * 3);
    final simpverts = Int32List(MAXV * 3);
    final remap = Int32List(MAXV);
    int vcount = 0, fcount = 0, removed = 0, flipped = 0;
    int vertexWeldComparisons = 0, simplificationWeldComparisons = 0;
    int cleanEdgeComparisons = 0, simplifiedEdgeComparisons = 0, uniqueEdges = 0;

    int vertex(int x, int y, int z) {
      for (int i = 0; i < vcount; i++) {
        vertexWeldComparisons++;
        if (verts[i * 3] == x && verts[i * 3 + 1] == y && verts[i * 3 + 2] == z) return i;
      }
      if (vcount >= MAXV) return -1;
      verts[vcount * 3] = x;
      verts[vcount * 3 + 1] = y;
      verts[vcount * 3 + 2] = z;
      return vcount++;
    }

    bool sameEdge(int a, int b, int c, int d) {
      return (a == c && b == d) || (a == d && b == c);
    }

    final id = Int32List(3);
    for (int f = 0; f < n; f++) {
      final at = 84 + f * 50 + 12;
      for (int p = 0; p < 3; p++) {
        final x = _quant(_readF32(input, at + p * 12));
        final y = _quant(_readF32(input, at + p * 12 + 4));
        final z = _quant(_readF32(input, at + p * 12 + 8));
        final vid = vertex(x, y, z);
        if (vid < 0) return -3;
        id[p] = vid;
      }
      if (id[0] == id[1] || id[1] == id[2] || id[0] == id[2]) {
        removed++;
        continue;
      }
      final ax = verts[id[0] * 3], ay = verts[id[0] * 3 + 1];
      final bx = verts[id[1] * 3], by = verts[id[1] * 3 + 1];
      final cx = verts[id[2] * 3], cy = verts[id[2] * 3 + 1];
      final nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (nz == 0) {
        removed++;
        continue;
      }
      if (nz < 0) {
        final sw = id[1];
        id[1] = id[2];
        id[2] = sw;
        flipped++;
      }
      if (fcount >= MAXF) return -4;
      faces[fcount * 3] = id[0];
      faces[fcount * 3 + 1] = id[1];
      faces[fcount * 3 + 2] = id[2];
      fcount++;
    }
    final cleanFaceCount = fcount;
    if (cleanFaceCount % 2 != 0) return -5;
    for (int i = 0; i < cleanFaceCount; i++) {
      for (int e = 0; e < 3; e++) {
        final a = faces[i * 3 + e], b = faces[i * 3 + (e + 1) % 3];
        int incidence = 0;
        for (int j = 0; j < cleanFaceCount; j++) {
          for (int q = 0; q < 3; q++) {
            cleanEdgeComparisons++;
            if (sameEdge(a, b, faces[j * 3 + q], faces[j * 3 + (q + 1) % 3])) incidence++;
          }
        }
        if (incidence > 2) return -6;
      }
    }
    int sv = 0;
    for (int i = 0; i < vcount; i++) {
      final ox = verts[i * 3];
      final unit = ox ~/ 10000;
      final x = (unit & 1) != 0 ? ox - 10000 : ox;
      final y = verts[i * 3 + 1], z = verts[i * 3 + 2];
      int next = -1;
      for (int c = 0; c < sv; c++) {
        simplificationWeldComparisons++;
        if (simpverts[c * 3] == x && simpverts[c * 3 + 1] == y && simpverts[c * 3 + 2] == z) {
          next = c;
          break;
        }
      }
      if (next < 0) {
        next = sv;
        simpverts[next * 3] = x;
        simpverts[next * 3 + 1] = y;
        simpverts[next * 3 + 2] = z;
        sv++;
      }
      remap[i] = next;
    }
    final target = cleanFaceCount ~/ 2;
    int sc = 0;
    for (int i = 0; i < cleanFaceCount; i++) {
      final a = remap[faces[i * 3]], b = remap[faces[i * 3 + 1]], c = remap[faces[i * 3 + 2]];
      if (a != b && b != c && a != c) {
        selected[sc * 3] = a;
        selected[sc * 3 + 1] = b;
        selected[sc * 3 + 2] = c;
        sc++;
      }
    }
    if (sc != target) return -7;
    for (int i = 0; i < sc; i++) {
      for (int e = 0; e < 3; e++) {
        final a = selected[i * 3 + e], b = selected[i * 3 + (e + 1) % 3];
        int incidence = 0;
        bool seen = false;
        for (int j = 0; j < sc; j++) {
          for (int q = 0; q < 3; q++) {
            simplifiedEdgeComparisons++;
            if (sameEdge(a, b, selected[j * 3 + q], selected[j * 3 + (q + 1) % 3])) {
              incidence++;
              if (j < i || (j == i && q < e)) seen = true;
            }
          }
        }
        if (incidence > 2) return -8;
        if (!seen) uniqueEdges++;
      }
    }
    int volume6 = 0;
    for (int i = 0; i < sc; i++) {
      final a = selected[i * 3], b = selected[i * 3 + 1], c = selected[i * 3 + 2];
      final ax = simpverts[a * 3], ay = simpverts[a * 3 + 1], az = simpverts[a * 3 + 2];
      final bx = simpverts[b * 3], by = simpverts[b * 3 + 1], bz = simpverts[b * 3 + 2];
      final cx = simpverts[c * 3], cy = simpverts[c * 3 + 1], cz = simpverts[c * 3 + 2];
      volume6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    }
    if (volume6 != 0) return -9;
    final header = <int>[
      0x4d455348, 2, n, vcount, fcount, target, removed, flipped, n * 3, uniqueEdges, sc, sv,
      volume6, sc, vertexWeldComparisons, simplificationWeldComparisons, cleanEdgeComparisons,
      simplifiedEdgeComparisons, 0, HEADER_WORDS,
    ];
    for (int i = 0; i < HEADER_WORDS; i++) outWords[i] = header[i];
    int off = HEADER_WORDS;
    for (int i = 0; i < sv * 3; i++, off++) outWords[off] = simpverts[i];
    for (int i = 0; i < sc * 3; i++, off++) outWords[off] = selected[i];
    return off;
  }

  int _readU32(Uint8List p, int at) {
    return p[at] | (p[at + 1] << 8) | (p[at + 2] << 16) | (p[at + 3] << 24);
  }

  double _readF32(Uint8List p, int at) {
    return ByteData.sublistView(p).getFloat32(at, Endian.little);
  }

  int _quant(double x) {
    if (x != x || x > 100000.0 || x < -100000.0) return 0x7fffffff;
    final product = fround(x * 10000.0);
    final adjusted = fround(product + (product < 0 ? -0.5 : 0.5));
    return adjusted.truncate();
  }
}

void main() {
  dartKernels = createJSInteropWrapper(MeshRepairKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
