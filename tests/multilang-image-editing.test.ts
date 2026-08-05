import { assert } from "./assert.ts";
import {
  floodFillJavaScript,
  lumaGaussianPipelineJavaScript,
} from "../benchmarks/image-editing/js.ts";
import {
  FLOOD_FIXTURE,
  generateFloodFixture,
  generatePipelineFixture,
  PIPELINE_FIXTURE,
} from "../benchmarks/image-editing/fixtures.ts";
import { COUNTER_NAMES } from "../benchmarks/image-editing/contract.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

// Fixed one-page layout (bytes), shared with the pinned proposal WAT and the
// compiled variants (their statics live past the first page; the data layout
// is identical).
const SRC = 0, OUT = 16384, MASK_LUMA = 32768, COUNTERS = 49152;

interface LinearExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  flood_fill: (width: number, height: number, seedX: number, seedY: number) => void;
  luma_gaussian_pipeline: (width: number, height: number) => void;
}

function assertBytes(label: string, got: Uint8Array, ref: Uint8Array): void {
  assert(got.length === ref.length, `${label} length ${got.length} != ${ref.length}`);
  for (let i = 0; i < ref.length; i++) {
    assert(got[i] === ref[i], `${label} byte mismatch at ${i}: got=${got[i]} ref=${ref[i]}`);
  }
}

function assertCounters(label: string, got: Uint32Array, ref: Record<string, number>): void {
  COUNTER_NAMES.forEach((name, index) => {
    assert(
      got[index] === ref[name],
      `${label} counter ${name}: got=${got[index]} ref=${ref[name]}`,
    );
  });
}

Deno.test(
  "multilang-image-editing: report contains a measured image-editing workload with 6 variants",
  async () => {
    const report = JSON.parse(
      await Deno.readTextFile(`${rootDir}/public/data/multilang-wasm-benchmark-report.v1.json`),
    );
    const wl = report.workloads.find((w: { name: string }) => w.name === "image-editing");
    assert(wl, "image-editing workload missing from report");
    assert(wl.variants.length >= 6, "image-editing needs 6 variants");
    for (const variant of wl.variants) {
      assert(typeof variant.warmExecutionMs === "number", `${variant.language} must be measured`);
    }
    const languages = wl.variants.map((v: { language: string }) => v.language);
    for (
      const expected of [
        "Rust / Wasm",
        "Dart / WasmGC",
        "C / Wasm",
        "C++ / Wasm",
        "AssemblyScript / Wasm",
        "JavaScript",
      ]
    ) {
      assert(languages.includes(expected), `image-editing missing ${expected}`);
    }
  },
);

