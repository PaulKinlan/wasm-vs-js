// text-diff-patch Dart WasmGC kernel — exact mirror of the JS myersDiff
// (same prefix/suffix trim, O(ND) forward pass with per-d trace snapshots,
// same backtrack, same op emission order, same counters). Inputs are interned
// line IDs passed as zero-copy Uint32Array views. Emits (op, x, y) triples;
// line values are derivable from base/target so they are not written.
//
// Dart note: the v/trace working set uses dart:typed_data buffers (the JS
// baseline uses Int32Array) — no f32 issue here, but the WasmGC managed-heap
// version is still disclosed separately from the linear-memory variants.

import 'dart:js_interop';
import 'dart:typed_data';

@JSExport()
class MyersKernels {
  @JSExport('myers_diff')
  int myersDiff(
    JSUint32Array baseJs,
    JSUint32Array targetJs,
    JSUint32Array outOpJs,
    JSUint32Array outXJs,
    JSUint32Array outYJs,
    JSUint32Array scratchJs,
    int outCap,
    JSUint32Array edJs,
    JSUint32Array fsJs,
  ) {
    final base = baseJs.toDart; // zero-copy Uint32List views on Wasm
    final target = targetJs.toDart;
    final outOp = outOpJs.toDart;
    final outX = outXJs.toDart;
    final outY = outYJs.toDart;
    final scratch = scratchJs.toDart;
    final ed = edJs.toDart;
    final fs = fsJs.toDart;

    int prefix = 0;
    while (prefix < base.length && prefix < target.length &&
        base[prefix] == target[prefix]) {
      prefix++;
    }
    int suffix = 0;
    while (suffix < base.length - prefix && suffix < target.length - prefix &&
        base[base.length - 1 - suffix] == target[target.length - 1 - suffix]) {
      suffix++;
    }
    final n = base.length - prefix - suffix;
    final m = target.length - prefix - suffix;
    final max = n + m;
    final vstride = 2 * max + 1;
    // scratch layout: v[0..vstride), then trace snapshots of vstride each.
    final v = Uint32List.view(scratch.buffer, scratch.offsetInBytes, vstride);
    final trace = Uint32List.view(
      scratch.buffer,
      scratch.offsetInBytes + vstride * 4,
      vstride * (max + 1),
    );

    int count = 0;
    int editDistance = 0;
    int frontierSteps = 0;

    // Suffix equal ops first (JS push order).
    for (int index = 0; index < suffix; index++) {
      if (count >= outCap) break;
      outOp[count] = 0;
      outX[count] = base.length - 1 - index;
      outY[count] = target.length - 1 - index;
      count++;
    }

    if (n == 0) {
      for (int y = m - 1; y >= 0; y--) {
        if (count >= outCap) break;
        outOp[count] = 2;
        outX[count] = prefix;
        outY[count] = prefix + y;
        count++;
      }
      editDistance = m;
    } else if (m == 0) {
      for (int x = n - 1; x >= 0; x--) {
        if (count >= outCap) break;
        outOp[count] = 1;
        outX[count] = prefix + x;
        outY[count] = prefix;
        count++;
      }
      editDistance = n;
    } else {
      final offset = max;
      v[offset + 1] = 0;
      var d = 0;
      var done = false;
      while (d <= max && !done) {
        for (var k = -d; k <= d; k += 2) {
          frontierSteps++;
          int x;
          if (k == -d || (k != d && v[offset + k - 1] < v[offset + k + 1])) {
            x = v[offset + k + 1];
          } else {
            x = v[offset + k - 1] + 1;
          }
          var y = x - k;
          while (x < n && y < m && base[prefix + x] == target[prefix + y]) {
            x++;
            y++;
          }
          v[offset + k] = x;
          if (x >= n && y >= m) {
            trace.setRange(d * vstride, d * vstride + vstride, v);
            editDistance = d;
            done = true;
            break;
          }
        }
        if (!done) {
          trace.setRange(d * vstride, d * vstride + vstride, v);
        }
        d++;
      }

      var x = n;
      var y = m;
      for (var d2 = editDistance; d2 > 0; d2--) {
        final prior = Uint32List.view(
          scratch.buffer,
          scratch.offsetInBytes + vstride * 4 + (d2 - 1) * vstride * 4,
          vstride,
        );
        final k = x - y;
        final down = k == -d2 || (k != d2 && prior[offset + k - 1] < prior[offset + k + 1]);
        final previousK = down ? k + 1 : k - 1;
        final previousX = prior[offset + previousK];
        final previousY = previousX - previousK;
        while (x > previousX && y > previousY) {
          x--;
          y--;
          if (count >= outCap) break;
          outOp[count] = 0;
          outX[count] = prefix + x;
          outY[count] = prefix + y;
          count++;
        }
        if (down) {
          y--;
          if (count >= outCap) break;
          outOp[count] = 2;
          outX[count] = prefix + x;
          outY[count] = prefix + y;
          count++;
        } else {
          x--;
          if (count >= outCap) break;
          outOp[count] = 1;
          outX[count] = prefix + x;
          outY[count] = prefix + y;
          count++;
        }
      }
    }
    // Prefix equal ops.
    for (int index = prefix - 1; index >= 0; index--) {
      if (count >= outCap) break;
      outOp[count] = 0;
      outX[count] = index;
      outY[count] = index;
      count++;
    }
    // Reverse the whole script (JS reverse.reverse()).
    for (int i = 0; i < count ~/ 2; i++) {
      final j = count - 1 - i;
      final to = outOp[i], tx = outX[i], ty = outY[i];
      outOp[i] = outOp[j];
      outX[i] = outX[j];
      outY[i] = outY[j];
      outOp[j] = to;
      outX[j] = tx;
      outY[j] = ty;
    }

    ed[0] = editDistance;
    fs[0] = frontierSteps;
    return count;
  }
}

void main() {
  dartKernels = createJSInteropWrapper(MyersKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
