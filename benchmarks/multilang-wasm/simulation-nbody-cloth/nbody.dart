// simulation-nbody-cloth Dart WasmGC kernel — exact mirror of the C
// nbody_step: O(N^2) pairwise gravitational accelerations (IEEE f64, 1/sqrt
// formulation, i-outer / j-inner loop order) plus the leapfrog Kick-Drift-Kick
// integrator. Dart doubles ARE f64 (IEEE-754) and dart2wasm does not contract
// or reassociate them, so with the same operation order the physics is
// bit-identical to the JS oracle natively.

import 'dart:js_interop';
import 'dart:math' as math;
import 'dart:typed_data';

@JSExport()
class NbodyKernels {
  @JSExport('nbody_step')
  void nbodyStep(
    JSFloat64Array massJs,
    JSFloat64Array pxJs,
    JSFloat64Array pyJs,
    JSFloat64Array pzJs,
    JSFloat64Array vxJs,
    JSFloat64Array vyJs,
    JSFloat64Array vzJs,
    JSFloat64Array axJs,
    JSFloat64Array ayJs,
    JSFloat64Array azJs,
    JSFloat64Array outJs,
    int count,
    int steps,
    double dt,
    double gravity,
    double soft2,
  ) {
    final mass = massJs.toDart;
    final px = pxJs.toDart;
    final py = pyJs.toDart;
    final pz = pzJs.toDart;
    final vx = vxJs.toDart;
    final vy = vyJs.toDart;
    final vz = vzJs.toDart;
    final ax = axJs.toDart;
    final ay = ayJs.toDart;
    final az = azJs.toDart;
    final out = outJs.toDart;
    final n = count;

    void accelerations() {
      for (var i = 0; i < n; i++) {
        var sx = 0.0, sy = 0.0, sz = 0.0;
        final x = px[i], y = py[i], z = pz[i];
        for (var j = 0; j < n; j++) {
          if (i == j) continue;
          final dx = px[j] - x, dy = py[j] - y, dz = pz[j] - z;
          final inv = 1.0 / math.sqrt(dx * dx + dy * dy + dz * dz + soft2);
          final scale = gravity * mass[j] * inv * inv * inv;
          sx += dx * scale;
          sy += dy * scale;
          sz += dz * scale;
        }
        ax[i] = sx;
        ay[i] = sy;
        az[i] = sz;
      }
    }

    accelerations();
    for (var step = 1; step <= steps; step++) {
      for (var i = 0; i < n; i++) {
        vx[i] += ax[i] * dt * 0.5;
        vy[i] += ay[i] * dt * 0.5;
        vz[i] += az[i] * dt * 0.5;
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
        pz[i] += vz[i] * dt;
      }
      accelerations();
      for (var i = 0; i < n; i++) {
        vx[i] += ax[i] * dt * 0.5;
        vy[i] += ay[i] * dt * 0.5;
        vz[i] += az[i] * dt * 0.5;
      }
    }
    var cursor = 0;
    for (final part in [px, py, pz, vx, vy, vz]) {
      for (var i = 0; i < n; i++) {
        out[cursor++] = part[i];
      }
    }
  }
}

void main() {
  dartKernels = createJSInteropWrapper(NbodyKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