Deno.test(
  "multilang-image-editing: C, C++, Rust, AssemblyScript, and Dart/WasmGC kernels are bit-identical to the image-editing oracle",
  async () => {
    const floodFixture = generateFloodFixture();
    const pipeFixture = generatePipelineFixture();
    const refFlood = floodFillJavaScript(
      floodFixture,
      FLOOD_FIXTURE.width,
      FLOOD_FIXTURE.height,
      10,
      12,
    );
    const refPipe = lumaGaussianPipelineJavaScript(
      pipeFixture,
      PIPELINE_FIXTURE.width,
      PIPELINE_FIXTURE.height,
    );

    const linear = [
      ["image_kernels_c.wasm", "C"],
      ["image_kernels_cpp.wasm", "C++"],
      ["image_kernels_rs.wasm", "Rust"],
      ["image_kernels_asc.wasm", "AssemblyScript"],
    ] as const;
    for (const [file, label] of linear) {
      const result = await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        {},
      );
      const instance = result instanceof WebAssembly.Instance ? result : result.instance;
      const exports = instance.exports as LinearExports;
      const mem = new Uint8Array(exports.memory.buffer);

      // Flood fill: host pre-stages source + output copy + zeroed mask.
      mem.set(floodFixture, SRC);
      mem.set(floodFixture, OUT);
      mem.fill(0, MASK_LUMA, MASK_LUMA + FLOOD_FIXTURE.width * FLOOD_FIXTURE.height);
      exports.flood_fill(FLOOD_FIXTURE.width, FLOOD_FIXTURE.height, 10, 12);
      const pixels = FLOOD_FIXTURE.width * FLOOD_FIXTURE.height;
      assertBytes(
        `${label} flood output`,
        mem.slice(OUT, OUT + refFlood.output.length),
        refFlood.output,
      );
      assertBytes(
        `${label} flood visited mask`,
        mem.slice(MASK_LUMA, MASK_LUMA + pixels),
        refFlood.visitedMask,
      );
      assertCounters(
        `${label} flood`,
        new Uint32Array(exports.memory.buffer, COUNTERS, COUNTER_NAMES.length),
        refFlood.counters as unknown as Record<string, number>,
      );

      // Luma Gaussian pipeline: host pre-stages source only.
      mem.set(pipeFixture, SRC);
      exports.luma_gaussian_pipeline(PIPELINE_FIXTURE.width, PIPELINE_FIXTURE.height);
      assertBytes(
        `${label} pipeline output`,
        mem.slice(OUT, OUT + refPipe.output.length),
        refPipe.output,
      );
      assertCounters(
        `${label} pipeline`,
        new Uint32Array(exports.memory.buffer, COUNTERS, COUNTER_NAMES.length),
        refPipe.counters as unknown as Record<string, number>,
      );
    }

    const dartGlue = await import(`file://${ARTIFACTS}/image_kernels_dart.mjs`);
    const dartApp = await dartGlue.compile(
      await Deno.readFile(`${ARTIFACTS}/image_kernels_dart.wasm`),
    );
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      flood_fill: (
        source: Uint8Array,
        output: Uint8Array,
        mask: Uint8Array,
        counters: Uint32Array,
        width: number,
        height: number,
        seedX: number,
        seedY: number,
      ) => void;
      luma_gaussian_pipeline: (
        source: Uint8Array,
        output: Uint8Array,
        luma: Uint8Array,
        horizontal: Uint16Array,
        counters: Uint32Array,
        width: number,
        height: number,
      ) => void;
    };
    assert(kernels && typeof kernels.flood_fill === "function", "dartKernels not published");

    const floodPixels = FLOOD_FIXTURE.width * FLOOD_FIXTURE.height;
    const dartOutput = new Uint8Array(floodFixture);
    const dartMask = new Uint8Array(floodPixels);
    const dartCounters = new Uint32Array(COUNTER_NAMES.length);
    kernels.flood_fill(
      floodFixture,
      dartOutput,
      dartMask,
      dartCounters,
      FLOOD_FIXTURE.width,
      FLOOD_FIXTURE.height,
      10,
      12,
    );
    assertBytes("Dart/WasmGC flood output", dartOutput, refFlood.output);
    assertBytes("Dart/WasmGC flood visited mask", dartMask, refFlood.visitedMask);
    assertCounters(
      "Dart/WasmGC flood",
      dartCounters,
      refFlood.counters as unknown as Record<string, number>,
    );

    const pipePixels = PIPELINE_FIXTURE.width * PIPELINE_FIXTURE.height;
    const dartPipeOut = new Uint8Array(pipeFixture.byteLength);
    const dartPipeCounters = new Uint32Array(COUNTER_NAMES.length);
    kernels.luma_gaussian_pipeline(
      pipeFixture,
      dartPipeOut,
      new Uint8Array(pipePixels),
      new Uint16Array(pipePixels),
      dartPipeCounters,
      PIPELINE_FIXTURE.width,
      PIPELINE_FIXTURE.height,
    );
    assertBytes("Dart/WasmGC pipeline output", dartPipeOut, refPipe.output);
    assertCounters(
      "Dart/WasmGC pipeline",
      dartPipeCounters,
      refPipe.counters as unknown as Record<string, number>,
    );
  },
);
