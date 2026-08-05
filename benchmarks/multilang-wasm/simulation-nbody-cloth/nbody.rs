#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// no_std: core's f64::sqrt is unavailable; LLVM lowers the C sqrt name to the
// f64.sqrt wasm instruction (same pattern as numeric-polybench-panel/polybench.rs).
extern "C" {
    fn sqrt(x: f64) -> f64;
}

// simulation-nbody-cloth multilang kernel — exact mirror of
// benchmarks/base/simulation-nbody/engine.js simulate(): O(N^2) pairwise
// gravitational accelerations (IEEE f64, 1/sqrt formulation, i-outer / j-inner
// loop order, i==j skipped) plus the leapfrog Kick-Drift-Kick integrator.
// rustc does not contract or reassociate f64 by default, so every op rounds
// identically to the JS oracle.

#[inline(always)]
unsafe fn compute_accelerations(
    n: usize,
    mass: *const f64,
    px: *const f64,
    py: *const f64,
    pz: *const f64,
    ax: *mut f64,
    ay: *mut f64,
    az: *mut f64,
    gravity: f64,
    soft2: f64,
) {
    for i in 0..n {
        let mut sx = 0.0f64;
        let mut sy = 0.0f64;
        let mut sz = 0.0f64;
        let x = *px.add(i);
        let y = *py.add(i);
        let z = *pz.add(i);
        for j in 0..n {
            if i == j {
                continue;
            }
            let dx = *px.add(j) - x;
            let dy = *py.add(j) - y;
            let dz = *pz.add(j) - z;
            let inv = 1.0f64 / sqrt(dx * dx + dy * dy + dz * dz + soft2);
            let scale = gravity * *mass.add(j) * inv * inv * inv;
            sx += dx * scale;
            sy += dy * scale;
            sz += dz * scale;
        }
        *ax.add(i) = sx;
        *ay.add(i) = sy;
        *az.add(i) = sz;
    }
}

#[no_mangle]
pub extern "C" fn nbody_step(
    mass: *const f64,
    px: *mut f64,
    py: *mut f64,
    pz: *mut f64,
    vx: *mut f64,
    vy: *mut f64,
    vz: *mut f64,
    ax: *mut f64,
    ay: *mut f64,
    az: *mut f64,
    out: *mut f64,
    count: u32,
    steps: u32,
    dt: f64,
    gravity: f64,
    soft2: f64,
) {
    let n = count as usize;
    unsafe {
        compute_accelerations(n, mass, px, py, pz, ax, ay, az, gravity, soft2);
        for _step in 1..=steps {
            for i in 0..n {
                *vx.add(i) += *ax.add(i) * dt * 0.5;
                *vy.add(i) += *ay.add(i) * dt * 0.5;
                *vz.add(i) += *az.add(i) * dt * 0.5;
                *px.add(i) += *vx.add(i) * dt;
                *py.add(i) += *vy.add(i) * dt;
                *pz.add(i) += *vz.add(i) * dt;
            }
            compute_accelerations(n, mass, px, py, pz, ax, ay, az, gravity, soft2);
            for i in 0..n {
                *vx.add(i) += *ax.add(i) * dt * 0.5;
                *vy.add(i) += *ay.add(i) * dt * 0.5;
                *vz.add(i) += *az.add(i) * dt * 0.5;
            }
        }
        let mut cursor = 0usize;
        let parts: [*const f64; 6] = [px, py, pz, vx, vy, vz];
        for part in parts {
            for i in 0..n {
                *out.add(cursor) = *part.add(i);
                cursor += 1;
            }
        }
    }
}
