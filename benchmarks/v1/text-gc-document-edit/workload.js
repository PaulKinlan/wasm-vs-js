const FORMAT = "text-gc-document-edit-fixture-v1";

function decodeLabel(value) {
  if (!/^(?:[0-9a-f]{2})*$/u.test(value)) throw new Error("invalid UTF-8 hex label");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function escapeCanonical(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")
    .replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll(":", "\\:");
}

export function parseFixture(text) {
  const lines = text.trimEnd().split("\n");
  if (lines.shift() !== FORMAT) throw new Error("fixture format mismatch");
  const initialCount = Number(lines.shift()?.slice("initial\t".length));
  const operationCount = Number(lines.shift()?.slice("operations\t".length));
  if (!Number.isInteger(initialCount) || initialCount < 1) throw new Error("invalid initial count");
  if (operationCount !== 10_000) throw new Error("fixture must contain exactly 10,000 edits");
  const initial = [];
  for (let index = 0; index < initialCount; index++) {
    const fields = lines.shift()?.split("\t") ?? [];
    if (fields.length !== 5 || fields[0] !== "N") throw new Error(`invalid node row ${index}`);
    initial.push({
      id: Number(fields[1]),
      parentId: Number(fields[2]),
      position: Number(fields[3]),
      label: decodeLabel(fields[4]),
    });
  }
  const operations = lines.map((line, index) => {
    const fields = line.split("\t");
    if (fields[0] === "I" && fields.length === 5) {
      return {
        kind: "insert",
        id: Number(fields[1]),
        parentId: Number(fields[2]),
        position: Number(fields[3]),
        label: decodeLabel(fields[4]),
      };
    }
    if (fields[0] === "D" && fields.length === 2) {
      return { kind: "delete", id: Number(fields[1]) };
    }
    if (fields[0] === "R" && fields.length === 4) {
      return {
        kind: "reparent",
        id: Number(fields[1]),
        parentId: Number(fields[2]),
        position: Number(fields[3]),
      };
    }
    throw new Error(`invalid operation row ${index}`);
  });
  if (operations.length !== operationCount) throw new Error("operation count mismatch");
  return { initial, operations };
}

function assertSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

export function executeFixture(fixtureText, variant = "js-controlled") {
  const { initial, operations } = parseFixture(fixtureText);
  const nodes = new Map();
  let root = null;
  let childInsertions = 0;
  let childRemovals = 0;
  let parentWrites = 0;
  for (const item of initial) {
    assertSafeInteger(item.id, "node id");
    if (nodes.has(item.id)) throw new Error(`duplicate initial node ${item.id}`);
    const node = { id: item.id, label: item.label, parent: null, children: [] };
    nodes.set(item.id, node);
    if (item.parentId === -1) {
      if (root) throw new Error("multiple roots");
      root = node;
    } else {
      const parent = nodes.get(item.parentId);
      if (!parent) throw new Error(`initial parent ${item.parentId} must precede child`);
      if (item.position < 0 || item.position > parent.children.length) {
        throw new Error("initial child position out of range");
      }
      parent.children.splice(item.position, 0, node);
      node.parent = parent;
      childInsertions++;
      parentWrites++;
    }
  }
  if (!root || root.id !== 0) throw new Error("root id must be 0");
  let inserted = 0;
  let deleted = 0;
  let reparented = 0;
  for (const operation of operations) {
    if (operation.kind === "insert") {
      if (nodes.has(operation.id)) throw new Error(`insert id already exists: ${operation.id}`);
      const parent = nodes.get(operation.parentId);
      if (!parent) throw new Error(`insert parent missing: ${operation.parentId}`);
      if (operation.position < 0 || operation.position > parent.children.length) {
        throw new Error("insert position out of range");
      }
      const node = { id: operation.id, label: operation.label, parent, children: [] };
      parent.children.splice(operation.position, 0, node);
      nodes.set(operation.id, node);
      inserted++;
      childInsertions++;
      parentWrites++;
    } else if (operation.kind === "delete") {
      const node = nodes.get(operation.id);
      if (!node || node === root) throw new Error(`delete target missing or root: ${operation.id}`);
      if (node.children.length !== 0) {
        throw new Error(`delete target is not a leaf: ${operation.id}`);
      }
      const parent = node.parent;
      const position = parent.children.indexOf(node);
      if (position < 0) throw new Error("delete parent link mismatch");
      parent.children.splice(position, 1);
      nodes.delete(node.id);
      node.parent = null;
      deleted++;
      childRemovals++;
      parentWrites++;
    } else {
      const node = nodes.get(operation.id);
      const parent = nodes.get(operation.parentId);
      if (!node || node === root || !parent) throw new Error("reparent target or parent missing");
      for (let cursor = parent; cursor; cursor = cursor.parent) {
        if (cursor === node) throw new Error("reparent would create a cycle");
      }
      const oldParent = node.parent;
      const oldPosition = oldParent.children.indexOf(node);
      if (oldPosition < 0) throw new Error("reparent old link mismatch");
      oldParent.children.splice(oldPosition, 1);
      if (operation.position < 0 || operation.position > parent.children.length) {
        throw new Error("reparent position out of range");
      }
      parent.children.splice(operation.position, 0, node);
      node.parent = parent;
      reparented++;
      childRemovals++;
      childInsertions++;
      parentWrites++;
    }
  }
  const seen = new Set();
  let canonical = "";
  function visit(node) {
    if (seen.has(node.id)) throw new Error("cycle or duplicate traversal");
    seen.add(node.id);
    canonical += `(${node.id}:${escapeCanonical(node.label)}[`;
    for (const child of node.children) {
      if (child.parent !== node) throw new Error("parent/child identity mismatch");
      visit(child);
    }
    canonical += "])";
  }
  visit(root);
  if (seen.size !== nodes.size) throw new Error("unreachable nodes remain");
  const counters = {
    "initial-nodes": initial.length,
    operations: operations.length,
    inserts: inserted,
    deletes: deleted,
    reparents: reparented,
    "final-nodes": nodes.size,
    "child-insertions": childInsertions,
    "child-removals": childRemovals,
    "parent-writes": parentWrites,
    "node-object-allocations": initial.length + inserted,
    "child-list-allocations": initial.length + inserted,
    "label-values": initial.length + inserted,
    "traversal-nodes": seen.size,
    "boundary-crossings": variant === "wasmgc-controlled" ? 2 : 0,
  };
  return {
    variant,
    canonical,
    counters,
    identity: {
      rootId: root.id,
      reachableNodes: seen.size,
      uniqueNodeIds: seen.size,
      parentChildLinksValid: true,
      orderedChildrenRetained: true,
    },
    gcDiagnostics: {
      status: "unavailable",
      reason:
        "Portable GC events and runtime-internal allocation counts are not exposed by the Web platform.",
    },
  };
}

export const fixtureFormat = FORMAT;
