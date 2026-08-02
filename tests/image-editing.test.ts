import { sha256Hex } from "../lib/canonical.ts";
import { validateBenchmark } from "../lib/contracts.ts";
import {
  FLOOD_REPLACEMENT,
  LINEAR_MEMORY_LAYOUT,
  RGBA_CHANNELS,
} from "../benchmarks/image-editing/contract.ts";
import {
  FLOOD_FIXTURE,
  generateFloodFixture,
  generatePipelineFixture,
  PIPELINE_FIXTURE,
} from "../benchmarks/image-editing/fixtures.ts";
import {
  floodFillJavaScript,
  lumaGaussianPipelineJavaScript,
} from "../benchmarks/image-editing/js.ts";
import {
  floodFillWasm,
  instantiateImageEditingWasm,
  lumaGaussianPipelineWasm,
} from "../benchmarks/image-editing/wasm.ts";
import { assert, assertEquals } from "./assert.ts";

async function runtime() {
  return await instantiateImageEditingWasm(
    await Deno.readFile("benchmarks/image-editing/artifacts/image-editing.wasm"),
  );
}

function pixel(red: number, green: number, blue: number, alpha = 255): number[] {
  return [red, green, blue, alpha];
}

Deno.test("generated image fixtures are byte-identical and carry an explicit rights record", async () => {
  const manifestBytes = await Deno.readFile(
    "benchmarks/image-editing/fixtures/fixture-manifest.json",
  );
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  const benchmark = JSON.parse(await Deno.readTextFile("benchmarks/image-editing/benchmark.json"));
  const flood = generateFloodFixture();
  const pipeline = generatePipelineFixture();
  assertEquals(
    [...await Deno.readFile("benchmarks/image-editing/fixtures/generated-map-64x48.rgba")],
    [...flood],
  );
  assertEquals(
    [...await Deno.readFile("benchmarks/image-editing/fixtures/generated-photo-40x30.rgba")],
    [...pipeline],
  );
  assertEquals(await sha256Hex(flood), manifest.fixtures[0].sha256);
  assertEquals(await sha256Hex(pipeline), manifest.fixtures[1].sha256);
  assertEquals(await sha256Hex(manifestBytes), benchmark.inputs.manifestSha256);
  assertEquals(manifest.rights.license, "CC0-1.0");
  assertEquals(manifest.rights.redistribution, "permitted");
  assert((await Deno.readTextFile("benchmarks/image-editing/fixtures/RIGHTS.md")).includes(
    "reads no photographs, fonts, icons, or other third-party media",
  ));
});

Deno.test("proposal definition and measurement contract keep image editing out of catalog v1", async () => {
  const benchmark = JSON.parse(await Deno.readTextFile("benchmarks/image-editing/benchmark.json"));
  const contract = JSON.parse(
    await Deno.readTextFile("benchmarks/image-editing/measurement-contract.json"),
  );
  const catalog = await Deno.readTextFile("catalog/workloads.v1.json");
  const publicCatalog = await Deno.readTextFile("public/data/workloads.v1.json");
  assert(validateBenchmark(benchmark).ok);
  assertEquals(contract.status, "proposal-out-of-catalog");
  assertEquals(contract.authoritativePerformanceEvidence, false);
  assertEquals(contract.tolerance.controlledPixels, "exact");
  assertEquals(contract.tolerance.controlledMasks, "exact");
  assertEquals(contract.phases.map((phase: { id: string }) => phase.id), [
    "fixture-materialization",
    "ingress-and-reset-copy",
    "resident-algorithm",
    "egress-copy",
    "validation",
    "canvas-upload",
    "presentation-proxy",
  ]);
  assertEquals(catalog, publicCatalog);
  assert(!catalog.includes("image-editing-proposal"));
});

