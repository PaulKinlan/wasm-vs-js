/* global DracoDecoderModule */
self.onmessage = async (event) => {
  const { mode, bytes } = event.data ?? {};
  if (!new Set(["javascript", "wasm"]).has(mode) || !(bytes instanceof ArrayBuffer)) {
    self.postMessage({ type: "error", message: "invalid decoder request" });
    return;
  }
  try {
    if (mode === "javascript") {
      importScripts("/artifacts/base-gltf-viewer/draco_decoder_gltf.js");
    } else {
      importScripts("/artifacts/base-gltf-viewer/draco_wasm_wrapper_gltf.js");
    }
    const module = await DracoDecoderModule(
      mode === "wasm"
        ? { locateFile: () => "/artifacts/base-gltf-viewer/draco_decoder_gltf.wasm" }
        : {},
    );
    const decoder = new module.Decoder();
    const buffer = new module.DecoderBuffer();
    buffer.Init(new Int8Array(bytes), bytes.byteLength);
    if (decoder.GetEncodedGeometryType(buffer) !== module.TRIANGULAR_MESH) {
      throw new Error("not mesh");
    }
    const mesh = new module.Mesh();
    const status = decoder.DecodeBufferToMesh(buffer, mesh);
    if (!status.ok()) throw new Error(status.error_msg());
    const attribute = (id, components) => {
      const attr = decoder.GetAttributeByUniqueId(mesh, id);
      const values = new module.DracoFloat32Array();
      if (!decoder.GetAttributeFloatForAllPoints(mesh, attr, values)) {
        throw new Error(`attribute ${id}`);
      }
      const out = new Float32Array(mesh.num_points() * components);
      for (let i = 0; i < out.length; i++) out[i] = values.GetValue(i);
      module.destroy(values);
      return out;
    };
    const face = new module.DracoInt32Array();
    const indices = new Uint32Array(mesh.num_faces() * 3);
    for (let i = 0; i < mesh.num_faces(); i++) {
      if (!decoder.GetFaceFromMesh(mesh, i, face)) throw new Error(`face ${i}`);
      indices[i * 3] = face.GetValue(0);
      indices[i * 3 + 1] = face.GetValue(1);
      indices[i * 3 + 2] = face.GetValue(2);
    }
    module.destroy(face);
    const positions = attribute(3, 3), normals = attribute(1, 3), texcoords = attribute(0, 2);
    module.destroy(mesh);
    module.destroy(decoder);
    module.destroy(buffer);
    self.postMessage({ type: "decoded", positions, normals, texcoords, indices }, [
      positions.buffer,
      normals.buffer,
      texcoords.buffer,
      indices.buffer,
    ]);
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
