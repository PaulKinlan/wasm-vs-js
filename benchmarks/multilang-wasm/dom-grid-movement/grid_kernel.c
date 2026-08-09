// grid_kernel.c — multilang compute core for dom.grid-movement.v1.
//
// ABI (mirrors the multilang-wasm kernels): the kernel GENERATES the frozen
// 3,600-action trace internally from the pinned seed (0xc001d00d), runs the
// 128-entity / 64x64 movement model with collision checks, and writes its
// counters to a fixed memory offset. No pointer args — the caller invokes
// grid_trace() and reads the results from memory.
//
// Results (fixed offset 16384): [0] totalMoves, [1] collisions, [2] finalPosSum
// Exports: i32 grid_trace() -> finalPosSum

#define GRID_W 64
#define GRID_H 64
#define ENTITIES 128
#define ACTIONS 3600
#define RES_OFFSET 16384

static unsigned int seed = 0xc001d00d;
static unsigned int next_rand(void) {
  seed ^= seed << 13;
  // the engine's JS rand() applies >> 17 to the int32 interpretation
  // (arithmetic, sign-extending) — replicate exactly
  seed ^= (unsigned int)((int)seed >> 17);
  seed ^= seed << 5;
  return seed;
}

static void generate_actions(unsigned int *actions) {
  seed = 0xc001d00d;
  for (unsigned int i = 0; i < ACTIONS; i++) {
    const unsigned int r = next_rand();
    const unsigned int r2 = next_rand();
    const unsigned int entity = (r >> 25) & 0x7f;
    const unsigned int dir = (r2 >> 30);
    actions[i] = (dir << 8) | entity;
  }
}

__attribute__((export_name("grid_trace")))
int grid_trace(void) {
  int entities[ENTITIES * 2];
  unsigned int actions[ACTIONS];
  unsigned int *results = (unsigned int *)RES_OFFSET;
  for (int i = 0; i < ENTITIES; i++) {
    entities[i * 2] = (i * 3) % GRID_W;
    entities[i * 2 + 1] = (i * 3) / GRID_W;
  }
  generate_actions(actions);

  unsigned int total_moves = 0;
  unsigned int collisions = 0;
  for (unsigned int a = 0; a < ACTIONS; a++) {
    const unsigned int entity_id = actions[a] & 0xff;
    const unsigned int dir = (actions[a] >> 8) & 0xff;
    int new_x = entities[entity_id * 2];
    int new_y = entities[entity_id * 2 + 1];
    switch (dir) {
      case 0: if (new_y > 0) new_y--; break;
      case 1: if (new_y < GRID_H - 1) new_y++; break;
      case 2: if (new_x > 0) new_x--; break;
      case 3: if (new_x < GRID_W - 1) new_x++; break;
      default: break;
    }
    int occupied = 0;
    for (unsigned int j = 0; j < ENTITIES; j++) {
      if (j == entity_id) continue;
      if (entities[j * 2] == new_x && entities[j * 2 + 1] == new_y) {
        occupied = 1;
        collisions++;
        break;
      }
    }
    if (!occupied) {
      entities[entity_id * 2] = new_x;
      entities[entity_id * 2 + 1] = new_y;
      total_moves++;
    }
  }
  int final_pos_sum = 0;
  for (int i = 0; i < ENTITIES; i++) {
    final_pos_sum += entities[i * 2] + entities[i * 2 + 1] * GRID_W;
  }
  results[0] = total_moves;
  results[1] = collisions;
  results[2] = (unsigned int)final_pos_sum;
  return final_pos_sum;
}
