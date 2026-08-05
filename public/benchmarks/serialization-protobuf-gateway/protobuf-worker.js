import {
  generateFixture,
  runJavaScript,
  runWasm,
  sha256Hex,
} from "/benchmarks/base/serialization-protobuf-gateway/workload.js";
const ROOT = "/artifacts/serialization-protobuf-gateway/";
const EXPECTED = {
  "fixture-manifest.json": "4b71993a213860b1972696a7dbc3d8d51a5984e436c06495acd0952682eee421",
  "output-manifest.json": "cc0a8e47fdac91129fa228ee6a87b38aab61a03ecadbc0d82e7e3563bda01adc",
  "build-manifest.json": "25edbc62aa828879e05ac56c8e655be1550b921c2bf594b6b09a33ffc4699e7f",
  "serialization-protobuf-gateway.wasm":
    "fc1aadc10019f26472b9f0d98d51103cdb86941ed32767189d959a244e6fd938",
  "implementation-contract.v1.json":
    "705729301e84f4aefb0f9f76081c7f20e15ecbb291fe58f7da6d72b646e44cfc",
  "workload.js": "f344d7a5e084b792a5354f8edd805893377dd65814ba14528f63b10b153b9214",
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
    // Every advertised mode is a correctness mode. Never report completion
    // unless the complete output matches the immutable output oracle.
    const outputBytes = await exactFetch(
      `${ROOT}output-manifest.json`,
      EXPECTED["output-manifest.json"],
    );
    if (JSON.parse(new TextDecoder().decode(outputBytes)).sha256 !== digest) {
      throw new Error("output oracle mismatch");
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
