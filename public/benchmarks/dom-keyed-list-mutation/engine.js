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

// ── REAL Wasm kernel + REAL DOM list ─────────────────────────────────────────

export const KL_ITEMS_B = 0; // i32[1 + 3*4900]
export const KL_ACT_B = 4 + 3 * 4900 * 4; // u32[2000]
export const KL_STP_B = KL_ACT_B + 2000 * 4;
export const KL_RES_B = KL_STP_B + 4 * 2000 * 4;

/** Fetch + instantiate the REAL Wasm kernel. */
export async function instantiateKeyedListWasm() {
  const response = await fetch(
    "/artifacts/dom-keyed-list-mutation/dom_keyed_list.wasm",
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`dom_keyed_list.wasm fetch failed: ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  return instance;
}

const opsValue = { insert: 0, remove: 1, swap: 2, update: 3, move: 4 };

/** Pack one action for the kernel (textId derived deterministically). */
function packAction(action, index) {
  const textId = index % 32;
  return ((opsValue[action.op] & 0x7) |
    ((action.key & 0xfff) << 3) |
    ((action.targetKey & 0xfff) << 15) |
    ((textId & 0x1f) << 27)) >>> 0;
}

function itemText(textId) {
  return `Item ${1000 + textId * 7 + 3}`;
}

/** Run the REAL Wasm kernel over the frozen trace; returns totals + steps. */
export function runKeyedListMutationWasmSteps(actions, instance) {
  const mem32 = new Int32Array(instance.exports.memory.buffer);
  const mem8 = new Uint8Array(instance.exports.memory.buffer);
  mem32[0] = 1000;
  for (let i = 0; i < 1000; i++) {
    mem32[1 + i * 3] = i;
    mem32[1 + i * 3 + 1] = -1; // key-derived initial text, not textId 0
    mem32[1 + i * 3 + 2] = 3;
  }
  const actView = new Uint32Array(mem8.buffer, KL_ACT_B, actions.length);
  for (let i = 0; i < actions.length; i++) actView[i] = packAction(actions[i], i);
  const stepCount = instance.exports.run_trace(
    KL_ITEMS_B,
    KL_ACT_B,
    actions.length,
    KL_STP_B,
    KL_RES_B,
  );
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    const base = (KL_STP_B / 4) + i * 4;
    steps.push({
      op: ["insert", "remove", "swap", "update", "move"][mem32[base]],
      key: mem32[base + 1],
      targetKey: mem32[base + 2],
      textId: mem32[base + 3],
    });
  }
  const items = [];
  const count = mem32[KL_RES_B / 4 + 2];
  for (let i = 0; i < count; i++) {
    const key = mem32[1 + i * 3];
    const textId = mem32[1 + i * 3 + 1];
    items.push({ key, text: textId < 0 ? `Item ${key}` : itemText(textId) });
  }
  return {
    actionsProcessed: actions.length,
    finalItemCount: mem32[KL_RES_B / 4 + 2],
    patchesCount: mem32[KL_RES_B / 4],
    textMutations: mem32[KL_RES_B / 4 + 1],
    finalKeySum: mem32[KL_RES_B / 4 + 3],
    steps,
    items,
  };
}

/** JS model run with the same step log + textId rule (mirrors the kernel). */
export function runKeyedListMutationJSSteps(actions) {
  const items = new Array(1000).fill(0).map((_, i) => ({ key: i, text: `Item ${i}` }));
  const steps = [];
  let patchesCount = 0;
  let textMutations = 0;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const textId = i % 32;
    const text = itemText(textId);
    if (action.op === "insert") {
      items.push({ key: action.key, text });
      patchesCount++;
      steps.push({ op: "insert", key: action.key, targetKey: 0, textId });
    } else if (action.op === "remove") {
      const idx = items.findIndex((item) => item.key === action.key);
      if (idx !== -1) {
        items.splice(idx, 1);
        patchesCount++;
        steps.push({ op: "remove", key: action.key, targetKey: 0, textId: 0 });
      }
    } else if (action.op === "swap" && items.length >= 2) {
      const idx1 = action.key % items.length;
      const idx2 = action.targetKey % items.length;
      const temp = items[idx1];
      items[idx1] = items[idx2];
      items[idx2] = temp;
      patchesCount += 2;
      steps.push({ op: "swap", key: action.key, targetKey: action.targetKey, textId: 0 });
    } else if (action.op === "update") {
      const idx = items.findIndex((item) => item.key === action.key);
      if (idx !== -1) {
        items[idx].text = text;
        textMutations++;
        steps.push({ op: "update", key: action.key, targetKey: 0, textId });
      }
    } else if (action.op === "move" && items.length >= 2) {
      const idx = items.findIndex((item) => item.key === action.key);
      if (idx !== -1) {
        const [moved] = items.splice(idx, 1);
        const targetIdx = action.targetKey % items.length;
        items.splice(targetIdx, 0, moved);
        patchesCount++;
        steps.push({ op: "move", key: action.key, targetKey: action.targetKey, textId: 0 });
      }
    }
  }
  return {
    actionsProcessed: actions.length,
    finalItemCount: items.length,
    patchesCount,
    textMutations,
    finalKeySum: items.reduce((acc, item) => acc + item.key, 0),
    steps,
    items,
  };
}

/** Build a REAL DOM list. The host tracks the model's key order (mirrors the
 * kernel's index semantics) and applies steps with real DOM APIs. */
export function buildKeyedListDom({ container }) {
  const list = document.createElement("ul");
  list.dataset.wvjKeyedList = "1";
  list.style.margin = "0";
  list.style.padding = "0";
  list.style.listStyle = "none";
  list.style.maxHeight = "320px";
  list.style.overflow = "auto";
  list.style.border = "1px solid #555";
  list.style.background = "#101015";
  // `order` mirrors the model items exactly (duplicate keys allowed): each
  // entry holds the key, its text and the live <li> node, so remove/swap/move
  // operate on the same index semantics as the JS model.
  const order = [];

  function makeLi(key, text) {
    const li = document.createElement("li");
    li.dataset.wvjKeyedItem = "1";
    li.dataset.key = String(key);
    li.textContent = text;
    li.style.padding = "2px 8px";
    li.style.font = "11px ui-monospace, monospace";
    li.style.color = "#d8e2f2";
    li.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
    return li;
  }

  for (let i = 0; i < 1000; i++) {
    const li = makeLi(i, `Item ${i}`);
    list.append(li);
    order.push({ key: i, text: `Item ${i}`, li });
  }
  container.append(list);

  function textFor(textId) {
    return itemText(textId);
  }

  function applyStep(step, domOpsRef) {
    const { op, key, targetKey, textId } = step;
    if (op === "insert") {
      const li = makeLi(key, textFor(textId));
      list.append(li);
      order.push({ key, text: textFor(textId), li });
      domOpsRef.n += 1;
    } else if (op === "remove") {
      const idx = order.findIndex((item) => item.key === key);
      if (idx !== -1) {
        const [removed] = order.splice(idx, 1);
        list.removeChild(removed.li);
        domOpsRef.n += 1;
      }
    } else if (op === "swap") {
      const idx1 = key % order.length;
      const idx2 = targetKey % order.length;
      if (idx1 !== idx2 && order.length >= 2) {
        const a = order[idx1];
        const b = order[idx2];
        order[idx1] = b;
        order[idx2] = a;
        list.insertBefore(a.li, b.li.nextSibling);
        domOpsRef.n += 2;
      }
    } else if (op === "update") {
      const idx = order.findIndex((item) => item.key === key);
      if (idx !== -1) {
        order[idx].text = textFor(textId);
        order[idx].li.textContent = textFor(textId);
        domOpsRef.n += 1;
      }
    } else if (op === "move") {
      const idx = order.findIndex((item) => item.key === key);
      if (idx !== -1 && order.length >= 2) {
        const [moved] = order.splice(idx, 1);
        const targetIdx = targetKey % order.length;
        order.splice(targetIdx, 0, moved);
        if (targetIdx >= order.length - 1) {
          list.append(moved.li);
        } else {
          list.insertBefore(moved.li, order[targetIdx + 1].li);
        }
        domOpsRef.n += 1;
      }
    }
  }

  function verifyFinal(items) {
    let ok = order.length === items.length;
    let firstBad = "";
    if (ok) {
      for (let i = 0; i < order.length; i++) {
        if (order[i].key !== items[i].key || order[i].li.textContent !== items[i].text) {
          ok = false;
          firstBad = `pos ${i}: dom=${order[i].key}/${order[i].li.textContent} model=${
            items[i].key
          }/${items[i].text}`;
          break;
        }
      }
    }
    return { ok, firstBad, items: order.length };
  }

  return { list, applyStep, verifyFinal };
}

/** One full trace pass over the real DOM. */
export function runKeyedListDomTraceOnce({
  actions,
  computeSteps, // () => { steps, items }
  container,
  keep = false,
}) {
  const dom = buildKeyedListDom({ container });
  const t0 = performance.now();
  const { steps, items } = computeSteps();
  const ops = { n: 0 };
  for (const step of steps) dom.applyStep(step, ops);
  const verified = dom.verifyFinal(items);
  const ms = performance.now() - t0;
  if (!keep) dom.list.remove();
  return { ms, domOps: ops.n, verified, list: keep ? dom.list : null, steps: steps.length };
}
