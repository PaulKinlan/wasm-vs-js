// simulation-rigid-body-2d Dart WasmGC kernel — exact mirror of the C
// rigid_engine (and the engine.js oracle): 500-body 2D physics with SAT
// collision, joints, torque, quantized state, and checkpoints.
//
// DISCLOSURE: Dart's native arithmetic is f64; the C kernel computes in f32.
// To keep output bit-identical every arithmetic step is rounded back to f32
// with Math.fround (the same per-op emulation pattern as the ml-gemm and
// ml-dense-mlp Dart kernels). This is honest f32-emulation, so the Dart row
// carries the emulation cost, not a free pass.

import 'dart:js_interop';
import 'dart:typed_data';
import 'dart:math' as math;

const int kBodies = 500;
const int kJoints = 19;
const int kHeaderBytes = 96;
const int kBodyWords = 11;
const int kJointBytes = 32;
const int kMaxPairs = 8192;
const int kMaxCheckpoints = 6;
const int kStateValues = kBodies * 6;
const double kPI = 3.1415927410125732;
const double kTAU = 6.2831854820251465;

Float32List? _x, _y, _angle, _vx, _vy, _omega;
Float32List? _invMass, _invInertia, _halfX, _halfY, _torque;
Float32List? _cosine, _sine, _extentX, _extentY;
Uint32List? _jointA, _jointB;
Float32List? _localAx, _localAy, _localBx, _localBy, _jointRest, _jointStiffness;
Uint32List? _order, _pairA, _pairB;
Uint32List? _counters;
Float32List? _checkpoints;
Uint8List? _fixture;

// f32 rounding: dart2wasm stores Float32List elements with an f32 store, so
// writing a value into a Float32List element and reading it back performs the
// f32 rounding (the dart2wasm pattern used by the ml-gemm/ml-dense-mlp kernels).
Float32List _f32roundBuf = Float32List(1);
double _f32(double v) {
  _f32roundBuf[0] = v;
  return _f32roundBuf[0];
}

double _add(double a, double b) => _f32(a + b);
double _sub(double a, double b) => _f32(a - b);
double _mul(double a, double b) => _f32(a * b);
double _div(double a, double b) => _f32(a / b);
double _neg(double a) => _f32(-a);
double _absf(double a) => a < 0 ? _f32(-a) : a;
// sqrt is immune to double rounding (sqrt correctly rounded in f64 then
// rounded to f32 equals the f32.sqrt result), so math.sqrt + f32 rounding is
// bit-identical to the C kernel's __builtin_sqrtf.
double _sqrtf(double a) => _f32(math.sqrt(a));

double _wrap(double a) {
  while (a > kPI) {
    a = _sub(a, kTAU);
  }
  while (a < -kPI) {
    a = _add(a, kTAU);
  }
  return a;
}

double _sinApprox(double x) {
  x = _wrap(x);
  final x2 = _mul(x, x);
  return _add(x, _mul(_mul(x, x2),
      _add(_f32(-1.0 / 6.0), _mul(x2, _add(_f32(1.0 / 120.0), _mul(x2, _f32(-1.0 / 5040.0)))))));
}

double _cosApprox(double x) {
  x = _wrap(x);
  final x2 = _mul(x, x);
  return _add(1.0, _mul(x2,
      _add(_f32(-1.0 / 2.0), _mul(x2, _add(_f32(1.0 / 24.0), _mul(x2, _f32(-1.0 / 720.0)))))));
}

double _quantize(double a) {
  final s = _mul(a, 1000.0);
  final r = s < 0 ? (s - 0.5).truncateToDouble() : (s + 0.5).truncateToDouble();
  return _div(r, 1000.0);
}

double _cross(double ax, double ay, double bx, double by) => _sub(_mul(ax, by), _mul(ay, bx));

double _clampf(double v, double lo, double hi) =>
    v < lo ? lo : (v > hi ? hi : v);

int _u32(int o) =>
    _fixture![o] | (_fixture![o + 1] << 8) | (_fixture![o + 2] << 16) | (_fixture![o + 3] << 24);

double _f32at(int o) {
  final bits = _u32(o);
  // little-endian f32 bits -> double via a ByteData view
  final bytes = Uint8List(4)
    ..[0] = bits & 0xff
    ..[1] = (bits >> 8) & 0xff
    ..[2] = (bits >> 16) & 0xff
    ..[3] = (bits >> 24) & 0xff;
  return ByteData.sublistView(bytes).getFloat32(0, Endian.little);
}

