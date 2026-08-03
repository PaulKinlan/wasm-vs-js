typedef unsigned char u8;
typedef unsigned int u32;
typedef unsigned long long u64;

#define N 1024u
#define STEPS 120u
#define INPUT_BYTES 57408u
#define OUTPUT_HEADER 128u
#define STATE_VALUES (N * 6u)
#define OUTPUT_BYTES (OUTPUT_HEADER + STATE_VALUES * 8u * 6u)
#define INPUT_MAGIC 0x3144424eu
#define OUTPUT_MAGIC 0x314f424eu

static u8 input_data[INPUT_BYTES] __attribute__((aligned(16)));
static u8 output_data[OUTPUT_BYTES] __attribute__((aligned(16)));
static double ax[N], ay[N], az[N];

u32 input_ptr(void) { return (u32)(unsigned long)input_data; }
u32 output_ptr(void) { return (u32)(unsigned long)output_data; }

static u32 read_u32(u32 off) { return *(u32 *)(input_data + off); }
static void write_u32(u32 off, u32 value) { *(u32 *)(output_data + off) = value; }
static void write_u64(u32 off, u64 value) { *(u64 *)(output_data + off) = value; }
static void write_f64(u32 off, double value) { *(double *)(output_data + off) = value; }
static double square_root(double value) { return __builtin_sqrt(value); }

static void compute_acceleration(
  const double *mass, const double *px, const double *py, const double *pz,
  double gravity, double softening_squared
) {
  for (u32 i = 0; i < N; i++) {
    double sx = 0.0, sy = 0.0, sz = 0.0;
    const double x = px[i], y = py[i], z = pz[i];
    for (u32 j = 0; j < N; j++) {
      if (i == j) continue;
      const double dx = px[j] - x;
      const double dy = py[j] - y;
      const double dz = pz[j] - z;
      const double inv = 1.0 / square_root(dx * dx + dy * dy + dz * dz + softening_squared);
      const double scale = gravity * mass[j] * inv * inv * inv;
      sx += dx * scale;
      sy += dy * scale;
      sz += dz * scale;
    }
    ax[i] = sx; ay[i] = sy; az[i] = sz;
  }
}

