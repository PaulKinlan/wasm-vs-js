import { assert } from "./assert.ts";
import { generateEcsFixture } from "../benchmarks/v1/game-ecs-frame-update/fixture.js";
import { runEcsJavaScript } from "../benchmarks/v1/game-ecs-frame-update/engine.js";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// Reduced fixed shape for the comparison (full contract shape is 10,000
// entities x 1,000 frames): 1,024 entities, 300 frames exercises movement,
// control, grid collision, animation, and the checkpoint digests.
const ENTITIES = 1024, FRAMES = 300;

function hex(v: number): string {
  return (v >>> 0).toString(16).padStart(8, "0");
}

function keyOf(r: {
  stateDigest: string;
  checkpointDigest: string;
  pairTests: number;
  collisions: number;
  animationUpdates: number;
  controlMutations: number;
  stateMutations: number;
}): string {
  return [
    r.stateDigest,
    r.checkpointDigest,
    r.pairTests,
    r.collisions,
    r.animationUpdates,
    r.controlMutations,
    r.stateMutations,
  ].join(":");
}

const fixture = generateEcsFixture({ entities: ENTITIES, frames: FRAMES, seed: 0x6ec5f17d });
const js = runEcsJavaScript(fixture);
const expected = keyOf({
  stateDigest: js.oracle.finalStateDigest,
  checkpointDigest: js.oracle.checkpointDigest,
  pairTests: js.counters.pairTests,
  collisions: js.counters.collisions,
  animationUpdates: js.counters.animationUpdates,
  controlMutations: js.counters.controlMutations,
  stateMutations: js.counters.stateMutations,
});

async function assertLinearBitIdentical(label: string, bytes: Uint8Array): Promise<void> {
  const mod = (await WebAssembly.instantiate(bytes, {})) as unknown as {
    instance: WebAssembly.Instance;
  };
  const mem = mod.instance.exports.memory as WebAssembly.Memory;
  const input = new Uint8Array(
    mem.buffer,
    (mod.instance.exports.input_ptr as () => number)(),
    fixture.length,
  );
  input.set(fixture);
  assert(
    (mod.instance.exports.run as (l: number) => number)(fixture.length) === 0,
    `${label} run != 0`,
  );
  const w = new Uint32Array(mem.buffer, (mod.instance.exports.result_ptr as () => number)(), 128);
  const got = keyOf({
    stateDigest: hex(w[0]),
    checkpointDigest: hex(w[1]),
    pairTests: w[23],
    collisions: w[24],
    animationUpdates: w[25],
    controlMutations: w[27],
    stateMutations: w[28],
  });
  assert(got === expected, `${label} digest mismatch: got=${got} expected=${expected}`);
}

Deno.test("multilang-ecs: C/C++/Rust kernels are bit-identical to the runEcsJavaScript oracle", async () => {
  for (const key of ["c", "cpp", "rs"]) {
    const bytes = await Deno.readFile(`${ARTIFACTS}/ecs_frame_update_${key}.wasm`);
    assertLinearBitIdentical(key, bytes);
  }
});

Deno.test("multilang-ecs: Dart/WasmGC kernel is bit-identical to the oracle", async () => {
  const glue = await import(`file://${ARTIFACTS}/ecs_frame_update_dart.mjs`);
  const app = await glue.compile(await Deno.readFile(`${ARTIFACTS}/ecs_frame_update_dart.wasm`));
  const inst = await app.instantiate({});
  inst.invokeMain();
  const kernels = (globalThis as Record<string, unknown>).dartKernels as {
    run: (f: Uint8Array, r: Uint32Array) => void;
  };
  assert(kernels && typeof kernels.run === "function", "dartKernels not published");
  const result = new Uint32Array(128 + ENTITIES * 6);
  kernels.run(fixture, result);
  const got = keyOf({
    stateDigest: hex(result[0]),
    checkpointDigest: hex(result[1]),
    pairTests: result[23],
    collisions: result[24],
    animationUpdates: result[25],
    controlMutations: result[27],
    stateMutations: result[28],
  });
  assert(got === expected, `Dart/WasmGC digest mismatch: got=${got} expected=${expected}`);
});

Deno.test("multilang-ecs: report contains a measured game-ecs-frame-update workload with 5 variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const wl = report.workloads.find((w: { name: string }) => w.name === "game-ecs-frame-update");
  assert(wl, "game-ecs-frame-update workload missing from report");
  assert(wl.variants.length >= 5, "game-ecs-frame-update needs 5 variants");
  for (const variant of wl.variants) {
    assert(typeof variant.warmExecutionMs === "number", `${variant.language} must be measured`);
  }
  const languages = wl.variants.map((v: { language: string }) => v.language);
  for (
    const expectedLang of ["Rust / Wasm", "Dart / WasmGC", "C / Wasm", "C++ / Wasm", "JavaScript"]
  ) {
    assert(languages.includes(expectedLang), `game-ecs-frame-update missing ${expectedLang}`);
  }
});
