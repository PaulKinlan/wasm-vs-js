// Pure, DOM-free helpers for the iframe-based real-DOM benchmark orchestration.
//
// These functions are intentionally dependency-free so they run identically in
// the browser (public/dom-hosts/*-host.js) and in Deno tests
// (tests/iframe-bridge.test.ts). The DOM application itself lives in the host;
// this module only decodes, plans, and reduces.

// ── Command stream decoding ────────────────────────────────────────────────

// The todomvc engine emits one Int32Array of 150 commands x 4 fields
// (opcode, id, value, focus). Decode into plain objects.
export function decodeCommands(commands) {
  if (!(commands instanceof Int32Array) && !Array.isArray(commands)) {
    throw new TypeError("commands must be an Int32Array or number[]");
  }
  if (commands.length % 4 !== 0) {
    throw new Error(`command stream length must be a multiple of 4, got ${commands.length}`);
  }
  const ops = [];
  for (let i = 0; i < commands.length; i += 4) {
    const opcode = commands[i];
    const id = commands[i + 1];
    const value = commands[i + 2];
    const focus = commands[i + 3];
    if (![1, 2, 3, 4, 5].includes(opcode)) {
      throw new Error(`unknown opcode ${opcode} at field ${i}`);
    }
    if (!Number.isInteger(id) || id < 0 || id > 99) {
      throw new Error(`invalid todo id ${id} at field ${i + 1}`);
    }
    ops.push({ opcode, id, value, focus });
  }
  return ops;
}

// ── DOM operation planning ─────────────────────────────────────────────────

// Map a decoded command to a concrete DOM operation descriptor. Labels are
// supplied by the caller (from the frozen fixture) so this module stays
// DOM- and fixture-free.
export const OP = Object.freeze({
  ADD: "add",
  TOGGLE: "toggle",
  FILTER: "filter",
  EDIT: "edit",
  REMOVE: "remove",
});
export const FILTER_STATE = Object.freeze({ ALL: 0, ACTIVE: 1, COMPLETED: 2 });

export function planDomOperations(commands, labels, editedLabels = {}) {
  const ops = decodeCommands(commands);
  return ops.map(({ opcode, id, value, focus }) => {
    switch (opcode) {
      case 1:
        return { op: OP.ADD, id, label: editedLabels[id] ?? labels[id] };
      case 2:
        return { op: OP.TOGGLE, id, value: value === 1 };
      case 3:
        return { op: OP.FILTER, value };
      case 4:
        return {
          op: OP.EDIT,
          id,
          value: value === 1,
          label: editedLabels[id] ?? labels[id],
          focus,
        };
      case 5:
        return { op: OP.REMOVE, id };
      default:
        throw new Error(`unreachable opcode ${opcode}`);
    }
  });
}

// Count operations by kind — used by the host's self-check and by tests.
export function summarizePlan(plan) {
  const counts = { add: 0, toggle: 0, filter: 0, edit: 0, remove: 0 };
  for (const item of plan) counts[item.op] += 1;
  return counts;
}

// ── Sample statistics ──────────────────────────────────────────────────────

export function computeStats(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("samples must be a non-empty array");
  }
  const valid = samples.filter((ms) => Number.isFinite(ms) && ms >= 0);
  if (valid.length === 0) {
    throw new Error("no finite samples");
  }
  const coldMs = valid[0];
  const warm = valid.slice(1).sort((a, b) => a - b);
  const warmMedianMs = warm.length > 0 ? warm[Math.floor(warm.length / 2)] : coldMs;
  return {
    coldMs,
    warmMedianMs,
    minMs: Math.min(...valid),
    maxMs: Math.max(...valid),
    samples: valid,
    iterations: valid.length,
  };
}

// ── Protocol message shape validation ──────────────────────────────────────

// The iframe bridge exchanges strictly shaped messages. Validate inbound
// messages before acting on them (token + shape).
export function validateStartMessage(data) {
  if (!data || typeof data !== "object") return { ok: false, reason: "non-object" };
  if (data.type !== "wvj-benchmark-start") return { ok: false, reason: "wrong type" };
  if (typeof data.token !== "string" || data.token.length < 8 || data.token.length > 128) {
    return { ok: false, reason: "invalid token" };
  }
  if (!Number.isInteger(data.iterations) || data.iterations < 1 || data.iterations > 1000) {
    return { ok: false, reason: "invalid iterations" };
  }
  const targets = Array.isArray(data.targets) && data.targets.length > 0
    ? data.targets
    : ["js", "wasm"];
  for (const target of targets) {
    if (target !== "js" && target !== "wasm") {
      return { ok: false, reason: `invalid target ${target}` };
    }
  }
  return { ok: true, targets };
}

export function validateResultMessage(data) {
  if (!data || typeof data !== "object") return { ok: false, reason: "non-object" };
  if (data.type !== "wvj-benchmark-result") return { ok: false, reason: "wrong type" };
  if (typeof data.token !== "string" || data.token.length < 8) {
    return { ok: false, reason: "invalid token" };
  }
  if (!data.perTarget || typeof data.perTarget !== "object") {
    return { ok: false, reason: "missing perTarget" };
  }
  return { ok: true };
}
