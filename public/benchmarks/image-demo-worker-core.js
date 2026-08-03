import { floodFillJavaScript, lumaGaussianPipelineJavaScript } from "./image-demo-js-engine.js";
import {
  floodFillWasm,
  instantiateImageEditingWasm,
  lumaGaussianPipelineWasm,
  sha256Hex,
} from "./image-demo-engine.js";

const FLOOD_COUNTERS = Object.freeze({
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
const PIPELINE_COUNTERS = Object.freeze({
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

function targetOracles(counters, changedBounds) {
  return Object.freeze({
    javascript: Object.freeze({ counters, changedBounds }),
    "wasm-linear": Object.freeze({ counters, changedBounds }),
  });
}

export const IMAGE_DEMOS = Object.freeze({
  "image-flood-fill-demo": Object.freeze({
    fixtureUrl: "/artifacts/image-editing-demo/generated-map-64x48.rgba",
    fixtureSha256: "e73223a6982e72ffa4eedbc74c5e2d8622773ab66d67a7fef96188e39d299554",
    width: 64,
    height: 48,
    seedX: 10,
    seedY: 12,
    outputSha256: "898507f255796bd6c3edfa4d938d369ceb3cf1c744f0554f8118949182e4f559",
    maskSha256: "f40ae0b5c3ef9b289d6ae6643c8432e77994ad72118031aa7a28aa1357efd88c",
    oracles: targetOracles(
      FLOOD_COUNTERS,
      Object.freeze({ minX: 0, minY: 0, maxX: 63, maxY: 47 }),
    ),
  }),
  "image-editing-demo": Object.freeze({
    fixtureUrl: "/artifacts/image-editing-demo/generated-photo-40x30.rgba",
    fixtureSha256: "f57f8734dac54c95405d08b4121a1ccea15c0de9dd9adcef6624de1cc408a550",
    width: 40,
    height: 30,
    outputSha256: "286f9422579da9052de00c67ced53dd547fed6be27b21e608d286674dbb4006c",
    maskSha256: null,
    oracles: targetOracles(PIPELINE_COUNTERS, null),
  }),
});
const WASM_URL = "/artifacts/image-editing-demo/image-editing.wasm";
const TARGETS = new Set(["javascript", "wasm-linear"]);

async function fetchBytes(url) {
  const response = await fetch(url, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function assertExactRecord(actual, expected, label) {
  if (expected === null) {
    if (actual !== null) throw new Error(`${label} mismatch`);
    return;
  }
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
    throw new Error(`${label} mismatch`);
  }
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) throw new Error(`${label} fields mismatch`);
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) throw new Error(`${label}.${key} mismatch`);
  }
}

async function execute(config, demoId, target, fixture, loadBytes) {
  if (target === "wasm-linear") {
    const exports = await instantiateImageEditingWasm(await loadBytes(WASM_URL));
    return demoId === "image-flood-fill-demo"
      ? floodFillWasm(exports, fixture, config.width, config.height, config.seedX, config.seedY)
      : lumaGaussianPipelineWasm(exports, fixture, config.width, config.height);
  }
  return demoId === "image-flood-fill-demo"
    ? floodFillJavaScript(fixture, config.width, config.height, config.seedX, config.seedY)
    : lumaGaussianPipelineJavaScript(fixture, config.width, config.height);
}

export async function runImageDemo(request, dependencies = {}) {
  const { demoId, target } = request;
  const config = IMAGE_DEMOS[demoId];
  if (!config) throw new Error("unknown demo denied");
  if (!TARGETS.has(target)) throw new Error("unknown implementation denied");
  const loadBytes = dependencies.loadBytes ?? fetchBytes;
  const hash = dependencies.sha256Hex ?? sha256Hex;
  const fixture = await loadBytes(config.fixtureUrl);
  const fixtureHash = await hash(fixture);
  if (fixtureHash !== config.fixtureSha256) throw new Error("fixture hash mismatch");

  let result = await execute(config, demoId, target, fixture, loadBytes);
  if (dependencies.afterExecute) result = await dependencies.afterExecute(result);
  const outputSha256 = await hash(result.output);
  if (outputSha256 !== config.outputSha256) throw new Error("output hash mismatch");

  let mask = null;
  let maskSha256 = null;
  if (config.maskSha256 !== null) {
    mask = result.visitedMask;
    if (!(mask instanceof Uint8Array)) throw new Error("visited mask missing");
    maskSha256 = await hash(mask);
    if (maskSha256 !== config.maskSha256) throw new Error("visited-mask hash mismatch");
  } else if (result.visitedMask !== undefined) {
    throw new Error("unexpected visited mask");
  }

  const oracle = config.oracles[target];
  const changedBounds = result.changedBounds ?? null;
  assertExactRecord(changedBounds, oracle.changedBounds, "changedBounds");
  assertExactRecord(result.counters, oracle.counters, "counters");

  return {
    demoId,
    target,
    dimensions: { width: config.width, height: config.height, rgbaBytes: result.output.byteLength },
    fixture: { url: config.fixtureUrl, sha256: fixtureHash },
    output: result.output,
    outputSha256,
    mask,
    maskSha256,
    changedBounds,
    counters: result.counters,
    validation: "exact-match",
  };
}