@JSExport()
class RigidEngine {
  @JSExport('run')
  int run(JSUint8Array fixtureJs, int timesteps, int checkpointEvery) {
    final fixtureBytes = fixtureJs.toDart;
    _fixture = Uint8List.fromList(fixtureBytes);
    _ensureState();
    if (_u32(8) != 2 ||
        _u32(12) != kBodies ||
        _u32(16) > kJoints ||
        timesteps == 0 ||
        timesteps > 1800 ||
        checkpointEvery == 0 ||
        (timesteps + checkpointEvery - 1) ~/ checkpointEvery > kMaxCheckpoints) {
      return 1;
    }
    final jointCount = _u32(16);
    final velIters = _u32(24);
    final posIters = _u32(28);
    final torqueSteps = _u32(68);
    final dt = _f32at(40);
    final gravity = _f32at(44);
    final restitution = _f32at(48);
    final friction = _f32at(52);
    final linearDamping = _f32at(60);
    final angularDamping = _f32at(64);
    for (var i = 0; i < 13; i++) {
      _counters![i] = 0;
    }
    for (var i = 0; i < kBodies; i++) {
      final o = kHeaderBytes + i * kBodyWords * 4;
      _x![i] = _f32at(o);
      _y![i] = _f32at(o + 4);
      _angle![i] = _f32at(o + 8);
      _vx![i] = _f32at(o + 12);
      _vy![i] = _f32at(o + 16);
      _omega![i] = _f32at(o + 20);
      _invMass![i] = _f32at(o + 24);
      _invInertia![i] = _f32at(o + 28);
      _halfX![i] = _f32at(o + 32);
      _halfY![i] = _f32at(o + 36);
      _torque![i] = _f32at(o + 40);
      _order![i] = i;
    }
    final jb = kHeaderBytes + kBodies * kBodyWords * 4;
    for (var j = 0; j < jointCount; j++) {
      final o = jb + j * kJointBytes;
      _jointA![j] = _u32(o);
      _jointB![j] = _u32(o + 4);
      _localAx![j] = _f32at(o + 8);
      _localAy![j] = _f32at(o + 12);
      _localBx![j] = _f32at(o + 16);
      _localBy![j] = _f32at(o + 20);
      _jointRest![j] = _f32at(o + 24);
      _jointStiffness![j] = _f32at(o + 28);
    }
    var cp = 0;
    for (var step = 0; step < timesteps; step++) {
      for (var i = 0; i < kBodies; i++) {
        _vy![i] = _add(_vy![i], _mul(gravity, dt));
        if (step < torqueSteps && _torque![i] != 0) {
          _omega![i] = _add(_omega![i], _mul(_mul(_torque![i], _invInertia![i]), dt));
          _counters![9]++;
        }
        _vx![i] = _mul(_vx![i], linearDamping);
        _vy![i] = _mul(_vy![i], linearDamping);
        _omega![i] = _mul(_omega![i], angularDamping);
        _x![i] = _add(_x![i], _mul(_vx![i], dt));
        _y![i] = _add(_y![i], _mul(_vy![i], dt));
        _angle![i] = _wrap(_add(_angle![i], _mul(_omega![i], dt)));
      }
      _quantizeState();
      var pairs = _buildPairs();
      if (pairs == 0xffffffff) {
        return 2;
      }
      for (var it = 0; it < velIters; it++) {
        _counters![10]++;
        _updateBasis();
        for (var i = 0; i < kBodies; i++) {
          if (_groundManifold(i)) {
            _counters![3]++;
            _counters![4]++;
            _contactVelocity(i, -1, restitution, friction);
          }
        }
        for (var p = 0; p < pairs; p++) {
          _counters![2]++;
          if (_sat(_pairA![p], _pairB![p])) {
            _counters![3]++;
            _counters![4]++;
            _contactVelocity(_pairA![p], _pairB![p], restitution, friction);
          }
        }
        for (var j = 0; j < jointCount; j++) {
          _jointVelocity(j);
        }
        _quantizeState();
      }
      for (var it = 0; it < posIters; it++) {
        _counters![11]++;
        pairs = _buildPairs();
        if (pairs == 0xffffffff) {
          return 2;
        }
        for (var i = 0; i < kBodies; i++) {
          if (_groundManifold(i)) {
            _counters![3]++;
            _counters![4]++;
            _contactPosition(i, -1);
          }
        }
        for (var p = 0; p < pairs; p++) {
          _counters![2]++;
          if (_sat(_pairA![p], _pairB![p])) {
            _counters![3]++;
            _counters![4]++;
            _contactPosition(_pairA![p], _pairB![p]);
          }
        }
        _updateBasis();
        for (var j = 0; j < jointCount; j++) {
          _jointPosition(j);
        }
        _updateBasis();
        for (var i = 0; i < kBodies; i++) {
          if (_groundManifold(i)) {
            _counters![3]++;
            _counters![4]++;
            _contactPosition(i, -1);
          }
        }
        _quantizeState();
      }
      _counters![0]++;
      if ((step + 1) % checkpointEvery == 0 || step + 1 == timesteps) {
        _snapshot(cp);
        cp++;
      }
    }
    _counters![12] = cp * kStateValues;
    return 0;
  }

