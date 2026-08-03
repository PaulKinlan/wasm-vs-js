import {
  floodFillJavaScript,
  floodFillWasm,
  instantiateImageEditingWasm,
  lumaGaussianPipelineJavaScript,
  lumaGaussianPipelineWasm,
  sha256Hex,
} from "./image-demo-engine.js";

const DEMOS = Object.freeze({
  "image-flood-fill-demo": Object.freeze({
    fixtureUrl: "/artifacts/image-editing-demo/generated-map-64x48.rgba",
    fixtureSha256: "e73223a6982e72ffa4eedbc74c5e2d8622773ab66d67a7fef96188e39d299554",
    width: 64,
    height: 48,
    seedX: 10,
    seedY: 12,
    outputSha256: "898507f255796bd6c3edfa4d938d369ceb3cf1c744f0554f8118949182e4f559",
    maskSha256: "f40ae0b5c3ef9b289d6ae6643c8432e77994ad72118031aa7a28aa1357efd88c",
  }),
  "image-editing-demo": Object.freeze({
    fixtureUrl: "/artifacts/image-editing-demo/generated-photo-40x30.rgba",
    fixtureSha256: "f57f8734dac54c95405d08b4121a1ccea15c0de9dd9adcef6624de1cc408a550",
    width: 40,
    height: 30,
    outputSha256: "286f9422579da9052de00c67ced53dd547fed6be27b21e608d286674dbb4006c",
  }),
});
const WASM_URL = "/artifacts/image-editing-demo/image-editing.wasm";
const TARGETS = new Set(["javascript", "wasm-linear"]);
let accepted = false;

async function fetchBytes(url) {
  const response = await fetch(url, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function execute(demoId, target) {
  const config = DEMOS[demoId];
  if (!config) throw new Error("unknown demo denied");
  if (!TARGETS.has(target)) throw new Error("unknown implementation denied");
  const fixture = await fetchBytes(config.fixtureUrl);
  const fixtureHash = await sha256Hex(fixture);
  if (fixtureHash !== config.fixtureSha256) throw new Error("fixture hash mismatch");

  let result;
  if (target === "wasm-linear") {
    const wasm = await fetchBytes(WASM_URL);
    const exports = await instantiateImageEditingWasm(wasm);
    result = demoId === "image-flood-fill-demo"
      ? floodFillWasm(exports, fixture, config.width, config.height, config.seedX, config.seedY)
      : lumaGaussianPipelineWasm(exports, fixture, config.width, config.height);
  } else {
    result = demoId === "image-flood-fill-demo"
      ? floodFillJavaScript(fixture, config.width, config.height, config.seedX, config.seedY)
      : lumaGaussianPipelineJavaScript(fixture, config.width, config.height);
  }

  const outputSha256 = await sha256Hex(result.output);
  if (outputSha256 !== config.outputSha256) throw new Error("output hash mismatch");
  let mask = null;
  let maskSha256 = null;
  if (demoId === "image-flood-fill-demo") {
    mask = result.visitedMask;
    maskSha256 = await sha256Hex(mask);
    if (maskSha256 !== config.maskSha256) throw new Error("visited-mask hash mismatch");
  }
  return {
    demoId,
    target,
    dimensions: { width: config.width, height: config.height, rgbaBytes: result.output.byteLength },
    fixture: { url: config.fixtureUrl, sha256: fixtureHash },
    output: result.output,
    outputSha256,
    mask,
    maskSha256,
    changedBounds: demoId === "image-flood-fill-demo" ? result.changedBounds : null,
    counters: result.counters,
    validation: "exact-match",
  };
}

globalThis.addEventListener("message", async (event) => {
  const message = event.data;
  if (accepted || !message || message.type !== "run" || typeof message.token !== "string") return;
  accepted = true;
  try {
    const result = await execute(message.demoId, message.target);
    const transfers = [result.output.buffer];
    if (result.mask) transfers.push(result.mask.buffer);
    globalThis.postMessage({ type: "result", token: message.token, result }, {
      transfer: transfers,
    });
  } catch (error) {
    globalThis.postMessage({
      type: "error",
      token: message.token,
      message: error instanceof Error ? error.message : "worker failed",
    });
  }
});
