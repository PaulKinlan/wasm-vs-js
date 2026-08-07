// path_tracer.dart — Dart/WasmGC mirror of the frozen graphics-cpu-path-tracer
// engine, bit-identical framebuffer + 9 counters to the JS oracle's
// renderJavaScript (strict f32 via Math.fround per op, exactly like the C/Rust
// f32 arithmetic). ABI: render(width, height, spp, framebufferOut, countersOut).
import 'dart:js_interop';
import 'dart:typed_data';

@JS('Math.fround')
external double fround(double x);

@JS('Math.sqrt')
external double fsqrt(double x);

const int MAX_WIDTH = 512;
const int MAX_HEIGHT = 512;
const int MAX_SPP = 64;
const int MAX_BOUNCES = 4;

double F(double x) => fround(x);

class Vec3 {
  double x, y, z;
  Vec3(this.x, this.y, this.z);
}

@JSExport()
class PathTracerKernels {
  @JSExport('render')
  int render(
    JSAny widthJs,
    JSAny heightJs,
    JSAny sppJs,
    JSUint8Array framebufferJs,
    JSInt32Array countersJs,
  ) {
    final width = (widthJs as JSNumber).toDartInt;
    final height = (heightJs as JSNumber).toDartInt;
    final spp = (sppJs as JSNumber).toDartInt;
    final fb = framebufferJs.toDart; // zero-copy Uint8List view
    final ct = countersJs.toDart; // zero-copy Int32List view
    if (width < 1 || height < 1 || spp < 1 || width > MAX_WIDTH || height > MAX_HEIGHT || spp > MAX_SPP) {
      return 1;
    }
    for (int i = 0; i < 9; i++) {
      ct[i] = 0;
    }
    ct[4] = width * height * spp;
    ct[6] = 0;
    ct[8] = 1;
    final spheres = _Spheres.list;
    final nodes = _Nodes.list;
    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        final pixel = y * width + x;
        double ar = 0.0, ag = 0.0, ab = 0.0;
        for (int sample = 0; sample < spp; sample++) {
          int state = (0x6d2b79f5 ^ ((pixel * 0x9e3779b9) & 0xffffffff) ^ ((sample * 0x85ebca6b) & 0xffffffff)) & 0xffffffff;
          state = _rng(state);
          final jx = _unit(state);
          state = _rng(state);
          final jy = _unit(state);
          ct[5] += 2;
          final pixelX = F((x + jx) / width);
          final pixelY = F((y + jy) / height);
          final sxCentered = F(F(pixelX * F(2.0)) - F(1.0));
          final syCentered = F(F(1.0) - F(pixelY * F(2.0)));
          final sx = F(sxCentered * F(1.7));
          final sy = F(syCentered * F(1.7));
          var origin = Vec3(F(0.0), F(0.0), F(4.5));
          var direction = _norm(Vec3(sx, sy, F(-4.5)));
          var throughput = Vec3(F(1.0), F(1.0), F(1.0));
          var radiance = Vec3(F(0.0), F(0.0), F(0.0));
          ct[0] += 1;
          for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
            final hit = _intersect(origin, direction, spheres, nodes, ct);
            if (hit.index < 0) {
              break;
            }
            ct[1] += 1;
            final s = spheres[hit.index];
            if (s.emit > 0.0) {
              radiance.x = F(radiance.x + F(throughput.x * s.emit));
              radiance.y = F(radiance.y + F(throughput.y * s.emit));
              radiance.z = F(radiance.z + F(throughput.z * s.emit));
              break;
            }
            throughput.x = F(throughput.x * s.cr);
            throughput.y = F(throughput.y * s.cg);
            throughput.z = F(throughput.z * s.cb);
            if (bounce >= 2) {
              final prob = _maxf(F(0.1), _minf(F(0.95), _maxf(throughput.x, _maxf(throughput.y, throughput.z))));
              state = _rng(state);
              ct[5] += 1;
              if (_unit(state) > prob) {
                break;
              }
              throughput.x = F(throughput.x / prob);
              throughput.y = F(throughput.y / prob);
              throughput.z = F(throughput.z / prob);
            }
            state = _rng(state);
            final rx = F(F(_unit(state) * F(2.0)) - F(1.0));
            state = _rng(state);
            final ry = F(F(_unit(state) * F(2.0)) - F(1.0));
            state = _rng(state);
            final rz = F(F(_unit(state) * F(2.0)) - F(1.0));
            ct[5] += 3;
            var hemi = _norm(Vec3(rx, ry, rz));
            if (_dot(hemi, hit.n) < 0.0) {
              hemi = _vmul(hemi, F(-1.0));
            }
            origin = _vadd(hit.p, _vmul(hit.n, F(0.001)));
            direction = hemi;
            ct[0] += 1;
          }
          ar += radiance.x;
          ag += radiance.y;
          ab += radiance.z;
        }
        final off = pixel * 4;
        fb[off] = _tone(F(ar / spp));
        fb[off + 1] = _tone(F(ag / spp));
        fb[off + 2] = _tone(F(ab / spp));
        fb[off + 3] = 255;
        ct[7] += 4;
      }
    }
    return 0;
  }
}