  @JSExport('result_ptr')
  int resultPtr() => 0; // not used by the glue; result read via counters()/checkpoints()

  @JSExport('counters')
  JSArrayBuffer counters() {
    final bytes = Uint8List(13 * 4);
    final view = ByteData.sublistView(bytes);
    for (var i = 0; i < 13; i++) {
      view.setUint32(i * 4, _counters![i], Endian.little);
    }
    return bytes.buffer.toJS;
  }

  @JSExport('checkpoints')
  JSArrayBuffer checkpoints() {
    final n = _counters![12];
    final bytes = Uint8List(n * 4);
    final view = ByteData.sublistView(bytes);
    for (var i = 0; i < n; i++) {
      view.setFloat32(i * 4, _checkpoints![i], Endian.little);
    }
    return bytes.buffer.toJS;
  }
}

void _ensureState() {
  _x ??= Float32List(kBodies);
  _y ??= Float32List(kBodies);
  _angle ??= Float32List(kBodies);
  _vx ??= Float32List(kBodies);
  _vy ??= Float32List(kBodies);
  _omega ??= Float32List(kBodies);
  _invMass ??= Float32List(kBodies);
  _invInertia ??= Float32List(kBodies);
  _halfX ??= Float32List(kBodies);
  _halfY ??= Float32List(kBodies);
  _torque ??= Float32List(kBodies);
  _cosine ??= Float32List(kBodies);
  _sine ??= Float32List(kBodies);
  _extentX ??= Float32List(kBodies);
  _extentY ??= Float32List(kBodies);
  _jointA ??= Uint32List(kJoints);
  _jointB ??= Uint32List(kJoints);
  _localAx ??= Float32List(kJoints);
  _localAy ??= Float32List(kJoints);
  _localBx ??= Float32List(kJoints);
  _localBy ??= Float32List(kJoints);
  _jointRest ??= Float32List(kJoints);
  _jointStiffness ??= Float32List(kJoints);
  _order ??= Uint32List(kBodies);
  _pairA ??= Uint32List(kMaxPairs);
  _pairB ??= Uint32List(kMaxPairs);
  _counters ??= Uint32List(16);
  _checkpoints ??= Float32List(kMaxCheckpoints * kStateValues);
}

void _updateBasis() {
  for (var i = 0; i < kBodies; i++) {
    final c = _cosApprox(_angle![i]);
    final s = _sinApprox(_angle![i]);
    _cosine![i] = c;
    _sine![i] = s;
    _extentX![i] = _add(_mul(_absf(c), _halfX![i]), _mul(_absf(s), _halfY![i]));
    _extentY![i] = _add(_mul(_absf(s), _halfX![i]), _mul(_absf(c), _halfY![i]));
  }
}