Deno.test("controlled flood fill has exact JavaScript and Wasm pixels, mask, work, and phases", async () => {
  const fixture = generateFloodFixture();
  const js = floodFillJavaScript(
    fixture,
    FLOOD_FIXTURE.width,
    FLOOD_FIXTURE.height,
    10,
    12,
  );
  const wasm = floodFillWasm(
    await runtime(),
    fixture,
    FLOOD_FIXTURE.width,
    FLOOD_FIXTURE.height,
    10,
    12,
  );
  assertEquals([...wasm.output], [...js.output]);
  assertEquals([...wasm.visitedMask], [...js.visitedMask]);
  assertEquals(wasm.counters, js.counters);
  assertEquals(
    await sha256Hex(js.output),
    "898507f255796bd6c3edfa4d938d369ceb3cf1c744f0554f8118949182e4f559",
  );
  assertEquals(
    await sha256Hex(js.visitedMask),
    "f40ae0b5c3ef9b289d6ae6643c8432e77994ad72118031aa7a28aa1357efd88c",
  );
  assertEquals(js.counters, {
    operations: 35_536,
    readBytes: 35_536,
    writeBytes: 26_540,
    visitedPixels: 3_072,
    changedPixels: 2_795,
    neighborTests: 10_956,
    stackPushes: 3_072,
    stackPops: 3_072,
    maxFrontier: 1_050,
    allocations: 0,
    allocationBytes: 0,
    boundaryCrossings: 1,
  });
  assertEquals(js.phases.copy.copiedBytes, 43_008);
  assertEquals(wasm.phases.copy.copiedBytes, 43_008);
  assertEquals(js.phases.copy.boundaryCrossings, 2);
  assertEquals(js.phases.presentation.status, "not-run-proposal-contract");
  assertEquals(js.phases.presentation.uploadBytes, fixture.byteLength);
  assertEquals(js.phases.presentation.boundaryCrossings, 0);
});

Deno.test("flood fill adversarial barrier and no-op cases compare every pixel and mask byte", async () => {
  const base = pixel(10, 12, 14);
  const barrier = pixel(100, 100, 100);
  const fixture = new Uint8Array([
    ...base,
    ...base,
    ...barrier,
    ...base,
    ...base,
    ...base,
    ...barrier,
    ...base,
    ...base,
    ...base,
    ...barrier,
    ...base,
  ]);
  const expected = new Uint8Array([
    ...FLOOD_REPLACEMENT,
    ...FLOOD_REPLACEMENT,
    ...barrier,
    ...base,
    ...FLOOD_REPLACEMENT,
    ...FLOOD_REPLACEMENT,
    ...barrier,
    ...base,
    ...FLOOD_REPLACEMENT,
    ...FLOOD_REPLACEMENT,
    ...barrier,
    ...base,
  ]);
  const expectedMask = new Uint8Array([
    1,
    1,
    1,
    0,
    1,
    1,
    1,
    0,
    1,
    1,
    1,
    0,
  ]);
  const js = floodFillJavaScript(fixture, 4, 3, 0, 0);
  const wasm = floodFillWasm(await runtime(), fixture, 4, 3, 0, 0);
  assertEquals([...js.output], [...expected]);
  assertEquals([...js.visitedMask], [...expectedMask]);
  assertEquals([...wasm.output], [...expected]);
  assertEquals([...wasm.visitedMask], [...expectedMask]);
  assertEquals(wasm.counters, js.counters);
  assertEquals(js.counters.changedPixels, 6);
  assertEquals(js.counters.visitedPixels, 9);
  assertEquals(js.changedBounds, { minX: 0, minY: 0, maxX: 1, maxY: 2 });

  const alreadyReplacement = new Uint8Array(FLOOD_REPLACEMENT);
  const noOpJs = floodFillJavaScript(alreadyReplacement, 1, 1, 0, 0);
  const noOpWasm = floodFillWasm(await runtime(), alreadyReplacement, 1, 1, 0, 0);
  assertEquals([...noOpJs.output], [...alreadyReplacement]);
  assertEquals([...noOpJs.visitedMask], [0]);
  assertEquals(noOpJs.counters.operations, RGBA_CHANNELS);
  assertEquals(noOpJs.counters.readBytes, RGBA_CHANNELS);
  assertEquals(noOpJs.counters.visitedPixels, 0);
  assertEquals(noOpWasm.counters, noOpJs.counters);
  assertEquals([...noOpWasm.output], [...alreadyReplacement]);
  assertEquals([...noOpWasm.visitedMask], [0]);
});

