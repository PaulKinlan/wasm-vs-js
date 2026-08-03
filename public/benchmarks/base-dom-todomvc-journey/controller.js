import {
  ACTION,
  editedLabels,
  FILTER,
  generateLabels,
  IMPLEMENTATION_ID,
} from "/benchmarks/base/dom-todomvc-journey/fixture.js";

const root = document.querySelector("main[data-implementation-id]");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const target = document.querySelector("#target");
const list = document.querySelector("#todo-list");
const status = document.querySelector("#status");
const resultOutput = document.querySelector("#result");
const countOutput = document.querySelector("#todo-count");
const filterButtons = new Map([...document.querySelectorAll("[data-filter]")].map((button) => [
  Number(button.dataset.filter),
  button,
]));
const labels = generateLabels();
let token = 0;
let worker = null;
let timeout = null;
let nodes = new Map();
let counters;

function emptyCounters() {
  return {
    createdElements: 0,
    appendOperations: 0,
    removeOperations: 0,
    propertyWrites: 0,
    attributeWrites: 0,
    nodeReuses: 0,
    focusCalls: 0,
    selectionCalls: 0,
    rafCheckpoints: 0,
  };
}

function setAttribute(element, name, value) {
  element.setAttribute(name, value);
  counters.attributeWrites += 1;
}

function setProperty(element, name, value) {
  element[name] = value;
  counters.propertyWrites += 1;
}

function append(parent, child) {
  parent.append(child);
  counters.appendOperations += 1;
}

function create(tag) {
  counters.createdElements += 1;
  return document.createElement(tag);
}

function currentLabel(id, version) {
  return version === 1 ? editedLabels[id] : labels[id];
}

function createTodo(id) {
  const item = create("li");
  setAttribute(item, "data-todo-id", String(id));
  const checkbox = create("input");
  setProperty(checkbox, "type", "checkbox");
  setProperty(checkbox, "checked", false);
  setAttribute(checkbox, "id", `toggle-${id}`);
  setAttribute(checkbox, "aria-labelledby", `label-${id}`);
  const label = create("span");
  setAttribute(label, "id", `label-${id}`);
  setProperty(label, "textContent", labels[id]);
  const edit = create("input");
  setProperty(edit, "type", "text");
  setProperty(edit, "value", labels[id]);
  setProperty(edit, "hidden", true);
  setAttribute(edit, "id", `edit-${id}`);
  setAttribute(edit, "aria-label", `Edit ${labels[id]}`);
  const remove = create("button");
  setProperty(remove, "type", "button");
  setProperty(remove, "textContent", "Remove");
  setAttribute(remove, "aria-label", `Remove ${labels[id]}`);
  append(item, checkbox);
  append(item, label);
  append(item, edit);
  append(item, remove);
  append(list, item);
  nodes.set(id, { item, checkbox, label, edit, remove, version: 0 });
}

function applyFilter(filter) {
  for (const [id, node] of nodes) {
    void id;
    counters.nodeReuses += 1;
    const completed = node.checkbox.checked;
    setProperty(
      node.item,
      "hidden",
      filter === FILTER.ACTIVE ? completed : filter === FILTER.COMPLETED ? !completed : false,
    );
  }
  for (const [value, button] of filterButtons) {
    setAttribute(button, "aria-pressed", String(value === filter));
  }
}

function applyCommand(opcode, id, value, focus) {
  if (opcode === ACTION.ADD) {
    if (nodes.has(id)) throw new Error(`DOM duplicate add ${id}`);
    createTodo(id);
  } else if (opcode === ACTION.TOGGLE) {
    const node = nodes.get(id);
    if (!node) throw new Error(`DOM toggle missing ${id}`);
    counters.nodeReuses += 1;
    setProperty(node.checkbox, "checked", !node.checkbox.checked);
    setProperty(node.item, "className", node.checkbox.checked ? "completed" : "");
  } else if (opcode === ACTION.FILTER) {
    applyFilter(value);
  } else if (opcode === ACTION.REMOVE) {
    const node = nodes.get(id);
    if (!node) throw new Error(`DOM remove missing ${id}`);
    counters.nodeReuses += 1;
    node.item.remove();
    counters.removeOperations += 1;
    nodes.delete(id);
  } else if (opcode === ACTION.EDIT) {
    const node = nodes.get(id);
    if (!node) throw new Error(`DOM edit missing ${id}`);
    counters.nodeReuses += 1;
    node.version = value;
    const text = currentLabel(id, value);
    setProperty(node.label, "textContent", text);
    setProperty(node.edit, "value", text);
    setProperty(node.edit, "hidden", focus !== 1);
    setAttribute(node.edit, "aria-label", `Edit ${text}`);
    setAttribute(node.remove, "aria-label", `Remove ${text}`);
    if (focus === 1) {
      node.edit.focus();
      counters.focusCalls += 1;
      node.edit.setSelectionRange(text.length, text.length);
      counters.selectionCalls += 1;
    }
  } else {
    throw new Error(`DOM unknown opcode ${opcode}`);
  }
}

function canonicalDom() {
  return [...list.children].map((item) => {
    const id = Number(item.dataset.todoId);
    const node = nodes.get(id);
    return {
      id,
      completed: node.checkbox.checked,
      hidden: item.hidden,
      label: node.label.textContent,
      editValue: node.edit.value,
      editHidden: node.edit.hidden,
      checkboxName: node.label.textContent,
      removeName: node.remove.getAttribute("aria-label"),
    };
  });
}