bool _sat(int a, int b) {
  final dx = _sub(_x![b], _x![a]);
  final dy = _sub(_y![b], _y![a]);
  var minimum = 3.402823e38;
  var nx = 0.0, ny = 0.0;
  final axes = [
    _cosine![a], _sine![a], _neg(_sine![a]), _cosine![a],
    _cosine![b], _sine![b], _neg(_sine![b]), _cosine![b],
  ];
  for (var k = 0; k < 4; k++) {
    final ax = axes[k * 2], ay = axes[k * 2 + 1];
    final d = _add(_mul(dx, ax), _mul(dy, ay));
    final au = _absf(_add(_mul(ax, _cosine![a]), _mul(ay, _sine![a])));
    final av = _absf(_add(_mul(ax, _neg(_sine![a])), _mul(ay, _cosine![a])));
    final bu = _absf(_add(_mul(ax, _cosine![b]), _mul(ay, _sine![b])));
    final bv = _absf(_add(_mul(ax, _neg(_sine![b])), _mul(ay, _cosine![b])));
    final radius = _add(
        _add(_add(_mul(_halfX![a], au), _mul(_halfY![a], av)),
            _mul(_halfX![b], bu)),
        _mul(_halfY![b], bv));
    final overlap = _sub(radius, _absf(d));
    if (overlap <= 0) {
      return false;
    }
    if (overlap < minimum) {
      minimum = overlap;
      final sign = d < 0 ? -1.0 : 1.0;
      nx = _mul(ax, sign);
      ny = _mul(ay, sign);
    }
  }
  final sau = _add(_mul(nx, _cosine![a]), _mul(ny, _sine![a])) < 0 ? -1.0 : 1.0;
  final sav = _add(_mul(nx, _neg(_sine![a])), _mul(ny, _cosine![a])) < 0 ? -1.0 : 1.0;
  final sbu = _add(_mul(_neg(nx), _cosine![b]), _mul(_neg(ny), _sine![b])) < 0 ? -1.0 : 1.0;
  final sbv = _add(_mul(_neg(nx), _neg(_sine![b])), _mul(_neg(ny), _cosine![b])) < 0 ? -1.0 : 1.0;
  final sax = _add(_add(_x![a], _mul(_mul(sau, _halfX![a]), _cosine![a])),
      _mul(_mul(sav, _halfY![a]), _neg(_sine![a])));
  final say = _add(_add(_y![a], _mul(_mul(sau, _halfX![a]), _sine![a])),
      _mul(_mul(sav, _halfY![a]), _cosine![a]));
  final sbx = _add(_add(_x![b], _mul(_mul(sbu, _halfX![b]), _cosine![b])),
      _mul(_mul(sbv, _halfY![b]), _neg(_sine![b])));
  final sby = _add(_add(_y![b], _mul(_mul(sbu, _halfX![b]), _sine![b])),
      _mul(_mul(sbv, _halfY![b]), _cosine![b]));
  _mNx = nx;
  _mNy = ny;
  _mPenetration = minimum;
  _mCx = _mul(_add(sax, sbx), 0.5);
  _mCy = _mul(_add(say, sby), 0.5);
  return true;
}

double _mNx = 0, _mNy = 0, _mPenetration = 0, _mCx = 0, _mCy = 0;

bool _groundManifold(int i) {
  final su = _sine![i] > 0 ? -1.0 : 1.0;
  final sv = _cosine![i] > 0 ? -1.0 : 1.0;
  final rx = _add(_mul(_mul(su, _halfX![i]), _cosine![i]),
      _mul(_mul(sv, _halfY![i]), _neg(_sine![i])));
  final ry = _add(_mul(_mul(su, _halfX![i]), _sine![i]),
      _mul(_mul(sv, _halfY![i]), _cosine![i]));
  final lowest = _add(_y![i], ry);
  if (lowest >= 0) {
    return false;
  }
  _mNx = 0;
  _mNy = -1.0;
  _mPenetration = _neg(lowest);
  _mCx = _add(_x![i], rx);
  _mCy = 0;
  return true;
}

int _buildPairs() {
  _updateBasis();
  for (var k = 1; k < kBodies; k++) {
    final id = _order![k];
    var at = k;
    final key = _sub(_x![id], _extentX![id]);
    while (at > 0) {
      final p = _order![at - 1];
      final pk = _sub(_x![p], _extentX![p]);
      if (pk < key || (pk == key && p < id)) {
        break;
      }
      _order![at] = p;
      at--;
    }
    _order![at] = id;
  }
  var count = 0;
  for (var l = 0; l < kBodies; l++) {
    final a = _order![l];
    final mx = _add(_x![a], _extentX![a]);
    for (var r = l + 1; r < kBodies; r++) {
      final b = _order![r];
      if (_sub(_x![b], _extentX![b]) > mx) {
        break;
      }
      _counters![1]++;
      if (_absf(_sub(_y![b], _y![a])) <= _add(_extentY![a], _extentY![b])) {
        if (count >= kMaxPairs) {
          return 0xffffffff;
        }
        _pairA![count] = a;
        _pairB![count] = b;
        count++;
      }
    }
  }
  return count;
}

