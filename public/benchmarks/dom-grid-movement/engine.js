// Deterministic DOM Grid Movement Engine (JS vs Wasm) — REAL DOM.
//
// Two honest halves, both measured:
//   1. Model computation — 128 entities on a 64×64 grid, 3,600 frozen move
//      actions (seeded 0xc001d00d). JS binary-search-free array model, or a
//      REAL Wasm kernel (/artifacts/dom-grid-movement/dom_grid.wasm) running
//      the same trace over linear memory.
//   2. DOM application — the iframe DOM host renders the 128 entities as real
//      DOM cells and moves the moved entity per action (style.left/top +
//      textContent), so the measured iteration includes real DOM mutation.

export const GRID_ENTITIES = 128;
export const GRID_WIDTH = 64;
export const GRID_HEIGHT = 64;

export function generateGridActions() {
  const actions = [];
  const directions = ["up", "down", "left", "right"];
  let seed = 0xc001d00d;
  function rand() {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 3600; i++) {
    actions.push({
      entityId: Math.floor(rand() * 128),
      dir: directions[Math.floor(rand() * 4)],
    });
  }
  return actions;
}

export function initialEntities() {
  return new Array(GRID_ENTITIES).fill(null).map((_, i) => ({
    id: i,
    x: (i * 3) % GRID_WIDTH,
    y: Math.floor((i * 3) / GRID_WIDTH),
  }));
}

export function runGridMovementJS(actions, entities = initialEntities()) {
  let totalMoves = 0;
  let collisions = 0;

  for (const action of actions) {
    const entity = entities[action.entityId];
    let newX = entity.x;
    let newY = entity.y;

    if (action.dir === "up") newY = Math.max(0, entity.y - 1);
    else if (action.dir === "down") newY = Math.min(GRID_HEIGHT - 1, entity.y + 1);
    else if (action.dir === "left") newX = Math.max(0, entity.x - 1);
    else if (action.dir === "right") newX = Math.min(GRID_WIDTH - 1, entity.x + 1);

    let occupied = false;
    for (let j = 0; j < entities.length; j++) {
      if (j !== entity.id && entities[j].x === newX && entities[j].y === newY) {
        occupied = true;
        collisions++;
        break;
      }
    }

    if (!occupied) {
      entity.x = newX;
      entity.y = newY;
      totalMoves++;
    }
  }

  return {
    actionsProcessed: actions.length,
    totalMoves,
    collisions,
    finalPosSum: entities.reduce((acc, e) => acc + e.x + e.y * GRID_WIDTH, 0),
    entities,
  };
}