static double total_energy(
  const double *mass, const double *px, const double *py, const double *pz,
  const double *vx, const double *vy, const double *vz,
  double gravity, double softening_squared
) {
  double kinetic = 0.0, potential = 0.0;
  for (u32 i = 0; i < N; i++) {
    kinetic += 0.5 * mass[i] * (vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
    for (u32 j = i + 1; j < N; j++) {
      const double dx = px[j] - px[i];
      const double dy = py[j] - py[i];
      const double dz = pz[j] - pz[i];
      potential -= gravity * mass[i] * mass[j] /
        square_root(dx * dx + dy * dy + dz * dz + softening_squared);
    }
  }
  return kinetic + potential;
}

static void write_state(u32 offset, const double *px, const double *py, const double *pz,
                        const double *vx, const double *vy, const double *vz) {
  const double *parts[6] = { px, py, pz, vx, vy, vz };
  double *target = (double *)(output_data + offset);
  u32 cursor = 0;
  for (u32 part = 0; part < 6; part++) {
    for (u32 i = 0; i < N; i++) target[cursor++] = parts[part][i];
  }
}

u32 run_small(u32 count, u32 steps, double dt, double gravity, double softening_squared) {
  if (count < 2u || count > 16u || steps > 8u) return 0u;
  double *mass = (double *)input_data;
  double *px = mass + count, *py = px + count, *pz = py + count;
  double *vx = pz + count, *vy = vx + count, *vz = vy + count;
  for (u32 i = 0; i < count; i++) {
    double sx = 0.0, sy = 0.0, sz = 0.0;
    for (u32 j = 0; j < count; j++) if (i != j) {
      const double dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
      const double inv = 1.0 / square_root(dx * dx + dy * dy + dz * dz + softening_squared);
      const double scale = gravity * mass[j] * inv * inv * inv;
      sx += dx * scale; sy += dy * scale; sz += dz * scale;
    }
    ax[i] = sx; ay[i] = sy; az[i] = sz;
  }
  for (u32 step = 0; step < steps; step++) {
    for (u32 i = 0; i < count; i++) {
      vx[i] += ax[i] * dt * 0.5; vy[i] += ay[i] * dt * 0.5; vz[i] += az[i] * dt * 0.5;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
    }
    for (u32 i = 0; i < count; i++) {
      double sx = 0.0, sy = 0.0, sz = 0.0;
      for (u32 j = 0; j < count; j++) if (i != j) {
        const double dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
        const double inv = 1.0 / square_root(dx * dx + dy * dy + dz * dz + softening_squared);
        const double scale = gravity * mass[j] * inv * inv * inv;
        sx += dx * scale; sy += dy * scale; sz += dz * scale;
      }
      ax[i] = sx; ay[i] = sy; az[i] = sz;
    }
    for (u32 i = 0; i < count; i++) {
      vx[i] += ax[i] * dt * 0.5; vy[i] += ay[i] * dt * 0.5; vz[i] += az[i] * dt * 0.5;
    }
  }
  double *target = (double *)output_data; u32 cursor = 0;
  double *parts[6] = { px, py, pz, vx, vy, vz };
  for (u32 part = 0; part < 6u; part++) for (u32 i = 0; i < count; i++) target[cursor++] = parts[part][i];
  return count * 6u * 8u;
}

u32 run(void) {
  if (read_u32(0) != INPUT_MAGIC || read_u32(4) != 1u || read_u32(8) != N || read_u32(12) != STEPS) return 0;
  double *mass = (double *)(input_data + 64u);
  double *px = mass + N, *py = px + N, *pz = py + N;
  double *vx = pz + N, *vy = vx + N, *vz = vy + N;
  const double dt = *(double *)(input_data + 32u);
  const double softening_squared = *(double *)(input_data + 40u);
  const double gravity = *(double *)(input_data + 48u);
  const u32 checkpoints[5] = { 1u, 30u, 60u, 90u, 120u };

  write_u32(0, OUTPUT_MAGIC); write_u32(4, 1u); write_u32(8, N);
  write_u32(12, STEPS); write_u32(16, 5u); write_u32(20, 0u);
  write_u64(24, 121u); write_u64(32, (u64)121u * N * (N - 1u));
  write_u64(40, (u64)STEPS * N * 2u); write_u64(48, (u64)STEPS * N);
  write_u64(56, (u64)121u * N * 3u); write_u64(64, (u64)5u * STATE_VALUES);
  write_u64(72, INPUT_BYTES); write_u64(80, OUTPUT_BYTES);
  write_u64(88, (u64)N * (N - 1u)); write_u64(96, (u64)N * 2u);

  const double initial_energy = total_energy(mass, px, py, pz, vx, vy, vz, gravity, softening_squared);
  write_f64(104, initial_energy);
  compute_acceleration(mass, px, py, pz, gravity, softening_squared);
  u32 checkpoint_index = 0;
  for (u32 step = 1; step <= STEPS; step++) {
    for (u32 i = 0; i < N; i++) {
      vx[i] += ax[i] * dt * 0.5; vy[i] += ay[i] * dt * 0.5; vz[i] += az[i] * dt * 0.5;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
    }
    compute_acceleration(mass, px, py, pz, gravity, softening_squared);
    for (u32 i = 0; i < N; i++) {
      vx[i] += ax[i] * dt * 0.5; vy[i] += ay[i] * dt * 0.5; vz[i] += az[i] * dt * 0.5;
    }
    if (checkpoint_index < 5u && step == checkpoints[checkpoint_index]) {
      write_state(OUTPUT_HEADER + STATE_VALUES * 8u * (1u + checkpoint_index), px, py, pz, vx, vy, vz);
      checkpoint_index++;
    }
  }
  write_state(OUTPUT_HEADER, px, py, pz, vx, vy, vz);
  const double final_energy = total_energy(mass, px, py, pz, vx, vy, vz, gravity, softening_squared);
  double drift = (final_energy - initial_energy) / initial_energy;
  if (drift < 0.0) drift = -drift;
  write_f64(112, final_energy); write_f64(120, drift);
  return OUTPUT_BYTES;
}