void _contactVelocity(int a, int b, double restitution, double friction) {
  final rax = _sub(_mCx, _x![a]);
  final ray = _sub(_mCy, _y![a]);
  final vax = _sub(_vx![a], _mul(_omega![a], ray));
  final vay = _add(_vy![a], _mul(_omega![a], rax));
  var inverse = _invMass![a];
  var rbx = 0.0, rby = 0.0, vbx = 0.0, vby = 0.0;
  if (b >= 0) {
    rbx = _sub(_mCx, _x![b]);
    rby = _sub(_mCy, _y![b]);
    vbx = _sub(_vx![b], _mul(_omega![b], rby));
    vby = _add(_vy![b], _mul(_omega![b], rbx));
    inverse = _add(inverse, _invMass![b]);
  }
  final rna = _cross(rax, ray, _mNx, _mNy);
  var denom = _add(inverse, _mul(_mul(rna, rna), _invInertia![a]));
  var rnb = 0.0;
  if (b >= 0) {
    rnb = _cross(rbx, rby, _mNx, _mNy);
    denom = _add(denom, _mul(_mul(rnb, rnb), _invInertia![b]));
  }
  final relx = _sub(vbx, vax);
  final rely = _sub(vby, vay);
  final nv = _add(_mul(relx, _mNx), _mul(rely, _mNy));
  if (nv >= 0 || denom <= 0) {
    return;
  }
  final impulse = _div(_mul(_neg(_add(1.0, restitution)), nv), denom);
  final ix = _mul(impulse, _mNx);
  final iy = _mul(impulse, _mNy);
  _vx![a] = _sub(_vx![a], _mul(ix, _invMass![a]));
  _vy![a] = _sub(_vy![a], _mul(iy, _invMass![a]));
  _omega![a] = _sub(_omega![a], _mul(_mul(rna, impulse), _invInertia![a]));
  if (b >= 0) {
    _vx![b] = _add(_vx![b], _mul(ix, _invMass![b]));
    _vy![b] = _add(_vy![b], _mul(iy, _invMass![b]));
    _omega![b] = _add(_omega![b], _mul(_mul(rnb, impulse), _invInertia![b]));
  }
  _counters![5]++;
  if (rna != 0) {
    _counters![7]++;
  }
  if (b >= 0 && rnb != 0) {
    _counters![7]++;
  }
  final tx = _neg(_mNy);
  final ty = _mNx;
  final rta = _cross(rax, ray, tx, ty);
  var tden = _add(inverse, _mul(_mul(rta, rta), _invInertia![a]));
  var rtb = 0.0;
  if (b >= 0) {
    rtb = _cross(rbx, rby, tx, ty);
    tden = _add(tden, _mul(_mul(rtb, rtb), _invInertia![b]));
  }
  final ti = _clampf(_div(_neg(_add(_mul(relx, tx), _mul(rely, ty))), tden),
      _mul(_neg(friction), impulse), _mul(friction, impulse));
  final fx = _mul(ti, tx);
  final fy = _mul(ti, ty);
  _vx![a] = _sub(_vx![a], _mul(fx, _invMass![a]));
  _vy![a] = _sub(_vy![a], _mul(fy, _invMass![a]));
  _omega![a] = _sub(_omega![a], _mul(_mul(rta, ti), _invInertia![a]));
  if (b >= 0) {
    _vx![b] = _add(_vx![b], _mul(fx, _invMass![b]));
    _vy![b] = _add(_vy![b], _mul(fy, _invMass![b]));
    _omega![b] = _add(_omega![b], _mul(_mul(rtb, ti), _invInertia![b]));
  }
  _counters![6]++;
}

int _contactPosition(int a, int b) {
  final depth = _sub(_mPenetration, 0.001);
  if (depth <= 0) {
    return 0;
  }
  var den = _invMass![a];
  if (b >= 0) {
    den = _add(den, _invMass![b]);
  }
  if (den <= 0) {
    return 0;
  }
  final imp = _div(b < 0 ? depth : (depth < 0.05 ? depth : 0.05), den);
  final ix = _mul(imp, _mNx);
  final iy = _mul(imp, _mNy);
  _x![a] = _sub(_x![a], _mul(ix, _invMass![a]));
  _y![a] = _sub(_y![a], _mul(iy, _invMass![a]));
  if (b >= 0) {
    _x![b] = _add(_x![b], _mul(ix, _invMass![b]));
    _y![b] = _add(_y![b], _mul(iy, _invMass![b]));
  }
  return 1;
}

