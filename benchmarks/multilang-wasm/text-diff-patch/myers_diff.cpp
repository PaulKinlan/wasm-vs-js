// text-diff-patch multilang kernel (C++ translation unit; identical body).
#include <stdint.h>

extern "C" {

// text-diff-patch multilang kernel — mirrors benchmarks/v2/text-diff-patch/
// workload.js myersDiff EXACTLY: same prefix/suffix trim, same O(ND) forward
// pass with the same v-array indexing and per-d trace snapshots, same
// backtrack, same operation emission order (equal=0, delete=1, insert=2).
// Inputs are interned line IDs (u32). Output is the edit script as
// (op, x, y) triples — line values are derivable from base/target, so they
// are not written. editDistance and frontierSteps counters match the JS.
//
// scratch layout (u32): [0 .. 2*max] = v, then trace snapshots of
// (2*max+1) u32 each: snapshot d at scratch[(2*max+1)*(1 + d)].

__attribute__((visibility("default")))
uint32_t myers_diff(
    const uint32_t* base, uint32_t base_len,
    const uint32_t* target, uint32_t target_len,
    uint32_t* out_op, uint32_t* out_x, uint32_t* out_y, uint32_t out_cap,
    uint32_t* scratch, uint32_t scratch_u32,
    uint32_t* out_edit_distance, uint32_t* out_frontier_steps) {
  uint32_t prefix = 0;
  while (prefix < base_len && prefix < target_len &&
         base[prefix] == target[prefix]) prefix++;
  uint32_t suffix = 0;
  while (suffix < base_len - prefix && suffix < target_len - prefix &&
         base[base_len - 1 - suffix] == target[target_len - 1 - suffix]) suffix++;
  const uint32_t n = base_len - prefix - suffix;
  const uint32_t m = target_len - prefix - suffix;
  const uint32_t max = n + m;
  const uint32_t vstride = 2 * max + 1;
  uint32_t* v = scratch;                       // v[offset + k]
  uint32_t* trace = scratch + vstride;         // trace[d * vstride + offset + k]

  uint32_t count = 0;                          // operations emitted
  uint32_t editDistance = 0;
  uint32_t frontierSteps = 0;

  // JS pushes suffix equal ops first: [0, base_len-1-idx, target_len-1-idx].
  for (uint32_t index = 0; index < suffix; index++) {
    if (count >= out_cap) break;
    out_op[count] = 0;
    out_x[count] = base_len - 1 - index;
    out_y[count] = target_len - 1 - index;
    count++;
  }

  if (n == 0) {
    for (uint32_t y = m; y > 0; y--) {
      if (count >= out_cap) break;
      out_op[count] = 2; out_x[count] = prefix; out_y[count] = prefix + (y - 1);
      count++;
    }
    editDistance = m;
  } else if (m == 0) {
    for (uint32_t x = n; x > 0; x--) {
      if (count >= out_cap) break;
      out_op[count] = 1; out_x[count] = prefix + (x - 1); out_y[count] = prefix;
      count++;
    }
    editDistance = n;
  } else {
    const uint32_t offset = max;
    v[offset + 1] = 0;
    uint32_t d;
    for (d = 0; d <= max; d++) {
      int done = 0;
      for (uint32_t kk = 0; kk <= 2 * d; kk += 2) {
        const int32_t k = (int32_t)kk - (int32_t)d;
        frontierSteps++;
        int32_t x;
        if (k == -(int32_t)d ||
            (k != (int32_t)d && v[offset + k - 1] < v[offset + k + 1])) {
          x = v[offset + k + 1];
        } else {
          x = v[offset + k - 1] + 1;
        }
        int32_t y = x - k;
        while ((uint32_t)x < n && (uint32_t)y < m &&
               base[prefix + x] == target[prefix + y]) {
          x++;
          y++;
        }
        v[offset + k] = (uint32_t)x;
        if ((uint32_t)x >= n && (uint32_t)y >= m) {
          for (uint32_t i = 0; i < vstride; i++) trace[d * vstride + i] = v[i];
          editDistance = d;
          done = 1;
          break;
        }
      }
      if (done) break;
      for (uint32_t i = 0; i < vstride; i++) trace[d * vstride + i] = v[i];
    }

    int32_t x = (int32_t)n;
    int32_t y = (int32_t)m;
    for (uint32_t d = editDistance; d > 0; d--) {
      const uint32_t* prior = trace + (d - 1) * vstride;
      const int32_t k = x - y;
      const int32_t down = (k == -(int32_t)d ||
                            (k != (int32_t)d && prior[offset + k - 1] < prior[offset + k + 1]))
        ? 1 : 0;
      const int32_t previousK = down ? k + 1 : k - 1;
      const int32_t previousX = prior[offset + previousK];
      const int32_t previousY = previousX - previousK;
      while (x > previousX && y > previousY) {
        x--;
        y--;
        if (count >= out_cap) break;
        out_op[count] = 0;
        out_x[count] = prefix + (uint32_t)x;
        out_y[count] = prefix + (uint32_t)y;
        count++;
      }
      if (down) {
        y--;
        if (count >= out_cap) break;
        out_op[count] = 2;
        out_x[count] = prefix + (uint32_t)x;
        out_y[count] = prefix + (uint32_t)y;
        count++;
      } else {
        x--;
        if (count >= out_cap) break;
        out_op[count] = 1;
        out_x[count] = prefix + (uint32_t)x;
        out_y[count] = prefix + (uint32_t)y;
        count++;
      }
    }
  }
  for (uint32_t index = prefix; index > 0; index--) {
    if (count >= out_cap) break;
    out_op[count] = 0;
    out_x[count] = index - 1;
    out_y[count] = index - 1;
    count++;
  }
  // The JS builds the script in reverse order then reverses it.
  for (uint32_t i = 0; i < count / 2; i++) {
    const uint32_t j = count - 1 - i;
    const uint32_t to = out_op[i], tx = out_x[i], ty = out_y[i];
    out_op[i] = out_op[j]; out_x[i] = out_x[j]; out_y[i] = out_y[j];
    out_op[j] = to; out_x[j] = tx; out_y[j] = ty;
  }
  *out_edit_distance = editDistance;
  *out_frontier_steps = frontierSteps;
  return count;
}
}
