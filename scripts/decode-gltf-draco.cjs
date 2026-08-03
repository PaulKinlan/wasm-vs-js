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
const config = mode === "wasm" ? { wasmBinary: fs.readFileSync(wasmPath) } : {};
(async () => {
  const module = await globalThis.__DracoDecoderModule(config);
  let apiCalls = 0;
  let allocations = 0;
  const call = (fn) => {
    apiCalls++;
    return fn();
  };
  const allocate = (fn) => {
    allocations++;
    return call(fn);
  };
  const bytes = new Int8Array(fs.readFileSync(binPath));
  const buffer = allocate(() => new module.DecoderBuffer());
  call(() => buffer.Init(bytes, bytes.length));
  const decoder = allocate(() => new module.Decoder());
  if (call(() => decoder.GetEncodedGeometryType(buffer)) !== module.TRIANGULAR_MESH) {
    throw new Error("not Draco mesh");
  }
  const mesh = allocate(() => new module.Mesh());
  const status = call(() => decoder.DecodeBufferToMesh(buffer, mesh));
  if (!call(() => status.ok())) throw new Error(status.error_msg());
  const points = call(() => mesh.num_points());
  const faces = call(() => mesh.num_faces());
  const readAttribute = (id, components) => {
    const attribute = call(() => decoder.GetAttributeByUniqueId(mesh, id));
    if (!attribute || attribute.ptr === 0) throw new Error(`missing attribute ${id}`);
    const values = allocate(() => new module.DracoFloat32Array());
    if (!call(() => decoder.GetAttributeFloatForAllPoints(mesh, attribute, values))) {
      throw new Error(`attribute ${id}`);
    }
    allocations++;
    const output = new Array(points * components);
    for (let i = 0; i < output.length; i++) output[i] = call(() => values.GetValue(i));
    call(() => module.destroy(values));
    return output;
  };
  const face = allocate(() => new module.DracoInt32Array());
  allocations++;
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
      allocations,
      apiCalls,
      wasmBoundaryCrossings: mode === "wasm" ? apiCalls : 0,
    },
  };
  process.stdout.write(JSON.stringify(result));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