int _rng(int x) {
  x = (x ^ (x << 13)) & 0xffffffff;
  x = (x ^ (x >>> 17)) & 0xffffffff;
  x = (x ^ (x << 5)) & 0xffffffff;
  return x;
}

double _unit(int x) => F((x >> 8) / 16777216.0);

double _minf(double a, double b) => a < b ? a : b;
double _maxf(double a, double b) => a > b ? a : b;
Vec3 _vadd(Vec3 a, Vec3 b) => Vec3(F(a.x + b.x), F(a.y + b.y), F(a.z + b.z));
Vec3 _vmul(Vec3 a, double s) => Vec3(F(a.x * s), F(a.y * s), F(a.z * s));
double _dot(Vec3 a, Vec3 b) => F(F(a.x * b.x) + F(F(a.y * b.y) + F(a.z * b.z)));
Vec3 _norm(Vec3 a) {
  final d = _dot(a, a);
  if (d == 0.0) {
    return Vec3(F(0.0), F(1.0), F(0.0));
  }
  final l = F(fsqrt(d));
  return Vec3(F(a.x / l), F(a.y / l), F(a.z / l));
}

_Hit _intersect(Vec3 o, Vec3 d, List<_Sphere> spheres, List<_Node> nodes, Int32List ct) {
  final stack = List<int>.filled(32, 0);
  var sp = 0;
  var bestIndex = -1;
  var best = 1.0e30;
  stack[sp++] = 0;
  while (sp > 0) {
    final ni = stack[--sp];
    ct[2] += 1;
    final n = nodes[ni];
    if (!_hitBox(o, d, n, best)) {
      continue;
    }
    if (n.primitive >= 0) {
      ct[3] += 1;
      final s = spheres[n.primitive];
      final oc = Vec3(F(o.x - s.cx), F(o.y - s.cy), F(o.z - s.cz));
      final half = _dot(oc, d);
      final radiusSquared = F(s.r * s.r);
      final originSquared = _dot(oc, oc);
      final c = F(originSquared - radiusSquared);
      final halfSquared = F(half * half);
      final disc = F(halfSquared - c);
      if (disc < 0.0) {
        continue;
      }
      final root = F(fsqrt(disc));
      var t = F(-half - root);
      if (t <= F(0.001)) {
        t = F(-half + root);
      }
      if (t > F(0.001) && (t < best || (t == best && n.primitive < bestIndex))) {
        best = t;
        bestIndex = n.primitive;
      }
    } else {
      stack[sp++] = n.right;
      stack[sp++] = n.left;
    }
  }
  if (bestIndex < 0) {
    return _Hit(-1, Vec3(0, 0, 0), Vec3(0, 0, 0));
  }
  final p = _vadd(o, _vmul(d, best));
  final s = spheres[bestIndex];
  final n = _norm(Vec3(F(p.x - s.cx), F(p.y - s.cy), F(p.z - s.cz)));
  return _Hit(bestIndex, p, n);
}

bool _hitBox(Vec3 o, Vec3 d, _Node n, double tmax) {
  var lo = F(0.001);
  var hi = tmax;
  final oo = [o.x, o.y, o.z];
  final dd = [d.x, d.y, d.z];
  final mn = [n.minx, n.miny, n.minz];
  final mx = [n.maxx, n.maxy, n.maxz];
  for (int a = 0; a < 3; a++) {
    final inv = F(1.0 / dd[a]);
    final nearDelta = F(mn[a] - oo[a]);
    final farDelta = F(mx[a] - oo[a]);
    var t0 = F(nearDelta * inv);
    var t1 = F(farDelta * inv);
    if (inv < 0.0) {
      final q = t0;
      t0 = t1;
      t1 = q;
    }
    lo = _maxf(lo, t0);
    hi = _minf(hi, t1);
    if (hi < lo) {
      return false;
    }
  }
  return true;
}

