import {
  instantiateMeshWasm,
  repairMeshJavaScript,
  repairMeshWasm,
} from "/benchmarks/base/cad-mesh-repair/engine.js";
const EXPECTED = {
  fixture: "46fa97b0518e96edd1a2bb01d362955f5fae7f9d3e1371c0056ff17ba7d95a91",
  wasm: "b0067130175374850480fba3bed5a6e90f5cc7b9ba2403937023f4f4dced5b48",
  output: "8e5abc003ef884f807630e4cbc0afaa555ef0aa7eacb9a3012ebd3c78590566b",
};
async function hash(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((x) =>
    x.toString(16).padStart(2, "0")
  ).join("");
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
