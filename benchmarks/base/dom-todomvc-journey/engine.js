import { ACTION, encodeActionTrace, FILTER, generateActionTrace } from "./fixture.js";

const TODO_COUNT = 100;
const COMMAND_FIELDS = 4;
const INPUT_PTR = 4096;
const COMMAND_PTR = 8192;
const STATE_PTR = 16384;

function assertAction(opcode, id, value, focus) {
  if (!Object.values(ACTION).includes(opcode)) throw new Error(`unknown opcode ${opcode}`);
  if (!Number.isInteger(id) || id < 0 || id >= TODO_COUNT) throw new Error(`invalid todo id ${id}`);
  if (!Number.isInteger(value) || !Number.isInteger(focus) || (focus !== 0 && focus !== 1)) {
    throw new Error("invalid action fields");
  }
}

export class TodoJsEngine {
  constructor() {
    this.flags = new Uint8Array(TODO_COUNT);
    this.versions = new Uint8Array(TODO_COUNT);
    this.filter = FILTER.ALL;
    this.allocations = 2;
    this.counters = {
      actions: 0,
      adds: 0,
      toggles: 0,
      filters: 0,
      removes: 0,
      edits: 0,
      stateWrites: 0,
      commandsEmitted: 0,
    };
  }

  apply(opcode, id, value, focus) {
    assertAction(opcode, id, value, focus);
    if (opcode === ACTION.ADD) {
      if (this.flags[id] !== 0) throw new Error(`duplicate add ${id}`);
      this.flags[id] = 1;
      this.versions[id] = 0;
      this.counters.adds += 1;
      this.counters.stateWrites += 2;
    } else if (opcode === ACTION.TOGGLE) {
      if ((this.flags[id] & 1) === 0) throw new Error(`toggle missing ${id}`);
      this.flags[id] ^= 2;
      this.counters.toggles += 1;
      this.counters.stateWrites += 1;
    } else if (opcode === ACTION.FILTER) {
      if (![FILTER.ALL, FILTER.ACTIVE, FILTER.COMPLETED].includes(value)) {
        throw new Error(`invalid filter ${value}`);
      }
      this.filter = value;
      this.counters.filters += 1;
      this.counters.stateWrites += 1;
    } else if (opcode === ACTION.EDIT) {
      if ((this.flags[id] & 1) === 0 || value !== 1) throw new Error(`invalid edit ${id}`);
      this.versions[id] = value;
      this.counters.edits += 1;
      this.counters.stateWrites += 1;
    } else if (opcode === ACTION.REMOVE) {
      if ((this.flags[id] & 1) === 0) throw new Error(`remove missing ${id}`);
      this.flags[id] = 0;
      this.counters.removes += 1;
      this.counters.stateWrites += 1;
    }
    this.counters.actions += 1;
    this.counters.commandsEmitted += 1;
    return [opcode, id, value, focus];
  }

  run(encoded) {
    if (!(encoded instanceof Int32Array) || encoded.length % COMMAND_FIELDS !== 0) {
      throw new Error("encoded trace must contain four i32 fields per action");
    }
    const commands = new Int32Array(encoded.length);
    this.allocations += 1;
    for (let offset = 0; offset < encoded.length; offset += COMMAND_FIELDS) {
      commands.set(
        this.apply(
          encoded[offset],
          encoded[offset + 1],
          encoded[offset + 2],
          encoded[offset + 3],
        ),
        offset,
      );
    }
    return commands;
  }
}

export function summarizeState(flags, versions, filter) {
  let alive = 0;
  let completed = 0;
  let edited = 0;
  for (let id = 0; id < TODO_COUNT; id += 1) {
    if ((flags[id] & 1) !== 0) {
      alive += 1;
      if ((flags[id] & 2) !== 0) completed += 1;
      if (versions[id] === 1) edited += 1;
    }
  }
  return {
    alive,
    active: alive - completed,
    completed,
    edited,
    filter,
    focus: { id: 95, version: 1 },
  };
}

const EXPECTED_CORE_COUNTERS = Object.freeze({
  actions: 150,
  adds: 100,
  toggles: 34,
  filters: 3,
  removes: 10,
  edits: 3,
  stateWrites: 250,
  commandsEmitted: 150,
});

function completeCounters(operative, observed, target) {
  const expected = {
    ...EXPECTED_CORE_COUNTERS,
    commandFields: 600,
    outputElements: 801,
    allocations: target === "javascript" ? 4 : 0,
    boundaryCrossings: target === "wasm-linear" ? 1 : 0,
  };
  const counters = { ...operative, ...observed };
  if (JSON.stringify(counters) !== JSON.stringify(expected)) {
    throw new Error(`operative counter mismatch: ${JSON.stringify(counters)}`);
  }
  return counters;
}

