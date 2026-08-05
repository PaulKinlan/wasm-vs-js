#include <stdint.h>

// simulation-nbody-cloth multilang kernel — exact mirror of
// benchmarks/base/simulation-nbody/engine.js simulate():
//   * O(N^2) pairwise gravitational accelerations (IEEE f64, 1/sqrt
//     formulation, i-outer / j-inner loop order, i==j skipped);
//   * leapfrog Kick-Drift-Kick integrator (v += a*dt*0.5; p += v*dt;
//     v += a*dt*0.5) for `steps` timesteps;
//   * final [px,py,pz,vx,vy,vz] state written contiguously to `out`.
// Built with -ffp-contract=off so every f64 mul/add stays unfused — identical
// rounding to the JS oracle (Math.sqrt + scalar accumulation).

typedef uint32_t u32;

static double square_root(double value) { return __builtin_sqrt(value); }

static void compute_accelerations(
    const double *mass, const double *px, const double *py, const double *pz,
    double *ax, double *ay, double *az,
    u32 n, double gravity, double soft2) {
  for (u32 i = 0; i < n; i++) {
    double sx = 0.0, sy = 0.0, sz = 0.0;
    const double x = px[i], y = py[i], z = pz[i];
    for (u32 j = 0; j < n; j++) {
      if (i == j) continue;
      const double dx = px[j] - x, dy = py[j] - y, dz = pz[j] - z;
      const double inv = 1.0 / square_root(dx * dx + dy * dy + dz * dz + soft2);
      const double scale = gravity * mass[j] * inv * inv * inv;
      sx += dx * scale;
      sy += dy * scale;
      sz += dz * scale;
    }
    ax[i] = sx;
    ay[i] = sy;
    az[i] = sz;
  }
}

__attribute__((visibility("default")))
void nbody_step(
    const double *mass, double *px, double *py, double *pz,
    double *vx, double *vy, double *vz,
    double *ax, double *ay, double *az,
    double *out,
    u32 count, u32 steps, double dt, double gravity, double soft2) {
  const u32 n = count;
  compute_accelerations(mass, px, py, pz, ax, ay, az, n, gravity, soft2);
  for (u32 step = 1; step <= steps; step++) {
    for (u32 i = 0; i < n; i++) {
      vx[i] += ax[i] * dt * 0.5;
      vy[i] += ay[i] * dt * 0.5;
      vz[i] += az[i] * dt * 0.5;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;
    }
    compute_accelerations(mass, px, py, pz, ax, ay, az, n, gravity, soft2);
    for (u32 i = 0; i < n; i++) {
      vx[i] += ax[i] * dt * 0.5;
      vy[i] += ay[i] * dt * 0.5;
      vz[i] += az[i] * dt * 0.5;
    }
  }
  u32 cursor = 0;
  const double *parts[6] = { px, py, pz, vx, vy, vz };
  for (u32 part = 0; part < 6; part++) {
    for (u32 i = 0; i < n; i++) out[cursor++] = parts[part][i];
  }
}
