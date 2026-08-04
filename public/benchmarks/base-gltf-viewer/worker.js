import {
  normalizeControlledOutput,
  OUTPUT_BYTES,
  quantizeDecodedMesh,
  runJavaScript,
  validateGltfContract,
} from "/benchmarks/base/graphics-gltf-viewer/engine.js";

const A = "/artifacts/base-gltf-viewer/";
const hex = (bytes) => [...bytes].map((v) => v.toString(16).padStart(2, "0")).join("");
async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function fetchJsonBytes(path) {
  const bytes = await fetchBytes(path);
  return { bytes, json: JSON.parse(new TextDecoder().decode(bytes)) };
}
function packMesh(mesh) {
  const header = new Uint32Array([
    mesh.vertexCount,
    mesh.indices.length,
    mesh.positions.length,
    mesh.normals.length,
    mesh.texcoords.length,
  ]);
  const bytes = new Uint8Array(
    header.byteLength + mesh.positions.byteLength + mesh.normals.byteLength +
      mesh.texcoords.byteLength + mesh.indices.byteLength,
  );
  let offset = 0;
  for (const value of [header, mesh.positions, mesh.normals, mesh.texcoords, mesh.indices]) {
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), offset);
    offset += value.byteLength;
  }
  return bytes;
}
function decode(mode, bytes, decoderScript, decoderWasm) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/benchmarks/base-gltf-viewer/decoder-worker.js");
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Draco decode timeout"));
    }, 30_000);
    worker.onmessage = (event) => {
      if (event.data?.type === "decoded") {
        clearTimeout(timer);
        worker.terminate();
        resolve(event.data);
      } else if (event.data?.type === "error") {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message));
    };
    const transfer = [bytes.buffer, decoderScript.buffer];
    if (decoderWasm) transfer.push(decoderWasm.buffer);
    worker.postMessage({
      mode,
      bytes: bytes.buffer,
      decoderScript: decoderScript.buffer,
      decoderWasm: decoderWasm?.buffer,
    }, transfer);
  });
}
async function runWasm(mesh, texture, animation, gltfText, wasmBytes, decoderMetrics) {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const ex = instance.exports;
  const memory = new Uint8Array(ex.memory.buffer), base = ex.heap_ptr();
  let cursor = 0;
  const copy = (value) => {
    cursor = (cursor + 7) & ~7;
    const offset = cursor;
    memory.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), base + offset);
    cursor += value.byteLength;
    return offset;
  };
  const po = copy(mesh.positions),
    no = copy(mesh.normals),
    uo = copy(mesh.texcoords),
    io = copy(mesh.indices);
  const to = copy(texture),
    ao = copy(animation),
    json = new TextEncoder().encode(gltfText),
    jo = copy(json);
  if (ex.validate_gltf(jo, json.length) !== 0) {
    throw new Error("Wasm glTF parser rejected exact model");
  }
  if (
    ex.run(
      po,
      no,
      uo,
      io,
      to,
      ao,
      mesh.vertexCount,
      mesh.indices.length,
      decoderMetrics.allocations,
      decoderMetrics.apiCalls,
      decoderMetrics.wasmBoundaryCrossings,
    ) !== 0
  ) {
    throw new Error("Wasm viewer failed");
  }
  return memory.slice(ex.output_ptr(), ex.output_ptr() + OUTPUT_BYTES);
}