Deno.test("controlled luma Gaussian pipeline has exact full output and declared integer work", async () => {
  const fixture = generatePipelineFixture();
  const js = lumaGaussianPipelineJavaScript(
    fixture,
    PIPELINE_FIXTURE.width,
    PIPELINE_FIXTURE.height,
  );
  const wasm = lumaGaussianPipelineWasm(
    await runtime(),
    fixture,
    PIPELINE_FIXTURE.width,
    PIPELINE_FIXTURE.height,
  );
  assertEquals([...wasm.output], [...js.output]);
  assertEquals(wasm.counters, js.counters);
  assertEquals(
    await sha256Hex(js.output),
    "286f9422579da9052de00c67ced53dd547fed6be27b21e608d286674dbb4006c",
  );
  assertEquals(js.counters, {
    operations: 22_800,
    readBytes: 15_600,
    writeBytes: 8_400,
    visitedPixels: 1_200,
    changedPixels: 0,
    neighborTests: 0,
    stackPushes: 0,
    stackPops: 0,
    maxFrontier: 0,
    allocations: 0,
    allocationBytes: 0,
    boundaryCrossings: 1,
  });
  assertEquals(js.phases.copy.copiedBytes, fixture.byteLength * 2);
  assertEquals(wasm.phases.copy.copiedBytes, fixture.byteLength * 2);
  assertEquals(js.phases.presentation.status, "not-run-proposal-contract");
});

Deno.test("small luma Gaussian oracle freezes replicate borders, rounding, and alpha copy", async () => {
  const fixture = new Uint8Array([
    ...pixel(255, 0, 0, 11),
    ...pixel(0, 255, 0, 22),
    ...pixel(0, 0, 255, 33),
    ...pixel(0, 0, 0, 44),
    ...pixel(255, 255, 255, 55),
    ...pixel(128, 128, 128, 66),
  ]);
  const expected = new Uint8Array([
    ...pixel(87, 87, 87, 11),
    ...pixel(116, 116, 116, 22),
    ...pixel(84, 84, 84, 33),
    ...pixel(72, 72, 72, 44),
    ...pixel(145, 145, 145, 55),
    ...pixel(135, 135, 135, 66),
  ]);
  const js = lumaGaussianPipelineJavaScript(fixture, 3, 2);
  const wasm = lumaGaussianPipelineWasm(await runtime(), fixture, 3, 2);
  assertEquals([...js.output], [...expected]);
  assertEquals([...wasm.output], [...expected]);
  assertEquals(wasm.counters, js.counters);
});

Deno.test("fixed Wasm memory preserves canary gaps and cannot grow", async () => {
  const wasmRuntime = await runtime();
  const memory = new Uint8Array(wasmRuntime.exports.memory.buffer);
  const guards = [
    [12_288, LINEAR_MEMORY_LAYOUT.output],
    [28_672, LINEAR_MEMORY_LAYOUT.maskOrLuma],
    [LINEAR_MEMORY_LAYOUT.counters + 36, memory.byteLength],
  ] as const;
  for (const [start, end] of guards) memory.fill(0xa5, start, end);
  floodFillWasm(wasmRuntime, generateFloodFixture(), 64, 48, 10, 12);
  for (const [start, end] of guards) {
    assert(
      memory.subarray(start, end).every((value) => value === 0xa5),
      `guard bytes changed at ${start}:${end}`,
    );
  }
  let threw = false;
  try {
    wasmRuntime.exports.memory.grow(1);
  } catch (error) {
    threw = error instanceof RangeError;
  }
  assert(threw, "fixed one-page Wasm memory unexpectedly grew");
});