void _jointGeometry(int j) {
  final a = _jointA![j], b = _jointB![j];
  final rax = _add(_mul(_localAx![j], _cosine![a]), _mul(_localAy![j], _neg(_sine![a])));
  final ray = _add(_mul(_localAx![j], _sine![a]), _mul(_localAy![j], _cosine![a]));
  final rbx = _add(_mul(_localBx![j], _cosine![b]), _mul(_localBy![j], _neg(_sine![b])));
  final rby = _add(_mul(_localBx![j], _sine![b]), _mul(_localBy![j], _cosine![b]));
  final dx = _sub(_add(_x![b], rbx), _add(_x![a], rax));
  final dy = _sub(_add(_y![b], rby), _add(_y![a], ray));
  final len = _sqrtf(_add(_mul(dx, dx), _mul(dy, dy)));
  _jA = a;
  _jB = b;
  _jRax = rax;
  _jRay = ray;
  _jRbx = rbx;
  _jRby = rby;
  _jLen = len;
  _jNx = len > 0.000001 ? _div(dx, len) : 1.0;
  _jNy = len > 0.000001 ? _div(dy, len) : 0.0;
}

int _jA = 0, _jB = 0;
double _jRax = 0, _jRay = 0, _jRbx = 0, _jRby = 0, _jLen = 0, _jNx = 0, _jNy = 0;

void _jointVelocity(int j) {
  _jointGeometry(j);
  final a = _jA, b = _jB;
  final vax = _sub(_vx![a], _mul(_omega![a], _jRay));
  final vay = _add(_vy![a], _mul(_omega![a], _jRax));
  final vbx = _sub(_vx![b], _mul(_omega![b], _jRby));
  final vby = _add(_vy![b], _mul(_omega![b], _jRbx));
  final rna = _cross(_jRax, _jRay, _jNx, _jNy);
  final rnb = _cross(_jRbx, _jRby, _jNx, _jNy);
  final den = _add(_add(_add(_invMass![a], _invMass![b]), _mul(_mul(rna, rna), _invInertia![a])),
      _mul(_mul(rnb, rnb), _invInertia![b]));
  if (den <= 0) {
    return;
  }
  final imp = _div(_neg(_add(_mul(_sub(vbx, vax), _jNx), _mul(_sub(vby, vay), _jNy))), den);
  final ix = _mul(imp, _jNx);
  final iy = _mul(imp, _jNy);
  _vx![a] = _sub(_vx![a], _mul(ix, _invMass![a]));
  _vy![a] = _sub(_vy![a], _mul(iy, _invMass![a]));
  _omega![a] = _sub(_omega![a], _mul(_mul(rna, imp), _invInertia![a]));
  _vx![b] = _add(_vx![b], _mul(ix, _invMass![b]));
  _vy![b] = _add(_vy![b], _mul(iy, _invMass![b]));
  _omega![b] = _add(_omega![b], _mul(_mul(rnb, imp), _invInertia![b]));
  _counters![8]++;
}

void _jointPosition(int j) {
  _jointGeometry(j);
  final a = _jA, b = _jB;
  final den = _add(_invMass![a], _invMass![b]);
  if (den <= 0) {
    return;
  }
  final imp = _div(_mul(_clampf(_sub(_jLen, _jointRest![j]), -0.05, 0.05), _jointStiffness![j]), den);
  final ix = _mul(imp, _jNx);
  final iy = _mul(imp, _jNy);
  _x![a] = _add(_x![a], _mul(ix, _invMass![a]));
  _y![a] = _add(_y![a], _mul(iy, _invMass![a]));
  _x![b] = _sub(_x![b], _mul(ix, _invMass![b]));
  _y![b] = _sub(_y![b], _mul(iy, _invMass![b]));
  _counters![8]++;
}

void _quantizeState() {
  for (var i = 0; i < kBodies; i++) {
    _x![i] = _quantize(_x![i]);
    _y![i] = _quantize(_y![i]);
    _angle![i] = _quantize(_wrap(_angle![i]));
    _vx![i] = _quantize(_vx![i]);
    _vy![i] = _quantize(_vy![i]);
    _omega![i] = _quantize(_omega![i]);
  }
}

void _snapshot(int cp) {
  var at = cp * kStateValues;
  for (var i = 0; i < kBodies; i++) {
    _checkpoints![at++] = _x![i];
    _checkpoints![at++] = _y![i];
    _checkpoints![at++] = _angle![i];
    _checkpoints![at++] = _vx![i];
    _checkpoints![at++] = _vy![i];
    _checkpoints![at++] = _omega![i];
  }
}

@JS('dartKernels')
external set dartKernels(JSObject value);

void main() {
  dartKernels = createJSInteropWrapper(RigidEngine());
}
