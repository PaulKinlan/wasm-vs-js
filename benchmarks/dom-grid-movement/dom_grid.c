// dom_grid.c — real linear-memory kernel for dom.grid-movement.v1.
//
// The workload: 128 entities on a 64×64 grid, 3,600 frozen move actions
// (entityId + direction). The kernel advances the model in linear memory;
// the JS host applies each move to a REAL DOM grid (entity cells moved with
// style.left/top + textContent).
//
// Memory layout (little-endian):
//   entities_ptr : i32[256]  x,y per entity (128 entities)
//   actions_ptr  : i32[3600] packed pairs: low byte = entityId, next byte = dir
//                  (0=up 1=down 2=left 3=right)
//   results_ptr  : i32[3]    [0] = totalMoves, [1] = collisions, [2] = finalPosSum
//   steps_ptr    : i32[3*3600] per successful move: (entityId, newX, newY)
// Exports: i32 run_trace(i32 entities_ptr, i32 actions_ptr, i32 actions_len,
//                        i32 results_ptr, i32 steps_ptr) -> step count

#define GRID_W 64
#define GRID_H 64
#define ENTITIES 128

__attribute__((export_name("run_trace")))
int run_trace(
    int *entities,
    const unsigned int *actions,
    unsigned int actions_len,
    unsigned int *results,
    unsigned int *steps) {
  unsigned int total_moves = 0;
  unsigned int collisions = 0;

  for (unsigned int a = 0; a < actions_len; a++) {
    const unsigned int packed = actions[a];
    const unsigned int entity_id = packed & 0xff;
    const unsigned int dir = (packed >> 8) & 0xff;
    if (entity_id >= ENTITIES) continue;

    const int *e = &entities[entity_id * 2];
    int new_x = e[0];
    int new_y = e[1];
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
      steps[total_moves * 3] = entity_id;
      steps[total_moves * 3 + 1] = (unsigned int)new_x;
      steps[total_moves * 3 + 2] = (unsigned int)new_y;
      total_moves++;
    }
  }

  int final_pos_sum = 0;
  for (unsigned int i = 0; i < ENTITIES; i++) {
    final_pos_sum += entities[i * 2] + entities[i * 2 + 1] * GRID_W;
  }
  results[0] = total_moves;
  results[1] = collisions;
  results[2] = (unsigned int)final_pos_sum;
  return (int)total_moves;
}
