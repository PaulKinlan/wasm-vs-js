// Deterministic Keyed List Mutation Engine (JS vs Wasm)

export function generateKeyedListActions() {
  const actions = [];
  const ops = ["insert", "remove", "swap", "update", "move"];
  let seed = 0x1a2b3c4d;
  function rand() {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 2000; i++) {
    const op = ops[Math.floor(rand() * ops.length)];
    actions.push({
      id: i,
      op,
      key: Math.floor(rand() * 1000),
      targetKey: Math.floor(rand() * 1000),
      text: `Item ${Math.floor(rand() * 10000)}`,
    });
  }
  return actions;
}

export function runKeyedListMutationJS(actions) {
  const items = new Array(1000).fill(0).map((_, i) => ({ key: i, text: `Item ${i}` }));
  let patchesCount = 0;
  let textMutations = 0;

  for (const action of actions) {
    if (action.op === "insert") {
      items.push({ key: action.key, text: action.text });
      patchesCount++;
    } else if (action.op === "remove") {
      const idx = items.findIndex((item) => item.key === action.key);
      if (idx !== -1) {
        items.splice(idx, 1);
        patchesCount++;
      }
    } else if (action.op === "swap" && items.length >= 2) {
      const idx1 = action.key % items.length;
      const idx2 = action.targetKey % items.length;
      const temp = items[idx1];
      items[idx1] = items[idx2];
      items[idx2] = temp;
      patchesCount += 2;
    } else if (action.op === "update") {
      const idx = items.findIndex((item) => item.key === action.key);
      if (idx !== -1) {
        items[idx].text = action.text;
        textMutations++;
      }
    } else if (action.op === "move" && items.length >= 2) {
      const idx = items.findIndex((item) => item.key === action.key);
      if (idx !== -1) {
        const [moved] = items.splice(idx, 1);
        const targetIdx = action.targetKey % items.length;
        items.splice(targetIdx, 0, moved);
        patchesCount++;
      }
    }
  }

  const finalKeySum = items.reduce((acc, item) => acc + item.key, 0);
  return {
    actionsProcessed: actions.length,
    finalItemCount: items.length,
    patchesCount,
    textMutations,
    finalKeySum,
  };
}

export function runKeyedListMutationWasm(actions) {
  // Wasm / Int32Array linear memory list simulation
  const keysMemory = new Int32Array(5000);
  let count = 1000;
  for (let i = 0; i < 1000; i++) keysMemory[i] = i;

  let patchesCount = 0;
  let textMutations = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action.op === "insert" && count < 4900) {
      keysMemory[count] = action.key;
      count++;
      patchesCount++;
    } else if (action.op === "remove") {
      let idx = -1;
      for (let j = 0; j < count; j++) {
        if (keysMemory[j] === action.key) {
          idx = j;
          break;
        }
      }
      if (idx !== -1) {
        for (let j = idx; j < count - 1; j++) keysMemory[j] = keysMemory[j + 1];
        count--;
        patchesCount++;
      }
    } else if (action.op === "swap" && count >= 2) {
      const idx1 = action.key % count;
      const idx2 = action.targetKey % count;
      const temp = keysMemory[idx1];
      keysMemory[idx1] = keysMemory[idx2];
      keysMemory[idx2] = temp;
      patchesCount += 2;
    } else if (action.op === "update") {
      textMutations++;
    } else if (action.op === "move" && count >= 2) {
      let idx = -1;
      for (let j = 0; j < count; j++) {
        if (keysMemory[j] === action.key) {
          idx = j;
          break;
        }
      }
      if (idx !== -1) {
        const movedKey = keysMemory[idx];
        for (let j = idx; j < count - 1; j++) keysMemory[j] = keysMemory[j + 1];
        count--;
        const targetIdx = action.targetKey % count;
        for (let j = count; j > targetIdx; j--) keysMemory[j] = keysMemory[j - 1];
        keysMemory[targetIdx] = movedKey;
        count++;
        patchesCount++;
      }
    }
  }

  let finalKeySum = 0;
  for (let i = 0; i < count; i++) finalKeySum += keysMemory[i];

  return {
    actionsProcessed: actions.length,
    finalItemCount: count,
    patchesCount,
    textMutations,
    finalKeySum,
  };
}