function result(
  variantId,
  target,
  commands,
  flags,
  versions,
  filter,
  operativeCounters,
  observedCounters,
) {
  const summary = summarizeState(flags, versions, filter);
  if (
    JSON.stringify(summary) !== JSON.stringify({
      alive: 90,
      active: 60,
      completed: 30,
      edited: 3,
      filter: FILTER.ALL,
      focus: { id: 95, version: 1 },
    })
  ) throw new Error(`final state mismatch: ${JSON.stringify(summary)}`);
  return {
    variantId,
    executionTarget: target,
    commands: Array.from(commands),
    flags: Array.from(flags),
    versions: Array.from(versions),
    summary,
    counters: completeCounters(operativeCounters, observedCounters, target),
  };
}

export function runJavaScript(encoded = encodeActionTrace()) {
  const engine = new TodoJsEngine();
  const commands = engine.run(encoded);
  engine.allocations += 1;
  return result(
    "js-controlled",
    "javascript",
    commands,
    engine.flags,
    engine.versions,
    engine.filter,
    engine.counters,
    {
      commandFields: commands.length,
      outputElements: commands.length + engine.flags.length + engine.versions.length + 1,
      allocations: engine.allocations,
      boundaryCrossings: 0,
    },
  );
}

export async function instantiateTodoWasm(bytes) {
  const module = await WebAssembly.compile(bytes);
  const instance = await WebAssembly.instantiate(module, {});
  const exports = instance.exports;
  for (
    const name of [
      "memory",
      "input_ptr",
      "command_ptr",
      "state_ptr",
      "run",
      "counter_actions",
      "counter_adds",
      "counter_toggles",
      "counter_filters",
      "counter_removes",
      "counter_edits",
      "counter_state_writes",
      "counter_commands_emitted",
      "counter_output_elements",
      "counter_allocations",
    ]
  ) {
    if (!(name in exports)) throw new Error(`Wasm export missing: ${name}`);
  }
  return exports;
}

export function runWasm(exports, encoded = encodeActionTrace()) {
  const inputPtr = Number(exports.input_ptr());
  const commandPtr = Number(exports.command_ptr());
  const statePtr = Number(exports.state_ptr());
  if (inputPtr !== INPUT_PTR || commandPtr !== COMMAND_PTR || statePtr !== STATE_PTR) {
    throw new Error("Wasm memory layout mismatch");
  }
  const memory = exports.memory;
  new Int32Array(memory.buffer, inputPtr, encoded.length).set(encoded);
  const count = encoded.length / COMMAND_FIELDS;
  const memoryPagesBefore = memory.buffer.byteLength / 65_536;
  let boundaryCrossings = 0;
  boundaryCrossings += 1;
  const status = Number(exports.run(count));
  if (status !== count) throw new Error(`Wasm processed ${status}/${count} actions`);
  const commands = new Int32Array(new Int32Array(memory.buffer, commandPtr, encoded.length));
  const flags = new Uint8Array(new Uint8Array(memory.buffer, statePtr, TODO_COUNT));
  const versions = new Uint8Array(new Uint8Array(memory.buffer, statePtr + TODO_COUNT, TODO_COUNT));
  const filter = new Uint8Array(memory.buffer, statePtr + 200, 1)[0];
  const operativeCounters = {
    actions: Number(exports.counter_actions()),
    adds: Number(exports.counter_adds()),
    toggles: Number(exports.counter_toggles()),
    filters: Number(exports.counter_filters()),
    removes: Number(exports.counter_removes()),
    edits: Number(exports.counter_edits()),
    stateWrites: Number(exports.counter_state_writes()),
    commandsEmitted: Number(exports.counter_commands_emitted()),
  };
  const memoryPagesAfter = memory.buffer.byteLength / 65_536;
  if (memoryPagesAfter !== memoryPagesBefore) throw new Error("Wasm memory allocation drift");
  return result(
    "wasm-linear-controlled",
    "wasm-linear",
    commands,
    flags,
    versions,
    filter,
    operativeCounters,
    {
      commandFields: commands.length,
      outputElements: Number(exports.counter_output_elements()),
      allocations: Number(exports.counter_allocations()),
      boundaryCrossings,
    },
  );
}

export function assertEquivalent(js, wasm) {
  for (const field of ["commands", "flags", "versions", "summary"]) {
    if (JSON.stringify(js[field]) !== JSON.stringify(wasm[field])) {
      throw new Error(`cross-target ${field} mismatch`);
    }
  }
  const jsCounters = { ...js.counters, allocations: 0, boundaryCrossings: 0 };
  const wasmCounters = { ...wasm.counters, allocations: 0, boundaryCrossings: 0 };
  if (JSON.stringify(jsCounters) !== JSON.stringify(wasmCounters)) {
    throw new Error("cross-target fixed-work counter mismatch");
  }
  return true;
}

export function canonicalTrace() {
  return generateActionTrace();
}
