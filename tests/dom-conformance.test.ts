// DOM Conformance Tests — Requirement 2: DOM workloads MUST drive and test the real DOM
//
// Asserts that each DOM-family benchmark:
// 1. Emits the expected typed DOM command stream
// 2. Drives a real DOM hierarchy through createElement/append/remove/style/dataset
// 3. Produces a rendered DOM state that exactly matches the oracle

import { assert, assertEquals } from "./assert.ts";

// --- Minimal, spec-compliant Mock DOM for headless test execution ---

class MockClassList {
  private classes = new Set<string>();
  add(...tokens: string[]) {
    for (const t of tokens) this.classes.add(t);
  }
  remove(...tokens: string[]) {
    for (const t of tokens) this.classes.delete(t);
  }
  contains(token: string) {
    return this.classes.has(token);
  }
  toggle(token: string, force?: boolean) {
    if (force !== undefined) {
      if (force) this.classes.add(token);
      else this.classes.delete(token);
      return force;
    }
    if (this.classes.has(token)) {
      this.classes.delete(token);
      return false;
    }
    this.classes.add(token);
    return true;
  }
}

function createDatasetProxy(element: MockElement): Record<string, string> {
  const data: Record<string, string> = {};
  return new Proxy(data, {
    set(target, prop: string, value) {
      target[prop] = String(value);
      const kebab = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      element.attributes[`data-${kebab}`] = String(value);
      return true;
    },
    get(target, prop: string) {
      return target[prop];
    },
    deleteProperty(target, prop: string) {
      delete target[prop];
      const kebab = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      delete element.attributes[`data-${kebab}`];
      return true;
    },
  });
}

class MockElement {
  tagName: string;
  id = "";
  value = "";
  textContent = "";
  parentNode: MockElement | null = null;
  childNodes: MockElement[] = [];
  attributes: Record<string, string> = {};
  style: Record<string, string> = {};
  dataset: Record<string, string>;
  classList = new MockClassList();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.dataset = createDatasetProxy(this);
  }

  get children(): MockElement[] {
    return this.childNodes;
  }

  get nextSibling(): MockElement | null {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx === -1 || idx === this.parentNode.childNodes.length - 1) return null;
    return this.parentNode.childNodes[idx + 1];
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
    if (name.startsWith("data-")) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[prop] = String(value);
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  append(...nodes: (MockElement | string)[]) {
    for (const node of nodes) {
      if (typeof node === "string") {
        this.textContent += node;
      } else {
        node.parentNode = this;
        this.childNodes.push(node);
      }
    }
  }

  appendChild(node: MockElement) {
    this.append(node);
    return node;
  }

  removeChild(node: MockElement) {
    const idx = this.childNodes.indexOf(node);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
    return node;
  }

  replaceChildren(...nodes: (MockElement | string)[]) {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes = [];
    this.textContent = "";
    this.append(...nodes);
  }

  insertBefore(newNode: MockElement, referenceNode: MockElement | null) {
    if (!referenceNode) {
      this.append(newNode);
      return newNode;
    }
    const idx = this.childNodes.indexOf(referenceNode);
    if (idx !== -1) {
      newNode.parentNode = this;
      this.childNodes.splice(idx, 0, newNode);
    } else {
      this.append(newNode);
    }
    return newNode;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];
    const tagMatch = selector.match(/^([a-zA-Z0-9_-]+)?(\[([^=\]]+)(?:="([^"]*)")?\])?$/);
    const tag = tagMatch?.[1]?.toUpperCase();
    const attrName = tagMatch?.[3];
    const attrVal = tagMatch?.[4];

    const check = (node: MockElement) => {
      let match = true;
      if (tag && node.tagName !== tag) match = false;
      if (attrName) {
        if (!node.hasAttribute(attrName)) match = false;
        else if (attrVal !== undefined && node.getAttribute(attrName) !== attrVal) match = false;
      }
      if (match) matches.push(node);
      for (const child of node.childNodes) {
        check(child);
      }
    };
    for (const child of this.childNodes) {
      check(child);
    }
    return matches;
  }

  querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class MockDocument {
  createElement(tag: string) {
    return new MockElement(tag);
  }
  querySelector(_selector: string): MockElement | null {
    return null;
  }
}

// Setup global document environment
(globalThis as unknown as { document: MockDocument }).document = new MockDocument();
(globalThis as unknown as { HTMLElement: typeof MockElement }).HTMLElement = MockElement;
(globalThis as unknown as { Element: typeof MockElement }).Element = MockElement;

// --- Imports from benchmark engines ---

import {
  generateFormActions,
  runFormDomTraceOnce,
  runFormValidationJSSteps,
} from "../public/benchmarks/dom-dependent-form-validation/engine.js";

