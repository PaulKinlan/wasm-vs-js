import {
  instantiateMeshWasm,
  repairMeshJavaScript,
  repairMeshWasm,
} from "/benchmarks/base/cad-mesh-repair/engine.js";
import { WORKER_ANCHORS } from "/worker-anchors.generated.js";

const EXPECTED = Object.freeze({
  ...WORKER_ANCHORS["cad-mesh-repair"],
  output: "9176fd44b472ec6369d880a0f605c9a1a0c518f4fbe55485da399b5718228309", // runtime repair-output digest
});
async function hash(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((x) =>
    x.toString(16).padStart(2, "0")
  ).join("");
}
function base64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
self.onmessage = async ({ data }) => {
  const { token, target } = data;
  try {
    const input = new Uint8Array(
      await (await fetch("/artifacts/cad-mesh-repair-v1/dirty-grid.stl", { cache: "no-store" }))
        .arrayBuffer(),
    );
    if (await hash(input) !== EXPECTED.fixture) throw new Error("fixture hash mismatch");
    let value;
    if (target === "javascript") value = repairMeshJavaScript(input);
    else if (target === "wasm") {
      const wasm = new Uint8Array(
        await (await fetch("/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", { cache: "no-store" }))
          .arrayBuffer(),
      );
      if (await hash(wasm) !== EXPECTED.wasm) throw new Error("Wasm hash mismatch");
      value = repairMeshWasm(await instantiateMeshWasm(wasm), input);
    } else throw new Error("unknown target");
    const outputSha256 = await hash(value.bytes);
    if (outputSha256 !== EXPECTED.output) throw new Error("complete output oracle mismatch");
    self.postMessage({
      type: "complete",
      token,
      result: {
        target,
        outputSha256,
        outputBytes: value.bytes.length,
        outputBase64: base64(value.bytes),
        counters: value.counters,
        invariants: value.invariants,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
