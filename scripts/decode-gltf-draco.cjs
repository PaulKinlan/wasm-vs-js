const fs = require("node:fs");
const vm = require("node:vm");
const [mode, decoderPath, wasmPath, binPath] = process.argv.slice(2);
if (!new Set(["javascript", "wasm"]).has(mode) || !decoderPath || !binPath) {
  throw new Error("usage: decode-gltf-draco.cjs javascript|wasm decoder.js wasm-or-dash input.bin");
}
globalThis.require = require;
globalThis.__filename = decoderPath;
globalThis.__dirname = require("node:path").dirname(decoderPath);
const source = fs.readFileSync(decoderPath, "utf8") +
  "\n;globalThis.__DracoDecoderModule=DracoDecoderModule;";
vm.runInThisContext(source, { filename: decoderPath });
const wasmBinary = mode === "wasm" ? fs.readFileSync(wasmPath) : null;
let generatedExportCalls = 0;
const config = mode === "wasm"
  ? {
    wasmBinary,
    instantiateWasm(imports, receiveInstance) {
      WebAssembly.instantiate(wasmBinary, imports).then(({ instance }) => {
        const instrumentedExports = {};
        for (const [name, value] of Object.entries(instance.exports)) {
          instrumentedExports[name] = typeof value === "function"
            ? (...args) => {
              generatedExportCalls++;
              return value(...args);
            }
            : value;
        }
        receiveInstance({ exports: instrumentedExports });
      });
      return {};
    },
  }
  : {};
(async () => {
  const module = await globalThis.__DracoDecoderModule(config);
  let apiCalls = 0;
  let wrapperObjects = 0;
  const call = (fn) => {
    apiCalls++;
    return fn();
  };
  const wrapper = (fn, countsAsApiCall = true) => {
    wrapperObjects++;
    return countsAsApiCall ? call(fn) : fn();
  };
  const bytes = new Int8Array(fs.readFileSync(binPath));
  const buffer = wrapper(() => new module.DecoderBuffer());
  call(() => buffer.Init(bytes, bytes.length));
  const decoder = wrapper(() => new module.Decoder());
  if (call(() => decoder.GetEncodedGeometryType(buffer)) !== module.TRIANGULAR_MESH) {
    throw new Error("not Draco mesh");
  }
  const mesh = wrapper(() => new module.Mesh());
  const status = wrapper(() => call(() => decoder.DecodeBufferToMesh(buffer, mesh)), false);
  if (!call(() => status.ok())) throw new Error(status.error_msg());
  const points = call(() => mesh.num_points());
  const faces = call(() => mesh.num_faces());
  const readAttribute = (id, components) => {
    const attribute = wrapper(
      () => call(() => decoder.GetAttributeByUniqueId(mesh, id)),
      false,
    );
    if (!attribute || attribute.ptr === 0) throw new Error(`missing attribute ${id}`);
    const values = wrapper(() => new module.DracoFloat32Array());
    if (!call(() => decoder.GetAttributeFloatForAllPoints(mesh, attribute, values))) {
      throw new Error(`attribute ${id}`);
    }
    const output = new Array(points * components);
    for (let i = 0; i < output.length; i++) output[i] = call(() => values.GetValue(i));
    call(() => module.destroy(values));
    return output;
  };
  const face = wrapper(() => new module.DracoInt32Array());
  const indices = new Array(faces * 3);
  for (let i = 0; i < faces; i++) {
    if (!call(() => decoder.GetFaceFromMesh(mesh, i, face))) throw new Error(`face ${i}`);
    indices[i * 3] = call(() => face.GetValue(0));
    indices[i * 3 + 1] = call(() => face.GetValue(1));
    indices[i * 3 + 2] = call(() => face.GetValue(2));
  }
  call(() => module.destroy(face));
  const positions = readAttribute(3, 3);
  const normals = readAttribute(1, 3);
  const texcoords = readAttribute(0, 2);
  call(() => module.destroy(mesh));
  call(() => module.destroy(decoder));
  call(() => module.destroy(buffer));
  const result = {
    points,
    faces,
    positions,
    normals,
    texcoords,
    indices,
    metrics: {
      allocations: 1 + wrapperObjects + 1 + 4 + (mode === "wasm" ? 3 : 1),
      allocationUnits: {
        moduleFactoryResults: 1,
        generatedWrapperObjects: wrapperObjects,
        inputTypedArrayViews: 1,
        outputArrayAllocations: 4,
        asmJsHeapBackingStores: mode === "javascript" ? 1 : 0,
        wasmModules: mode === "wasm" ? 1 : 0,
        wasmInstances: mode === "wasm" ? 1 : 0,
        wasmMemories: mode === "wasm" ? 1 : 0,
        wasmMemoryBytes: mode === "wasm" ? 16777216 : 0,
      },
      apiCalls,
      wasmBoundaryCrossings: mode === "wasm" ? generatedExportCalls : 0,
      generatedExportCalls: mode === "wasm" ? generatedExportCalls : 0,
    },
  };
  process.stdout.write(JSON.stringify(result));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
