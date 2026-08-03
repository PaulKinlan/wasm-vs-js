import {
  generateFixture,
  runJavaScript,
  runWasm,
  sha256Hex,
} from "/benchmarks/base/serialization-protobuf-gateway/workload.js";
const ROOT = "/artifacts/serialization-protobuf-gateway/";
const EXPECTED = {
  "fixture-manifest.json": "34244a6da870bb68e66f7b1e6aea1ecb5bc65bd85b6826d2eabc5f79b891d666",
  "output-manifest.json": "09799b4c9620a35459a38ac1e81f316629702e602a94cc622c85852bdb6bf641",
  "build-manifest.json": "36950c08371d434ab681e0d08e2d11d8ebd695a3df899d46fd7a1cff2f86ca61",
  "serialization-protobuf-gateway.wasm":
    "94e885a121de7fbe69442870b8ce0d7b62456dec37de3d978e18784dbb08a010",
  "implementation-contract.v1.json":
    "705729301e84f4aefb0f9f76081c7f20e15ecbb291fe58f7da6d72b646e44cfc",
  "workload.js": "9307e64445f66a0264d60da8df211d1510379da2263608360c5ff7aaa106e430",
};
async function exactFetch(path, expected) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = await sha256Hex(bytes);
  if (hash !== expected) throw new Error(`${path} hash mismatch`);
  return bytes;
}
self.onmessage = async ({ data }) => {
  const { token, target, mode } = data;
  try {
    const fixture = generateFixture();
    const wasmBytes = await exactFetch(
      `${ROOT}serialization-protobuf-gateway.wasm`,
      EXPECTED["serialization-protobuf-gateway.wasm"],
    );
    let exact = null;
    if (mode === "exact") {
      const records = {};
      for (const name of ["fixture-manifest.json", "output-manifest.json", "build-manifest.json"]) {
        const bytes = await exactFetch(`${ROOT}${name}`, EXPECTED[name]);
        records[name] = JSON.parse(new TextDecoder().decode(bytes));
      }
      await exactFetch(
        "/benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
        EXPECTED["implementation-contract.v1.json"],
      );
      await exactFetch(
        "/benchmarks/base/serialization-protobuf-gateway/workload.js",
        EXPECTED["workload.js"],
      );
      if (await sha256Hex(fixture) !== records["fixture-manifest.json"].sha256) {
        throw new Error("fixture hash mismatch");
      }
      if (
        records["build-manifest.json"].variants["wasm-linear-controlled"].artifactSha256 !==
          EXPECTED["serialization-protobuf-gateway.wasm"]
      ) throw new Error("build relationship mismatch");
      exact = {
        verifiedRawBytes: Object.keys(EXPECTED).length,
        catalogSha256: records["build-manifest.json"].catalogV1.sha256,
      };
    }
    const js = target !== "wasm" ? runJavaScript(fixture) : null;
    const wasm = target !== "javascript" ? await runWasm(fixture, wasmBytes) : null;
    if (js && wasm && js.text !== wasm.text) {
      throw new Error("complete cross-target output mismatch");
    }
    const selected = js ?? wasm;
    const digest = await sha256Hex(selected.bytes);
    if (mode === "exact") {
      const outputBytes = await exactFetch(
        `${ROOT}output-manifest.json`,
        EXPECTED["output-manifest.json"],
      );
      if (JSON.parse(new TextDecoder().decode(outputBytes)).sha256 !== digest) {
        throw new Error("output oracle mismatch");
      }
    }
    self.postMessage({
      token,
      type: "complete",
      result: {
        target,
        mode,
        digest,
        outputBytes: selected.bytes.length,
        counters: { javascript: js?.counters ?? null, wasm: wasm?.counters ?? null },
        exact,
      },
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
