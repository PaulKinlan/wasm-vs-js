// multilang-grid-movement.test.ts — every multilang engine's grid-movement
// compute core must produce the EXACT oracle of the JS model (the frozen
// 3,600-action trace from seed 0xc001d00d, 128 entities on a 64x64 grid):
//   2869 moves / 731 collisions / finalPosSum 33583.
import { assert } from "./assert.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

const ORACLE = Object.freeze({ moves: 2869, collisions: 731, finalPosSum: 33583 });

async function load(file: string, imports: WebAssembly.Imports = {}) {
  const bytes = await Deno.readFile(`${ARTIFACTS}/${file}`);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

function runKernel(instance: WebAssembly.Instance) {
  const exports = instance.exports as Record<string, unknown>;
  const mem = (exports.memory as WebAssembly.Memory).buffer;
  const ret = (exports.grid_trace as () => number)();
  const view = new Int32Array(mem);
  return {
    ret,
    moves: view[16384 / 4],
    collisions: view[16384 / 4 + 1],
    finalPosSum: view[16384 / 4 + 2],
  };
}

Deno.test("multilang grid-movement: JS model reproduces the frozen oracle", () => {
  // JS reference: replicate generateGridActions + runGridMovementJS exactly.
  const directions = ["up", "down", "left", "right"];
  let seed = 0xc001d00d >>> 0;
  const rand = () => {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  };
  const entities = new Array(128).fill(null).map((_, i) => ({
    id: i,
    x: (i * 3) % 64,
    y: Math.floor((i * 3) / 64),
  }));
  let moves = 0;
  let collisions = 0;
  for (let i = 0; i < 3600; i++) {
    const entityId = Math.floor(rand() * 128);
    const dir = directions[Math.floor(rand() * 4)];
    const e = entities[entityId];
    let nx = e.x, ny = e.y;
    if (dir === "up") ny = Math.max(0, e.y - 1);
    else if (dir === "down") ny = Math.min(63, e.y + 1);
    else if (dir === "left") nx = Math.max(0, e.x - 1);
    else nx = Math.min(63, e.x + 1);
    let occupied = false;
    for (let j = 0; j < 128; j++) {
      if (j !== e.id && entities[j].x === nx && entities[j].y === ny) {
        occupied = true;
        collisions++;
        break;
      }
    }
    if (!occupied) {
      e.x = nx;
      e.y = ny;
      moves++;
    }
  }
  const finalPosSum = entities.reduce((acc, e) => acc + e.x + e.y * 64, 0);
  assert(moves === ORACLE.moves, `JS moves ${moves} != ${ORACLE.moves}`);
  assert(collisions === ORACLE.collisions, `JS collisions ${collisions} != ${ORACLE.collisions}`);
  assert(
    finalPosSum === ORACLE.finalPosSum,
    `JS finalPosSum ${finalPosSum} != ${ORACLE.finalPosSum}`,
  );
});

Deno.test("multilang grid-movement: C kernel matches the JS oracle exactly", async () => {
  const instance = await load("grid_kernel_c.wasm");
  const r = runKernel(instance);
  assert(r.moves === ORACLE.moves, `C moves ${r.moves} != ${ORACLE.moves}`);
  assert(
    r.collisions === ORACLE.collisions,
    `C collisions ${r.collisions} != ${ORACLE.collisions}`,
  );
  assert(r.finalPosSum === ORACLE.finalPosSum, `C sum ${r.finalPosSum} != ${ORACLE.finalPosSum}`);
  assert(r.ret === ORACLE.finalPosSum, `C return ${r.ret} != ${ORACLE.finalPosSum}`);
});

Deno.test("multilang grid-movement: C++ kernel matches the JS oracle exactly", async () => {
  const instance = await load("grid_kernel_cpp.wasm");
  const r = runKernel(instance);
  assert(r.moves === ORACLE.moves, `C++ moves ${r.moves} != ${ORACLE.moves}`);
  assert(
    r.collisions === ORACLE.collisions,
    `C++ collisions ${r.collisions} != ${ORACLE.collisions}`,
  );
  assert(r.finalPosSum === ORACLE.finalPosSum, `C++ sum ${r.finalPosSum} != ${ORACLE.finalPosSum}`);
});

Deno.test("multilang grid-movement: Rust kernel matches the JS oracle exactly", async () => {
  const instance = await load("grid_kernel_rs.wasm");
  const r = runKernel(instance);
  assert(r.moves === ORACLE.moves, `Rust moves ${r.moves} != ${ORACLE.moves}`);
  assert(
    r.collisions === ORACLE.collisions,
    `Rust collisions ${r.collisions} != ${ORACLE.collisions}`,
  );
  assert(
    r.finalPosSum === ORACLE.finalPosSum,
    `Rust sum ${r.finalPosSum} != ${ORACLE.finalPosSum}`,
  );
});

Deno.test("multilang grid-movement: AssemblyScript kernel matches the JS oracle exactly", async () => {
  const instance = await load("grid_kernel_asc.wasm", { env: { abort: () => {} } });
  const r = runKernel(instance);
  assert(r.moves === ORACLE.moves, `AS moves ${r.moves} != ${ORACLE.moves}`);
  assert(
    r.collisions === ORACLE.collisions,
    `AS collisions ${r.collisions} != ${ORACLE.collisions}`,
  );
  assert(r.finalPosSum === ORACLE.finalPosSum, `AS sum ${r.finalPosSum} != ${ORACLE.finalPosSum}`);
});