int _tone(double value) {
  final denominator = F(F(1.0) + value);
  final mapped = F(value / denominator);
  final clamped = _maxf(F(0.0), _minf(F(1.0), mapped));
  final gamma = F(fsqrt(clamped));
  final scaled = F(gamma * F(255.0));
  final rounded = F(scaled + F(0.5));
  var q = rounded.toInt();
  if (q < 0) {
    q = 0;
  }
  if (q > 255) {
    q = 255;
  }
  return q;
}

class _Sphere {
  final double cx, cy, cz, r, cr, cg, cb, emit;
  _Sphere(this.cx, this.cy, this.cz, this.r, this.cr, this.cg, this.cb, this.emit);
}

class _Node {
  final int left, right, primitive;
  final double minx, miny, minz, maxx, maxy, maxz;
  _Node(this.left, this.right, this.primitive, this.minx, this.miny, this.minz, this.maxx, this.maxy, this.maxz);
}

class _Hit {
  final int index;
  final Vec3 p, n;
  _Hit(this.index, this.p, this.n);
}

class _Spheres {
  static final List<_Sphere> list = [
    _Sphere(F(-0.0), F(-1001.0), F(0.0), F(1000.0), F(0.72), F(0.72), F(0.72), F(0.0)),
    _Sphere(F(-1001.0), F(0.0), F(0.0), F(1000.0), F(0.72), F(0.12), F(0.12), F(0.0)),
    _Sphere(F(1001.0), F(0.0), F(0.0), F(1000.0), F(0.12), F(0.72), F(0.18), F(0.0)),
    _Sphere(F(0.0), F(0.0), F(-1001.0), F(1000.0), F(0.72), F(0.72), F(0.72), F(0.0)),
    _Sphere(F(-0.6), F(-0.45), F(0.3), F(0.55), F(0.75), F(0.68), F(0.22), F(0.0)),
    _Sphere(F(0.65), F(-0.55), F(-0.2), F(0.45), F(0.2), F(0.38), F(0.82), F(0.0)),
    _Sphere(F(0.0), F(2.3), F(0.0), F(0.5), F(1.0), F(1.0), F(1.0), F(8.0)),
  ];
}

class _Nodes {
  static final List<_Node> list = [
    _Node(1, 2, -1, F(-2001.0), F(-2001.0), F(-2001.0), F(2001.0), F(1000.0), F(1000.0)),
    _Node(3, 4, -1, F(-2001.0), F(-2001.0), F(-2001.0), F(2001.0), F(1000.0), F(1000.0)),
    _Node(5, 6, -1, F(-1.1500001), F(-1.0), F(-0.65), F(1.0999999), F(2.8), F(0.85)),
    _Node(7, 8, -1, F(-1000.0), F(-2001.0), F(-2001.0), F(1000.0), F(1000.0), F(1000.0)),
    _Node(9, 10, -1, F(-2001.0), F(-1000.0), F(-1000.0), F(2001.0), F(1000.0), F(1000.0)),
    _Node(-1, -1, 4, F(-1.1500001), F(-1.0), F(-0.25), F(-0.050000012), F(0.100000024), F(0.85)),
    _Node(11, 12, -1, F(-0.5), F(-1.0), F(-0.65), F(1.0999999), F(2.8), F(0.5)),
    _Node(-1, -1, 0, F(-1000.0), F(-2001.0), F(-1000.0), F(1000.0), F(-1.0), F(1000.0)),
    _Node(-1, -1, 3, F(-1000.0), F(-1000.0), F(-2001.0), F(1000.0), F(1000.0), F(-1.0)),
    _Node(-1, -1, 1, F(-2001.0), F(-1000.0), F(-1000.0), F(-1.0), F(1000.0), F(1000.0)),
    _Node(-1, -1, 2, F(1.0), F(-1000.0), F(-1000.0), F(2001.0), F(1000.0), F(1000.0)),
    _Node(-1, -1, 5, F(0.19999999), F(-1.0), F(-0.65), F(1.0999999), F(-0.100000024), F(0.24999999)),
    _Node(-1, -1, 6, F(-0.5), F(1.8), F(-0.5), F(0.5), F(2.8), F(0.5)),
  ];
}

void main() {
  dartKernels = createJSInteropWrapper(PathTracerKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
