const fs = require("node:fs");
const vm = require("node:vm");
const [mode, decoderPath, wasmPath, binPath] = process.argv.slice(2);
if (!new Set(["javascript", "wasm"]).has(mode) || !decoderPath || !binPath) {
  throw new Error("usage: decode-gltf-draco.cjs javascript|wasm decoder.js wasm-or-dash input.bin");
}
globalThis.require = require;
globalThis.__filename = decoderPath;
globalThis.__dirname = require("node:path").dirname(decoderPath);
const source = fs.readFileSync(decoderPath, "utf8") + "\n;globalThis.__DracoDecoderModule=DracoDecoderModule;";
vm.runInThisContext(source, { filename: decoderPath });
const config = mode === "wasm" ? { locateFile: () => wasmPath } : {};
(async () => {
  const module = await globalThis.__DracoDecoderModule(config);
  const bytes = new Int8Array(fs.readFileSync(binPath));
  const buffer = new module.DecoderBuffer();
  buffer.Init(bytes, bytes.length);
  const decoder = new module.Decoder();
  if (decoder.GetEncodedGeometryType(buffer) !== module.TRIANGULAR_MESH) throw new Error("not Draco mesh");
  const mesh = new module.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw new Error(status.error_msg());
  const readAttribute = (id, components) => {
    const attribute = decoder.GetAttributeByUniqueId(mesh, id);
    if (!attribute || attribute.ptr === 0) throw new Error(`missing attribute ${id}`);
    const values = new module.DracoFloat32Array();
    if (!decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)) throw new Error(`attribute ${id}`);
    const output = new Array(mesh.num_points() * components);
    for (let i = 0; i < output.length; i++) output[i] = values.GetValue(i);
    module.destroy(values);
    return output;
  };
  const face = new module.DracoInt32Array();
  const indices = new Array(mesh.num_faces() * 3);
  for (let i = 0; i < mesh.num_faces(); i++) {
    if (!decoder.GetFaceFromMesh(mesh, i, face)) throw new Error(`face ${i}`);
    indices[i * 3] = face.GetValue(0); indices[i * 3 + 1] = face.GetValue(1); indices[i * 3 + 2] = face.GetValue(2);
  }
  module.destroy(face);
  const result = {
    points: mesh.num_points(), faces: mesh.num_faces(),
    positions: readAttribute(3, 3), normals: readAttribute(1, 3), texcoords: readAttribute(0, 2), indices,
  };
  module.destroy(mesh); module.destroy(decoder); module.destroy(buffer);
  process.stdout.write(JSON.stringify(result));
})().catch((error) => { console.error(error); process.exit(1); });
