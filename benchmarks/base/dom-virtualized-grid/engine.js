export const GRID_ID = "dom.virtualized-grid.v1";
export const VARIANTS = ["js-controlled", "wasm-linear-controlled"];
export const ROWS = 100_000;
export const ACTIONS = 300;
export const ROW_BYTES = 16;
export const ACTION_BYTES = 16;
export const HEADER_BYTES = 64;
export const COMMAND_WIDTH = 6;
export const MAX_MOUNTED = 28;
export const MAGIC = 0x31445247;
export const RESULT_MAGIC = 0x31525347;
const EMPTY = 0xffffffff;

function next(state) {
  state.value ^= state.value << 13;
  state.value ^= state.value >>> 17;
  state.value ^= state.value << 5;
  return state.value >>> 0;
}

export function generateFixture() {
  const bytes = new Uint8Array(HEADER_BYTES + ROWS * ROW_BYTES + ACTIONS * ACTION_BYTES);
  const view = new DataView(bytes.buffer);
  const fields = [
    MAGIC,
    1,
    ROWS,
    ACTIONS,
    30_000,
    100,
    960,
    480,
    2,
    24,
    20,
    4,
    MAX_MOUNTED,
    0,
    0,
    0,
  ];
  fields.forEach((value, index) => view.setUint32(index * 4, value, true));
  const state = { value: 0x6d2b79f5 };
  let offset = HEADER_BYTES;
  for (let id = 0; id < ROWS; id += 1) {
    const value = next(state);
    view.setUint32(offset, id, true);
    view.setInt32(offset + 4, ((value & 0xffff) - 32768) | 0, true);
    view.setUint32(offset + 8, (value >>> 16) & 7, true);
    view.setUint32(offset + 12, next(state), true);
    offset += ROW_BYTES;
  }
  for (let index = 0; index < ACTIONS; index += 1) {
    let type = 0;
    let a = ((index * 7919) % (ROWS - 20)) * 24;
    let b = 0;
    if (index === ACTIONS - 1) {
      type = 4;
      a = EMPTY;
    } else if (index > 0 && index % 75 === 0) {
      type = 2;
      a = (index / 75) & 1;
    } else if (index > 0 && index % 50 === 0) {
      type = 1;
      a = (index / 50) % 6 === 5 ? EMPTY : (index / 50) & 7;
    } else if (index > 0 && index % 33 === 0) {
      type = 3;
      a = (index * 997) % ROWS;
      b = ((next(state) & 0xffff) - 32768) >>> 0;
    } else if (index > 0 && index % 40 === 0) {
      type = 4;
      a = (((index - 1) * 7919) % (ROWS - 20)) + 5;
    }
    view.setUint32(offset, index * 100, true);
    view.setUint32(offset + 4, type, true);
    view.setUint32(offset + 8, a, true);
    view.setUint32(offset + 12, b, true);
    offset += ACTION_BYTES;
  }
  return bytes;
}

function readFixture(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength !== HEADER_BYTES + ROWS * ROW_BYTES + ACTIONS * ACTION_BYTES
  ) {
    throw new Error("virtualized-grid fixture length mismatch");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== 1 ||
    view.getUint32(8, true) !== ROWS || view.getUint32(12, true) !== ACTIONS
  ) {
    throw new Error("virtualized-grid fixture identity mismatch");
  }
  return view;
}

function compare(orderA, orderB, scores, direction) {
  const scoreA = scores[orderA];
  const scoreB = scores[orderB];
  if (scoreA !== scoreB) return direction ? scoreB - scoreA : scoreA - scoreB;
  return orderA - orderB;
}

