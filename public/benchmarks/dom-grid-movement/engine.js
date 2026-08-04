// Deterministic DOM Grid Movement Engine (JS vs Wasm)

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

export function runGridMovementJS(actions) {
  const gridWidth = 64;
  const gridHeight = 64;
  const entities = new Array(128).fill(null).map((_, i) => ({
    id: i,
    x: (i * 3) % gridWidth,
    y: Math.floor((i * 3) / gridWidth),
  }));

  let totalMoves = 0;
  let collisions = 0;

  for (const action of actions) {
    const entity = entities[action.entityId];
    let newX = entity.x;
    let newY = entity.y;

    if (action.dir === "up") newY = Math.max(0, entity.y - 1);
    else if (action.dir === "down") newY = Math.min(gridHeight - 1, entity.y + 1);
    else if (action.dir === "left") newX = Math.max(0, entity.x - 1);
    else if (action.dir === "right") newX = Math.min(gridWidth - 1, entity.x + 1);

    // Collision check against other entities
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
    finalPosSum: entities.reduce((acc, e) => acc + e.x + e.y * gridWidth, 0),
  };
}

export function runGridMovementWasm(actions) {
  // Wasm / Int32Array linear memory layout
  const gridWidth = 64;
  const gridHeight = 64;
  const entitiesMemory = new Int32Array(128 * 2); // x, y for 128 entities

  for (let i = 0; i < 128; i++) {
    entitiesMemory[i * 2] = (i * 3) % gridWidth;
    entitiesMemory[i * 2 + 1] = Math.floor((i * 3) / gridWidth);
  }

  let totalMoves = 0;
  let collisions = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const eIdx = action.entityId * 2;
    const curX = entitiesMemory[eIdx];
    const curY = entitiesMemory[eIdx + 1];

    let newX = curX;
    let newY = curY;

    if (action.dir === "up") newY = Math.max(0, curY - 1);
    else if (action.dir === "down") newY = Math.min(gridHeight - 1, curY + 1);
    else if (action.dir === "left") newX = Math.max(0, curX - 1);
    else if (action.dir === "right") newX = Math.min(gridWidth - 1, curX + 1);

    let occupied = false;
    for (let j = 0; j < 128; j++) {
      if (
        j !== action.entityId && entitiesMemory[j * 2] === newX &&
        entitiesMemory[j * 2 + 1] === newY
      ) {
        occupied = true;
        collisions++;
        break;
      }
    }

    if (!occupied) {
      entitiesMemory[eIdx] = newX;
      entitiesMemory[eIdx + 1] = newY;
      totalMoves++;
    }
  }

  let finalPosSum = 0;
  for (let i = 0; i < 128; i++) {
    finalPosSum += entitiesMemory[i * 2] + entitiesMemory[i * 2 + 1] * gridWidth;
  }

  return {
    actionsProcessed: actions.length,
    totalMoves,
    collisions,
    finalPosSum,
  };
}
