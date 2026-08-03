#include <stdint.h>

#define BODIES 500u
#define JOINTS 19u
#define FIXTURE_BYTES (64u + BODIES * 28u + JOINTS * 16u)
#define MAX_PAIRS 8192u
#define MAX_CHECKPOINTS 6u
#define STATE_VALUES (BODIES * 4u)

static uint8_t fixture[FIXTURE_BYTES];
static float x[BODIES], y[BODIES], vx[BODIES], vy[BODIES];
static float inv_mass[BODIES], half_x[BODIES], half_y[BODIES];
static uint32_t joint_a[JOINTS], joint_b[JOINTS];
static float joint_rest[JOINTS], joint_stiffness[JOINTS];
static uint32_t order[BODIES], pair_a[MAX_PAIRS], pair_b[MAX_PAIRS];

struct Result {
  uint32_t timesteps;
  uint32_t broadphase_pairs;
  uint32_t narrowphase_tests;
  uint32_t contacts;
  uint32_t contact_constraints;
  uint32_t joint_constraints;
  uint32_t velocity_iterations;
  uint32_t position_iterations;
  uint32_t state_values;
  uint32_t reserved[7];
  float checkpoints[MAX_CHECKPOINTS * STATE_VALUES];
};
static struct Result result;

static uint32_t u32(uint32_t offset) {
  return ((uint32_t)fixture[offset]) | ((uint32_t)fixture[offset + 1] << 8) |
    ((uint32_t)fixture[offset + 2] << 16) | ((uint32_t)fixture[offset + 3] << 24);
}
static float f32(uint32_t offset) {
  union { uint32_t u; float f; } value;
  value.u = u32(offset);
  return value.f;
}
static float absf(float value) { return value < 0.0f ? -value : value; }
static float sqrt_f32(float value) { return __builtin_sqrtf(value); }
static float quantize_step(float value) {
  float scaled = value * 1000.0f;
  int32_t rounded = (int32_t)(scaled < 0.0f ? scaled - 0.5f : scaled + 0.5f);
  return (float)rounded / 1000.0f;
}

__attribute__((visibility("default"))) uint32_t fixture_ptr(void) {
  return (uint32_t)(uintptr_t)fixture;
}
__attribute__((visibility("default"))) uint32_t result_ptr(void) {
  return (uint32_t)(uintptr_t)&result;
}

static void snapshot(uint32_t checkpoint) {
  uint32_t at = checkpoint * STATE_VALUES;
  for (uint32_t id = 0; id < BODIES; id++) {
    result.checkpoints[at++] = x[id];
    result.checkpoints[at++] = y[id];
    result.checkpoints[at++] = vx[id];
    result.checkpoints[at++] = vy[id];
  }
}

