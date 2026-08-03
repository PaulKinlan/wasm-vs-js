/* global DracoDecoderModule */
self.onmessage = async (event) => {
  const { mode, bytes, decoderScript, decoderWasm } = event.data ?? {};
  if (
    !new Set(["javascript", "wasm"]).has(mode) || !(bytes instanceof ArrayBuffer) ||
    !(decoderScript instanceof ArrayBuffer) ||
    (mode === "wasm" && !(decoderWasm instanceof ArrayBuffer))
  ) {
    self.postMessage({ type: "error", message: "invalid decoder request" });
    return;
  }
  let scriptUrl;
  try {
    scriptUrl = URL.createObjectURL(new Blob([decoderScript], { type: "text/javascript" }));
    importScripts(scriptUrl);
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
    const module = await DracoDecoderModule(
      mode === "wasm" ? { wasmBinary: new Uint8Array(decoderWasm) } : {},
    );
    const decoder = allocate(() => new module.Decoder());
    const buffer = allocate(() => new module.DecoderBuffer());
    call(() => buffer.Init(new Int8Array(bytes), bytes.byteLength));
    if (call(() => decoder.GetEncodedGeometryType(buffer)) !== module.TRIANGULAR_MESH) {
      throw new Error("not mesh");
    }
    const mesh = allocate(() => new module.Mesh());
    const status = call(() => decoder.DecodeBufferToMesh(buffer, mesh));
    if (!call(() => status.ok())) throw new Error(status.error_msg());
    const points = call(() => mesh.num_points());
    const faces = call(() => mesh.num_faces());
    const attribute = (id, components) => {
      const attr = call(() => decoder.GetAttributeByUniqueId(mesh, id));
      const values = allocate(() => new module.DracoFloat32Array());
      if (!call(() => decoder.GetAttributeFloatForAllPoints(mesh, attr, values))) {
        throw new Error(`attribute ${id}`);
      }
      allocations++;
      const out = new Float32Array(points * components);
      for (let i = 0; i < out.length; i++) out[i] = call(() => values.GetValue(i));
      call(() => module.destroy(values));
      return out;
    };
    const face = allocate(() => new module.DracoInt32Array());
    allocations++;
    const indices = new Uint32Array(faces * 3);
    for (let i = 0; i < faces; i++) {
      if (!call(() => decoder.GetFaceFromMesh(mesh, i, face))) throw new Error(`face ${i}`);
      indices[i * 3] = call(() => face.GetValue(0));
      indices[i * 3 + 1] = call(() => face.GetValue(1));
      indices[i * 3 + 2] = call(() => face.GetValue(2));
    }
    call(() => module.destroy(face));
    const positions = attribute(3, 3), normals = attribute(1, 3), texcoords = attribute(0, 2);
    call(() => module.destroy(mesh));
    call(() => module.destroy(decoder));
    call(() => module.destroy(buffer));
    const metrics = {
      allocations,
      apiCalls,
      wasmBoundaryCrossings: mode === "wasm" ? apiCalls : 0,
    };
    self.postMessage({ type: "decoded", positions, normals, texcoords, indices, metrics }, [
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
  } finally {
    if (scriptUrl) URL.revokeObjectURL(scriptUrl);
  }
};