/** Fetch + instantiate the REAL Wasm kernel (linear memory). */
export async function instantiateGridWasm() {
  const response = await fetch("/artifacts/dom-grid-movement/dom_grid.wasm", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`dom_grid.wasm fetch failed: ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  return instance;
}

const GRID_ENT_B = 0;
const GRID_ACT_B = 1024;
const GRID_RES_B = 1024 + 3600 * 4;
const GRID_STP_B = GRID_RES_B + 12;

/** Wasm model run — writes entities + packed actions into linear memory, calls
 * the kernel, reads back totals, final positions and the per-move step log.
 * Returns { steps, entities } so DOM application is target-agnostic. */
export function runGridMovementWasm(actions, instance) {
  const mem = new Int32Array(instance.exports.memory.buffer);
  for (let i = 0; i < GRID_ENTITIES; i++) {
    mem[GRID_ENT_B / 4 + i * 2] = (i * 3) % GRID_WIDTH;
    mem[GRID_ENT_B / 4 + i * 2 + 1] = Math.floor((i * 3) / GRID_WIDTH);
  }
  const dirValue = { up: 0, down: 1, left: 2, right: 3 };
  for (let i = 0; i < actions.length; i++) {
    mem[GRID_ACT_B / 4 + i] = (dirValue[actions[i].dir] << 8) | actions[i].entityId;
  }
  const stepCount = instance.exports.run_trace(
    GRID_ENT_B,
    GRID_ACT_B,
    actions.length,
    GRID_RES_B,
    GRID_STP_B,
  );
  const entities = [];
  for (let i = 0; i < GRID_ENTITIES; i++) {
    entities.push({
      id: i,
      x: mem[GRID_ENT_B / 4 + i * 2],
      y: mem[GRID_ENT_B / 4 + i * 2 + 1],
    });
  }
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    steps.push({
      entityId: mem[GRID_STP_B / 4 + i * 3],
      x: mem[GRID_STP_B / 4 + i * 3 + 1],
      y: mem[GRID_STP_B / 4 + i * 3 + 2],
    });
  }
  return {
    actionsProcessed: actions.length,
    totalMoves: mem[GRID_RES_B / 4],
    collisions: mem[GRID_RES_B / 4 + 1],
    finalPosSum: mem[GRID_RES_B / 4 + 2],
    entities,
    steps,
  };
}

/** JS model run with a per-move step log (same interface as the Wasm path). */
export function runGridMovementJSSteps(actions) {
  const entities = initialEntities();
  const steps = [];
  let totalMoves = 0;
  let collisions = 0;
  for (const action of actions) {
    const entity = entities[action.entityId];
    let newX = entity.x;
    let newY = entity.y;
    if (action.dir === "up") newY = Math.max(0, entity.y - 1);
    else if (action.dir === "down") newY = Math.min(GRID_HEIGHT - 1, entity.y + 1);
    else if (action.dir === "left") newX = Math.max(0, entity.x - 1);
    else if (action.dir === "right") newX = Math.min(GRID_WIDTH - 1, entity.x + 1);
    let occupied = false;
    for (let j = 0; j < entities.length; j++) {
      if (j !== entity.id && entities[j].x === newX && entities[j].y === newY) {
        occupied = true;
        collisions++;
        break;
      }
    }
    if (!occupied) {
      entity.x = newX;
      entity.y = newY;
      totalMoves++;
      steps.push({ entityId: entity.id, x: newX, y: newY });
    }
  }
  return {
    actionsProcessed: actions.length,
    totalMoves,
    collisions,
    finalPosSum: entities.reduce((acc, e) => acc + e.x + e.y * GRID_WIDTH, 0),
    entities,
    steps,
  };
}

// ── REAL DOM: a grid of entity cells the host drives with real DOM APIs ─────

/**
 * Build a real DOM grid: a container with 128 absolutely-positioned entity
 * cells (8px each on a 512px board). Each action moves the target entity's
 * cell (style.left/top + textContent) — real DOM mutation per move.
 */
export function buildGridDom({ container, entityCount = GRID_ENTITIES, cellSize = 8 }) {
  const board = document.createElement("div");
  board.dataset.wvjGridBoard = "1";
  board.style.position = "relative";
  board.style.width = `${GRID_WIDTH * cellSize}px`;
  board.style.height = `${GRID_HEIGHT * cellSize}px`;
  board.style.background = "#101015";
  board.style.border = "1px solid #555";

  const cells = [];
  for (let i = 0; i < entityCount; i++) {
    const cell = document.createElement("div");
    cell.dataset.wvjGridCell = "1";
    cell.dataset.entity = String(i);
    cell.style.position = "absolute";
    cell.style.width = `${cellSize}px`;
    cell.style.height = `${cellSize}px`;
    cell.style.background = "rgba(140, 190, 255, 0.75)";
    cell.style.border = "1px solid rgba(255,255,255,0.35)";
    cell.style.boxSizing = "border-box";
    board.append(cell);
    cells.push(cell);
  }
  container.append(board);

  let domOps = 0;
  /** Apply one frozen action: move the entity's cell to its (already computed)
   * position. `pos` = { x, y } in grid cells. */
  function applyMove(entityId, pos) {
    const cell = cells[entityId];
    cell.style.left = `${pos.x * cellSize}px`;
    cell.style.top = `${pos.y * cellSize}px`;
    cell.textContent = String(entityId);
    domOps += 1;
    return { domOps };
  }

  function reset() {
    domOps = 0;
    for (let i = 0; i < entityCount; i++) {
      const cell = cells[i];
      cell.style.left = `${((i * 3) % GRID_WIDTH) * cellSize}px`;
      cell.style.top = `${Math.floor((i * 3) / GRID_WIDTH) * cellSize}px`;
      cell.textContent = String(i);
    }
  }

  function verifyFinal(entities) {
    let ok = true;
    let firstBad = "";
    for (let i = 0; i < entityCount; i++) {
      const cell = cells[i];
      const left = parseFloat(cell.style.left);
      const top = parseFloat(cell.style.top);
      if (left !== entities[i].x * cellSize || top !== entities[i].y * cellSize) {
        ok = false;
        firstBad = `entity ${i}: dom(${left},${top}) vs model(${entities[i].x * cellSize},${
          entities[i].y * cellSize
        })`;
        break;
      }
    }
    return { ok, firstBad, cells: entityCount };
  }

  return { board, cells, applyMove, reset, verifyFinal, cellSize };
}

/** One full trace pass over the real DOM. computeSteps() runs INSIDE the timed
 * region (JS or Wasm) and returns { steps, entities } — steps drive the DOM
 * moves, entities verify the final state. */
export function runGridDomTraceOnce({
  computeSteps, // () => { steps: [{entityId,x,y}], entities: [{x,y}] }
  container,
  build = buildGridDom,
  keep = false,
}) {
  const dom = build({ container });
  const t0 = performance.now();
  const { steps, entities } = computeSteps();
  let domOps = 0;
  for (const step of steps) {
    const applied = dom.applyMove(step.entityId, step);
    domOps += applied.domOps;
  }
  const verified = dom.verifyFinal(entities);
  const ms = performance.now() - t0;
  if (!keep) dom.board.remove();
  return { ms, domOps, verified, dom: keep ? dom : null, steps: steps.length };
}