__attribute__((visibility("default"))) int32_t run(uint32_t timesteps, uint32_t checkpoint_every) {
  if (u32(8) != 1u || u32(12) != BODIES || u32(16) > JOINTS ||
      timesteps == 0u || timesteps > 1800u || checkpoint_every == 0u ||
      (timesteps + checkpoint_every - 1u) / checkpoint_every > MAX_CHECKPOINTS) return 1;
  const uint32_t joint_count = u32(16);
  const uint32_t velocity_iterations = u32(24);
  const uint32_t position_iterations = u32(28);
  const float dt = f32(40), gravity_y = f32(44), linear_damping = f32(60);
  for (uint32_t word = 0; word < 16u; word++) ((uint32_t*)&result)[word] = 0u;
  for (uint32_t id = 0; id < BODIES; id++) {
    uint32_t offset = 64u + id * 28u;
    x[id] = f32(offset); y[id] = f32(offset + 4u);
    vx[id] = f32(offset + 8u); vy[id] = f32(offset + 12u);
    inv_mass[id] = f32(offset + 16u); half_x[id] = f32(offset + 20u);
    half_y[id] = f32(offset + 24u); order[id] = id;
  }
  uint32_t joint_base = 64u + BODIES * 28u;
  for (uint32_t joint = 0; joint < joint_count; joint++) {
    uint32_t offset = joint_base + joint * 16u;
    joint_a[joint] = u32(offset); joint_b[joint] = u32(offset + 4u);
    joint_rest[joint] = f32(offset + 8u); joint_stiffness[joint] = f32(offset + 12u);
  }
  uint32_t checkpoint = 0u;
  for (uint32_t step = 0; step < timesteps; step++) {
    for (uint32_t id = 0; id < BODIES; id++) {
      vy[id] = vy[id] + gravity_y * dt;
      vx[id] = vx[id] * linear_damping;
      vy[id] = vy[id] * linear_damping;
      x[id] = x[id] + vx[id] * dt;
      y[id] = y[id] + vy[id] * dt;
      x[id] = quantize_step(x[id]); y[id] = quantize_step(y[id]);
      vx[id] = quantize_step(vx[id]); vy[id] = quantize_step(vy[id]);
    }
    for (uint32_t index = 1u; index < BODIES; index++) {
      uint32_t id = order[index];
      float key = x[id] - half_x[id];
      uint32_t at = index;
      while (at > 0u) {
        uint32_t prior = order[at - 1u];
        float prior_key = x[prior] - half_x[prior];
        if (prior_key < key || (prior_key == key && prior < id)) break;
        order[at] = prior;
        at--;
      }
      order[at] = id;
    }
    uint32_t pair_count = 0u;
    for (uint32_t left = 0; left < BODIES; left++) {
      uint32_t a = order[left];
      float max_x = x[a] + half_x[a];
      for (uint32_t right = left + 1u; right < BODIES; right++) {
        uint32_t b = order[right];
        if (x[b] - half_x[b] > max_x) break;
        result.broadphase_pairs++;
        result.narrowphase_tests++;
        float px = half_x[a] + half_x[b] - absf(x[b] - x[a]);
        float py = half_y[a] + half_y[b] - absf(y[b] - y[a]);
        if (px > 0.0f && py > 0.0f) {
          if (pair_count >= MAX_PAIRS) return 2;
          pair_a[pair_count] = a; pair_b[pair_count] = b; pair_count++;
        }
      }
    }
    uint32_t ground_count = 0u;
    for (uint32_t id = 0; id < BODIES; id++) if (y[id] <= half_y[id] + 0.002f) ground_count++;
    result.contacts += pair_count + ground_count;
    for (uint32_t iteration = 0; iteration < velocity_iterations; iteration++) {
      result.velocity_iterations++;
      for (uint32_t id = 0; id < BODIES; id++) {
        if (y[id] <= half_y[id] + 0.002f && vy[id] < 0.0f) vy[id] = 0.0f;
      }
      for (uint32_t pair = 0; pair < pair_count; pair++) {
        uint32_t a = pair_a[pair], b = pair_b[pair];
        float dx = x[b] - x[a], dy = y[b] - y[a];
        float px = half_x[a] + half_x[b] - absf(dx);
        float py = half_y[a] + half_y[b] - absf(dy);
        if (px <= 0.0f || py <= 0.0f) continue;
        float inverse = inv_mass[a] + inv_mass[b];
        if (px < py) {
          float sign = dx < 0.0f ? -1.0f : 1.0f;
          float relative = (vx[b] - vx[a]) * sign;
          if (relative < 0.0f) {
            float impulse = -relative / inverse;
            vx[a] = vx[a] - impulse * sign * inv_mass[a];
            vx[b] = vx[b] + impulse * sign * inv_mass[b];
          }
        } else {
          float sign = dy < 0.0f ? -1.0f : 1.0f;
          float relative = (vy[b] - vy[a]) * sign;
          if (relative < 0.0f) {
            float impulse = -relative / inverse;
            vy[a] = vy[a] - impulse * sign * inv_mass[a];
            vy[b] = vy[b] + impulse * sign * inv_mass[b];
          }
        }
        result.contact_constraints++;
      }
      for (uint32_t joint = 0; joint < joint_count; joint++) {
        uint32_t a = joint_a[joint], b = joint_b[joint];
        float dx = x[b] - x[a], dy = y[b] - y[a];
        float length = sqrt_f32(dx * dx + dy * dy);
        if (length > 0.000001f) {
          float nx = dx / length, ny = dy / length;
          float relative = (vx[b] - vx[a]) * nx + (vy[b] - vy[a]) * ny;
          float impulse = -relative / (inv_mass[a] + inv_mass[b]);
          vx[a] = vx[a] - impulse * nx * inv_mass[a];
          vy[a] = vy[a] - impulse * ny * inv_mass[a];
          vx[b] = vx[b] + impulse * nx * inv_mass[b];
          vy[b] = vy[b] + impulse * ny * inv_mass[b];
        }
        result.joint_constraints++;
      }
    }
    for (uint32_t iteration = 0; iteration < position_iterations; iteration++) {
      result.position_iterations++;
      for (uint32_t id = 0; id < BODIES; id++) if (y[id] < half_y[id]) y[id] = half_y[id];
      for (uint32_t index = 1u; index < BODIES; index++) {
        uint32_t id = order[index];
        float key = x[id] - half_x[id];
        uint32_t at = index;
        while (at > 0u) {
          uint32_t prior = order[at - 1u];
          float prior_key = x[prior] - half_x[prior];
          if (prior_key < key || (prior_key == key && prior < id)) break;
          order[at] = prior; at--;
        }
        order[at] = id;
      }
      pair_count = 0u;
      for (uint32_t left = 0; left < BODIES; left++) {
        uint32_t a = order[left];
        float max_x = x[a] + half_x[a];
        for (uint32_t right = left + 1u; right < BODIES; right++) {
          uint32_t b = order[right];
          if (x[b] - half_x[b] > max_x) break;
          result.broadphase_pairs++; result.narrowphase_tests++;
          float px = half_x[a] + half_x[b] - absf(x[b] - x[a]);
          float py = half_y[a] + half_y[b] - absf(y[b] - y[a]);
          if (px > 0.0f && py > 0.0f) {
            if (pair_count >= MAX_PAIRS) return 2;
            pair_a[pair_count] = a; pair_b[pair_count] = b; pair_count++;
          }
        }
      }
      result.contacts += pair_count;
      for (uint32_t pair = 0; pair < pair_count; pair++) {
        uint32_t a = pair_a[pair], b = pair_b[pair];
        float dx = x[b] - x[a], dy = y[b] - y[a];
        float px = half_x[a] + half_x[b] - absf(dx);
        float py = half_y[a] + half_y[b] - absf(dy);
        if (px <= 0.0f || py <= 0.0f) continue;
        float inverse = inv_mass[a] + inv_mass[b];
        if (px < py) {
          float sign = dx < 0.0f ? -1.0f : 1.0f;
          float correction = px;
          x[a] = x[a] - (correction / inverse) * sign * inv_mass[a];
          x[b] = x[b] + (correction / inverse) * sign * inv_mass[b];
        } else {
          float sign = dy < 0.0f ? -1.0f : 1.0f;
          float correction = py;
          if (sign > 0.0f) {
            y[b] = y[b] + correction;
            if (vy[b] < vy[a]) vy[b] = vy[a];
          } else {
            y[a] = y[a] + correction;
            if (vy[a] < vy[b]) vy[a] = vy[b];
          }
        }
        result.contact_constraints++;
      }
      for (uint32_t joint = 0; joint < joint_count; joint++) {
        uint32_t a = joint_a[joint], b = joint_b[joint];
        float dx = x[b] - x[a], dy = y[b] - y[a];
        float length = sqrt_f32(dx * dx + dy * dy);
        if (length > 0.000001f) {
          float error = length - joint_rest[joint];
          float scale = (error * joint_stiffness[joint] / (inv_mass[a] + inv_mass[b])) / length;
          float cx = dx * scale, cy = dy * scale;
          x[a] = x[a] + cx * inv_mass[a]; y[a] = y[a] + cy * inv_mass[a];
          x[b] = x[b] - cx * inv_mass[b]; y[b] = y[b] - cy * inv_mass[b];
        }
        result.joint_constraints++;
      }
      for (uint32_t id = 0; id < BODIES; id++) {
        if (y[id] < half_y[id]) y[id] = half_y[id];
        if (y[id] <= half_y[id] && vy[id] < 0.0f) vy[id] = 0.0f;
        x[id] = quantize_step(x[id]); y[id] = quantize_step(y[id]);
        vx[id] = quantize_step(vx[id]); vy[id] = quantize_step(vy[id]);
      }
    }
    for (uint32_t id = 0; id < BODIES; id++) {
      x[id] = quantize_step(x[id]); y[id] = quantize_step(y[id]);
      vx[id] = quantize_step(vx[id]); vy[id] = quantize_step(vy[id]);
    }
    result.timesteps++;
    if ((step + 1u) % checkpoint_every == 0u || step + 1u == timesteps) snapshot(checkpoint++);
  }
  result.state_values = checkpoint * STATE_VALUES;
  return 0;
}