self.onmessage = async (event) => {
  const token = event.data?.token;
  let target = event.data?.target || "javascript";
  if (target === "wasm-linear" || target === "wasm-linear-controlled") target = "wasm";
  if (target === "js" || target === "js-controlled") target = "javascript";
  const mode = event.data?.mode || "bounded";
  if (
    !Number.isInteger(token) || !new Set(["javascript", "wasm"]).has(target) ||
    !new Set(["bounded", "exact"]).has(mode)
  ) {
    self.postMessage({ type: "error", token, message: "invalid request" });
    return;
  }
  try {
    self.postMessage({ type: "progress", token, phase: "Fetching exact assets", value: 10 });
    const [build, fixture, contract, outputManifest, gltf, draco, texture, viewer, animationBytes] =
      await Promise.all([
        fetchJsonBytes(`${A}build-manifest.json`),
        fetchJsonBytes(`${A}fixture-manifest.json`),
        fetchJsonBytes(`${A}implementation-contract.v1.json`),
        fetchJsonBytes(`${A}output-manifest.json`),
        fetchBytes(`${A}Avocado.gltf`),
        fetchBytes(`${A}Avocado.bin`),
        fetchBytes(`${A}base-color-64.rgba`),
        fetchBytes(`${A}viewer.wasm`),
        fetchBytes(`${A}animation-table.i32`),
      ]);
    if (
      build.json.sourceCommit !== outputManifest.json.sourceCommit ||
      !/^[a-f0-9]{40}$/.test(build.json.sourceCommit)
    ) {
      throw new Error("source commit trust chain mismatch");
    }
    const byPath = new Map(build.json.artifacts.map((entry) => [entry.path, entry]));
    const verify = async (path, bytes) => {
      const entry = byPath.get(path);
      if (!entry || entry.bytes !== bytes.length || entry.sha256 !== await sha256(bytes)) {
        throw new Error(`raw-byte hash mismatch: ${path}`);
      }
    };
    await Promise.all([
      verify("public/artifacts/base-gltf-viewer/viewer.wasm", viewer),
      verify("public/artifacts/base-gltf-viewer/animation-table.i32", animationBytes),
      verify("public/artifacts/base-gltf-viewer/fixture-manifest.json", fixture.bytes),
      verify("public/artifacts/base-gltf-viewer/implementation-contract.v1.json", contract.bytes),
      verify("public/artifacts/base-gltf-viewer/output-manifest.json", outputManifest.bytes),
    ]);
    const gltfText = new TextDecoder("utf-8", { fatal: true }).decode(gltf);
    validateGltfContract(gltfText);
    const fixtureFiles = new Map(fixture.json.files.map((entry) => [entry.path, entry]));
    for (
      const [path, bytes] of [["fixtures/base/graphics-gltf-viewer/Avocado.gltf", gltf], [
        "fixtures/base/graphics-gltf-viewer/Avocado.bin",
        draco,
      ], ["fixtures/base/graphics-gltf-viewer/base-color-64.rgba", texture]]
    ) {
      const entry = fixtureFiles.get(path);
      if (!entry || entry.bytes !== bytes.length || entry.sha256 !== await sha256(bytes)) {
        throw new Error(`fixture hash ${path}`);
      }
    }
    const decoderPath = target === "javascript"
      ? "draco_decoder_gltf.js"
      : "draco_wasm_wrapper_gltf.js";
    const decoderScript = await fetchBytes(`${A}${decoderPath}`);
    await verify(`public/artifacts/base-gltf-viewer/${decoderPath}`, decoderScript);
    const decoderWasm = target === "wasm"
      ? await fetchBytes(`${A}draco_decoder_gltf.wasm`)
      : undefined;
    if (decoderWasm) {
      await verify("public/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm", decoderWasm);
    }
    self.postMessage({ type: "progress", token, phase: `Decoding Draco in ${target}`, value: 35 });
    const decoded = await decode(target, draco, decoderScript, decoderWasm);
    const mesh = quantizeDecodedMesh(decoded);
    if (await sha256(packMesh(mesh)) !== outputManifest.json.input.decodedMeshSha256) {
      throw new Error("decoded mesh oracle mismatch");
    }
    const animation = new Int32Array(
      animationBytes.buffer,
      animationBytes.byteOffset,
      animationBytes.byteLength / 4,
    );
    self.postMessage({
      type: "progress",
      token,
      phase: "Running 600 frames and pick trace",
      value: 60,
    });
    const result = target === "javascript"
      ? runJavaScript(mesh, texture, animation, decoded.metrics)
      : await runWasm(mesh, texture, animation, gltfText, viewer, decoded.metrics);
    const digest = await sha256(result);
    const expectedVariant = outputManifest.json.output.variants[target];
    if (
      digest !== expectedVariant?.sha256 ||
      await sha256(normalizeControlledOutput(result)) !== outputManifest.json.output.semanticSha256
    ) {
      throw new Error("complete output oracle mismatch");
    }
    const header = Array.from(new Uint32Array(result.buffer, result.byteOffset, 28));
    const pixelOffset = (28 + 600 * 8) * 4;
    const preview = result.slice(pixelOffset, pixelOffset + 96 * 96 * 4);
    self.postMessage({
      type: "complete",
      token,
      result: {
        target,
        mode,
        digest,
        sourceCommit: build.json.sourceCommit,
        frames: header[3],
        decodedVertices: header[1],
        decodedIndices: header[2],
        visibleTriangles: header[4],
        pickHits: header[5],
        rasterizedPixels: header[8],
        vertexTransforms: header[9],
        trianglesTested: header[10],
        drawFrames: header[11],
        retainedRasterFrames: header[12],
        pickTests: header[13],
        boundaryCrossings: header[14],
        allocations: header[15],
        decoderAllocations: header[20],
        decoderApiCalls: header[21],
        decoderBoundaryCrossings: header[22],
        engineBoundaryCrossings: header[23],
        engineAllocations: header[24],
        rasterizedFrames: header[25],
        inputBytes: header[16],
        outputBytes: header[17],
        preview,
      },
    }, [preview.buffer]);
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