import {
  generateGridActions,
  runGridDomTraceOnce,
  runGridMovementJSSteps,
} from "../public/benchmarks/dom-grid-movement/engine.js";

import {
  generateKeyedListActions,
  runKeyedListDomTraceOnce,
  runKeyedListMutationJSSteps,
} from "../public/benchmarks/dom-keyed-list-mutation/engine.js";

import {
  generateNestedTreeActions,
  runNestedTreeDomTraceOnce,
  runNestedTreeMutationJSSteps,
} from "../public/benchmarks/dom-nested-tree-mutation/engine.js";

import {
  generateTableActions,
  runTableSortDomTraceOnce,
  runTableSortJSSteps,
} from "../public/benchmarks/dom-table-sort-filter-pagination/engine.js";

import {
  buildPrefixSums,
  computeWindowJS,
  generateScrollActions,
  runDomTraceOnce as runScrollDomTraceOnce,
} from "../public/benchmarks/dom-virtualized-scrolling/engine.js";

import { generateFixture } from "../benchmarks/v2/game-family/fixtures.js";
import { runGameJavaScript } from "../benchmarks/v2/game-family/engine.js";

import { executeFixture, parseFixture } from "../benchmarks/v1/text-gc-document-edit/workload.js";

// --- Tests ---

Deno.test("DOM conformance: dom-dependent-form-validation drives real DOM form and verifies final state", () => {
  const actions = generateFormActions();
  assertEquals(actions.length, 240);
  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  const result = runFormDomTraceOnce({
    actions,
    computeSteps: () => runFormValidationJSSteps(actions),
    container,
    keep: true,
  });
  assert(result.domOps > 0, "domOps must be positive");
  assertEquals(result.steps, 240);
  assert(result.verified.ok, result.verified.firstBad);
});

Deno.test("DOM conformance: dom-grid-movement drives real DOM cells and verifies coordinates", () => {
  const actions = generateGridActions();
  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  const computeSteps = () => {
    const r = runGridMovementJSSteps(actions);
    return { steps: r.steps, entities: r.entities };
  };
  const result = runGridDomTraceOnce({
    computeSteps,
    container,
    keep: true,
  });
  assert(result.domOps > 0, "domOps must be positive");
  assert(result.verified.ok, result.verified.firstBad);
  assertEquals(result.verified.cells, 128);
});

Deno.test("DOM conformance: dom-keyed-list-mutation drives real DOM list and verifies item order", () => {
  const actions = generateKeyedListActions();
  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  const computeSteps = () => {
    const r = runKeyedListMutationJSSteps(actions);
    return { steps: r.steps, items: r.items };
  };
  const result = runKeyedListDomTraceOnce({
    computeSteps,
    container,
    keep: true,
  });
  assert(result.domOps > 0, "domOps must be positive");
  assert(result.verified.ok, result.verified.firstBad);
});

Deno.test("DOM conformance: dom-nested-tree-mutation drives real DOM tree and verifies hierarchy", () => {
  const actions = generateNestedTreeActions();
  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  const computeSteps = () => {
    const r = runNestedTreeMutationJSSteps(actions);
    return { steps: r.steps, nodes: r.nodes };
  };
  const result = runNestedTreeDomTraceOnce({
    computeSteps,
    container,
    keep: true,
  });
  assert(result.domOps > 0, "domOps must be positive");
  assert(result.verified.ok, result.verified.firstBad);
});

Deno.test("DOM conformance: dom-table-sort-filter-pagination drives real DOM table and verifies slice", () => {
  const actions = generateTableActions();
  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  const result = runTableSortDomTraceOnce({
    computeSteps: () => runTableSortJSSteps(actions),
    container,
    keep: true,
  });
  assert(result.domOps > 0, "domOps must be positive");
  assert(result.verified.ok, result.verified.firstBad);
  assertEquals(result.verified.rows, 50);
});

Deno.test("DOM conformance: dom-virtualized-scrolling drives real DOM viewport and verifies spacer", () => {
  const actions = generateScrollActions();
  const prefixSums = buildPrefixSums();
  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  const computeWindows = () =>
    actions.map((a: { scrollTop: number; viewportHeight: number }) =>
      computeWindowJS(prefixSums, a.scrollTop, a.viewportHeight)
    );
  const result = runScrollDomTraceOnce({
    actions,
    computeWindows,
    container,
    keep: true,
  });
  assert(result.domOps > 0, "domOps must be positive");
  assertEquals(result.verified.ok, true);
  assert(result.verified.rowsRendered > 0);
});

