import { assert } from "./assert.ts";
import { generateFixture } from "../benchmarks/base/simulation-nbody/fixture.js";
import { decodeResult, runJavaScript } from "../benchmarks/base/simulation-nbody/engine.js";
import {
  BODY_COUNT,
  DT,
  GRAVITY,
  OUTPUT_HEADER_BYTES,
  SOFTENING_SQUARED,
  TIMESTEPS,
} from "../benchmarks/base/simulation-nbody/contract.js";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// The full frozen contract shape (1024 bodies x 120 timesteps) is cheap in
// every engine (~0.3s JS), so the bit-identity check runs at full size against
// the authoritative base engine (the oracle).

function engineFinalState(): Float64Array {
  const js = runJavaScript(generateFixture());
  return new Float64Array(
    js.output.buffer,
    js.output.byteOffset + OUTPUT_HEADER_BYTES,
    BODY_COUNT * 6,
  );
}

async function runLinearKernel(file: string): Promise<Float64Array> {
  const { instance } = await WebAssembly.instantiate(
    await Deno.readFile(`${ARTIFACTS}/${file}`),
    {},
  ) as unknown as { instance: WebAssembly.Instance };
  const mem = instance.exports.memory as WebAssembly.Memory;
  const N = BODY_COUNT;
  const bytesPer = N * 8;
  const off = (k: number) => k * bytesPer;
  const fixture = generateFixture();
  // layout: mass, px, py, pz, vx, vy, vz, ax, ay, az, out
  new Uint8Array(mem.buffer, 0, 11 * bytesPer).set(fixture.subarray(64, 64 + 7 * bytesPer));
  (instance.exports.nbody_step as (...args: number[]) => void)(
    off(0),
    off(1),
    off(2),
    off(3),
    off(4),
    off(5),
    off(6),
    off(7),
    off(8),
    off(9),
    off(10),
    N,
    TIMESTEPS,
    DT,
    GRAVITY,
    SOFTENING_SQUARED,
  );
  return new Float64Array(mem.buffer, off(10), N * 6).slice();
}

function assertBitIdentical(label: string, got: Float64Array, ref: Float64Array): void {
  assert(
    got.length === ref.length,
    `${label}: output length ${got.length} != ${ref.length}`,
  );
  for (let i = 0; i < ref.length; i++) {
    assert(
      Object.is(got[i], ref[i]),
      `${label} output mismatch at ${i}: got=${got[i]} ref=${ref[i]}`,
    );
  }
}

Deno.test(
  "multilang-nbody: C, C++, Rust, and Dart/WasmGC nbody_step kernels are bit-identical to the engine oracle at full contract shape",
  async () => {
    const ref = engineFinalState();
    for (
      const [file, label] of [
        ["nbody_step_c.wasm", "C"],
        ["nbody_step_cpp.wasm", "C++"],
        ["nbody_step_rs.wasm", "Rust"],
      ] as const
    ) {
      assertBitIdentical(label, await runLinearKernel(file), ref);
    }

    const dartGlue = await import(`file://${ARTIFACTS}/nbody_step_dart.mjs`);
    const dartApp = await dartGlue.compile(
      await Deno.readFile(`${ARTIFACTS}/nbody_step_dart.wasm`),
    );
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      nbody_step: (
        mass: Float64Array,
        px: Float64Array,
        py: Float64Array,
        pz: Float64Array,
        vx: Float64Array,
        vy: Float64Array,
        vz: Float64Array,
        ax: Float64Array,
        ay: Float64Array,
        az: Float64Array,
        out: Float64Array,
        count: number,
        steps: number,
        dt: number,
        gravity: number,
        soft2: number,
      ) => void;
    };
    assert(kernels && typeof kernels.nbody_step === "function", "dartKernels not published");
    const fixture = generateFixture();
    const N = BODY_COUNT;
    const at = (o: number) => new Float64Array(fixture.buffer, 64 + o * N * 8, N);
    const out = new Float64Array(N * 6);
    kernels.nbody_step(
      at(0),
      at(1),
      at(2),
      at(3),
      at(4),
      at(5),
      at(6),
      new Float64Array(N),
      new Float64Array(N),
      new Float64Array(N),
      out,
      N,
      TIMESTEPS,
      DT,
      GRAVITY,
      SOFTENING_SQUARED,
    );
    assertBitIdentical("Dart/WasmGC", out, ref);
  },
);

Deno.test("multilang-nbody: report contains a measured simulation-nbody-cloth workload with 5 variants", async () => {
  const report = JSON.parse(
    await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
  );
  const wl = report.workloads.find((w: { name: string }) => w.name === "simulation-nbody-cloth");
  assert(wl, "simulation-nbody-cloth workload missing from report");
  assert(wl.variants.length >= 5, "simulation-nbody-cloth needs 5 variants");
  for (const variant of wl.variants) {
    assert(typeof variant.warmExecutionMs === "number", `${variant.language} must be measured`);
  }
  const languages = wl.variants.map((v: { language: string }) => v.language);
  for (const expected of ["Rust / Wasm", "Dart / WasmGC", "C / Wasm", "C++ / Wasm", "JavaScript"]) {
    assert(languages.includes(expected), `simulation-nbody-cloth missing ${expected}`);
  }
});

// Sanity: the pinned oracle digest is unchanged (guards the fixture/engine).
Deno.test("multilang-nbody: engine oracle digest matches the published evidence", () => {
  const js = runJavaScript(generateFixture());
  assert(js.quantizedStateDigest === "5c5c1eca3fffb709", "oracle digest drifted");
});
