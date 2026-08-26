// myers_diff.ts — AssemblyScript multilang kernel for text.diff-patch.v1.
//
// Mirrors myers_diff.c, which mirrors benchmarks/v2/text-diff-patch/workload.js
// myersDiff exactly: same prefix/suffix trim, the same O(ND) forward pass with
// the same v-array indexing and per-d trace snapshots, the same backtrack, and
// the same operation emission order (equal=0, delete=1, insert=2). Inputs are
// interned line IDs (u32); the output is the edit script as (op, x, y) triples,
// since line values are derivable from base and target.
//
// Signed arithmetic on k and x is kept in i32 exactly as the C does, because
// the frontier index goes negative and the comparisons depend on it.
//
// Scratch layout (u32): [0 .. vstride) is v, then one trace snapshot of
// vstride entries per d, at scratch[vstride * (1 + d)].

export function myers_diff(
  base: usize,
  baseLen: u32,
  target: usize,
  targetLen: u32,
  outOp: usize,
  outX: usize,
  outY: usize,
  outCap: u32,
  scratch: usize,
  scratchU32: u32,
  outEditDistance: usize,
  outFrontierSteps: usize,
): u32 {
  let prefix: u32 = 0;
  while (
    prefix < baseLen && prefix < targetLen &&
    load<u32>(base + (<usize> prefix) * 4) == load<u32>(target + (<usize> prefix) * 4)
  ) prefix++;
  let suffix: u32 = 0;
  while (
    suffix < baseLen - prefix && suffix < targetLen - prefix &&
    load<u32>(base + (<usize> (baseLen - 1 - suffix)) * 4) ==
      load<u32>(target + (<usize> (targetLen - 1 - suffix)) * 4)
  ) suffix++;

  const n: u32 = baseLen - prefix - suffix;
  const m: u32 = targetLen - prefix - suffix;
  const max: u32 = n + m;
  const vstride: u32 = 2 * max + 1;
  const v: usize = scratch;
  const trace: usize = scratch + (<usize> vstride) * 4;

  let count: u32 = 0;
  let editDistance: u32 = 0;
  let frontierSteps: u32 = 0;

  // The JS pushes the suffix equal ops first.
  for (let index: u32 = 0; index < suffix; index++) {
    if (count >= outCap) break;
    store<u32>(outOp + (<usize> count) * 4, 0);
    store<u32>(outX + (<usize> count) * 4, baseLen - 1 - index);
    store<u32>(outY + (<usize> count) * 4, targetLen - 1 - index);
    count++;
  }

  if (n == 0) {
    for (let y: u32 = m; y > 0; y--) {
      if (count >= outCap) break;
      store<u32>(outOp + (<usize> count) * 4, 2);
      store<u32>(outX + (<usize> count) * 4, prefix);
      store<u32>(outY + (<usize> count) * 4, prefix + (y - 1));
      count++;
    }
    editDistance = m;
  } else if (m == 0) {
    for (let x: u32 = n; x > 0; x--) {
      if (count >= outCap) break;
      store<u32>(outOp + (<usize> count) * 4, 1);
      store<u32>(outX + (<usize> count) * 4, prefix + (x - 1));
      store<u32>(outY + (<usize> count) * 4, prefix);
      count++;
    }
    editDistance = n;
  } else {
    const offset: i32 = <i32> max;
    store<u32>(v + (<usize> (offset + 1)) * 4, 0);
    for (let d: u32 = 0; d <= max; d++) {
      let done: bool = false;
      for (let kk: u32 = 0; kk <= 2 * d; kk += 2) {
        const k: i32 = <i32> kk - <i32> d;
        frontierSteps++;
        let x: i32;
        if (
          k == -(<i32> d) ||
          (k != <i32> d &&
            load<u32>(v + (<usize> (offset + k - 1)) * 4) <
              load<u32>(v + (<usize> (offset + k + 1)) * 4))
        ) {
          x = <i32> load<u32>(v + (<usize> (offset + k + 1)) * 4);
        } else {
          x = <i32> load<u32>(v + (<usize> (offset + k - 1)) * 4) + 1;
        }
        let y: i32 = x - k;
        while (
          <u32> x < n && <u32> y < m &&
          load<u32>(base + (<usize> (prefix + <u32> x)) * 4) ==
            load<u32>(target + (<usize> (prefix + <u32> y)) * 4)
        ) {
          x++;
          y++;
        }
        store<u32>(v + (<usize> (offset + k)) * 4, <u32> x);
        if (<u32> x >= n && <u32> y >= m) {
          copySnapshot(trace, v, d, vstride);
          editDistance = d;
          done = true;
          break;
        }
      }
      if (done) break;
      copySnapshot(trace, v, d, vstride);
    }

    let x: i32 = <i32> n;
    let y: i32 = <i32> m;
    for (let d: u32 = editDistance; d > 0; d--) {
      const prior: usize = trace + (<usize> ((d - 1) * vstride)) * 4;
      const k: i32 = x - y;
      const down: bool = k == -(<i32> d) ||
        (k != <i32> d &&
          load<u32>(prior + (<usize> (offset + k - 1)) * 4) <
            load<u32>(prior + (<usize> (offset + k + 1)) * 4));
      const previousK: i32 = down ? k + 1 : k - 1;
      const previousX: i32 = <i32> load<u32>(prior + (<usize> (offset + previousK)) * 4);
      const previousY: i32 = previousX - previousK;
      while (x > previousX && y > previousY) {
        x--;
        y--;
        if (count >= outCap) break;
        store<u32>(outOp + (<usize> count) * 4, 0);
        store<u32>(outX + (<usize> count) * 4, prefix + <u32> x);
        store<u32>(outY + (<usize> count) * 4, prefix + <u32> y);
        count++;
      }
      if (down) {
        y--;
        if (count >= outCap) break;
        store<u32>(outOp + (<usize> count) * 4, 2);
        store<u32>(outX + (<usize> count) * 4, prefix + <u32> x);
        store<u32>(outY + (<usize> count) * 4, prefix + <u32> y);
        count++;
      } else {
        x--;
        if (count >= outCap) break;
        store<u32>(outOp + (<usize> count) * 4, 1);
        store<u32>(outX + (<usize> count) * 4, prefix + <u32> x);
        store<u32>(outY + (<usize> count) * 4, prefix + <u32> y);
        count++;
      }
    }
  }

  for (let index: u32 = prefix; index > 0; index--) {
    if (count >= outCap) break;
    store<u32>(outOp + (<usize> count) * 4, 0);
    store<u32>(outX + (<usize> count) * 4, index - 1);
    store<u32>(outY + (<usize> count) * 4, index - 1);
    count++;
  }

  // The JS builds the script in reverse then reverses it.
  for (let i: u32 = 0; i < count / 2; i++) {
    const j: u32 = count - 1 - i;
    const oi: usize = outOp + (<usize> i) * 4, oj: usize = outOp + (<usize> j) * 4;
    const xi: usize = outX + (<usize> i) * 4, xj: usize = outX + (<usize> j) * 4;
    const yi: usize = outY + (<usize> i) * 4, yj: usize = outY + (<usize> j) * 4;
    const to: u32 = load<u32>(oi), tx: u32 = load<u32>(xi), ty: u32 = load<u32>(yi);
    store<u32>(oi, load<u32>(oj));
    store<u32>(xi, load<u32>(xj));
    store<u32>(yi, load<u32>(yj));
    store<u32>(oj, to);
    store<u32>(xj, tx);
    store<u32>(yj, ty);
  }

  store<u32>(outEditDistance, editDistance);
  store<u32>(outFrontierSteps, frontierSteps);
  // scratchU32 is part of the ABI the other kernels share; the caller sizes
  // the buffer and this kernel does not grow it.
  if (scratchU32 == 0) return 0;
  return count;
}

function copySnapshot(trace: usize, v: usize, d: u32, vstride: u32): void {
  const dst: usize = trace + (<usize> (d * vstride)) * 4;
  for (let i: u32 = 0; i < vstride; i++) {
    store<u32>(dst + (<usize> i) * 4, load<u32>(v + (<usize> i) * 4));
  }
}
