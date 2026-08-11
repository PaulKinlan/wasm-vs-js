// multilang-keyed-list.test.ts — every multilang engine's keyed-list-mutation
// compute core must produce the EXACT oracle of the JS model (the frozen
// 2,000-action trace from seed 0x1a2b3c4d, 1,000 initial items with keyed
// insert/remove/swap/update/move ops):
//   1853 patches / 375 textMutations / 1059 finalItemCount / finalKeySum 520890.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const ORACLE = Object.freeze({
  patches: 1853,
  textMutations: 375,
  finalItemCount: 1059,
  finalKeySum: 520890,
});

async function load(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = (exports.memory as WebAssembly.Memory).buffer;
  const ret = (exports.keyed_list_trace as () => number)();
  const view = new Int32Array(mem);
  return {
    ret,
    patches: view[16384 / 4],
    textMutations: view[16384 / 4 + 1],
    finalItemCount: view[16384 / 4 + 2],
    finalKeySum: view[16384 / 4 + 3],
  };
}

Deno.test("multilang keyed-list: JS model reproduces the frozen oracle", () => {
  // JS reference: replicate generateKeyedListActions + runKeyedListMutationJS.
  const opsList = ["insert", "remove", "swap", "update", "move"];
  let seed = 0x1a2b3c4d >>> 0;
  const rand = () => {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  };
  const items = new Array(1000).fill(0).map((_, i) => ({ key: i, text: `Item ${i}` }));
  let patches = 0;
  let textMutations = 0;
  for (let i = 0; i < 2000; i++) {
    const op = opsList[Math.floor(rand() * opsList.length)];
    const key = Math.floor(rand() * 1000);
    const targetKey = Math.floor(rand() * 1000);
    const text = `Item ${Math.floor(rand() * 10000)}`;
    if (op === "insert") {
      items.push({ key, text });
      patches++;
    } else if (op === "remove") {
      const idx = items.findIndex((it) => it.key === key);
      if (idx !== -1) {
        items.splice(idx, 1);
        patches++;
      }
    } else if (op === "swap" && items.length >= 2) {
      const i1 = key % items.length;
      const i2 = targetKey % items.length;
      const t = items[i1];
      items[i1] = items[i2];
      items[i2] = t;
      patches += 2;
    } else if (op === "update") {
      const idx = items.findIndex((it) => it.key === key);
      if (idx !== -1) {
        items[idx].text = text;
        textMutations++;
      }
    } else if (op === "move" && items.length >= 2) {
      const idx = items.findIndex((it) => it.key === key);
      if (idx !== -1) {
        const [moved] = items.splice(idx, 1);
        const targetIdx = targetKey % items.length;
        items.splice(targetIdx, 0, moved);
        patches++;
      }
    }
  }
  const finalKeySum = items.reduce((acc, it) => acc + it.key, 0);
  assert(patches === ORACLE.patches, `JS patches ${patches} != ${ORACLE.patches}`);
  assert(
    textMutations === ORACLE.textMutations,
    `JS textMutations ${textMutations} != ${ORACLE.textMutations}`,
  );
  assert(
    items.length === ORACLE.finalItemCount,
    `JS finalItemCount ${items.length} != ${ORACLE.finalItemCount}`,
  );
  assert(
    finalKeySum === ORACLE.finalKeySum,
    `JS finalKeySum ${finalKeySum} != ${ORACLE.finalKeySum}`,
  );
});

Deno.test("multilang keyed-list: C kernel matches the JS oracle exactly", async () => {
  const instance = await load("keyed_list_kernel_c.wasm");
  const r = runKernel(instance);
  assert(r.patches === ORACLE.patches, `C patches ${r.patches} != ${ORACLE.patches}`);
  assert(
    r.textMutations === ORACLE.textMutations,
    `C textMutations ${r.textMutations} != ${ORACLE.textMutations}`,
  );
  assert(
    r.finalItemCount === ORACLE.finalItemCount,
    `C finalItemCount ${r.finalItemCount} != ${ORACLE.finalItemCount}`,
  );
  assert(
    r.finalKeySum === ORACLE.finalKeySum,
    `C finalKeySum ${r.finalKeySum} != ${ORACLE.finalKeySum}`,
  );
  assert(r.ret === ORACLE.finalKeySum, `C return ${r.ret} != ${ORACLE.finalKeySum}`);
});

Deno.test("multilang keyed-list: C++ kernel matches the JS oracle exactly", async () => {
  const instance = await load("keyed_list_kernel_cpp.wasm");
  const r = runKernel(instance);
  assert(r.patches === ORACLE.patches, `C++ patches ${r.patches} != ${ORACLE.patches}`);
  assert(
    r.textMutations === ORACLE.textMutations,
    `C++ textMutations ${r.textMutations} != ${ORACLE.textMutations}`,
  );
  assert(
    r.finalItemCount === ORACLE.finalItemCount,
    `C++ finalItemCount ${r.finalItemCount} != ${ORACLE.finalItemCount}`,
  );
  assert(
    r.finalKeySum === ORACLE.finalKeySum,
    `C++ finalKeySum ${r.finalKeySum} != ${ORACLE.finalKeySum}`,
  );
});

Deno.test("multilang keyed-list: Rust kernel matches the JS oracle exactly", async () => {
  const instance = await load("keyed_list_kernel_rs.wasm");
  const r = runKernel(instance);
  assert(r.patches === ORACLE.patches, `Rust patches ${r.patches} != ${ORACLE.patches}`);
  assert(
    r.textMutations === ORACLE.textMutations,
    `Rust textMutations ${r.textMutations} != ${ORACLE.textMutations}`,
  );
  assert(
    r.finalItemCount === ORACLE.finalItemCount,
    `Rust finalItemCount ${r.finalItemCount} != ${ORACLE.finalItemCount}`,
  );
  assert(
    r.finalKeySum === ORACLE.finalKeySum,
    `Rust finalKeySum ${r.finalKeySum} != ${ORACLE.finalKeySum}`,
  );
});

Deno.test("multilang keyed-list: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const instance = await load("keyed_list_kernel_asc.wasm", { env: { abort: () => {} } });
  const r = runKernel(instance);
  assert(r.patches === ORACLE.patches, `AS patches ${r.patches} != ${ORACLE.patches}`);
  assert(
    r.textMutations === ORACLE.textMutations,
    `AS textMutations ${r.textMutations} != ${ORACLE.textMutations}`,
  );
  assert(
    r.finalItemCount === ORACLE.finalItemCount,
    `AS finalItemCount ${r.finalItemCount} != ${ORACLE.finalItemCount}`,
  );
  assert(
    r.finalKeySum === ORACLE.finalKeySum,
    `AS finalKeySum ${r.finalKeySum} != ${ORACLE.finalKeySum}`,
  );
});