function hashWords(words) {
  let hash = 0x811c9dc5;
  for (const word of words) {
    let value = word >>> 0;
    for (let byte = 0; byte < 4; byte += 1) {
      hash ^= value & 255;
      hash = Math.imul(hash, 0x01000193) >>> 0;
      value >>>= 8;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

function execute(bytes, boundaryCrossings, executionTarget) {
  const view = readFixture(bytes);
  const scores = new Int32Array(ROWS);
  const groups = new Uint32Array(ROWS);
  let order = new Uint32Array(ROWS);
  let scratch = new Uint32Array(ROWS);
  const filtered = new Uint32Array(ROWS);
  let offset = HEADER_BYTES;
  for (let index = 0; index < ROWS; index += 1) {
    const id = view.getUint32(offset, true);
    if (id !== index) throw new Error("virtualized-grid row ID mismatch");
    scores[id] = view.getInt32(offset + 4, true);
    groups[id] = view.getUint32(offset + 8, true);
    order[index] = id;
    filtered[index] = id;
    offset += ROW_BYTES;
  }
  let filteredLength = ROWS;
  let filterGroup = EMPTY;
  let scrollOffset = 0;
  let focused = EMPTY;
  let selected = EMPTY;
  const slotRows = new Uint32Array(MAX_MOUNTED).fill(EMPTY);
  const slotScores = new Int32Array(MAX_MOUNTED);
  const slotIndexes = new Uint32Array(MAX_MOUNTED).fill(EMPTY);
  const slotSelected = new Uint8Array(MAX_MOUNTED);
  const slotPositions = new Uint32Array(MAX_MOUNTED).fill(EMPTY);
  let slotCount = 0;
  const commandWords = new Uint32Array(30_000 * COMMAND_WIDTH);
  let commandWordLength = 0;
  const checkpointWords = new Uint32Array(6 * 8);
  let checkpointCount = 0;
  const visible = new Uint32Array(MAX_MOUNTED);
  const used = new Uint8Array(MAX_MOUNTED);
  const counters = {
    rowsScanned: 0,
    comparisons: 0,
    events: 0,
    commands: 0,
    physicalCreates: 0,
    physicalReuses: 0,
    physicalUpdates: 0,
    physicalPlacements: 0,
    physicalHides: 0,
    focusOperations: 0,
    layoutReads: 0,
    allocations: 0,
    boundaryCrossings,
  };
  const emit = (op, a = 0, b = 0, c = 0, d = 0, e = 0) => {
    if (commandWordLength + COMMAND_WIDTH > commandWords.length) {
      throw new Error("virtualized-grid command bound exceeded");
    }
    commandWords[commandWordLength] = op >>> 0;
    commandWords[commandWordLength + 1] = a >>> 0;
    commandWords[commandWordLength + 2] = b >>> 0;
    commandWords[commandWordLength + 3] = c >>> 0;
    commandWords[commandWordLength + 4] = d >>> 0;
    commandWords[commandWordLength + 5] = e >>> 0;
    commandWordLength += COMMAND_WIDTH;
    counters.commands += 1;
  };
  const rebuildFilter = () => {
    filteredLength = 0;
    for (let index = 0; index < ROWS; index += 1) {
      const row = order[index];
      counters.rowsScanned += 1;
      if (filterGroup === EMPTY || groups[row] === filterGroup) filtered[filteredLength++] = row;
    }
  };
  const stableSort = (direction) => {
    for (let width = 1; width < ROWS; width *= 2) {
      for (let left = 0; left < ROWS; left += width * 2) {
        const middle = Math.min(left + width, ROWS);
        const right = Math.min(left + width * 2, ROWS);
        let i = left;
        let j = middle;
        let out = left;
        while (i < middle && j < right) {
          counters.comparisons += 1;
          if (compare(order[i], order[j], scores, direction) <= 0) scratch[out++] = order[i++];
          else scratch[out++] = order[j++];
        }
        while (i < middle) scratch[out++] = order[i++];
        while (j < right) scratch[out++] = order[j++];
      }
      const swap = order;
      order = scratch;
      scratch = swap;
    }
    rebuildFilter();
  };
  const findVisible = (row, length) => {
    for (let index = 0; index < length; index += 1) {
      if (visible[index] === row) return index;
    }
    return -1;
  };
  const reconcile = (actionIndex) => {
    const visibleRows = 20;
    const overscan = 4;
    const base = Math.min(filteredLength, Math.floor(scrollOffset / 24));
    const start = Math.max(0, base - overscan);
    const end = Math.min(filteredLength, base + visibleRows + overscan);
    const visibleLength = end - start;
    used.fill(0);
    for (let index = 0; index < visibleLength; index += 1) {
      visible[index] = filtered[start + index];
    }
    for (let position = 0; position < visibleLength; position += 1) {
      const row = visible[position];
      let slot = -1;
      for (let candidate = 0; candidate < slotCount; candidate += 1) {
        if (slotRows[candidate] === row) {
          slot = candidate;
          break;
        }
      }
      const isSelected = row === selected ? 1 : 0;
      if (slot < 0) {
        for (let candidate = 0; candidate < slotCount; candidate += 1) {
          if (findVisible(slotRows[candidate], visibleLength) < 0 && !used[candidate]) {
            slot = candidate;
            break;
          }
        }
        if (slot < 0) {
          if (slotCount >= MAX_MOUNTED) throw new Error("virtualized-grid mount bound exceeded");
          slot = slotCount++;
          emit(1, slot, row, start + position, scores[row], isSelected);
          counters.physicalCreates += 1;
        } else {
          emit(2, slot, row, start + position, scores[row], isSelected);
          counters.physicalReuses += 1;
        }
        slotRows[slot] = row;
        slotScores[slot] = scores[row];
        slotIndexes[slot] = start + position;
        slotSelected[slot] = isSelected;
      } else if (
        slotScores[slot] !== scores[row] || slotIndexes[slot] !== start + position ||
        slotSelected[slot] !== isSelected
      ) {
        emit(3, slot, row, start + position, scores[row], isSelected);
        counters.physicalUpdates += 1;
        slotScores[slot] = scores[row];
        slotIndexes[slot] = start + position;
        slotSelected[slot] = isSelected;
      }
      used[slot] = 1;
      if (slotPositions[slot] !== position) {
        emit(4, slot, position, row, start + position, 0);
        counters.physicalPlacements += 1;
        slotPositions[slot] = position;
      }
    }
    for (let slot = 0; slot < slotCount; slot += 1) {
      if (!used[slot] && slotRows[slot] !== EMPTY) {
        emit(5, slot, slotRows[slot], 0, 0, 0);
        counters.physicalHides += 1;
        slotRows[slot] = EMPTY;
        slotPositions[slot] = EMPTY;
      }
    }
    for (let slot = 0; slot < slotCount; slot += 1) {
      if (slotRows[slot] === focused) {
        emit(6, slot, focused, 0, 0, 0);
        counters.focusOperations += 1;
        break;
      }
    }
    emit(7, actionIndex, visibleLength, start, end, filteredLength);
    counters.layoutReads += 1;
    if ((actionIndex + 1) % 50 === 0) {
      const at = checkpointCount * 8;
      checkpointWords[at] = actionIndex + 1;
      checkpointWords[at + 1] = start;
      checkpointWords[at + 2] = end;
      checkpointWords[at + 3] = visibleLength;
      checkpointWords[at + 4] = focused;
      checkpointWords[at + 5] = selected;
      checkpointWords[at + 6] = counters.commands;
      checkpointWords[at + 7] = filteredLength;
      checkpointCount += 1;
    }
  };

  const actionOffset = HEADER_BYTES + ROWS * ROW_BYTES;
  for (let action = 0; action < ACTIONS; action += 1) {
    const at = actionOffset + action * ACTION_BYTES;
    if (view.getUint32(at, true) !== action * 100) {
      throw new Error("virtualized-grid event cadence mismatch");
    }
    const type = view.getUint32(at + 4, true);
    const a = view.getUint32(at + 8, true);
    const b = view.getUint32(at + 12, true);
    if (type === 0) scrollOffset = Math.min(a, Math.max(0, filteredLength - 20) * 24);
    else if (type === 1) {
      filterGroup = a;
      rebuildFilter();
      scrollOffset = 0;
    } else if (type === 2) stableSort(a & 1);
    else if (type === 3) {
      if (a >= ROWS) throw new Error("virtualized-grid edit row out of range");
      scores[a] = b | 0;
      selected = a;
    } else if (type === 4) {
      if (a === EMPTY) {
        const base = Math.min(filteredLength - 1, Math.floor(scrollOffset / 24) + 5);
        focused = filtered[base];
      } else {
        if (a >= ROWS) throw new Error("virtualized-grid focus row out of range");
        focused = a;
      }
      selected = focused;
    } else throw new Error("virtualized-grid action denied");
    counters.events += 1;
    reconcile(action);
  }
  const words = commandWords.slice(0, commandWordLength);
  const checkpoints = [];
  for (let index = 0; index < checkpointCount; index += 1) {
    const at = index * 8;
    checkpoints.push({
      action: checkpointWords[at],
      start: checkpointWords[at + 1],
      end: checkpointWords[at + 2],
      visibleLength: checkpointWords[at + 3],
      focused: checkpointWords[at + 4],
      selected: checkpointWords[at + 5],
      commandCount: checkpointWords[at + 6],
      filteredLength: checkpointWords[at + 7],
    });
  }
  return {
    workloadId: GRID_ID,
    executionTarget,
    commandWidth: COMMAND_WIDTH,
    commands: words,
    commandDigest: hashWords(words),
    counters,
    final: checkpoints.at(-1),
    checkpoints,
    fixture: { rows: ROWS, actions: ACTIONS, durationMs: 30_000, eventCadenceMs: 100 },
  };
}

export function runJavaScript(bytes = generateFixture()) {
  return execute(bytes, 0, "javascript");
}

export async function instantiateGridWasm(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}

function decodeWasm(exports) {
  const pointer = exports.result_ptr();
  const memory = exports.memory;
  const header = new Uint32Array(memory.buffer, pointer, 20).slice();
  if (header[0] !== RESULT_MAGIC || header[1] !== 1) {
    throw new Error("virtualized-grid Wasm result identity mismatch");
  }
  const commandCount = header[2];
  if (commandCount > 30_000) throw new Error("virtualized-grid Wasm command bound exceeded");
  const checkpoints = [];
  const checkpointWords = new Uint32Array(memory.buffer, pointer + 20 * 4, 6 * 8).slice();
  for (let index = 0; index < 6; index += 1) {
    const at = index * 8;
    checkpoints.push({
      action: checkpointWords[at],
      start: checkpointWords[at + 1],
      end: checkpointWords[at + 2],
      visibleLength: checkpointWords[at + 3],
      focused: checkpointWords[at + 4],
      selected: checkpointWords[at + 5],
      commandCount: checkpointWords[at + 6],
      filteredLength: checkpointWords[at + 7],
    });
  }
  const commands = new Uint32Array(
    memory.buffer,
    pointer + (20 + 6 * 8) * 4,
    commandCount * COMMAND_WIDTH,
  ).slice();
  const counters = {
    rowsScanned: header[6],
    comparisons: header[7],
    events: header[8],
    commands: header[9],
    physicalCreates: header[10],
    physicalReuses: header[11],
    physicalUpdates: header[12],
    physicalPlacements: header[13],
    physicalHides: header[14],
    focusOperations: header[15],
    layoutReads: header[16],
    allocations: header[17],
    boundaryCrossings: header[18],
  };
  return { header, commands, counters, checkpoints };
}

export function runWasm(exports, bytes = generateFixture()) {
  readFixture(bytes);
  const pointer = exports.input_ptr();
  const memory = exports.memory;
  new Uint8Array(memory.buffer, pointer, bytes.byteLength).set(bytes);
  const status = exports.run(bytes.byteLength);
  if (status !== 0) throw new Error(`virtualized-grid Wasm failed (${status})`);
  const decoded = decodeWasm(exports);
  return {
    workloadId: GRID_ID,
    executionTarget: "wasm-linear",
    commandWidth: COMMAND_WIDTH,
    commands: decoded.commands,
    commandDigest: hashWords(decoded.commands),
    counters: decoded.counters,
    final: decoded.checkpoints.at(-1),
    checkpoints: decoded.checkpoints,
    fixture: { rows: ROWS, actions: ACTIONS, durationMs: 30_000, eventCadenceMs: 100 },
  };
}

export function normalizeForEquivalence(result) {
  return {
    ...result,
    executionTarget: null,
    counters: { ...result.counters, boundaryCrossings: null },
  };
}
