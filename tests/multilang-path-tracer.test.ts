// graphics.cpu-path-tracer.v1 timed four engines and checked only that
// render() returned 0. Nothing compared the images, so an engine that drew a
// different picture — or stopped early and left the framebuffer blank — would
// have been reported as a faster engine rather than a broken one.
//
// The engines do in fact agree byte for byte, which is what makes the
// comparison meaningful and what the adapter now asserts at run time. This
// pins that agreement, including for the AssemblyScript engine added
// alongside it: a scalar port whose f32 expression grouping has to match the
// C exactly to land on the same pixels.

import { assert } from "./assert.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const ARTIFACTS = `${ROOT}public/artifacts/multilang-wasm-benchmark/`;

const WIDTH = 16, HEIGHT = 16, SPP = 4;
const ENGINES = [
  "path_tracer_c.wasm",
  "path_tracer_cpp.wasm",
  "path_tracer_rs.wasm",
  "path_tracer_asc.wasm",
];

/** The frozen frame and the counters every engine reaches. */
const ORACLE = {
  frameFnv1a: 0x509d4baf,
  // rays, bounces, node tests, intersections, samples, RNG draws, output bytes.
  counters: [3378, 3248, 35866, 6531, 1024, 10287, 1024],
};

function fnv1a(bytes: Uint8Array): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = Math.imul(hash ^ bytes[i], 0x01000193) >>> 0;
  }
  return hash;
}

async function render(file: string): Promise<{ frame: number; counters: number[] }> {
  const { instance } = await WebAssembly.instantiate(
    await Deno.readFile(ARTIFACTS + file),
    {
      env: {
        abort: () => {
          throw new Error(`${file}: abort()`);
        },
      },
    },
  );
  const exports = instance.exports as Record<string, CallableFunction> & {
    memory: WebAssembly.Memory;
  };
  const status = Number(exports.render(WIDTH, HEIGHT, SPP));
  assert(status === 0, `${file}: render() returned ${status}`);
  const frame = new Uint8Array(
    exports.memory.buffer,
    Number(exports.framebuffer_ptr()),
    WIDTH * HEIGHT * 4,
  );
  const raw = new Uint32Array(
    exports.memory.buffer,
    Number(exports.counters_ptr()),
    9,
  );
  // Allocations (6) and boundary crossings (8) are engine properties, not
  // properties of the image, so they are not compared.
  return {
    frame: fnv1a(frame),
    counters: [raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], raw[7]],
  };
}

Deno.test("every path-tracer engine renders the identical frame", async () => {
  for (const file of ENGINES) {
    const { frame, counters } = await render(file);
    assert(
      frame === ORACLE.frameFnv1a,
      `${file} rendered FNV-1a ${frame.toString(16)}, want ${ORACLE.frameFnv1a.toString(16)}`,
    );
    assert(
      counters.every((v, i) => v === ORACLE.counters[i]),
      `${file} counters ${JSON.stringify(counters)} != ${JSON.stringify(ORACLE.counters)}`,
    );
  }
});

Deno.test("the adapter refuses to time a frame it has not checked", async () => {
  const runner = await Deno.readTextFile(`${ROOT}public/multilang-runner.js`);
  const at = runner.indexOf('"graphics-cpu-path-tracer.v1"');
  assert(at !== -1, "path tracer adapter not found");
  const block = runner.slice(at, at + 6000);
  assert(
    block.includes("frameFnv1a"),
    "the adapter must digest the rendered frame, not just read render()'s status",
  );
  // Every engine, not only the Wasm ones.
  for (const key of ["js", "dart"]) {
    assert(
      new RegExp(`path_tracer ${key} rendered a different frame`).test(block),
      `the ${key} engine's frame must be checked too`,
    );
  }
});

Deno.test("the manifest declares the AssemblyScript engine", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile(
      `${ROOT}public/benchmarks/multilang-wasm/graphics-cpu-path-tracer.manifest.json`,
    ),
  ) as { engines: Array<{ key: string }> };
  assert(
    manifest.engines.some((e) => e.key === "asc"),
    "graphics-cpu-path-tracer must declare asc",
  );
});
