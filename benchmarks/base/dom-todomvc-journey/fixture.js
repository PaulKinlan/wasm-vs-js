export const BASE_CATALOG_ID = "dom.todomvc-journey.v1";
export const IMPLEMENTATION_ID = "dom.todomvc-journey.v1.controlled-v1";
export const ROUTE = "/benchmarks/base-dom-todomvc-journey/";
export const VIEWPORT = Object.freeze({ width: 1280, height: 720, deviceScaleFactor: 1 });
export const FRAME_POLICY = Object.freeze({
  eventOrder: "one action, one DOM command application, then one requestAnimationFrame checkpoint",
  rafCheckpoints: 150,
  animation: "none",
});

export const ACTION = Object.freeze({ ADD: 1, TOGGLE: 2, FILTER: 3, EDIT: 4, REMOVE: 5 });
export const FILTER = Object.freeze({ ALL: 0, ACTIVE: 1, COMPLETED: 2 });

const multilingualSuffixes = Object.freeze([
  "café",
  "東京",
  "naïve",
  "κόσμος",
  "مرحبا",
  "हिंदी",
  "한국",
  "🚀",
]);

export function generateLabels() {
  return Array.from(
    { length: 100 },
    (_, id) =>
      `Todo ${String(id + 1).padStart(3, "0")} — ${
        multilingualSuffixes[id % multilingualSuffixes.length]
      }`,
  );
}

export const editedLabels = Object.freeze({
  5: "Edited 006 — résumé",
  55: "Edited 056 — 東京 café",
  95: "Edited 096 — final 🚀",
});

export function generateActionTrace() {
  const actions = [];
  for (let id = 0; id < 100; id += 1) actions.push({ opcode: ACTION.ADD, id, value: 0, focus: 0 });
  for (let id = 0; id < 100; id += 3) {
    actions.push({ opcode: ACTION.TOGGLE, id, value: 1, focus: 0 });
  }
  actions.push(
    { opcode: ACTION.FILTER, id: 0, value: FILTER.COMPLETED, focus: 0 },
    { opcode: ACTION.FILTER, id: 0, value: FILTER.ACTIVE, focus: 0 },
    { opcode: ACTION.FILTER, id: 0, value: FILTER.ALL, focus: 0 },
  );
  for (let id = 0; id < 100; id += 10) {
    actions.push({ opcode: ACTION.REMOVE, id, value: 0, focus: 0 });
  }
  actions.push(
    { opcode: ACTION.EDIT, id: 5, value: 1, focus: 0 },
    { opcode: ACTION.EDIT, id: 55, value: 1, focus: 0 },
    { opcode: ACTION.EDIT, id: 95, value: 1, focus: 1 },
  );
  if (actions.length !== 150) throw new Error(`trace length drifted: ${actions.length}`);
  return actions;
}

export function encodeActionTrace(actions = generateActionTrace()) {
  const encoded = new Int32Array(actions.length * 4);
  actions.forEach((action, index) => {
    const offset = index * 4;
    encoded[offset] = action.opcode;
    encoded[offset + 1] = action.id;
    encoded[offset + 2] = action.value;
    encoded[offset + 3] = action.focus;
  });
  return encoded;
}

export function fixtureDocument() {
  return {
    schemaVersion: 1,
    catalogId: BASE_CATALOG_ID,
    implementationId: IMPLEMENTATION_ID,
    rights: {
      licenseSpdx: "CC0-1.0",
      redistribution: "permitted",
      provenance:
        "Generated solely by this repository; no framework, TodoMVC source, or external labels are included.",
    },
    viewport: VIEWPORT,
    framePolicy: FRAME_POLICY,
    labels: generateLabels(),
    editedLabels,
    actions: generateActionTrace(),
  };
}