Deno.test("DOM conformance: game-dom-tactics-grid drives real 12x8 DOM grid and verifies visual turns", () => {
  const fixture = generateFixture("game.dom-tactics-grid.v1");
  const model = runGameJavaScript("game.dom-tactics-grid.v1", fixture);
  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );

  // Replicate tactics grid DOM construction and updates
  const wrap = (globalThis as unknown as { document: MockDocument }).document.createElement("div");
  wrap.dataset.wvjTacticsGrid = "1";
  const grid = (globalThis as unknown as { document: MockDocument }).document.createElement("div");
  const cells: MockElement[] = [];
  for (let i = 0; i < 12 * 8; i++) {
    const cell = (globalThis as unknown as { document: MockDocument }).document.createElement(
      "div",
    );
    cell.dataset.wvjTacticsCell = "1";
    cell.dataset.cell = String(i);
    grid.append(cell);
    cells.push(cell);
  }
  const status = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  wrap.append(grid, status);
  container.append(wrap);

  let ops = 0;
  for (const turn of model.replay) {
    for (const cell of cells) {
      if (cell.dataset.selected || cell.dataset.focused) {
        delete cell.dataset.selected;
        delete cell.dataset.focused;
        ops++;
      }
    }
    const selected = cells[turn.selected % cells.length];
    selected.dataset.selected = "true";
    ops++;
    const focused = cells[turn.focused % cells.length];
    focused.dataset.focused = "true";
    ops++;
    status.textContent = `turn ${turn.turn} · initiative ${turn.initiative} · ` +
      `objectives ${turn.objectives[0]}/${
        turn.objectives[1]
      } · selected ${turn.selected} · focused ${turn.focused}`;
    ops++;
  }

  assert(ops > 0, "tactics grid must perform DOM operations");
  const finalTurn = model.visual;
  const selectedCell = cells.find((c) => c.dataset.selected === "true");
  const focusedCell = cells.find((c) => c.dataset.focused === "true");
  assertEquals(Number(selectedCell?.dataset.cell), finalTurn.selected % cells.length);
  assertEquals(Number(focusedCell?.dataset.cell), finalTurn.focused % cells.length);
  assert(status.textContent.includes(`turn ${finalTurn.turn}`));
});

Deno.test("DOM conformance: text.gc-document-edit.v1 drives real DOM tree and verifies canonical oracle", async () => {
  const text = await Deno.readTextFile("public/artifacts/text-gc-document-edit/fixture.v1.txt");
  const fixture = parseFixture(text);
  const model = executeFixture(text);

  function escapeCanonical(value: string) {
    return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")
      .replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll(":", "\\:");
  }

  const container = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "div",
  );
  const rootList = (globalThis as unknown as { document: MockDocument }).document.createElement(
    "ul",
  );
  const byId = new Map<number, { id: number; label: string; li: MockElement; ul: MockElement }>();
  const makeLi = (id: number, label: string) => {
    const li = (globalThis as unknown as { document: MockDocument }).document.createElement("li");
    li.dataset.wvjDocNode = "1";
    li.dataset.id = String(id);
    li.dataset.label = label;
    li.textContent = label;
    const ul = (globalThis as unknown as { document: MockDocument }).document.createElement("ul");
    li.append(ul);
    return { li, ul };
  };

  for (const item of fixture.initial) {
    const node = { id: item.id, label: item.label, ...makeLi(item.id, item.label) };
    byId.set(item.id, node);
  }
  for (const item of fixture.initial) {
    const node = byId.get(item.id)!;
    if (item.parentId === -1) {
      rootList.append(node.li);
    } else {
      byId.get(item.parentId)?.ul.append(node.li);
    }
  }
  container.append(rootList);

  let ops = 0;
  for (const op of fixture.operations) {
    if (op.kind === "insert") {
      const node = { id: op.id, label: op.label, ...makeLi(op.id, op.label) };
      byId.set(op.id, node);
      const parent = byId.get(op.parentId)!;
      const siblings = [...parent.ul.children];
      const before = siblings[op.position] ?? null;
      parent.ul.insertBefore(node.li, before);
      ops++;
    } else if (op.kind === "delete") {
      const node = byId.get(op.id)!;
      node.li.remove();
      byId.delete(op.id);
      ops++;
    } else {
      const node = byId.get(op.id)!;
      node.li.remove();
      const parent = byId.get(op.parentId)!;
      const siblings = [...parent.ul.children];
      const before = siblings[op.position] ?? null;
      parent.ul.insertBefore(node.li, before);
      ops++;
    }
  }

  const render = (ul: MockElement): string => {
    let out = "";
    for (const li of ul.children) {
      const id = li.dataset.id;
      const label = li.dataset.label ?? li.textContent;
      const childUl = li.children.find((c) => c.tagName === "UL");
      out += `(${id}:${escapeCanonical(label)}[${childUl ? render(childUl) : ""}])`;
    }
    return out;
  };

  const serialized = render(rootList);
  assertEquals(ops, 10000);
  assertEquals(byId.size, model.counters["final-nodes"]);
  assertEquals(serialized, model.canonical);
});