function finalAssertions(engineResult) {
  const dom = canonicalDom();
  const focused = document.activeElement;
  const expectedFocus = nodes.get(95).edit;
  const physical = {
    ...counters,
    physicalMutations: counters.appendOperations + counters.removeOperations +
      counters.propertyWrites + counters.attributeWrites,
  };
  const assertions = {
    implementationId: root.dataset.implementationId === IMPLEMENTATION_ID,
    itemCount: dom.length === 90,
    completedCount: dom.filter((item) => item.completed).length === 30,
    activeCount: dom.filter((item) => !item.completed).length === 60,
    allVisible: dom.every((item) => item.hidden === false),
    orderedIds: dom.every((item, index) => item.id === index + 1 + Math.floor(index / 9)),
    editedLabels: [5, 55, 95].every((id) => nodes.get(id).label.textContent === editedLabels[id]),
    focus: focused === expectedFocus,
    selection: expectedFocus.selectionStart === expectedFocus.value.length &&
      expectedFocus.selectionEnd === expectedFocus.value.length,
    accessibleCheckboxNames: dom.every((item) => item.checkboxName === item.label),
    accessibleRemoveNames: dom.every((item) => item.removeName === `Remove ${item.label}`),
    semanticSummary: JSON.stringify(engineResult.summary) === JSON.stringify({
      alive: 90,
      active: 60,
      completed: 30,
      edited: 3,
      filter: FILTER.ALL,
      focus: { id: 95, version: 1 },
    }),
    physicalCounters: JSON.stringify(physical) === JSON.stringify({
      createdElements: 500,
      appendOperations: 500,
      removeOperations: 10,
      propertyWrites: 1177,
      attributeWrites: 715,
      nodeReuses: 347,
      focusCalls: 1,
      selectionCalls: 1,
      rafCheckpoints: 150,
      physicalMutations: 2402,
    }),
  };
  if (!Object.values(assertions).every(Boolean)) {
    throw new Error(`DOM assertion failed: ${JSON.stringify(assertions)}`);
  }
  return { dom, physical, assertions };
}

function resetDom() {
  list.replaceChildren();
  nodes = new Map();
  counters = emptyCounters();
  countOutput.textContent = "0 items";
}

function stopWorker() {
  clearTimeout(timeout);
  worker?.terminate();
  worker = null;
}

function fail(message) {
  token += 1;
  stopWorker();
  status.textContent = message;
  resultOutput.textContent = "No result was accepted.";
  start.disabled = false;
  cancel.disabled = true;
}

function replay(commands, acceptedToken, engineResult) {
  let offset = 0;
  const next = () => {
    if (acceptedToken !== token) return;
    if (offset >= commands.length) {
      try {
        const domResult = finalAssertions(engineResult);
        countOutput.textContent = `${domResult.dom.length} items`;
        resultOutput.textContent = JSON.stringify(
          {
            variantId: engineResult.variantId,
            summary: engineResult.summary,
            counters: engineResult.counters,
            physical: domResult.physical,
            assertions: domResult.assertions,
          },
          null,
          2,
        );
        status.textContent =
          "Complete. All semantic, physical DOM, accessibility, focus, selection, and counter checks passed.";
        start.disabled = false;
        cancel.disabled = true;
        stopWorker();
      } catch (error) {
        fail(error instanceof Error ? error.message : "DOM validation failed.");
      }
      return;
    }
    applyCommand(
      commands[offset],
      commands[offset + 1],
      commands[offset + 2],
      commands[offset + 3],
    );
    counters.rafCheckpoints += 1;
    offset += 4;
    requestAnimationFrame(next);
  };
  requestAnimationFrame(next);
}

function handleWorkerMessage({ data }, acceptedToken) {
  if (!data || data.token !== acceptedToken || acceptedToken !== token) return;
  if (data.type === "error") return fail(data.message);
  if (data.type !== "result") return;
  clearTimeout(timeout);
  replay(data.result.commands, acceptedToken, data.result);
}

function startRun() {
  token += 1;
  const acceptedToken = token;
  stopWorker();
  resetDom();
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Running the frozen 150-action trace in a fresh module worker.";
  resultOutput.textContent = "Waiting for authoritative typed commands.";
  worker = new Worker("/benchmarks/base-dom-todomvc-journey/worker.js", { type: "module" });
  worker.onmessage = (event) => handleWorkerMessage(event, acceptedToken);
  worker.onerror = () => fail("The worker stopped unexpectedly.");
  worker.postMessage({ type: "start", token: acceptedToken, variantId: target.value });
  timeout = setTimeout(
    () => fail("Timed out after 30 seconds; the worker and token were invalidated."),
    30_000,
  );
}

start.addEventListener("click", startRun);
cancel.addEventListener("click", () => {
  token += 1;
  stopWorker();
  resetDom();
  status.textContent = "Cancelled. Late worker and replay messages are invalidated.";
  resultOutput.textContent = "No result was accepted.";
  start.disabled = false;
  cancel.disabled = true;
});
addEventListener("pagehide", () => {
  token += 1;
  stopWorker();
});
if (new URL(location.href).searchParams.get("demo-test") === "1") {
  globalThis.__baseTodoTest = Object.freeze({
    workerActive: () => worker !== null,
    token: () => token,
    injectStaleMessage: () =>
      handleWorkerMessage({
        data: { type: "result", token: token - 1, result: { commands: [] } },
      }, token),
  });
}
resetDom();
start.disabled = false;
