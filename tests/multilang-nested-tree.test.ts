// multilang-nested-tree.test.ts — every multilang engine's nested-tree
// mutation compute core must produce the EXACT oracle of the JS model (the
// frozen 1,200-action trace from seed 0x5e6f7788, 500 initial nodes with
// keyed insert_child/remove_node/move_subtree/update_attr/replace_node ops):
//   644 totalMutations / 199 attrUpdates / 495 finalNodeCount /
//   finalNodeIdSum 272047.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const ORACLE = Object.freeze({
  totalMutations: 644,
  attrUpdates: 199,
  finalNodeCount: 495,
  finalNodeIdSum: 272047,
});

async function load(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = (exports.memory as WebAssembly.Memory).buffer;
  const ret = (exports.nested_tree_trace as () => number)();
  const view = new Int32Array(mem);
  return {
    ret,
    totalMutations: view[16384 / 4],
    attrUpdates: view[16384 / 4 + 1],
    finalNodeCount: view[16384 / 4 + 2],
    finalNodeIdSum: view[16384 / 4 + 3],
  };
}

Deno.test("multilang nested-tree: JS model reproduces the frozen oracle", () => {
  // JS reference: replicate generateNestedTreeActions + runNestedTreeMutationJS.
  const opsList = [
    "insert_child",
    "remove_node",
    "move_subtree",
    "update_attr",
    "replace_node",
  ];
  let seed = 0x5e6f7788 >>> 0;
  const rand = () => {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  };
  const nodesMap = new Map<number, { id: number; parentId: number | null }>();
  for (let i = 0; i < 500; i++) {
    nodesMap.set(i, { id: i, parentId: i === 0 ? null : Math.floor((i - 1) / 3) });
  }
  let totalMutations = 0;
  let attrUpdates = 0;
  for (let i = 0; i < 1200; i++) {
    const op = opsList[Math.floor(rand() * opsList.length)];
    const targetNodeId = Math.floor(rand() * 400);
    const parentTargetId = Math.floor(rand() * 400);
    rand();
    rand();
    const id = i + 500;
    if (op === "insert_child" && nodesMap.has(parentTargetId)) {
      nodesMap.set(id, { id, parentId: parentTargetId });
      totalMutations++;
    } else if (op === "remove_node" && targetNodeId > 0 && nodesMap.has(targetNodeId)) {
      nodesMap.delete(targetNodeId);
      totalMutations++;
    } else if (
      op === "move_subtree" && targetNodeId > 0 && nodesMap.has(targetNodeId) &&
      nodesMap.has(parentTargetId) && targetNodeId !== parentTargetId
    ) {
      nodesMap.get(targetNodeId)!.parentId = parentTargetId;
      totalMutations++;
    } else if (op === "update_attr" && nodesMap.has(targetNodeId)) {
      attrUpdates++;
    } else if (op === "replace_node" && targetNodeId > 0 && nodesMap.has(targetNodeId)) {
      totalMutations++;
    }
  }
  let idSum = 0;
  for (const [, n] of nodesMap) idSum += n.id;
  assert(
    totalMutations === ORACLE.totalMutations,
    `JS totalMutations ${totalMutations} != ${ORACLE.totalMutations}`,
  );
  assert(
    attrUpdates === ORACLE.attrUpdates,
    `JS attrUpdates ${attrUpdates} != ${ORACLE.attrUpdates}`,
  );
  assert(
    nodesMap.size === ORACLE.finalNodeCount,
    `JS finalNodeCount ${nodesMap.size} != ${ORACLE.finalNodeCount}`,
  );
  assert(
    idSum === ORACLE.finalNodeIdSum,
    `JS finalNodeIdSum ${idSum} != ${ORACLE.finalNodeIdSum}`,
  );
});

Deno.test("multilang nested-tree: C kernel matches the JS oracle exactly", async () => {
  const instance = await load("nested_tree_kernel_c.wasm");
  const r = runKernel(instance);
  assert(
    r.totalMutations === ORACLE.totalMutations,
    `C totalMutations ${r.totalMutations} != ${ORACLE.totalMutations}`,
  );
  assert(
    r.attrUpdates === ORACLE.attrUpdates,
    `C attrUpdates ${r.attrUpdates} != ${ORACLE.attrUpdates}`,
  );
  assert(
    r.finalNodeCount === ORACLE.finalNodeCount,
    `C finalNodeCount ${r.finalNodeCount} != ${ORACLE.finalNodeCount}`,
  );
  assert(
    r.finalNodeIdSum === ORACLE.finalNodeIdSum,
    `C finalNodeIdSum ${r.finalNodeIdSum} != ${ORACLE.finalNodeIdSum}`,
  );
  assert(r.ret === ORACLE.finalNodeIdSum, `C return ${r.ret} != ${ORACLE.finalNodeIdSum}`);
});

Deno.test("multilang nested-tree: C++ kernel matches the JS oracle exactly", async () => {
  const instance = await load("nested_tree_kernel_cpp.wasm");
  const r = runKernel(instance);
  assert(
    r.totalMutations === ORACLE.totalMutations,
    `C++ totalMutations ${r.totalMutations} != ${ORACLE.totalMutations}`,
  );
  assert(
    r.attrUpdates === ORACLE.attrUpdates,
    `C++ attrUpdates ${r.attrUpdates} != ${ORACLE.attrUpdates}`,
  );
  assert(
    r.finalNodeCount === ORACLE.finalNodeCount,
    `C++ finalNodeCount ${r.finalNodeCount} != ${ORACLE.finalNodeCount}`,
  );
  assert(
    r.finalNodeIdSum === ORACLE.finalNodeIdSum,
    `C++ finalNodeIdSum ${r.finalNodeIdSum} != ${ORACLE.finalNodeIdSum}`,
  );
});

Deno.test("multilang nested-tree: Rust kernel matches the JS oracle exactly", async () => {
  const instance = await load("nested_tree_kernel_rs.wasm");
  const r = runKernel(instance);
  assert(
    r.totalMutations === ORACLE.totalMutations,
    `Rust totalMutations ${r.totalMutations} != ${ORACLE.totalMutations}`,
  );
  assert(
    r.attrUpdates === ORACLE.attrUpdates,
    `Rust attrUpdates ${r.attrUpdates} != ${ORACLE.attrUpdates}`,
  );
  assert(
    r.finalNodeCount === ORACLE.finalNodeCount,
    `Rust finalNodeCount ${r.finalNodeCount} != ${ORACLE.finalNodeCount}`,
  );
  assert(
    r.finalNodeIdSum === ORACLE.finalNodeIdSum,
    `Rust finalNodeIdSum ${r.finalNodeIdSum} != ${ORACLE.finalNodeIdSum}`,
  );
});

Deno.test("multilang nested-tree: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const instance = await load("nested_tree_kernel_asc.wasm", { env: { abort: () => {} } });
  const r = runKernel(instance);
  assert(
    r.totalMutations === ORACLE.totalMutations,
    `AS totalMutations ${r.totalMutations} != ${ORACLE.totalMutations}`,
  );
  assert(
    r.attrUpdates === ORACLE.attrUpdates,
    `AS attrUpdates ${r.attrUpdates} != ${ORACLE.attrUpdates}`,
  );
  assert(
    r.finalNodeCount === ORACLE.finalNodeCount,
    `AS finalNodeCount ${r.finalNodeCount} != ${ORACLE.finalNodeCount}`,
  );
  assert(
    r.finalNodeIdSum === ORACLE.finalNodeIdSum,
    `AS finalNodeIdSum ${r.finalNodeIdSum} != ${ORACLE.finalNodeIdSum}`,
  );
});
