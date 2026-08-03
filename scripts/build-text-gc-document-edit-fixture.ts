import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { executeFixture, fixtureFormat } from "../benchmarks/v1/text-gc-document-edit/workload.js";

const root = new URL("../", import.meta.url);
const output = new URL("public/artifacts/text-gc-document-edit/", root);
await Deno.mkdir(output, { recursive: true });

let state = 0x74_65_78_74;
function random() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}
function pick<T>(values: T[]): T {
  if (!values.length) throw new Error("cannot pick from empty array");
  return values[random() % values.length];
}
function encoded(value: string) {
  return [...new TextEncoder().encode(value)].map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

interface NodeState {
  id: number;
  parentId: number;
  children: number[];
}
const labels = ["Café", "東京", "مرحبا", "नमस्ते", "🚀", "naïve", "資料", "edit:[]()\\"];
const nodes = new Map<number, NodeState>();
const rows = [fixtureFormat, "initial\t256", "operations\t10000"];
for (let id = 0; id < 256; id++) {
  const parentId = id === 0 ? -1 : Math.floor((id - 1) / 4);
  const parent = nodes.get(parentId);
  const position = parent ? parent.children.length : 0;
  rows.push(
    `N\t${id}\t${parentId}\t${position}\t${encoded(`${labels[id % labels.length]}-${id}`)}`,
  );
  nodes.set(id, { id, parentId, children: [] });
  if (parent) parent.children.push(id);
}
let nextId = 256;
const operationCounts = { insert: 0, delete: 0, reparent: 0 };
function descendants(id: number): Set<number> {
  const result = new Set<number>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...nodes.get(current)!.children);
  }
  return result;
}
for (let index = 0; index < 10_000; index++) {
  if (index % 3 === 0) {
    const parents = [...nodes.values()];
    const parent = pick(parents);
    const id = nextId++;
    const position = random() % (parent.children.length + 1);
    const label = `${labels[random() % labels.length]}-insert-${id}`;
    rows.push(`I\t${id}\t${parent.id}\t${position}\t${encoded(label)}`);
    parent.children.splice(position, 0, id);
    nodes.set(id, { id, parentId: parent.id, children: [] });
    operationCounts.insert++;
  } else if (index % 3 === 1) {
    const leaves = [...nodes.values()].filter((node) =>
      node.id !== 0 && node.children.length === 0
    );
    const node = pick(leaves);
    rows.push(`D\t${node.id}`);
    const parent = nodes.get(node.parentId)!;
    parent.children.splice(parent.children.indexOf(node.id), 1);
    nodes.delete(node.id);
    operationCounts.delete++;
  } else {
    const candidates = [...nodes.values()].filter((node) => node.id !== 0);
    const node = pick(candidates);
    const forbidden = descendants(node.id);
    const parents = [...nodes.values()].filter((candidate) => !forbidden.has(candidate.id));
    const newParent = pick(parents);
    const oldParent = nodes.get(node.parentId)!;
    oldParent.children.splice(oldParent.children.indexOf(node.id), 1);
    const position = random() % (newParent.children.length + 1);
    rows.push(`R\t${node.id}\t${newParent.id}\t${position}`);
    newParent.children.splice(position, 0, node.id);
    node.parentId = newParent.id;
    operationCounts.reparent++;
  }
}
const fixture = `${rows.join("\n")}\n`;
const fixtureBytes = new TextEncoder().encode(fixture);
const result = executeFixture(fixture);
const canonicalBytes = new TextEncoder().encode(result.canonical);
const fixtureSha256 = await sha256Hex(fixtureBytes);
const canonicalSha256 = await sha256Hex(canonicalBytes);
const manifest = {
  schemaVersion: 1,
  registrationId: "text.gc-document-edit.v1-supplemental-registration-v1",
  frozenCatalog: {
    id: "workload-catalog-v1",
    sha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
    immutable: "byte-for-byte",
  },
  fixture: {
    format: fixtureFormat,
    generator: "scripts/build-text-gc-document-edit-fixture.ts",
    generatorSeed: "0x74657874",
    licenseSpdx: "CC0-1.0",
    rightsStatus: "project-generated-reviewed-for-redistribution",
    bytes: fixtureBytes.length,
    sha256: fixtureSha256,
    initialNodes: 256,
    operations: 10_000,
    operationCounts,
    validityPolicy: {
      insert: "fresh stable id; existing parent; position in [0, child-count]",
      delete: "existing non-root leaf only",
      reparent: "existing non-root node to existing non-descendant parent; bounded position",
      invalidOperation: "reject the complete run before returning a result",
    },
  },
  oracle: {
    kind: "canonical-semantic",
    equivalenceClass: "semantic-product-choice",
    algorithmFamily: "document-tree-fixed-edit-trace",
    canonicalEncoding: "preorder (id:escaped-label[ordered-children...]) with backslash escaping",
    outputBytes: canonicalBytes.length,
    outputSha256: canonicalSha256,
    structuralCounters: result.counters,
    identity: result.identity,
  },
  gcDiagnostics: result.gcDiagnostics,
};
await Deno.writeTextFile(new URL("fixture.v1.txt", output), fixture);
await Deno.writeTextFile(new URL("fixture-manifest.json", output), `${canonicalize(manifest)}\n`);
await Deno.writeTextFile(
  new URL("reference.json", output),
  `${
    canonicalize({
      schemaVersion: 1,
      canonicalSha256,
      canonicalBytes: canonicalBytes.length,
      canonical: result.canonical,
      counters: result.counters,
      identity: result.identity,
    })
  }\n`,
);
console.log(
  `text.gc-document-edit fixture ${fixtureBytes.length} bytes, ${operationCounts.insert}/${operationCounts.delete}/${operationCounts.reparent}, output ${canonicalBytes.length} bytes ${canonicalSha256}`,
);
