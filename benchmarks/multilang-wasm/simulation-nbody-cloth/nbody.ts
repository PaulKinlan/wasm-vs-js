// nbody.ts — AssemblyScript multilang kernel for simulation.nbody-cloth.v1.
//
// Exact mirror of nbody.c and of benchmarks/base/simulation-nbody/engine.js
// simulate(): O(N^2) pairwise gravitational accelerations in IEEE f64 using
// the 1/sqrt formulation, i-outer / j-inner order with i==j skipped, then a
// leapfrog Kick-Drift-Kick integrator, then [px,py,pz,vx,vy,vz] written
// contiguously to `out`.
//
// AssemblyScript emits unfused f64 mul and add (there is no FMA contraction),
// which is what the C build gets from -ffp-contract=off and what the JS oracle
// does with scalar accumulation — so the rounding matches term for term.
//
// Pointers are raw linear-memory byte offsets; no allocation, no runtime
// imports.

function computeAccelerations(
  mass: usize,
  px: usize,
  py: usize,
  pz: usize,
  ax: usize,
  ay: usize,
  az: usize,
  n: u32,
  gravity: f64,
  soft2: f64,
): void {
  for (let i: u32 = 0; i < n; i++) {
    let sx: f64 = 0.0, sy: f64 = 0.0, sz: f64 = 0.0;
    const x: f64 = load<f64>(px + (<usize> i) * 8);
    const y: f64 = load<f64>(py + (<usize> i) * 8);
    const z: f64 = load<f64>(pz + (<usize> i) * 8);
    for (let j: u32 = 0; j < n; j++) {
      if (i == j) continue;
      const dx: f64 = load<f64>(px + (<usize> j) * 8) - x;
      const dy: f64 = load<f64>(py + (<usize> j) * 8) - y;
      const dz: f64 = load<f64>(pz + (<usize> j) * 8) - z;
      const inv: f64 = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz + soft2);
      const scale: f64 = gravity * load<f64>(mass + (<usize> j) * 8) * inv * inv * inv;
      sx += dx * scale;
      sy += dy * scale;
      sz += dz * scale;
    }
    store<f64>(ax + (<usize> i) * 8, sx);
    store<f64>(ay + (<usize> i) * 8, sy);
    store<f64>(az + (<usize> i) * 8, sz);
  }
}

export function nbody_step(
  mass: usize,
  px: usize,
  py: usize,
  pz: usize,
  vx: usize,
  vy: usize,
  vz: usize,
  ax: usize,
  ay: usize,
  az: usize,
  out: usize,
  count: u32,
  steps: u32,
  dt: f64,
  gravity: f64,
  soft2: f64,
): void {
  const n: u32 = count;
  computeAccelerations(mass, px, py, pz, ax, ay, az, n, gravity, soft2);
  for (let step: u32 = 1; step <= steps; step++) {
    for (let i: u32 = 0; i < n; i++) {
      const o: usize = (<usize> i) * 8;
      store<f64>(vx + o, load<f64>(vx + o) + load<f64>(ax + o) * dt * 0.5);
      store<f64>(vy + o, load<f64>(vy + o) + load<f64>(ay + o) * dt * 0.5);
      store<f64>(vz + o, load<f64>(vz + o) + load<f64>(az + o) * dt * 0.5);
      store<f64>(px + o, load<f64>(px + o) + load<f64>(vx + o) * dt);
      store<f64>(py + o, load<f64>(py + o) + load<f64>(vy + o) * dt);
      store<f64>(pz + o, load<f64>(pz + o) + load<f64>(vz + o) * dt);
    }
    computeAccelerations(mass, px, py, pz, ax, ay, az, n, gravity, soft2);
    for (let i: u32 = 0; i < n; i++) {
      const o: usize = (<usize> i) * 8;
      store<f64>(vx + o, load<f64>(vx + o) + load<f64>(ax + o) * dt * 0.5);
      store<f64>(vy + o, load<f64>(vy + o) + load<f64>(ay + o) * dt * 0.5);
      store<f64>(vz + o, load<f64>(vz + o) + load<f64>(az + o) * dt * 0.5);
    }
  }
  // Written slab by slab rather than through an array of pointers: an array
  // literal would allocate, and the heap sits in the same low memory the
  // adapter fills with the fixture.
  let cursor: u32 = 0;
  cursor = copySlab(out, px, n, cursor);
  cursor = copySlab(out, py, n, cursor);
  cursor = copySlab(out, pz, n, cursor);
  cursor = copySlab(out, vx, n, cursor);
  cursor = copySlab(out, vy, n, cursor);
  copySlab(out, vz, n, cursor);
}

function copySlab(out: usize, src: usize, n: u32, cursor: u32): u32 {
  let at: u32 = cursor;
  for (let i: u32 = 0; i < n; i++) {
    store<f64>(out + (<usize> at) * 8, load<f64>(src + (<usize> i) * 8));
    at++;
  }
  return at;
}
